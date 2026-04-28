// Pure comparison between two score row sets (live-written vs derived).
// Provider-agnostic, Supabase-free — runnable on either side of the
// runtime. Used by operational tooling before cutting the live sync
// over to the snapshot-derived path.

export type ScoreRow = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  recovery_score: number | null;
  activity_score: number | null;
  stress_score: number | null;
};

export type MismatchKind = "field_diff" | "live_only" | "derived_only";

export type Mismatch = {
  score_date: string;
  kind: MismatchKind;
  // Only populated when kind === "field_diff".
  fields?: Array<{
    name: keyof Omit<ScoreRow, "score_date">;
    live: number | null;
    derived: number | null;
  }>;
};

export type ParityReport = {
  comparedDays: number;
  matchingDays: number;
  mismatchedDays: number;
  mismatches: Mismatch[];
};

const FIELDS = [
  "overall_score",
  "sleep_score",
  "recovery_score",
  "activity_score",
  "stress_score",
] as const;

function diffFields(live: ScoreRow, derived: ScoreRow): Mismatch["fields"] {
  const out: NonNullable<Mismatch["fields"]> = [];
  for (const name of FIELDS) {
    const a = live[name];
    const b = derived[name];
    if (a !== b) out.push({ name, live: a, derived: b });
  }
  return out.length ? out : undefined;
}

export function compareScores(
  live: ScoreRow[],
  derived: ScoreRow[],
  sampleLimit = 20,
): ParityReport {
  const liveByDay = new Map<string, ScoreRow>();
  for (const r of live) liveByDay.set(r.score_date, r);
  const derivedByDay = new Map<string, ScoreRow>();
  for (const r of derived) derivedByDay.set(r.score_date, r);

  const allDays = new Set<string>([...liveByDay.keys(), ...derivedByDay.keys()]);

  let matching = 0;
  let mismatched = 0;
  const mismatches: Mismatch[] = [];

  for (const day of allDays) {
    const l = liveByDay.get(day);
    const d = derivedByDay.get(day);
    if (l && d) {
      const fields = diffFields(l, d);
      if (!fields) {
        matching++;
      } else {
        mismatched++;
        if (mismatches.length < sampleLimit) {
          mismatches.push({ score_date: day, kind: "field_diff", fields });
        }
      }
    } else if (l && !d) {
      mismatched++;
      if (mismatches.length < sampleLimit) {
        mismatches.push({ score_date: day, kind: "live_only" });
      }
    } else if (!l && d) {
      mismatched++;
      if (mismatches.length < sampleLimit) {
        mismatches.push({ score_date: day, kind: "derived_only" });
      }
    }
  }

  return {
    comparedDays: allDays.size,
    matchingDays: matching,
    mismatchedDays: mismatched,
    mismatches,
  };
}
