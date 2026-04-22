import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ResponsiveContainer, AreaChart, Area, LineChart, Line,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, BarChart, Bar,
} from "recharts";
import {
  Moon, Brain, Zap, Heart, HeartPulse, ArrowUp, Info, ChevronRight,
  Sparkles, Activity, Utensils, Droplet, Lightbulb, Footprints, Flame, Star, Target,
} from "lucide-react";
import { ScoreRing } from "@/components/dashboard/ScoreRing";
import {
  trendData7d, trendData30d, trendData90d,
  sparklineUp, sparklineDown, sparklineFlat, breakdownData, recentLogs,
} from "@/lib/mock-data";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — HealthOS" }] }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <HealthScoreCard />
        <TrendsCard />
        <RiskForecastCard />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <MetricCard icon={Moon} label="Sleep" value="7h 23m" status="Good" data={sparklineUp} color="var(--chart-2)" />
        <MetricCard icon={Brain} label="Stress" value="36" status="Low" data={sparklineDown} color="var(--chart-3)" />
        <MetricCard icon={Zap} label="Energy" value="76%" status="Good" data={sparklineFlat} color="var(--chart-1)" />
        <MetricCard icon={Heart} label="Heart Rate" value="62 bpm" status="Normal" data={sparklineFlat} color="var(--destructive)" />
        <MetricCard icon={HeartPulse} label="HRV" value="48 ms" status="Good" data={sparklineUp} color="var(--chart-2)" />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <BreakdownCard />
        <RecentLogsCard />
        <RecommendationCard />
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        <WeeklyInsightCard />
        <KpiCard icon={Flame} label="Day Streak" value="12" tone="warning" />
        <KpiCard icon={Target} label="Plan Adherence" value="85%" tone="primary" />
        <KpiCard icon={Star} label="Health Rating" value="4.8" tone="accent" />
      </div>
    </div>
  );
}

function HealthScoreCard() {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">Health Score <Info className="h-3.5 w-3.5 text-muted-foreground" /></h3>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-5xl font-bold tracking-tight">82</span>
            <span className="text-muted-foreground">/100</span>
          </div>
          <p className="mt-1 text-sm font-medium text-success">● Great</p>
        </div>
        <div className="ml-auto"><ScoreRing value={82} size={110} /></div>
      </div>
      <div className="mt-5 flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-sm">
        <ArrowUp className="h-3.5 w-3.5 text-success" />
        <span className="font-semibold text-success">6 points</span>
        <span className="text-muted-foreground">vs yesterday</span>
      </div>
    </div>
  );
}

function TrendsCard() {
  const [range, setRange] = useState<"7D" | "30D" | "90D">("7D");
  const data = range === "7D" ? trendData7d : range === "30D" ? trendData30d : trendData90d;
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6 lg:col-span-1">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">Trends <Info className="h-3.5 w-3.5 text-muted-foreground" /></h3>
        <div className="flex rounded-lg bg-muted p-1 text-xs font-medium">
          {(["7D", "30D", "90D"] as const).map((r) => (
            <button
              key={r} onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-md ${range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
            >{r}</button>
          ))}
        </div>
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
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
      </div>
    </div>
  );
}

