import { supabase } from "@/integrations/supabase/client";

export type OnboardingStatus = {
  fullName: string;
  healthGoal: string;
  complete: boolean;
};

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  const [{ data: profile }, { data: prefs }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    supabase.from("user_preferences").select("health_goal").eq("user_id", userId).maybeSingle(),
  ]);
  const fullName = profile?.full_name?.trim() ?? "";
  const healthGoal = prefs?.health_goal?.trim() ?? "";
  return { fullName, healthGoal, complete: !!fullName && !!healthGoal };
}
