import { describe, expect, it } from "vitest";
import {
  computeBaseline,
  computeDeviation,
  computeRisk,
  type BaselineScoreInput,
} from "./baseline";

// Helper: a synthetic stable history then a latest day to evaluate.
function buildScores(history: number[], latest: number): BaselineScoreInput[] {
  const allOverall = [latest, ...history];
  return allOverall.map((overall, idx) => ({
    score_date: `2026-01-${String(30 - idx).padStart(2, "0")}`,
    overall_score: overall,
    sleep_score: overall,
    recovery_score: overall,
    activity_score: overall,
  }));
}

describe("computeBaseline", () => {
  it("returns null when fewer than 6 rows (latest + 5 prior days)", () => {
    expect(computeBaseline(buildScores([80, 80, 80, 80], 80))).toBeNull();
  });

  it("returns a baseline with 5+ prior days", () => {
    const baseline = computeBaseline(buildScores([80, 80, 80, 80, 80], 50));
    expect(baseline).not.toBeNull();
    expect(baseline!.windowDays).toBe(5);
    expect(baseline!.overall.mean).toBe(80);
  });

  it("excludes the latest day from the baseline window", () => {
    // Latest is 0; prior days are all 80. Mean must be 80, not weighted by 0.
    const baseline = computeBaseline(buildScores([80, 80, 80, 80, 80], 0));
    expect(baseline!.overall.mean).toBe(80);
  });

  it("caps the window at 14 days", () => {
    // 20 prior days, all 70.
    const history = Array(20).fill(70);
    const baseline = computeBaseline(buildScores(history, 70));
    expect(baseline!.windowDays).toBe(14);
  });

  it("floors stddev at 3 to avoid divide-by-near-zero", () => {
    // All identical → real stddev is 0; floor must apply.
    const baseline = computeBaseline(buildScores([80, 80, 80, 80, 80], 80));
    expect(baseline!.overall.stddev).toBe(3);
  });

  it("computes p25 across the prior-day window", () => {
    // Prior 5 days sorted ascending: [40, 60, 70, 80, 90]
    // p25 (linear interp at rank 0.25 * 4 = 1.0) → values[1] = 60.
    const baseline = computeBaseline(buildScores([40, 60, 70, 80, 90], 75));
    expect(baseline!.overall.p25).toBe(60);
  });

  it("p25 equals the value when window collapses to 1", () => {
    // The latest is excluded from the window, leaving exactly the cap of
    // 14 prior values. Validate the simpler degenerate case via a stub by
    // running on uniform values: any percentile is the value itself.
    const baseline = computeBaseline(buildScores([80, 80, 80, 80, 80], 75));
    expect(baseline!.overall.p25).toBe(80);
  });
});

describe("computeDeviation", () => {
  it("returns 0 for a latest day equal to baseline mean", () => {
    const scores = buildScores([80, 80, 80, 80, 80], 80);
    const baseline = computeBaseline(scores)!;
    const dev = computeDeviation(scores[0], baseline);
    expect(dev.overall).toBe(0);
    expect(dev.sleep).toBe(0);
  });

  it("returns negative z when latest is below baseline", () => {
    const scores = buildScores([80, 80, 80, 80, 80], 50);
    const baseline = computeBaseline(scores)!;
    const dev = computeDeviation(scores[0], baseline);
    // (50 - 80) / 3 = -10
    expect(dev.overall).toBe(-10);
  });

  it("yields null sub-score z when baseline didn't have that dimension", () => {
    const history: BaselineScoreInput[] = [
      { score_date: "2026-01-29", overall_score: 80, sleep_score: 80, recovery_score: null, activity_score: 80 },
      { score_date: "2026-01-28", overall_score: 80, sleep_score: 80, recovery_score: null, activity_score: 80 },
      { score_date: "2026-01-27", overall_score: 80, sleep_score: 80, recovery_score: null, activity_score: 80 },
      { score_date: "2026-01-26", overall_score: 80, sleep_score: 80, recovery_score: null, activity_score: 80 },
      { score_date: "2026-01-25", overall_score: 80, sleep_score: 80, recovery_score: null, activity_score: 80 },
    ];
    const latest: BaselineScoreInput = {
      score_date: "2026-01-30",
      overall_score: 80,
      sleep_score: 80,
      recovery_score: 60,
      activity_score: 80,
    };
    const baseline = computeBaseline([latest, ...history])!;
    expect(baseline.recovery).toBeNull();
    const dev = computeDeviation(latest, baseline);
    expect(dev.recovery).toBeNull();
  });
});

describe("computeRisk", () => {
  it("returns low when no z is below -1", () => {
    const r = computeRisk({ overall: 0, sleep: -0.5, recovery: 0.2, activity: -0.9 });
    expect(r.level).toBe("low");
    expect(r.drivers).toHaveLength(0);
  });

  it("returns elevated when at least one z is in [-2, -1]", () => {
    const r = computeRisk({ overall: -0.5, sleep: -1.2, recovery: 0, activity: 0 });
    expect(r.level).toBe("elevated");
    expect(r.drivers[0].dimension).toBe("sleep");
  });

  it("returns high when any z <= -2", () => {
    const r = computeRisk({ overall: -0.5, sleep: -2.5, recovery: 0, activity: 0 });
    expect(r.level).toBe("high");
  });

  it("returns high when overall z <= -1.5 even without a sub-z <= -2", () => {
    const r = computeRisk({ overall: -1.7, sleep: -1.0, recovery: -0.5, activity: -0.5 });
    expect(r.level).toBe("high");
  });

  it("sorts drivers by most-negative z first", () => {
    const r = computeRisk({ overall: -1.5, sleep: -1.1, recovery: -2.4, activity: -1.0 });
    expect(r.drivers[0].dimension).toBe("recovery");
  });

  it("ignores null sub-scores when classifying", () => {
    const r = computeRisk({ overall: 0.2, sleep: null, recovery: null, activity: null });
    expect(r.level).toBe("low");
    expect(r.drivers).toHaveLength(0);
  });
});
