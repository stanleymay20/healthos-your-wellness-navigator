import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listInsights, type Insight } from "@/services/health";
import { Lightbulb, TrendingUp, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/insights")({
  head: () => ({ meta: [{ title: "Insights — HealthOS" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const [items, setItems] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listInsights(20).then(setItems).catch((e) => toast.error(e.message)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Your Insights</h1>
        <p className="text-muted-foreground text-sm mt-1">Patterns we found in your recent logs.</p>
      </header>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground text-sm">
          <Lightbulb className="h-5 w-5 mx-auto mb-2" />
          Add a daily log — insights appear automatically.
        </div>
      ) : (
        <div className="grid gap-4">
          {items.map((i) => {
            const Icon = i.type === "positive" ? TrendingUp : i.type === "warning" ? AlertTriangle : Lightbulb;
            const tone = i.type === "positive" ? "text-success bg-success/10" : i.type === "warning" ? "text-warning bg-warning/10" : "text-primary bg-primary/10";
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
        </div>
      )}
    </div>
  );
}
