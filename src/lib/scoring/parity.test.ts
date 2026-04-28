import { describe, expect, it } from "vitest";
import { compareScores, type ScoreRow } from "./parity";

const row = (
  date: string,
  overall: number,
  sleep: number | null = overall,
  recovery: number | null = overall,
  activity: number | null = overall,
  stress: number | null = overall,
): ScoreRow => ({
  score_date: date,
  overall_score: overall,
  sleep_score: sleep,
  recovery_score: recovery,
  activity_score: activity,
  stress_score: stress,
});

describe("compareScores", () => {
  it("counts matching days when both sides agree", () => {
    const live = [row("2026-01-01", 70), row("2026-01-02", 80)];
    const derived = [row("2026-01-01", 70), row("2026-01-02", 80)];
    const report = compareScores(live, derived);
    expect(report.comparedDays).toBe(2);
    expect(report.matchingDays).toBe(2);
    expect(report.mismatchedDays).toBe(0);
    expect(report.mismatches).toEqual([]);
  });

  it("flags field_diff when any score differs", () => {
    const live = [row("2026-01-01", 70, 65)];
    const derived = [row("2026-01-01", 70, 60)];
    const report = compareScores(live, derived);
    expect(report.matchingDays).toBe(0);
    expect(report.mismatchedDays).toBe(1);
    expect(report.mismatches[0].kind).toBe("field_diff");
    expect(report.mismatches[0].fields).toEqual([
      { name: "sleep_score", live: 65, derived: 60 },
    ]);
  });

  it("classifies live-only and derived-only days", () => {
    const live = [row("2026-01-01", 70)];
    const derived = [row("2026-01-02", 80)];
    const report = compareScores(live, derived);
    expect(report.comparedDays).toBe(2);
    const kinds = report.mismatches.map((m) => m.kind).sort();
    expect(kinds).toEqual(["derived_only", "live_only"]);
  });

  it("respects sampleLimit (counts stay exact, samples cap)", () => {
    const live = Array.from({ length: 30 }, (_, i) => row(`2026-02-${String(i + 1).padStart(2, "0")}`, 70 + i));
    const derived = Array.from({ length: 30 }, (_, i) => row(`2026-02-${String(i + 1).padStart(2, "0")}`, 71 + i));
    const report = compareScores(live, derived, 5);
    expect(report.mismatchedDays).toBe(30);
    expect(report.mismatches).toHaveLength(5);
  });
});
