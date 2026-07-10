// Creates a Stripe Billing Portal session for the authed user and returns
// its URL. The user manages their subscription (cancel, update card,
// download invoices) on Stripe's hosted portal.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { getClientIp, secureJsonResponse } from "@/lib/api/response";
import { enforceRateLimit } from "@/lib/rate-limit/limiter";
import { logger } from "@/lib/log/logger";
import { captureException } from "@/lib/monitoring/sentry.server";
import { createBillingPortalSession, isConfigured } from "@/lib/billing/stripe.server";

const ROUTE = "POST /api/billing/portal";
const RATE_LIMIT = 10;
const RATE_WINDOW_SEC = 60;

type AnyAdmin = { from: (t: string) => any };

export const Route = createFileRoute("/api/billing/portal")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const callerIp = getClientIp(request);
        const limit = enforceRateLimit(`portal:${callerIp}`, RATE_LIMIT, RATE_WINDOW_SEC);
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

        const admin = supabaseAdmin as unknown as AnyAdmin;
        const { data: sub } = await admin
          .from("subscriptions")
          .select("stripe_customer_id")
          .eq("user_id", userId)
          .maybeSingle();
        const customerId = sub?.stripe_customer_id as string | undefined;
        if (!customerId) {
          // Free-tier users have no Stripe customer yet — the portal has
          // nothing to show. Return 404 so the UI can render "you don't
          // have a subscription" instead of an opaque server error.
          return secureJsonResponse(
            { error: "No active subscription" },
            404,
          );
        }

        const origin = request.headers.get("origin") || new URL(request.url).origin;
        const returnUrl = `${origin}/settings`;

        try {
          const session = await createBillingPortalSession({
            customerId,
            returnUrl,
          });
          logger.info({
            event: "billing.portal_created",
            userId,
            session_id: session.id,
          });
          return secureJsonResponse({ ok: true, url: session.url });
        } catch (e) {
          const message = (e as Error).message;
          logger.error({ event: "billing.portal_failed", userId, error: message });
          void captureException(e, {
            route: ROUTE,
            userId,
            event: "billing.portal_failed",
          });
          return secureJsonResponse({ error: "Could not open billing portal" }, 502);
        }
      },
    },
  },
});
