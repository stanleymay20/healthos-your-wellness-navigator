// Pure insight generator. Takes scores sorted newest-first and returns
// at most 2 plain-text insight strings. No DB, no AI, no side effects.

export type InsightScoreInput = {
  score_date: string;
  overall_score: number;
  sleep_score: number | null;
  activity_score: number | null;
};

const MAX_INSIGHTS = 2;

export function generateInsights(scores: InsightScoreInput[]): string[] {
  if (scores.length === 0) return [];
  const latest = scores[0];
  const previous = scores[1] ?? null;
  const out: string[] = [];

  if (latest.overall_score < 50) {
    out.push("Your recovery is low. Prioritize rest today.");
  }
  if (out.length < MAX_INSIGHTS && latest.sleep_score != null && latest.sleep_score < 60) {
    out.push("Your sleep quality dropped. Consider earlier sleep.");
  }
  if (
    out.length < MAX_INSIGHTS &&
    latest.activity_score != null &&
    latest.activity_score < 50
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
