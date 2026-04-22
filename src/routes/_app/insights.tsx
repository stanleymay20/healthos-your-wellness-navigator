import { createFileRoute } from "@tanstack/react-router";
import { insights } from "@/lib/mock-data";
import { Lightbulb, TrendingUp, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_app/insights")({
  head: () => ({ meta: [{ title: "Insights — HealthOS" }] }),
  component: Insights,
});

function Insights() {
  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Your Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">Patterns we found in your data this week.</p>
      </header>
      <div className="grid gap-4">
        {insights.map((i) => {
          const Icon = i.type === "positive" ? TrendingUp : AlertTriangle;
          const tone = i.type === "positive" ? "text-success bg-success/10" : "text-warning bg-warning/10";
          return (
            <div key={i.id} className="rounded-2xl bg-card border border-border shadow-card p-6 flex gap-5">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold">{i.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{i.description}</p>
              </div>
            </div>
          );
        })}
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-muted-foreground text-sm">
          <Lightbulb className="h-5 w-5 mx-auto mb-2" />
          More insights unlock as you log more data.
        </div>
      </div>
    </div>
  );
}
