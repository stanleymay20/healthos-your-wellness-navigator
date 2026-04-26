import { describe, expect, it } from "vitest";
import { deriveDailyScores, type SnapshotInput } from "./derive";

const point = (
  date: string,
  type: SnapshotInput["record_type"],
  score: number | null,
): SnapshotInput => ({ record_date: date, record_type: type, score });

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
});
