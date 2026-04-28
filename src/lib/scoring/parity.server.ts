// Server-only. Reads live health_scores and snapshot-derived scores for a
// user/date window, then calls the pure compareScores rule. Does not write
// anything.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { deriveScoresFromSnapshotsForUser } from "./derive.server";
import { compareScores, type ParityReport, type ScoreRow } from "./parity";

export async function compareScoreParityForUser(args: {
  userId: string;
  startDate: string;
  endDate: string;
  provider?: string;
  sampleLimit?: number;
}): Promise<ParityReport> {
  const admin = supabaseAdmin as unknown as { from: (t: string) => any };

  const { data, error } = await admin
    .from("health_scores")
    .select("score_date, overall_score, sleep_score, recovery_score, activity_score, stress_score")
    .eq("user_id", args.userId)
    .gte("score_date", args.startDate)
    .lte("score_date", args.endDate);
  if (error) throw new Error(`health_scores read failed: ${error.message}`);

  const live: ScoreRow[] = (data ?? []) as ScoreRow[];

  const derivedRows = await deriveScoresFromSnapshotsForUser({
    userId: args.userId,
    startDate: args.startDate,
    endDate: args.endDate,
    provider: args.provider,
  });
  // DerivedDailyScore has the same column layout as ScoreRow.
  const derived: ScoreRow[] = derivedRows.map((d) => ({
    score_date: d.score_date,
    overall_score: d.overall_score,
    sleep_score: d.sleep_score,
    recovery_score: d.recovery_score,
    activity_score: d.activity_score,
    stress_score: d.stress_score,
  }));

  return compareScores(live, derived, args.sampleLimit ?? 20);
}
