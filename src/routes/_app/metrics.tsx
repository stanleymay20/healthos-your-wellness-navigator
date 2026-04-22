import { createFileRoute } from "@tanstack/react-router";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import { trendData30d } from "@/lib/mock-data";

export const Route = createFileRoute("/_app/metrics")({
  head: () => ({ meta: [{ title: "Metrics — HealthOS" }] }),
  component: Metrics,
});

const metrics = ["Sleep", "Stress", "Energy", "Heart Rate", "HRV", "Steps"];

function Metrics() {
  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Metrics</h1>
        <p className="text-sm text-muted-foreground">Track every signal from your wearables and logs.</p>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        {metrics.map((m) => (
          <div key={m} className="rounded-2xl bg-card border border-border shadow-card p-5">
            <h3 className="font-semibold">{m}</h3>
            <div className="h-40 mt-3">
              <ResponsiveContainer>
                <AreaChart data={trendData30d}>
                  <defs>
                    <linearGradient id={`m-${m}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.4} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                  <YAxis hide />
                  <Area type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} fill={`url(#m-${m})`} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
