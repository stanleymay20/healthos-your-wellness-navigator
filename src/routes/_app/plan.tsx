import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Clock, X, Loader2, Sparkles } from "lucide-react";
import { listTodaysRecommendations, updateRecommendationStatus, type Recommendation } from "@/services/health";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/plan")({
  head: () => ({ meta: [{ title: "Plan — HealthOS" }] }),
  component: PlanPage,
});

function PlanPage() {
  const [items, setItems] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());

  async function refresh() {
    try { setItems(await listTodaysRecommendations()); }
    catch (e) { toast.error((e as Error).message); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refresh();
    const onFocus = () => refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  async function update(id: string, status: Recommendation["status"]) {
    if (pending.has(id)) return;
    setPending((p) => new Set(p).add(id));
    const prev = items;
    const completed_at = status === "done" ? new Date().toISOString() : null;
    setItems((cur) => cur.map((r) => (r.id === id ? { ...r, status, completed_at } : r)));
    try {
      await updateRecommendationStatus(id, status);
      toast.success(status === "done" ? "Done!" : status === "snoozed" ? "Snoozed" : "Dismissed");
      await refresh();
    } catch (e) {
      setItems(prev);
      toast.error((e as Error).message);
    } finally {
      setPending((p) => {
        const next = new Set(p);
        next.delete(id);
        return next;
      });
    }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Today's Plan</h1>
        <p className="text-sm text-muted-foreground">Personalized actions based on your latest log.</p>
      </header>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
          <Sparkles className="h-5 w-5 mx-auto mb-2" />
          Add a log today to generate your plan.
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((r, i) => (
            <div key={r.id} className={`rounded-2xl bg-card border border-border shadow-card p-5 ${r.status !== "pending" ? "opacity-60" : ""}`}>
              <div className="flex items-start gap-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-brand flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-accent uppercase tracking-wider">{r.category}</span>
                    <span className="text-xs text-muted-foreground">· {r.priority} priority</span>
                    {r.status !== "pending" && (
                      <span className="text-xs text-muted-foreground">· {r.status}</span>
                    )}
                  </div>
                  <h3 className="mt-1 font-bold">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
                  {r.status === "pending" && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button size="sm" disabled={pending.has(r.id)} onClick={() => update(r.id, "done")} className="bg-success text-white hover:opacity-95 rounded-full">
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Mark as Done
                      </Button>
                      <Button size="sm" variant="outline" disabled={pending.has(r.id)} onClick={() => update(r.id, "snoozed")} className="rounded-full">
                        <Clock className="h-3.5 w-3.5 mr-1" /> Snooze
                      </Button>
                      <Button size="sm" variant="ghost" disabled={pending.has(r.id)} onClick={() => update(r.id, "dismissed")} className="rounded-full text-muted-foreground">
                        <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
