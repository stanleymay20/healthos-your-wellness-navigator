// Stripe webhook receiver. Public endpoint (no bearer auth) — trust is
// derived entirely from the Stripe-Signature header. Every request is
// verified against STRIPE_WEBHOOK_SECRET before any DB write happens.
//
// Events subscribed:
//   checkout.session.completed         → seed the subscriptions row with the
//                                        Stripe customer + subscription ids.
//   customer.subscription.created      → same row, hydrated with plan / status.
//   customer.subscription.updated      → same row, refreshed.
//   customer.subscription.deleted      → status flipped to "canceled".
//
// Anything else is logged and 200'd — Stripe retries non-2xx, so we only
// non-2xx when the signature is bad (400) or when the DB write actually
// failed (500) and a retry could succeed.

import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { secureJsonResponse } from "@/lib/api/response";
import { logger } from "@/lib/log/logger";
import { captureException } from "@/lib/monitoring/sentry.server";
import { verifyWebhookSignature } from "@/lib/billing/stripe.server";
import { planForPriceId } from "@/lib/billing/plans";

const ROUTE = "POST /api/billing/webhook";

type AnyAdmin = { from: (t: string) => any };

// Narrowed shape of the events we handle. Stripe events are much richer
// — we destructure only the fields we persist so upstream schema drift
// stays isolated to this file.
type StripeSubscription = {
  id: string;
  customer: string;
  status: string;
  current_period_end: number;
  cancel_at_period_end: boolean;
  items: {
    data: Array<{ price: { id: string } }>;
  };
};

type StripeCheckoutSession = {
  id: string;
  customer: string;
  subscription: string | null;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
};

type StripeEvent = {
  id: string;
  type: string;
  data: { object: unknown };
};

export const Route = createFileRoute("/api/billing/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!webhookSecret) {
          logger.error({ event: "billing.webhook_disabled" });
          return secureJsonResponse(
            { error: "Webhook disabled: STRIPE_WEBHOOK_SECRET not configured" },
            503,
          );
        }

        // MUST use raw body for signature verification — JSON.parse then
        // re-stringify would change whitespace and break the HMAC.
        const rawBody = await request.text();
        const sigHeader = request.headers.get("stripe-signature");
        const verified = await verifyWebhookSignature(rawBody, sigHeader, webhookSecret);
        if (!verified) {
          // Do NOT log the raw signature or body — this is either a bug
          // in Stripe (extremely rare) or a forgery attempt; either way
          // storing the payload gains us nothing and risks leaking real
          // signatures if the log drain is compromised.
          logger.warn({ event: "billing.webhook_bad_signature" });
          return secureJsonResponse({ error: "Bad signature" }, 400);
        }

        const event = verified.event as unknown as StripeEvent;
        const type = event.type;
        logger.info({
          event: "billing.webhook_received",
          stripe_event_id: event.id,
          stripe_event_type: type,
        });

        try {
          if (type === "checkout.session.completed") {
            await handleCheckoutCompleted(event.data.object as StripeCheckoutSession);
          } else if (
            type === "customer.subscription.created" ||
            type === "customer.subscription.updated"
          ) {
            await handleSubscriptionUpsert(event.data.object as StripeSubscription);
          } else if (type === "customer.subscription.deleted") {
            await handleSubscriptionDeleted(event.data.object as StripeSubscription);
          } else {
            // Not one we care about — 200 anyway so Stripe stops retrying.
            logger.info({
              event: "billing.webhook_ignored",
              stripe_event_type: type,
            });
          }
          return secureJsonResponse({ received: true });
        } catch (e) {
          const message = (e as Error).message;
          logger.error({
            event: "billing.webhook_failed",
            stripe_event_id: event.id,
            stripe_event_type: type,
            error: message,
          });
          void captureException(e, {
            route: ROUTE,
            event: "billing.webhook_failed",
            tags: { stripe_event_type: type },
            extra: { stripe_event_id: event.id },
          });
          // 500 → Stripe retries. That's what we want for a transient DB
          // failure. Persistent failures show up as repeated event ids in
          // the log drain.
          return secureJsonResponse({ error: "Handler failed" }, 500);
        }
      },
    },
  },
});

async function handleCheckoutCompleted(session: StripeCheckoutSession): Promise<void> {
  // checkout.session.completed fires ONCE right after payment. We seed
  // the row here with the customer + subscription ids; the follow-up
  // customer.subscription.created event fills in status/period_end/etc.
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  if (!userId) {
    throw new Error("checkout session missing client_reference_id / metadata.user_id");
  }
  const admin = supabaseAdmin as unknown as AnyAdmin;
  const { error } = await admin.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
    },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`subscriptions upsert failed: ${error.message}`);
}

async function handleSubscriptionUpsert(sub: StripeSubscription): Promise<void> {
  const priceId = sub.items.data[0]?.price.id ?? null;
  const planSlug = priceId ? planForPriceId(priceId) : null;
  const admin = supabaseAdmin as unknown as AnyAdmin;
  // Look up the user by stripe_customer_id — the row was seeded by
  // handleCheckoutCompleted, so this find should always succeed for a
  // legit event. If it doesn't (event before checkout completion in the
  // rare race), throw so Stripe retries after the seed lands.
  const { data: existing, error: findErr } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", sub.customer)
    .maybeSingle();
  if (findErr) throw new Error(`subscriptions lookup failed: ${findErr.message}`);
  if (!existing) {
    throw new Error(`no subscriptions row for customer ${sub.customer} yet`);
  }

  const { error: updErr } = await admin
    .from("subscriptions")
    .update({
      stripe_subscription_id: sub.id,
      stripe_price_id: priceId,
      plan_slug: planSlug,
      status: sub.status,
      current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      cancel_at_period_end: sub.cancel_at_period_end,
    })
    .eq("user_id", existing.user_id);
  if (updErr) throw new Error(`subscriptions update failed: ${updErr.message}`);
}

async function handleSubscriptionDeleted(sub: StripeSubscription): Promise<void> {
  const admin = supabaseAdmin as unknown as AnyAdmin;
  const { error } = await admin
    .from("subscriptions")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
    })
    .eq("stripe_customer_id", sub.customer);
  if (error) throw new Error(`subscriptions cancel failed: ${error.message}`);
}
