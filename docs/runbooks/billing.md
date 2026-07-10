# Billing runbook

Stripe is our billing provider. Zero SDK dependency — `src/lib/billing/stripe.server.ts` speaks the REST API via `fetch` and implements the exact HMAC-SHA256 scheme Stripe documents for webhook verification. Small surface, no upgrade churn.

This runbook covers Phase 38a (schema + client library + plan mapping). Phase 38b will cover the checkout / portal / webhook route wiring, and Phase 38c will cover the UI CTAs and plan-gating helpers.

## Configure

Set on the main-app Worker (via `wrangler secret put` or your environment provider):

- `STRIPE_SECRET_KEY` — starts with `sk_test_...` or `sk_live_...`. Required for checkout and portal.
- `STRIPE_WEBHOOK_SECRET` — starts with `whsec_...`. Required for verifying incoming webhooks. **Never** hard-code; if the endpoint is public the webhook secret is the ONLY thing distinguishing a real Stripe event from a forged one.
- `STRIPE_PRICE_ID_PRO_MONTHLY` — the Stripe price id for the Pro tier. Rotate by updating this env var; no code change needed.
- `STRIPE_PRICE_ID_FAMILY_MONTHLY` — same, for the Family tier.

Configure the webhook endpoint in the Stripe dashboard once Phase 38b lands:

- URL: `https://<your-domain>/api/billing/webhook`
- Events to subscribe: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- After creating, copy the endpoint's signing secret into `STRIPE_WEBHOOK_SECRET`.

## Data model

Single `subscriptions` table (migration `20260428010000_subscriptions.sql`). One row per user, PK is `user_id`. Populated only by the webhook handler; the client never writes it. Absent row = free tier — this matches the "Start Free" pricing surface.

Key columns:

- `stripe_customer_id` — Stripe's `Customer` id. Indexed for O(log n) webhook lookup.
- `stripe_subscription_id` / `stripe_price_id` — mirror the active subscription's current state.
- `plan_slug` — canonical local identifier (`"pro"` / `"family"`). Decoupled from Stripe price ids so we can rotate prices without renaming plans.
- `status` — Stripe subscription status string. May be `NULL` for the brief window between `checkout.session.completed` and the first `customer.subscription.created`.
- `current_period_end` / `cancel_at_period_end` — surface these in the UI ("your Pro plan renews on X" / "will end on X").

RLS: users can `SELECT` their own row. All writes are service-role only.

## Security notes

- Webhook signature verification lives in `verifyWebhookSignature`. It runs constant-time comparison, tolerates a 5-minute clock skew, accepts rotated (multiple `v1=`) signatures, and never throws — returning `null` on any failure so the caller can reply 400. Every rejection path has a test.
- The Stripe secret key is server-only. Do not expose it to the client — the checkout route is what the client hits, and it holds the secret behind the auth check.
- Log lines never carry the raw signature header or the secret. Payload ids (event id, session id) are safe to log.

## Rotating

- **Secret key**: rotate in the Stripe dashboard, update `STRIPE_SECRET_KEY`, redeploy. In-flight checkouts complete against the old key; new sessions pick up the new key.
- **Webhook secret**: when rotating the endpoint secret in Stripe, add the new secret first and keep the old one enabled during the overlap. `verifyWebhookSignature` accepts multiple `v1=` entries so a webhook signed with the new secret validates as long as `STRIPE_WEBHOOK_SECRET` matches one of them.
- **Price ids**: rotate via env var. Any active subscribers on the old price continue billing at the old price — Stripe honors the price the subscription was created with. New checkouts use the new price. The webhook handler treats an unknown price id as "we know they're paying, we just can't label the plan" — not an outage.
