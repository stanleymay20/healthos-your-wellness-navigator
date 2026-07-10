// Client + server safe reader for a user's plan. Reads the subscriptions
// table via the Supabase client (RLS-authed as the user), returning a
// derived shape that the UI can render directly. Never writes — every
// change to a subscription happens through the Stripe webhook path.

import { supabase } from "@/integrations/supabase/client";
import {
  derivePlan,
  FREE_PLAN,
  type SubscriptionRow,
  type UserPlan,
} from "@/lib/billing/derive-plan";

// Re-export the shared shapes so callers only need this one import.
export { derivePlan, FREE_PLAN } from "@/lib/billing/derive-plan";
export type { ActivePlan, SubscriptionRow, UserPlan } from "@/lib/billing/derive-plan";

export async function getUserPlan(userId: string): Promise<UserPlan> {
  // subscriptions was added in migration 20260428010000 but the generated
  // Supabase types haven't been regenerated yet, so cast to bypass the
  // typed client's whitelist. When types are regenerated, drop the cast.
  const anyClient = supabase as unknown as { from: (t: string) => any };
  const { data, error } = await anyClient
    .from("subscriptions")
    .select("plan_slug, status, current_period_end, cancel_at_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return FREE_PLAN;
  return derivePlan(data as SubscriptionRow);
}
