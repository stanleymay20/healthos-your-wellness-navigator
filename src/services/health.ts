import { supabase } from "@/integrations/supabase/client";

export type HealthLog = {
  id: string;
  user_id: string;
  log_date: string;
  sleep_hours: number | null;
  energy_level: number | null;
  stress_level: number | null;
  water_liters: number | null;
  meals_note: string | null;
  exercise_minutes: number | null;
  meditation_minutes: number | null;
  symptoms_note: string | null;
  mood: string | null;
  created_at: string;
};

export type HealthScore = {
  id: string;
  user_id: string;
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  activity_score: number | null;
  stress_score: number | null;
  recovery_score: number | null;
  nutrition_score: number | null;
  created_at: string;
};

export type Insight = {
  id: string;
  title: string;
  description: string;
  type: "positive" | "warning" | "neutral";
  severity: "low" | "medium" | "high";
  created_at: string;
};

export type Recommendation = {
  id: string;
  title: string;
  description: string;
  category: "sleep" | "activity" | "stress" | "nutrition" | "recovery" | "mindfulness";
  priority: "low" | "medium" | "high";
  status: "pending" | "done" | "snoozed" | "dismissed";
  generated_for_date: string;
  created_at: string;
  completed_at: string | null;
};

export type NewLog = Omit<HealthLog, "id" | "user_id" | "created_at" | "log_date"> & {
  log_date?: string;
};

export async function listLogs(limit = 30): Promise<HealthLog[]> {
  const { data, error } = await supabase
    .from("health_logs")
    .select("*")
    .order("log_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HealthLog[];
}

export async function createLog(input: NewLog) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const payload = {
    user_id: userId,
    log_date: input.log_date ?? new Date().toISOString().slice(0, 10),
    sleep_hours: input.sleep_hours,
    energy_level: input.energy_level,
    stress_level: input.stress_level,
    water_liters: input.water_liters,
    meals_note: input.meals_note,
    exercise_minutes: input.exercise_minutes,
    meditation_minutes: input.meditation_minutes,
    symptoms_note: input.symptoms_note,
    mood: input.mood,
  };
  const { data, error } = await supabase.from("health_logs").insert(payload).select().single();
  if (error) throw error;
  return data as HealthLog;
}

export async function listScores(limit = 30): Promise<HealthScore[]> {
  const { data, error } = await supabase
    .from("health_scores")
    .select("*")
    .order("score_date", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as HealthScore[];
}

export async function getLatestScore(): Promise<HealthScore | null> {
  const { data, error } = await supabase
    .from("health_scores")
    .select("*")
    .order("score_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as HealthScore | null;
}

export async function upsertScore(score: Omit<HealthScore, "id" | "user_id" | "created_at">) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");
  const { data, error } = await supabase
    .from("health_scores")
    .upsert({ ...score, user_id: userId }, { onConflict: "user_id,score_date" })
    .select()
    .single();
  if (error) throw error;
  return data as HealthScore;
}

export async function listInsights(limit = 10): Promise<Insight[]> {
  const { data, error } = await supabase
    .from("insights")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Insight[];
}

export async function replaceTodaysInsights(items: Array<Omit<Insight, "id" | "created_at">>) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  // Clear today's auto-generated insights first
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from("insights")
    .delete()
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00.000Z`);

  if (items.length === 0) return [];
  const rows = items.map((i) => ({ ...i, user_id: userId }));
  const { data, error } = await supabase.from("insights").insert(rows).select();
  if (error) throw error;
  return data as Insight[];
}

export async function listRecommendations(limit = 20): Promise<Recommendation[]> {
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Recommendation[];
}

export async function listTodaysRecommendations(): Promise<Recommendation[]> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("recommendations")
    .select("*")
    .eq("generated_for_date", today)
    .order("priority", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Recommendation[];
}

export async function replaceTodaysRecommendations(
  items: Array<Omit<Recommendation, "id" | "created_at" | "completed_at" | "status" | "generated_for_date">>,
) {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error("Not authenticated");

  const today = new Date().toISOString().slice(0, 10);
  // Only clear pending recommendations for today (preserve user actions)
  await supabase
    .from("recommendations")
    .delete()
    .eq("user_id", userId)
    .eq("generated_for_date", today)
    .eq("status", "pending");

  if (items.length === 0) return [];
  const rows = items.map((i) => ({
    ...i,
    user_id: userId,
    generated_for_date: today,
    status: "pending" as const,
  }));
  const { data, error } = await supabase.from("recommendations").insert(rows).select();
  if (error) throw error;
  return data as Recommendation[];
}

export async function updateRecommendationStatus(
  id: string,
  status: Recommendation["status"],
) {
  const completed_at = status === "done" ? new Date().toISOString() : null;
  const { error } = await supabase
    .from("recommendations")
    .update({ status, completed_at })
    .eq("id", id);
  if (error) throw error;
}
