import { describe, expect, it } from "vitest";
import {
  deriveDailyScores,
  deriveStressFromReadiness,
  type SnapshotInput,
} from "./derive";

const point = (
  date: string,
  type: SnapshotInput["record_type"],
  score: number | null,
): SnapshotInput => ({ record_date: date, record_type: type, score });

const readiness = (
  date: string,
  score: number | null,
  contributors?: { hrv_balance?: unknown; resting_heart_rate?: unknown },
): SnapshotInput => ({
  record_date: date,
  record_type: "readiness",
  score,
  payload: contributors ? { contributors } : null,
});

describe("deriveDailyScores", () => {
  it("returns [] for no input", () => {
    expect(deriveDailyScores([])).toEqual([]);
  });

  it("derives one row per day with at least one present sub-score", () => {
    const out = deriveDailyScores([
      point("2026-01-01", "sleep", 80),
      point("2026-01-01", "readiness", 70),
      point("2026-01-01", "activity", 60),
    ]);
    expect(out).toEqual([
      {
        score_date: "2026-01-01",
        overall_score: 70, // round(mean(80,70,60))
        sleep_score: 80,
        recovery_score: 70,
        activity_score: 60,
        stress_score: null,
      },
    ]);
  });

  it("skips days where every sub-score is null", () => {
    const out = deriveDailyScores([
      point("2026-01-01", "sleep", null),
      point("2026-01-01", "readiness", null),
    ]);
    expect(out).toEqual([]);
  });

  it("produces partial rows when some sub-scores are missing", () => {
    const out = deriveDailyScores([
      point("2026-01-02", "sleep", 90),
      point("2026-01-02", "activity", 50),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sleep_score).toBe(90);
    expect(out[0].recovery_score).toBeNull();
    expect(out[0].activity_score).toBe(50);
    expect(out[0].overall_score).toBe(70); // round(mean(90,50))
  });

  it("handles multiple days independently", () => {
    const out = deriveDailyScores([
      point("2026-01-01", "sleep", 80),
      point("2026-01-02", "sleep", 60),
    ]);
    const byDay = Object.fromEntries(out.map((r) => [r.score_date, r.overall_score]));
    expect(byDay).toEqual({ "2026-01-01": 80, "2026-01-02": 60 });
  });

  it("rounds half away from zero (Math.round behavior)", () => {
    // mean(80,70) = 75 — already integer
    // mean(80,71) = 75.5 -> 76
    const out = deriveDailyScores([
      point("2026-01-03", "sleep", 80),
      point("2026-01-03", "readiness", 71),
    ]);
    expect(out[0].overall_score).toBe(76);
  });

  it("emits stress_score: null when readiness has no payload (regression guard)", () => {
    const out = deriveDailyScores([point("2026-01-01", "readiness", 70)]);
    expect(out[0].stress_score).toBeNull();
  });

  it("derives stress from readiness contributors", () => {
    const out = deriveDailyScores([
      point("2026-01-01", "sleep", 80),
      readiness("2026-01-01", 70, { hrv_balance: 60, resting_heart_rate: 80 }),
      point("2026-01-01", "activity", 60),
    ]);
    // stress = round(mean(60, 80)) = 70
    expect(out[0].stress_score).toBe(70);
    // overall = round(mean(80, 70, 60, 70)) = 70
    expect(out[0].overall_score).toBe(70);
  });

  it("emits stress_score even when only readiness contributors are present", () => {
    const out = deriveDailyScores([
      readiness("2026-01-01", null, { hrv_balance: 50, resting_heart_rate: 70 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].sleep_score).toBeNull();
    expect(out[0].recovery_score).toBeNull();
    expect(out[0].activity_score).toBeNull();
    expect(out[0].stress_score).toBe(60);
    expect(out[0].overall_score).toBe(60); // mean of just stress
  });
});

describe("deriveStressFromReadiness", () => {
  it("averages both contributors, rounded", () => {
    expect(
      deriveStressFromReadiness({ contributors: { hrv_balance: 60, resting_heart_rate: 81 } }),
    ).toBe(71); // round(70.5)
  });

  it("returns the single contributor when only one is numeric", () => {
    expect(
      deriveStressFromReadiness({ contributors: { hrv_balance: 55 } }),
    ).toBe(55);
    expect(
      deriveStressFromReadiness({ contributors: { resting_heart_rate: 90 } }),
    ).toBe(90);
  });

  it("returns null when neither contributor is numeric", () => {
    expect(deriveStressFromReadiness({ contributors: {} })).toBeNull();
    expect(
      deriveStressFromReadiness({ contributors: { hrv_balance: "high" } }),
    ).toBeNull();
  });

  it("returns null when contributors object is missing", () => {
    expect(deriveStressFromReadiness({})).toBeNull();
    expect(deriveStressFromReadiness({ contributors: null })).toBeNull();
  });

  it("returns null for non-object payloads", () => {
    expect(deriveStressFromReadiness(null)).toBeNull();
    expect(deriveStressFromReadiness(undefined)).toBeNull();
    expect(deriveStressFromReadiness("nope")).toBeNull();
    expect(deriveStressFromReadiness(42)).toBeNull();
  });

  it("ignores non-finite numbers", () => {
    expect(
      deriveStressFromReadiness({
        contributors: { hrv_balance: NaN, resting_heart_rate: Infinity },
      }),
    ).toBeNull();
  });
});
