import {
  createLog, type NewLog, listLogs, upsertScore,
  replaceTodaysInsights, replaceTodaysRecommendations,
} from "./health";
import { computeScore } from "./scoring";
import type { HealthLog } from "./health";

/**
 * Deterministic insights & recommendations engine.
 * Looks at the most recent log + last 7 logs to produce explainable signals.
 */
function avg(nums: Array<number | null | undefined>): number | null {
  const xs = nums.filter((n): n is number => typeof n === "number");
  if (xs.length === 0) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

type GeneratedInsight = {
  title: string;
  description: string;
  type: "positive" | "warning" | "neutral";
  severity: "low" | "medium" | "high";
};

type GeneratedRec = {
  title: string;
  description: string;
  category: "sleep" | "activity" | "stress" | "nutrition" | "recovery" | "mindfulness";
  priority: "low" | "medium" | "high";
};

export function generateInsights(latest: HealthLog, recent: HealthLog[]): GeneratedInsight[] {
  const insights: GeneratedInsight[] = [];

  // Sleep consistency
  const sleeps = recent.map((l) => l.sleep_hours).filter((n): n is number => typeof n === "number");
  if (sleeps.length >= 3) {
    const mean = sleeps.reduce((a, b) => a + b, 0) / sleeps.length;
    const variance = sleeps.reduce((a, b) => a + (b - mean) ** 2, 0) / sleeps.length;
    const stddev = Math.sqrt(variance);
    if (stddev <= 0.5) {
      insights.push({
        title: "Your sleep is highly consistent",
        description: `Sleep duration varied by only ${stddev.toFixed(1)}h across your last ${sleeps.length} nights. Consistency is a top driver of recovery.`,
        type: "positive",
        severity: "low",
      });
    } else if (stddev >= 1.5) {
      insights.push({
        title: "Inconsistent sleep this week",
        description: `Sleep duration varied by ${stddev.toFixed(1)}h across recent nights. Try anchoring a consistent bedtime.`,
        type: "warning",
        severity: "medium",
      });
    }
  }

  // Stress trend
  const stress = recent.map((l) => l.stress_level).filter((n): n is number => typeof n === "number");
  if (stress.length >= 3) {
    const recent3 = avg(stress.slice(0, 3)) ?? 0;
    const prev = avg(stress.slice(3)) ?? recent3;
    if (recent3 > prev + 1) {
      insights.push({
        title: "Stress is trending upward",
        description: `Your stress average rose from ${prev.toFixed(1)} to ${recent3.toFixed(1)}/10 in the last 3 days.`,
        type: "warning",
        severity: "medium",
      });
    } else if (recent3 < prev - 1) {
      insights.push({
        title: "Stress is trending down",
        description: `Your stress average improved from ${prev.toFixed(1)} to ${recent3.toFixed(1)}/10. Keep the current routine.`,
        type: "positive",
        severity: "low",
      });
    }
  }

  // Hydration
  if (latest.water_liters != null && latest.water_liters < 1.5) {
    insights.push({
      title: "Hydration below target",
      description: `You logged ${latest.water_liters.toFixed(1)}L of water today. Aim for at least 2L.`,
      type: "warning",
      severity: "low",
    });
  }

  // Recovery
  if (latest.sleep_hours != null && latest.sleep_hours >= 7 && (latest.stress_level ?? 5) <= 4) {
    insights.push({
      title: "Recovery is on track",
      description: "Solid sleep and low stress today — your body is recovering well.",
      type: "positive",
      severity: "low",
    });
  }

  if (insights.length === 0) {
    insights.push({
      title: "Keep logging to unlock more insights",
      description: "A few more daily logs will let HealthOS surface clearer patterns.",
      type: "neutral",
      severity: "low",
    });
  }

  return insights.slice(0, 5);
}

export function generateRecommendations(latest: HealthLog): GeneratedRec[] {
  const recs: GeneratedRec[] = [];

  if ((latest.exercise_minutes ?? 0) < 20) {
    recs.push({
      title: "Take a 20-minute walk today",
      description:
        "Light movement boosts energy, reduces stress, and supports recovery. Even a brisk walk counts.",
      category: "activity",
      priority: "high",
    });
  }

  if (latest.sleep_hours != null && latest.sleep_hours < 7) {
    recs.push({
      title: "Sleep 45 minutes earlier tonight",
      description: `You slept ${latest.sleep_hours.toFixed(1)}h. Add even 30–45 min of sleep tonight to reset.`,
      category: "sleep",
      priority: "high",
    });
  }

  if ((latest.water_liters ?? 0) < 2) {
    recs.push({
      title: "Drink 500ml more water before evening",
      description: "Trending below your hydration target. A glass every hour helps you catch up.",
      category: "nutrition",
      priority: "medium",
    });
  }

  if ((latest.stress_level ?? 0) >= 6) {
    recs.push({
      title: "Take a 5-minute breathing break",
      description: "Box breathing (4-4-4-4) for 5 minutes can lower stress quickly.",
      category: "mindfulness",
      priority: "medium",
    });
  }

  if ((latest.meditation_minutes ?? 0) === 0) {
    recs.push({
      title: "Add a short mindfulness session",
      description: "Even 5 minutes of meditation supports recovery and focus.",
      category: "mindfulness",
      priority: "low",
    });
  }

  if (recs.length === 0) {
    recs.push({
      title: "Maintain your routine — you're on track",
      description: "Keep logging daily to spot improvements and risks early.",
      category: "recovery",
      priority: "low",
    });
  }
  return recs.slice(0, 4);
}

/**
 * Saves a log, then recomputes today's score, insights, and recommendations.
 */
export async function saveLogAndRefresh(input: NewLog) {
  const log = await createLog(input);
  const recent = await listLogs(7);
  const score = computeScore(log);
  await upsertScore({ ...score, score_date: log.log_date });
  const insights = generateInsights(log, recent);
  const recs = generateRecommendations(log);
  await Promise.all([
    replaceTodaysInsights(insights),
    replaceTodaysRecommendations(recs),
  ]);
  return { log, score };
}
