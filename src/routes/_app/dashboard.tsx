import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, BarChart, Bar,
} from "recharts";
import {
  Moon, Brain, Zap, Heart, HeartPulse, ArrowUp, ArrowDown, Info, ChevronRight,
  Sparkles, Activity, Utensils, Droplet, Lightbulb, Footprints, Flame, Star, Target, Plus, Loader2,
} from "lucide-react";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import { Button } from "@/components/ui/button";
import {
  listLogs, listScores, listTodaysRecommendations, updateRecommendationStatus,
  type HealthLog, type HealthScore, type Recommendation,
} from "@/services/health";
import { scoreLabel } from "@/services/scoring";
import { generateInsights } from "@/lib/insights/generate";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HealthOS" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [scores, setScores] = useState<HealthScore[]>([]);
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const [s, l, r] = await Promise.all([
        listScores(30), listLogs(7), listTodaysRecommendations(),
      ]);
      setScores(s);
      setLogs(l);
      setRecs(r);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function handleRecAction(id: string, status: Recommendation["status"]) {
    const prev = recs;
    const completed_at = status === "done" ? new Date().toISOString() : null;
    setRecs((cur) => cur.map((r) => (r.id === id ? { ...r, status, completed_at } : r)));
    try {
      await updateRecommendationStatus(id, status);
      toast.success(status === "done" ? "Marked as done" : status === "snoozed" ? "Snoozed" : "Dismissed");
      await refresh();
    } catch (e) {
      setRecs(prev);
      toast.error((e as Error).message);
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (scores.length === 0 && logs.length === 0) {
    return <EmptyDashboard />;
  }

  const todayScore = scores[0] ?? null;
  const yesterdayScore = scores[1] ?? null;
  const delta = todayScore && yesterdayScore ? todayScore.overall_score - yesterdayScore.overall_score : 0;
  const trendData = [...scores].reverse().map((s) => ({ day: s.score_date.slice(5), score: s.overall_score }));

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <HealthScoreCard score={todayScore} delta={delta} />
        <TrendsCard data={trendData} />
        <RiskForecastCard scores={scores} />
      </div>

      <MetricsRow log={logs[0] ?? null} logs={logs} />

      <div className="grid gap-5 lg:grid-cols-3">
        <BreakdownCard score={todayScore} />
        <RecentLogsCard logs={logs} />
        <RecommendationCard rec={recs.find((r) => r.status === "pending") ?? null} onAction={handleRecAction} />
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <WeeklyInsightCard scores={scores} />
        <KpiCard icon={Flame} label="Day Streak" value={String(computeStreak(logs))} tone="warning" />
        <KpiCard icon={Target} label="Plan Adherence" value={`${computeAdherence(recs)}%`} tone="primary" />
        <KpiCard icon={Star} label="Health Rating" value={todayScore ? (todayScore.overall_score / 20).toFixed(1) : "—"} tone="accent" />
      </div>
    </div>
  );
}

function computeStreak(logs: HealthLog[]): number {
  if (logs.length === 0) return 0;
  const dates = new Set(logs.map((l) => l.log_date));
  let streak = 0;
  const d = new Date();
  while (dates.has(d.toISOString().slice(0, 10))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function computeAdherence(recs: Recommendation[]): number {
  if (recs.length === 0) return 0;
  const done = recs.filter((r) => r.status === "done").length;
  return Math.round((done / recs.length) * 100);
}

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 max-w-md mx-auto text-center">
      <div className="h-16 w-16 rounded-2xl bg-gradient-brand flex items-center justify-center text-white shadow-elegant">
        <Sparkles className="h-7 w-7" />
      </div>
      <h2 className="mt-6 text-2xl font-bold">Let's get your first health score</h2>
      <p className="mt-2 text-muted-foreground">
        Log how you slept, your energy, and a few daily basics. We'll compute your score and surface insights instantly.
      </p>
      <Link to="/logs" className="mt-6">
        <Button className="bg-gradient-brand text-primary-foreground rounded-full px-6 shadow-elegant">
          <Plus className="h-4 w-4 mr-1" /> Add your first log
        </Button>
      </Link>
    </div>
  );
}

function HealthScoreCard({ score, delta }: { score: HealthScore | null; delta: number }) {
  const value = score?.overall_score ?? 0;
  const label = scoreLabel(value);
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-semibold flex items-center gap-2">Health Score <Info className="h-3.5 w-3.5 text-muted-foreground" /></h3>
      <div className="mt-4 flex items-center gap-6">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight">{value || "—"}</span>
            <span className="text-muted-foreground">/100</span>
          </div>
          <p className={`mt-1 text-sm font-medium text-${label.tone === "destructive" ? "destructive" : label.tone}`}>● {label.label}</p>
        </div>
        <div className="ml-auto"><ScoreRing value={value} size={110} /></div>
      </div>
      {delta !== 0 && (
        <div className={`mt-5 flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${delta > 0 ? "bg-success/10" : "bg-destructive/10"}`}>
          {delta > 0
            ? <ArrowUp className="h-3.5 w-3.5 text-success" />
            : <ArrowDown className="h-3.5 w-3.5 text-destructive" />}
          <span className={`font-semibold ${delta > 0 ? "text-success" : "text-destructive"}`}>
            {delta > 0 ? "+" : ""}{delta} points
          </span>
          <span className="text-muted-foreground">vs yesterday</span>
        </div>
      )}
    </div>
  );
}

