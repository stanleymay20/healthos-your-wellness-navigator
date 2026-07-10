// Creates a Stripe Checkout Session for the authed user and returns its
// hosted URL. The client redirects the browser to that URL; Stripe hosts
// the payment form and posts a webhook back to /api/billing/webhook when
// the session completes.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { logger } from "@/lib/log/logger";
import { captureException } from "@/lib/monitoring/sentry.server";
import { createCheckoutSession, isConfigured } from "@/lib/billing/stripe.server";
import { isKnownPlan, priceIdForPlan, type PlanSlug } from "@/lib/billing/plans";

const ROUTE = "POST /api/billing/checkout";
const RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 60;

type AnyAdmin = { from: (t: string) => any };

export const Route = createFileRoute("/api/billing/checkout")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const limit = enforceRateLimit(`checkout:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
        if (!limit.allowed) {
          return secureJsonResponse(
            { error: "Too many requests" },
            429,
            { "Retry-After": String(limit.retryAfter) },
          );
        }

        if (!isConfigured()) {
          return secureJsonResponse(
            { error: "Billing disabled: STRIPE_SECRET_KEY not configured" },
            503,
          );
        }

        const authHeader = request.headers.get("authorization") ?? "";
        if (!authHeader.startsWith("Bearer ")) {
          return secureJsonResponse({ error: "Missing bearer token" }, 401);
        }
        const token = authHeader.slice("Bearer ".length).trim();
        if (!token) return secureJsonResponse({ error: "Empty bearer token" }, 401);
        const { data: userData, error: authErr } = await supabaseAdmin.auth.getUser(token);
        if (authErr || !userData?.user) {
          return secureJsonResponse({ error: "Invalid token" }, 401);
        }
        const userId = userData.user.id;
        const userEmail = userData.user.email;
        if (!userEmail) {
          return secureJsonResponse({ error: "Account has no email address" }, 400);
        }

        let body: { plan?: unknown };
        try {
          const text = await request.text();
          body = text ? (JSON.parse(text) as typeof body) : {};
        } catch {
          return secureJsonResponse({ error: "Invalid JSON body" }, 400);
        }
        const planInput = typeof body.plan === "string" ? body.plan : "";
        if (!isKnownPlan(planInput)) {
          return secureJsonResponse(
            { error: `Unknown plan: ${planInput || "(missing)"}` },
            400,
          );
        }
        const plan: PlanSlug = planInput;
        const priceId = priceIdForPlan(plan);
        if (!priceId) {
          return secureJsonResponse(
            { error: `Plan ${plan} is not configured on this server` },
            503,
          );
        }

        // Build return URLs from the request's Origin so preview / staging
        // deploys work without a separate env var. The header is
        // controlled by the browser, but even a spoofed origin is harmless
        // here — worst case is the user's own browser gets redirected to
        // a URL they specified.
        const origin = request.headers.get("origin") || new URL(request.url).origin;
        const successUrl = `${origin}/settings?checkout=success`;
        const cancelUrl = `${origin}/pricing?checkout=cancelled`;

        // Reuse an existing Stripe customer id if we have one — avoids
        // creating duplicate Customer objects on second-time checkout.
        const admin = supabaseAdmin as unknown as AnyAdmin;
        const { data: existing } = await admin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle();
        const customerId = (existing?.stripe_customer_id as string | undefined) ?? undefined;

        try {
          const session = await createCheckoutSession({
            userId,
            userEmail,
            priceId,
            successUrl,
            cancelUrl,
            customerId,
          });
          logger.info({
            event: "billing.checkout_created",
            userId,
            plan,
            session_id: session.id,
          });
          return secureJsonResponse({ ok: true, url: session.url });
        } catch (e) {
          const message = (e as Error).message;
          logger.error({ event: "billing.checkout_failed", userId, plan, error: message });
          void captureException(e, {
            route: ROUTE,
            userId,
            event: "billing.checkout_failed",
            tags: { plan },
          });
          return secureJsonResponse({ error: "Could not start checkout" }, 502);
        }
      },
    },
  },
});
