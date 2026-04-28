// Pure scoring rule. Given one row per (date × record_type), produce one
// derived health_scores-shaped row per date. Provider-agnostic: any provider
// whose snapshots can be classified as "sleep" | "readiness" | "activity"
// can feed this function.
//
// Keep this file free of Supabase / I/O imports so it stays trivially
// testable and safely runnable in either client or server contexts.

export type DerivationRecordType = "sleep" | "readiness" | "activity";

export type SnapshotInput = {
  record_date: string;
  record_type: DerivationRecordType;
  score: number | null;
  // Raw provider payload for the snapshot. Optional so existing call sites
  // and tests don't have to construct it; only readiness payloads are read
  // (for HRV-derived stress). Other record types ignore it.
  payload?: Record<string, unknown> | null;
};

export type DerivedDailyScore = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  recovery_score: number | null;
  activity_score: number | null;
  stress_score: number | null;
};

type DayBucket = {
  sleep: number | null;
  recovery: number | null;
  activity: number | null;
  stress: number | null;
};

function meanRounded(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

// Pure stress proxy from Oura's daily_readiness payload. Both contributors
// are 0–100 where higher = better autonomic balance (i.e. less stress), so
// the mean is direction-consistent with the rest of the scoring model
// (higher = healthier). Returns null when neither contributor is numeric —
// we never fabricate a neutral value.
export function deriveStressFromReadiness(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;
  const contributors = (payload as { contributors?: unknown }).contributors;
  if (!contributors || typeof contributors !== "object") return null;
  const c = contributors as Record<string, unknown>;
  const present = [c.hrv_balance, c.resting_heart_rate].filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (present.length === 0) return null;
  return meanRounded(present);
}

export function deriveDailyScores(snapshots: SnapshotInput[]): DerivedDailyScore[] {
  const byDay = new Map<string, DayBucket>();
  for (const s of snapshots) {
    let bucket = byDay.get(s.record_date);
    if (!bucket) {
      bucket = { sleep: null, recovery: null, activity: null, stress: null };
      byDay.set(s.record_date, bucket);
    }
    if (s.record_type === "sleep") bucket.sleep = s.score;
    else if (s.record_type === "readiness") {
      bucket.recovery = s.score;
      bucket.stress = deriveStressFromReadiness(s.payload);
    } else if (s.record_type === "activity") bucket.activity = s.score;
  }

  const out: DerivedDailyScore[] = [];
  for (const [date, r] of byDay) {
    const present = [r.sleep, r.recovery, r.activity, r.stress].filter(
      (v): v is number => typeof v === "number",
    );
    if (present.length === 0) continue;
    out.push({
      score_date: date,
      overall_score: meanRounded(present),
      sleep_score: r.sleep,
      recovery_score: r.recovery,
      activity_score: r.activity,
      stress_score: r.stress,
    });
  }
  return out;
}
