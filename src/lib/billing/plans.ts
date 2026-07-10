// Canonical local plan identifiers ↔ Stripe price ids.
//
// The map is env-driven so we can rotate prices in Stripe (annual variant,
// promotional pricing, currency splits) without a code deploy. Every price
// id we accept in checkout must be listed here — anything else is rejected
// so a stray query-string can't spin up an unknown-plan subscription.

export type PlanSlug = "pro" | "family";

export const KNOWN_PLANS: readonly PlanSlug[] = ["pro", "family"] as const;

// Env-var lookup: STRIPE_PRICE_ID_<PLAN>_MONTHLY. Extending to _ANNUAL is
// a matter of adding a period param here and to the checkout route — for
// v1 we ship monthly only.
export function priceIdForPlan(plan: PlanSlug): string | null {
  const raw = process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}_MONTHLY`];
  return raw && raw.length > 0 ? raw : null;
}

// Reverse lookup: given a Stripe price id (from a webhook event), which
// local plan does it correspond to? Returns null for prices we don't
// recognize (e.g. legacy prices we've discontinued but still have
// subscribers on). The webhook handler treats "null slug + active status"
// as a valid subscription anyway, so a missing mapping downgrades to
// "we know they're paying, we just can't label the plan" — not an outage.
export function planForPriceId(priceId: string): PlanSlug | null {
  for (const plan of KNOWN_PLANS) {
    if (priceIdForPlan(plan) === priceId) return plan;
  }
  return null;
}

export function isKnownPlan(slug: string): slug is PlanSlug {
  return (KNOWN_PLANS as readonly string[]).includes(slug);
}
