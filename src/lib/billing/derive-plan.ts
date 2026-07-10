// Pure derivation from a subscriptions-row shape → the UserPlan the UI
// consumes. Lives in src/lib/billing/ (not src/services/) so vitest can
// exercise it directly — src/services/* imports the Supabase client,
// which pulls in env-var checks at import time and doesn't fit the
// current test harness.

import { isKnownPlan, type PlanSlug } from "./plans";

export type ActivePlan = "free" | PlanSlug;

// Stripe subscription statuses that count as "the user has access
// today." trialing counts because Stripe hasn't billed yet but the
// subscription is live. past_due keeps access while the retry logic
// runs; the UI can surface a "please update your card" banner off the
// cancel_at_period_end flag.
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type SubscriptionRow = {
  plan_slug: string | null;
  status: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
};

export type UserPlan = {
  plan: ActivePlan;
  active: boolean;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  // True if we found a subscription row for the user (paid at some point);
  // false if the free-tier fallback applied.
  hasBillingRecord: boolean;
};

export const FREE_PLAN: UserPlan = {
  plan: "free",
  active: true,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  hasBillingRecord: false,
};

export function derivePlan(row: SubscriptionRow): UserPlan {
  const active = !!row.status && ACTIVE_STATUSES.has(row.status);
  const plan: ActivePlan =
    active && row.plan_slug && isKnownPlan(row.plan_slug) ? row.plan_slug : "free";
  return {
    plan,
    active,
    currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : null,
    cancelAtPeriodEnd: !!row.cancel_at_period_end,
    hasBillingRecord: true,
  };
}
