import { describe, expect, it } from "vitest";
import { generateInsights, type InsightScoreInput } from "./generate";
import type { Baseline, Deviation } from "@/lib/scoring/baseline";

const score = (
  date: string,
  overall: number,
  sleep: number | null = overall,
  activity: number | null = overall,
): InsightScoreInput => ({
  score_date: date,
  overall_score: overall,
  sleep_score: sleep,
  activity_score: activity,
});

// A minimal stub baseline. Numbers don't matter for the generator — only
// the deviation z-scores it consumes do.
const dummyStats = { mean: 70, stddev: 5, n: 7, p25: 65 };
const stubBaseline: Baseline = {
  windowDays: 7,
  overall: dummyStats,
  sleep: dummyStats,
  recovery: dummyStats,
  activity: dummyStats,
};

describe("generateInsights", () => {
  it("returns [] when no scores", () => {
    expect(generateInsights([])).toEqual([]);
  });

  it("emits the recovery-low insight when overall < 50 and no baseline", () => {
    const out = generateInsights([score("2026-01-01", 40, 70, 70)]);
    expect(out[0]).toMatch(/recovery is low/i);
  });

  it("emits the day-over-day improvement insight when latest > previous", () => {
    const out = generateInsights([
      score("2026-01-02", 80, 75, 75),
      score("2026-01-01", 70, 75, 75),
    ]);
    expect(out.some((s) => /improving/i.test(s))).toBe(true);
  });

  it("caps output at 2 insights", () => {
    const out = generateInsights([
      score("2026-01-02", 40, 50, 40),
      score("2026-01-01", 30, 50, 40),
    ]);
    expect(out.length).toBeLessThanOrEqual(2);
  });

  it("emits a baseline-aware sleep insight when deviation.sleep <= -1.5", () => {
    const deviation: Deviation = { overall: -0.5, sleep: -1.7, recovery: 0, activity: 0 };
    const out = generateInsights(
      [score("2026-01-01", 60, 50, 70)],
      { baseline: stubBaseline, deviation },
    );
    expect(out[0]).toMatch(/sleep is .*1\.7/i);
    expect(out[0]).toMatch(/baseline/i);
  });

  it("suppresses the fixed-threshold sleep rule when baseline-aware sleep already fired", () => {
    // sleep_score < 60 would normally trigger the fixed rule, but baseline-
    // aware sleep already covered the same dimension.
    const deviation: Deviation = { overall: -0.5, sleep: -1.7, recovery: 0, activity: 0 };
    const out = generateInsights(
      [score("2026-01-01", 60, 50, 70)],
      { baseline: stubBaseline, deviation },
    );
    const fixedSleepFired = out.some((s) => /Your sleep quality dropped/i.test(s));
    expect(fixedSleepFired).toBe(false);
  });

  it("falls through to fixed-threshold rules when no deviation provided", () => {
    const out = generateInsights([score("2026-01-01", 60, 50, 70)]);
    expect(out.some((s) => /Your sleep quality dropped/i.test(s))).toBe(true);
  });

  it("emits the above-baseline momentum insight when deviation.overall >= 1.5", () => {
    const deviation: Deviation = { overall: 1.7, sleep: 0, recovery: 0, activity: 0 };
    const out = generateInsights(
      [score("2026-01-01", 90, 90, 90)],
      { baseline: stubBaseline, deviation },
    );
    expect(out.some((s) => /above your recent baseline/i.test(s))).toBe(true);
  });

  it("uses the user's p25 as the sleep fallback cut when a baseline exists", () => {
    // High-baseline user: sleep p25 = 78. Latest sleep_score 75 is above
    // the legacy 60 cut but below the user's bottom quartile, so the
    // fallback should fire even though 75 isn't "objectively low".
    const highBaselineSleep = { mean: 82, stddev: 4, n: 7, p25: 78 };
    const baseline: Baseline = {
      windowDays: 7,
      overall: { mean: 82, stddev: 4, n: 7, p25: 78 },
      sleep: highBaselineSleep,
      recovery: { mean: 82, stddev: 4, n: 7, p25: 78 },
      activity: { mean: 82, stddev: 4, n: 7, p25: 78 },
    };
    // Deviation must NOT cross the σ rule for sleep, otherwise the
    // baseline-aware insight fires and suppresses the fallback.
    const deviation: Deviation = { overall: -0.5, sleep: -0.7, recovery: 0, activity: 0 };
    const out = generateInsights(
      [score("2026-01-01", 80, 75, 80)],
      { baseline, deviation },
    );
    expect(out.some((s) => /Your sleep quality dropped/i.test(s))).toBe(true);
  });

  it("does not fire the sleep fallback for a low-baseline user above their p25", () => {
    // Low-baseline user: sleep p25 = 45. Latest sleep_score 55 is below
    // the legacy 60 cut (would have fired before) but above the user's
    // own bottom quartile, so the fallback now stays quiet.
    const lowBaselineSleep = { mean: 50, stddev: 5, n: 7, p25: 45 };
    const baseline: Baseline = {
      windowDays: 7,
      overall: { mean: 50, stddev: 5, n: 7, p25: 45 },
      sleep: lowBaselineSleep,
      recovery: { mean: 50, stddev: 5, n: 7, p25: 45 },
      activity: { mean: 50, stddev: 5, n: 7, p25: 45 },
    };
    const deviation: Deviation = { overall: 1.0, sleep: 1.0, recovery: 0, activity: 0 };
    const out = generateInsights(
      [score("2026-01-01", 55, 55, 55)],
      { baseline, deviation },
    );
    expect(out.some((s) => /Your sleep quality dropped/i.test(s))).toBe(false);
  });

  it("falls back to the legacy 60 cut for sleep when no baseline (cold start)", () => {
    // sleep_score 55 < 60 → fires the legacy fallback as before.
    const out = generateInsights([score("2026-01-01", 70, 55, 70)]);
    expect(out.some((s) => /Your sleep quality dropped/i.test(s))).toBe(true);
  });
});
