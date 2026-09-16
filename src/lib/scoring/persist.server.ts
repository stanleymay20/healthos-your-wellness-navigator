// Server-only. Writes derived scores into health_scores. Intentionally
// independent of the live Oura sync path so it can be invoked on demand
// (controlled backfill, future cutover) without touching the sync code.
//
// The live sync still authoritatively writes health_scores inline; because
// the pure derivation rule is shared (src/lib/scoring/derive.ts) and the
// upsert key is the same (user_id, score_date), running this writer over
// the same snapshots is idempotent and produces identical rows.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { DerivedDailyScore } from "./derive";
import { deriveScoresFromSnapshotsForUser } from "./derive.server";

export type PersistOutcome = { daysWritten: number };

export async function persistDerivedScores(
  userId: string,
  rows: DerivedDailyScore[],
): Promise<PersistOutcome> {
  if (rows.length === 0) return { daysWritten: 0 };

  const payload = rows.map((d) => ({
    user_id: userId,
    score_date: d.score_date,
    overall_score: d.overall_score,
    sleep_score: d.sleep_score,
    recovery_score: d.recovery_score,
    activity_score: d.activity_score,
  }));

  const { error } = await supabaseAdmin
    .from("health_scores")
    .upsert(payload, { onConflict: "user_id,score_date" });
  if (error) throw new Error(`health_scores upsert failed: ${error.message}`);

  return { daysWritten: rows.length };
}

// Convenience wrapper: read snapshots for a window, derive, persist.
// Callers supply the window (and optional provider). No date defaults here
// — the foundation is explicit; later phases pick the operational window
// (e.g., a backfill admin tool or a nightly cron).
export async function backfillScoresFromSnapshots(args: {
  userId: string;
  startDate: string;
  endDate: string;
  provider?: string;
}): Promise<PersistOutcome> {
  const derived = await deriveScoresFromSnapshotsForUser(args);
  return persistDerivedScores(args.userId, derived);
}
