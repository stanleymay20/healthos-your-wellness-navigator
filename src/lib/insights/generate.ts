// Pure insight generator. Takes scores sorted newest-first and returns
// at most 2 plain-text insight strings. No DB, no AI, no side effects.
//
// When a Baseline is supplied, baseline-aware rules (z-score relative to
// the user's recent baseline) take priority over the fixed-threshold
// fallbacks. The fallbacks remain so users with too few days of history
// still see something useful.

import type { Baseline, Deviation } from "@/lib/scoring/baseline";

export type InsightScoreInput = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  activity_score: number | null;
};

const MAX_INSIGHTS = 2;
const SIGNIFICANT_BELOW_Z = -1.5;
const SIGNIFICANT_ABOVE_Z = 1.5;

export function generateInsights(
  scores: InsightScoreInput[],
  context?: { baseline: Baseline | null; deviation: Deviation | null },
): string[] {
  if (scores.length === 0) return [];
  const latest = scores[0];
  const previous = scores[1] ?? null;
  const deviation = context?.deviation ?? null;
  const out: string[] = [];

  // Baseline-aware rules (fire only when we have a real baseline).
  if (deviation) {
    if (deviation.sleep != null && deviation.sleep <= SIGNIFICANT_BELOW_Z) {
      out.push(
        `Sleep is ${Math.abs(deviation.sleep).toFixed(1)}σ below your recent baseline. Protect tonight's wind-down.`,
      );
    }
    if (
      out.length < MAX_INSIGHTS &&
      deviation.recovery != null &&
      deviation.recovery <= SIGNIFICANT_BELOW_Z
    ) {
      out.push(
        `Recovery is ${Math.abs(deviation.recovery).toFixed(1)}σ below your usual baseline. Take a lighter day.`,
      );
    }
    if (
      out.length < MAX_INSIGHTS &&
      deviation.activity != null &&
      deviation.activity <= SIGNIFICANT_BELOW_Z
    ) {
      out.push(
        `Activity is ${Math.abs(deviation.activity).toFixed(1)}σ below your baseline. A short walk can help.`,
      );
    }
    if (
      out.length < MAX_INSIGHTS &&
      deviation.overall >= SIGNIFICANT_ABOVE_Z
    ) {
      out.push("You're well above your recent baseline. Strong momentum — keep the routine.");
    }
  }

  // Soft-threshold fallbacks. When the user has enough history for a
  // baseline, the cuts come from their own bottom-quartile (`p25`) so a
  // "low day" is judged relative to the user's own recent days. When
  // there's no baseline yet (cold start), we fall back to the legacy
  // fixed cuts (50/60/50). Each fallback is suppressed if the baseline-
  // aware branch already fired on the same dimension.
  const baseline = context?.baseline ?? null;
  const overallCut = baseline?.overall.p25 ?? 50;
  const sleepCut = baseline?.sleep?.p25 ?? 60;
  const activityCut = baseline?.activity?.p25 ?? 50;

  const baselineSleepFired =
    deviation?.sleep != null && deviation.sleep <= SIGNIFICANT_BELOW_Z;
  const baselineActivityFired =
    deviation?.activity != null && deviation.activity <= SIGNIFICANT_BELOW_Z;

  if (out.length < MAX_INSIGHTS && latest.overall_score < overallCut) {
    out.push("Your recovery is low. Prioritize rest today.");
  }
  if (
    out.length < MAX_INSIGHTS &&
    !baselineSleepFired &&
    latest.sleep_score != null &&
    latest.sleep_score < sleepCut
  ) {
    out.push("Your sleep quality dropped. Consider earlier sleep.");
  }
  if (
    out.length < MAX_INSIGHTS &&
    !baselineActivityFired &&
    latest.activity_score != null &&
    latest.activity_score < activityCut
  ) {
    out.push("Low activity detected. Try light movement today.");
  }
  if (
    out.length < MAX_INSIGHTS &&
    previous &&
    latest.overall_score > previous.overall_score
  ) {
    out.push("You're improving. Keep your routine consistent.");
  }

  return out.slice(0, MAX_INSIGHTS);
}
