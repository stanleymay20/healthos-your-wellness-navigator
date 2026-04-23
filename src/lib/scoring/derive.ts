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
};

export type DerivedDailyScore = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  recovery_score: number | null;
  activity_score: number | null;
};

type DayBucket = {
  sleep: number | null;
  recovery: number | null;
  activity: number | null;
};

function meanRounded(values: number[]): number {
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

export function deriveDailyScores(snapshots: SnapshotInput[]): DerivedDailyScore[] {
  const byDay = new Map<string, DayBucket>();
  for (const s of snapshots) {
    let bucket = byDay.get(s.record_date);
    if (!bucket) {
      bucket = { sleep: null, recovery: null, activity: null };
      byDay.set(s.record_date, bucket);
    }
    if (s.record_type === "sleep") bucket.sleep = s.score;
    else if (s.record_type === "readiness") bucket.recovery = s.score;
    else if (s.record_type === "activity") bucket.activity = s.score;
  }

  const out: DerivedDailyScore[] = [];
  for (const [date, r] of byDay) {
    const present = [r.sleep, r.recovery, r.activity].filter(
      (v): v is number => typeof v === "number",
    );
    if (present.length === 0) continue;
    out.push({
      score_date: date,
      overall_score: meanRounded(present),
      sleep_score: r.sleep,
      recovery_score: r.recovery,
      activity_score: r.activity,
    });
  }
  return out;
}
