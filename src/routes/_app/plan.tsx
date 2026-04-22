import { createFileRoute } from "@tanstack/react-router";
import { recommendations } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, X } from "lucide-react";

export const Route = createFileRoute("/_app/plan")({
  head: () => ({ meta: [{ title: "Plan — HealthOS" }] }),
  component: Plan,
});

function Plan() {
  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Today's Plan</h1>
        <p className="text-sm text-muted-foreground">Personalized actions to improve your health today.</p>
      </header>
      <div className="space-y-3">
        {recommendations.map((r) => (
          <div key={r.id} className="rounded-2xl bg-card border border-border shadow-card p-5">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-xs font-bold">
                {r.priority === "high" ? "1" : r.priority === "medium" ? "2" : "3"}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-accent uppercase tracking-wider">{r.category}</span>
                  <span className="text-xs text-muted-foreground">· {r.priority} priority</span>
                </div>
                <h3 className="mt-1 font-bold">{r.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" className="bg-success text-white hover:opacity-95 rounded-full">
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as Done
                  </Button>
                  <Button size="sm" variant="outline" className="rounded-full">
                    <Clock className="h-3.5 w-3.5 mr-1" /> Snooze
                  </Button>
                  <Button size="sm" variant="ghost" className="rounded-full text-muted-foreground">
                    <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
