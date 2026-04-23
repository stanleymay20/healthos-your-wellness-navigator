import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FileText, Loader2, Sparkles, TrendingUp, AlertCircle } from "lucide-react";
import {
  listScores, listInsights, listRecommendations,
  type HealthScore, type Insight, type Recommendation,
} from "@/services/health";
import { scoreLabel } from "@/services/scoring";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/reports")({
  head: () => ({ meta: [{ title: "Reports — HealthOS" }] }),
  component: Reports,
});

function Reports() {
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [s, i, r] = await Promise.all([
          listScores(30),
          listInsights(10),
          listRecommendations(30),
        ]);
        if (!active) return;
        setScores(s);
        setInsights(i);
        setRecs(r);
      } catch (e) {
        if (!active) return;
        const msg = (e as Error).message;
        setError(msg);
        toast.error(msg);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h3 className="font-semibold text-destructive">Couldn't load your reports</h3>
            <p className="text-sm text-muted-foreground mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const hasData = scores.length > 0 || insights.length > 0 || recs.length > 0;

  if (!hasData) {
    return (
      <div className="max-w-4xl space-y-5">
        <header>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-sm text-muted-foreground">Your health summaries, ready to read or share.</p>
        </header>
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
          <Sparkles className="h-5 w-5 mx-auto mb-2" />
          Add a daily log to generate your first report.
        </div>
      </div>
    );
  }

  const latest = scores[0] ?? null;
  const avg7 = scores.length
    ? Math.round(scores.slice(0, 7).reduce((a, b) => a + b.overall_score, 0) / Math.min(scores.length, 7))
    : 0;
  const prev7 = scores.length > 7
    ? Math.round(scores.slice(7, 14).reduce((a, b) => a + b.overall_score, 0) / Math.min(scores.length - 7, 7))
    : avg7;
  const delta = avg7 - prev7;
  const label = latest ? scoreLabel(latest.overall_score) : null;
  const doneCount = recs.filter((r) => r.status === "done").length;
  const totalActionable = recs.filter((r) => r.status !== "dismissed").length;
  const adherence = totalActionable ? Math.round((doneCount / totalActionable) * 100) : 0;

  const summaryLine = buildSummary({ latest, avg7, delta, insights, doneCount, adherence });

  return (
    <div className="max-w-4xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Reports</h1>
        <p className="text-sm text-muted-foreground">Your health summaries, ready to read or share.</p>
      </header>

      <div className="rounded-2xl bg-gradient-dark text-white p-6 shadow-elegant relative overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 bg-accent/20 blur-3xl rounded-full" />
        <p className="text-xs font-semibold flex items-center gap-1.5 text-accent">
          <TrendingUp className="h-3.5 w-3.5" /> Latest Summary
        </p>
        <div className="mt-3 flex items-end gap-3">
          <span className="text-5xl font-bold tracking-tight">{latest?.overall_score ?? "—"}</span>
          <span className="text-white/70 pb-1">/100</span>
          {label && (
            <span className="ml-2 text-sm font-medium text-white/80 pb-1">● {label.label}</span>
          )}
        </div>
        <p className="mt-3 text-sm text-white/80 leading-relaxed">{summaryLine}</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
          <Metric label="7-day avg" value={`${avg7}`} />
          <Metric label="Week Δ" value={`${delta > 0 ? "+" : ""}${delta}`} />
          <Metric label="Plan adherence" value={`${adherence}%`} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-2xl bg-card border border-border shadow-card p-5">
          <h3 className="font-semibold">Recent Insights</h3>
          {insights.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No insights yet.</p>
          ) : (
            <ul className="mt-3 space-y-3">
              {insights.slice(0, 5).map((it) => (
                <li key={it.id} className="flex items-start gap-3">
                  <span className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                    it.type === "positive" ? "bg-success" : it.type === "warning" ? "bg-warning" : "bg-muted-foreground"
                  }`} />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{it.title}</p>
                    <p className="text-xs text-muted-foreground truncate">{it.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-card border border-border shadow-card p-5">
          <h3 className="font-semibold">Daily History</h3>
          {scores.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">No scores yet.</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {scores.slice(0, 7).map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{s.score_date}</p>
                    <p className="text-xs text-muted-foreground">
                      Overall {s.overall_score}
                      {s.sleep_score != null ? ` · Sleep ${s.sleep_score}` : ""}
                      {s.activity_score != null ? ` · Activity ${s.activity_score}` : ""}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/5 border border-white/10 px-3 py-2">
      <p className="text-white/60">{label}</p>
      <p className="text-white font-semibold text-base">{value}</p>
    </div>
  );
}

function buildSummary(args: {
  latest: HealthScore | null;
  avg7: number;
  delta: number;
  insights: Insight[];
  doneCount: number;
  adherence: number;
}): string {
  const { latest, avg7, delta, insights, doneCount, adherence } = args;
  if (!latest) {
    return "No health score recorded yet. Log a day to generate your first report.";
  }
  const parts: string[] = [];
  parts.push(`Latest score ${latest.overall_score}/100 on ${latest.score_date}.`);
  parts.push(`7-day average is ${avg7}${delta > 2 ? ` — up ${delta} vs the prior week.` : delta < -2 ? ` — down ${Math.abs(delta)} vs the prior week.` : "."}`);
  if (doneCount > 0) parts.push(`Completed ${doneCount} recommendations (${adherence}% adherence).`);
  const warn = insights.find((i) => i.type === "warning");
  if (warn) parts.push(`Watch-out: ${warn.title}.`);
  return parts.join(" ");
}