function RiskForecastCard() {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-semibold flex items-center gap-2">Risk Forecast <Info className="h-3.5 w-3.5 text-muted-foreground" /></h3>
      <p className="mt-3 text-3xl font-bold text-success">Low</p>
      <p className="text-sm text-muted-foreground mt-1">Your risk of burnout is low</p>
      <div className="mt-3 inline-flex items-center gap-1 rounded-lg bg-success/10 px-2 py-1 text-xs font-semibold text-success">
        ↓ 18% <span className="text-muted-foreground font-normal">vs last 7 days</span>
      </div>
      <div className="mt-3 h-16">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparklineUp}>
            <defs>
              <linearGradient id="riskArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--success)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="v" stroke="var(--success)" strokeWidth={2} fill="url(#riskArea)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Next 7 days</span>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, status, data, color,
}: { icon: any; label: string; value: string; status: string; data: any[]; color: string }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon className="h-4 w-4" /><span className="text-xs font-medium">{label}</span>
          </div>
          <p className="mt-2 text-xl font-bold">{value}</p>
          <p className="text-xs text-success mt-0.5">● {status}</p>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="h-12 -mx-1 mt-2">
        <ResponsiveContainer width="100%" height="100%">
          {label === "Sleep" ? (
            <BarChart data={data}>
              <Bar dataKey="v" fill={color} radius={[2, 2, 0, 0]} />
            </BarChart>
          ) : (
            <LineChart data={data}>
              <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BreakdownCard() {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-semibold flex items-center gap-2">Health Score Breakdown <Info className="h-3.5 w-3.5 text-muted-foreground" /></h3>
      <div className="mt-2 grid grid-cols-2 gap-2 items-center">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={breakdownData}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="dim" tick={{ fontSize: 10 }} />
              <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 10]} />
              <Radar dataKey="score" stroke="var(--accent)" fill="var(--accent)" fillOpacity={0.25} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
        <ul className="space-y-2 text-sm">
          {[
            { i: Moon, l: "Sleep", v: "8/10" },
            { i: Activity, l: "Activity", v: "7/10" },
            { i: Brain, l: "Stress", v: "7/10" },
            { i: Heart, l: "Recovery", v: "8/10" },
            { i: Utensils, l: "Nutrition", v: "6/10" },
          ].map((r) => (
            <li key={r.l} className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-muted-foreground"><r.i className="h-3.5 w-3.5" /> {r.l}</span>
              <span className="font-semibold">{r.v}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

const iconMap: Record<string, any> = { moon: Moon, brain: Brain, activity: Footprints, utensils: Utensils, droplet: Droplet };

function RecentLogsCard() {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Recent Logs</h3>
        <button className="text-xs font-semibold text-primary">View all</button>
      </div>
      <ul className="mt-4 space-y-3">
        {recentLogs.map((l) => {
          const Icon = iconMap[l.icon] ?? Activity;
          return (
            <li key={l.id} className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-accent-soft/60 flex items-center justify-center text-accent">
                <Icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">{l.type}</p>
                <p className="text-xs text-muted-foreground">{l.value} {l.note && <span className="text-success">● {l.note}</span>}</p>
              </div>
              <span className="text-xs text-muted-foreground">{l.time}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecommendationCard() {
  return (
    <div className="rounded-2xl bg-gradient-dark text-white p-6 shadow-elegant relative overflow-hidden">
      <div className="absolute -top-10 -right-10 h-40 w-40 bg-accent/20 blur-3xl rounded-full" />
      <p className="text-xs font-semibold flex items-center gap-1.5 text-accent">
        <Sparkles className="h-3.5 w-3.5" /> AI Recommendations
      </p>
      <h3 className="mt-3 text-2xl font-bold leading-tight">Take a 20-min walk after lunch</h3>
      <p className="mt-3 text-sm text-white/70 leading-relaxed">
        Your energy usually dips in the afternoon. A short walk can boost your energy and focus.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Button className="bg-accent text-accent-foreground hover:opacity-95 rounded-full font-semibold">Mark as Done</Button>
        <Button variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10 rounded-full">Not Now</Button>
        <Button variant="ghost" className="text-white/70 hover:text-white hover:bg-white/5 rounded-full">Why this?</Button>
      </div>
    </div>
  );
}

function WeeklyInsightCard() {
  return (
    <div className="lg:col-span-1 rounded-2xl bg-card border border-border shadow-card p-6 flex items-center gap-4">
      <div className="h-12 w-12 rounded-xl bg-accent-soft/60 flex items-center justify-center text-accent">
        <Lightbulb className="h-5 w-5" />
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Weekly Insight</p>
        <p className="text-sm font-semibold mt-0.5">Sleep consistency improved by 18% 🎉</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: "warning" | "primary" | "accent" }) {
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
