import type { HealthLog } from "./health";

/**
 * Deterministic, explainable HealthOS scoring engine (MVP).
 * Each dimension is 0-100. Missing data degrades gracefully toward a neutral 60.
 */

const NEUTRAL = 60;

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)));
}

export function scoreSleep(hours: number | null | undefined): number {
  if (hours == null) return NEUTRAL;
  // Optimal 7-9h
  if (hours >= 7 && hours <= 9) return 95;
  if (hours >= 6 && hours < 7) return 80;
  if (hours > 9 && hours <= 10) return 80;
  if (hours >= 5 && hours < 6) return 60;
  if (hours > 10) return 65;
  return clamp(40 + hours * 4);
}

export function scoreActivity(minutes: number | null | undefined): number {
  if (minutes == null) return NEUTRAL;
  if (minutes >= 60) return 95;
  if (minutes >= 30) return 85;
  if (minutes >= 15) return 70;
  if (minutes > 0) return 55;
  return 35;
}

/** stress 1 (low) - 10 (high). Lower stress -> higher score. */
export function scoreStress(level: number | null | undefined): number {
  if (level == null) return NEUTRAL;
  return clamp(105 - level * 10);
}

/** Recovery blends sleep, low stress, and meditation. */
export function scoreRecovery(log: Pick<HealthLog, "sleep_hours" | "stress_level" | "meditation_minutes">): number {
  const sleep = scoreSleep(log.sleep_hours);
  const stress = scoreStress(log.stress_level);
  const med = log.meditation_minutes ?? 0;
  const medBonus = med >= 10 ? 10 : med > 0 ? 5 : 0;
  return clamp(sleep * 0.5 + stress * 0.4 + 60 * 0.1 + medBonus);
}

/** Nutrition heuristic from water intake + meal log presence. */
export function scoreNutrition(log: Pick<HealthLog, "water_liters" | "meals_note">): number {
  let base = NEUTRAL;
  const w = log.water_liters ?? 0;
  if (w >= 2.5) base = 90;
  else if (w >= 2) base = 80;
  else if (w >= 1.5) base = 70;
  else if (w >= 1) base = 55;
  else if (w > 0) base = 45;
  if (log.meals_note && log.meals_note.trim().length > 0) base += 5;
  return clamp(base);
}

export type ComputedScore = {
  overall_score: number;
  sleep_score: number;
  activity_score: number;
  stress_score: number;
  recovery_score: number;
  nutrition_score: number;
};

const WEIGHTS = {
  sleep: 0.25,
  activity: 0.2,
  stress: 0.2,
  recovery: 0.2,
  nutrition: 0.15,
};

export function computeScore(log: HealthLog | null): ComputedScore {
  const safe = log ?? ({} as HealthLog);
  const sleep = scoreSleep(safe.sleep_hours);
  const activity = scoreActivity(safe.exercise_minutes);
  const stress = scoreStress(safe.stress_level);
  const recovery = scoreRecovery(safe);
  const nutrition = scoreNutrition(safe);

  const overall = clamp(
    sleep * WEIGHTS.sleep +
      activity * WEIGHTS.activity +
      stress * WEIGHTS.stress +
      recovery * WEIGHTS.recovery +
      nutrition * WEIGHTS.nutrition,
  );
  return {
    overall_score: overall,
    sleep_score: sleep,
    activity_score: activity,
    stress_score: stress,
    recovery_score: recovery,
    nutrition_score: nutrition,
  };
}

export function scoreLabel(score: number): { label: string; tone: "success" | "warning" | "destructive" | "muted" } {
  if (score >= 85) return { label: "Excellent", tone: "success" };
  if (score >= 70) return { label: "Great", tone: "success" };
  if (score >= 55) return { label: "Good", tone: "warning" };
  if (score >= 40) return { label: "Moderate", tone: "warning" };
  return { label: "At Risk", tone: "destructive" };
}
