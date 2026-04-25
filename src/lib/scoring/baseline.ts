// Pure adaptive-baseline math. No DB, no I/O — runnable in either client
// or server contexts. Inputs are score rows ordered newest-first (matches
// listScores ordering). The "baseline" is computed from the days BEFORE
// the latest, so the latest day's deviation is meaningful.

export type BaselineScoreInput = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  recovery_score: number | null;
  activity_score: number | null;
};

export type DimensionStats = { mean: number; stddev: number; n: number };

export type Baseline = {
  windowDays: number; // number of prior days that contributed to overall
  overall: DimensionStats;
  sleep: DimensionStats | null;
  recovery: DimensionStats | null;
  activity: DimensionStats | null;
};

export type Deviation = {
  overall: number;
  sleep: number | null;
  recovery: number | null;
  activity: number | null;
};

export type RiskLevel = "low" | "elevated" | "high";
export type RiskDimension = "overall" | "sleep" | "recovery" | "activity";

export type RiskReport = {
  level: RiskLevel;
  drivers: Array<{ dimension: RiskDimension; z: number }>;
  summary: string;
};

// Minimum days required before a baseline is meaningful. Below this,
// callers should fall back to fixed-threshold logic.
const MIN_BASELINE_DAYS = 5;
// Cap the baseline window so very long histories don't drown out recent
// regime shifts.
const MAX_BASELINE_DAYS = 14;
// Floor stddev to avoid divide-by-near-zero when recent days are flat.
const STDDEV_FLOOR = 3;

function statsOf(values: number[]): DimensionStats | null {
  if (values.length === 0) return null;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const stddev = Math.max(Math.sqrt(variance), STDDEV_FLOOR);
  return { mean, stddev, n };
}

// scores must be sorted newest-first (scores[0] = latest day).
export function computeBaseline(scores: BaselineScoreInput[]): Baseline | null {
  if (scores.length < MIN_BASELINE_DAYS + 1) return null;
  const window = scores.slice(1, 1 + MAX_BASELINE_DAYS);

  const overallStats = statsOf(window.map((s) => s.overall_score));
  if (!overallStats || overallStats.n < MIN_BASELINE_DAYS) return null;

  const presentNumbers = (key: "sleep_score" | "recovery_score" | "activity_score") =>
    window.map((s) => s[key]).filter((v): v is number => typeof v === "number");

  const sleepStats = statsOf(presentNumbers("sleep_score"));
  const recoveryStats = statsOf(presentNumbers("recovery_score"));
  const activityStats = statsOf(presentNumbers("activity_score"));

  return {
    windowDays: overallStats.n,
    overall: overallStats,
    sleep: sleepStats && sleepStats.n >= MIN_BASELINE_DAYS ? sleepStats : null,
    recovery: recoveryStats && recoveryStats.n >= MIN_BASELINE_DAYS ? recoveryStats : null,
    activity: activityStats && activityStats.n >= MIN_BASELINE_DAYS ? activityStats : null,
  };
}

function zOf(value: number | null, stats: DimensionStats | null): number | null {
  if (value == null || !stats) return null;
  return (value - stats.mean) / stats.stddev;
}

export function computeDeviation(
  latest: BaselineScoreInput,
  baseline: Baseline,
): Deviation {
  return {
    overall: (latest.overall_score - baseline.overall.mean) / baseline.overall.stddev,
    sleep: zOf(latest.sleep_score, baseline.sleep),
    recovery: zOf(latest.recovery_score, baseline.recovery),
    activity: zOf(latest.activity_score, baseline.activity),
  };
}

const ELEVATED_Z = -1.0;
const HIGH_Z = -2.0;
const HIGH_OVERALL_Z = -1.5;

export function computeRisk(deviation: Deviation): RiskReport {
  const entries: Array<{ dimension: RiskDimension; z: number }> = [];
  for (const dim of ["overall", "sleep", "recovery", "activity"] as const) {
    const z = deviation[dim];
    if (z != null) entries.push({ dimension: dim, z });
  }

  const drivers = entries
    .filter((e) => e.z <= ELEVATED_Z)
    .sort((a, b) => a.z - b.z);

  let level: RiskLevel = "low";
  if (entries.some((e) => e.z <= HIGH_Z) || deviation.overall <= HIGH_OVERALL_Z) {
    level = "high";
  } else if (drivers.length > 0) {
    level = "elevated";
  }

  let summary: string;
  if (level === "low") {
    summary = "Your signals are in line with your recent baseline.";
  } else {
    const top = drivers[0];
    summary = `${capitalize(top.dimension)} is ${Math.abs(top.z).toFixed(1)}σ below your recent baseline.`;
  }

  return { level, drivers, summary };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