function TrendsCard({ data }: { data: Array<{ day: string; score: number }> }) {
  const [range, setRange] = useState<"7D" | "30D" | "90D">("7D");
  const sliced = range === "7D" ? data.slice(-7) : range === "30D" ? data.slice(-30) : data.slice(-90);
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Trends</h3>
        <div className="flex rounded-lg bg-muted p-1 text-xs font-medium">
          {(["7D", "30D", "90D"] as const).map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`px-2.5 py-1 rounded-md ${range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-44">
        {sliced.length === 0 ? (
          <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Log to see trends</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sliced}>
              <defs>
                <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis hide domain={[0, 100]} />
              <Area type="monotone" dataKey="score" stroke="var(--accent)" strokeWidth={2.5} fill="url(#trendArea)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function RiskForecastCard({ scores }: { scores: HealthScore[] }) {
  const recent = scores.slice(0, 7);
  const avgStress = recent.length ? recent.reduce((a, b) => a + (b.stress_score ?? 60), 0) / recent.length : 60;
  // High stress score = low stress = low risk
  const risk = avgStress >= 75 ? "Low" : avgStress >= 55 ? "Moderate" : "Elevated";
  const tone = risk === "Low" ? "text-success" : risk === "Moderate" ? "text-warning" : "text-destructive";
  const data = recent.slice().reverse().map((s, i) => ({ i, v: 100 - (s.stress_score ?? 60) }));
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-semibold">Risk Forecast</h3>
      <p className={`mt-3 text-3xl font-bold ${tone}`}>{risk}</p>
      <p className="text-sm text-muted-foreground mt-1">Based on your last 7 days of stress signals</p>
      <div className="mt-3 h-16">
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="v" stroke="var(--success)" strokeWidth={2} fill="url(#riskArea)" />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Not enough data yet</div>
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Next 7 days</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function MetricsRow({ log, logs }: { log: HealthLog | null; logs: HealthLog[] }) {
  const items = [
    { icon: Moon, label: "Sleep", value: log?.sleep_hours ? `${log.sleep_hours}h` : "—", color: "var(--chart-2)" },
    { icon: Brain, label: "Stress", value: log?.stress_level != null ? `${log.stress_level}/10` : "—", color: "var(--chart-3)" },
    { icon: Zap, label: "Energy", value: log?.energy_level != null ? `${log.energy_level}/10` : "—", color: "var(--chart-1)" },
    { icon: Heart, label: "Exercise", value: log?.exercise_minutes != null ? `${log.exercise_minutes}m` : "—", color: "var(--destructive)" },
    { icon: HeartPulse, label: "Water", value: log?.water_liters ? `${log.water_liters}L` : "—", color: "var(--chart-2)" },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map((it) => {
        const series = logs.slice(0, 7).reverse().map((l, i) => ({ i, v: numericFor(l, it.label) }));
        return (
          <div key={it.label} className="rounded-2xl bg-card border border-border shadow-card p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <it.icon className="h-4 w-4" /><span className="text-xs font-medium">{it.label}</span>
                </div>
                <p className="mt-2 text-xl font-bold">{it.value}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="h-12 -mx-1 mt-2">
              {series.length > 1 ? (
                <ResponsiveContainer width="100%" height="100%">
                  {it.label === "Sleep" ? (
                    <BarChart data={series}><Bar dataKey="v" fill={it.color} radius={[2, 2, 0, 0]} /></BarChart>
                  ) : (
                    <LineChart data={series}><Line type="monotone" dataKey="v" stroke={it.color} strokeWidth={2} dot={false} /></LineChart>
                  )}
                </ResponsiveContainer>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function numericFor(log: HealthLog, label: string): number {
  switch (label) {
    case "Sleep": return Number(log.sleep_hours ?? 0);
    case "Stress": return log.stress_level ?? 0;
    case "Energy": return log.energy_level ?? 0;
    case "Exercise": return log.exercise_minutes ?? 0;
    case "Water": return Number(log.water_liters ?? 0);
    default: return 0;
  }
}

function BreakdownCard({ score }: { score: HealthScore | null }) {
  const data = [
    { dim: "Sleep", score: (score?.sleep_score ?? 0) / 10 },
    { dim: "Activity", score: (score?.activity_score ?? 0) / 10 },
    { dim: "Stress", score: (score?.stress_score ?? 0) / 10 },
    { dim: "Recovery", score: (score?.recovery_score ?? 0) / 10 },
    { dim: "Nutrition", score: (score?.nutrition_score ?? 0) / 10 },
  ];
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-semibold">Health Score Breakdown</h3>
      <div className="mt-2 grid grid-cols-2 gap-2 items-center">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 10]} />
              <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.dim} className="flex items-center justify-between">
              <span className="text-muted-foreground">{d.dim}</span>
              <span className="font-semibold">{d.score.toFixed(1)}/10</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function RecentLogsCard({ logs }: { logs: HealthLog[] }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Recent Logs</h3>
        <Link to="/logs" className="text-xs font-semibold text-primary">View all</Link>
      </div>
      {logs.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">No logs yet. Start tracking to see them here.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {logs.slice(0, 5).map((l) => (
            <li key={l.id} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent-soft/60 flex items-center justify-center text-accent">
                <Footprints className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{l.log_date}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {l.sleep_hours ? `Sleep ${l.sleep_hours}h` : null}
                  {l.exercise_minutes ? ` · ${l.exercise_minutes}m exercise` : null}
                  {l.water_liters ? ` · ${l.water_liters}L water` : null}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecommendationCard({ rec, onAction }: { rec: Recommendation | null; onAction: (id: string, status: Recommendation["status"]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);

  if (!rec) {
    return (
      <div className="rounded-2xl bg-gradient-dark text-white p-6 shadow-elegant">
        <p className="text-xs font-semibold flex items-center gap-1.5 text-accent">
          <Sparkles className="h-3.5 w-3.5" /> AI Recommendations
        </p>
        <h3 className="mt-3 text-xl font-bold leading-tight">No new recommendations today</h3>
        <p className="mt-3 text-sm text-white/70">Add a log and we'll generate fresh, personalized actions.</p>
      </div>
    );
  }

  async function handle(status: Recommendation["status"]) {
    if (busy) return;
    setBusy(true);
    try {
      await onAction(rec!.id, status);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-gradient-dark text-white p-6 shadow-elegant relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 bg-accent/20 blur-3xl rounded-full" />
      <p className="text-xs font-semibold flex items-center gap-1.5 text-accent">
        <Sparkles className="h-3.5 w-3.5" /> AI Recommendation
      </p>
      <h3 className="mt-3 text-2xl font-bold leading-tight">{rec.title}</h3>
      <p className="mt-3 text-sm text-white/70 leading-relaxed">{rec.description}</p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button disabled={busy} onClick={() => handle("done")} className="bg-accent text-accent-foreground hover:opacity-95 rounded-full font-semibold">Mark as Done</Button>
        <Button disabled={busy} onClick={() => handle("snoozed")} variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 rounded-full">Not Now</Button>
        <Button disabled={busy} onClick={() => handle("dismissed")} variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 rounded-full">Dismiss</Button>
      </div>
    </div>
  );
}

function WeeklyInsightCard({ scores }: { scores: HealthScore[] }) {
  const last7 = scores.slice(0, 7);
  const prev7 = scores.slice(7, 14);
  const a = last7.length ? last7.reduce((x, s) => x + s.overall_score, 0) / last7.length : 0;
  const b = prev7.length ? prev7.reduce((x, s) => x + s.overall_score, 0) / prev7.length : a;
  const delta = a - b;
  const text = delta > 2
    ? `Your health score improved ${delta.toFixed(0)} pts vs last week 🎉`
    : delta < -2
      ? `Score dipped ${Math.abs(delta).toFixed(0)} pts — let's reset this week`
      : "Steady week. Consistency builds resilience.";
  const daily = generateInsights(
    scores.map((s) => ({
      score_date: s.score_date,
      overall_score: s.overall_score,
      sleep_score: s.sleep_score,
      activity_score: s.activity_score,
    })),
  );
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6 flex items-start gap-4">
      <div className="h-12 w-12 rounded-xl bg-accent-soft/60 flex items-center justify-center text-accent shrink-0">
        <Lightbulb className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Insight</p>
        <p className="text-sm font-semibold mt-0.5">{text}</p>
        {daily.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {daily.map((line, idx) => (
              <li
                key={line}
                className={
                  idx === 0
                    ? "text-sm font-semibold text-foreground flex gap-1.5"
                    : "text-xs text-muted-foreground flex gap-1.5"
                }
              >
                <span className="text-accent" aria-hidden>•</span>
                <span>{line}</span>
              </li>
            ))}
          </ul>
        ) : scores.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Sync your device or log data to get personalized insights.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: ComponentType<{ className?: string }>; label: string; value: string; tone: "warning" | "primary" | "accent" }) {
  const colors = {
    warning: "bg-warning/15 text-warning",
    primary: "bg-primary/10 text-primary",
    accent: "bg-accent/15 text-accent",
  };
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-5 flex items-center gap-4">
      <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${colors[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
