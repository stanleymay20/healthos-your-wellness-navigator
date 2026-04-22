import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { recentLogs } from "@/lib/mock-data";
import { Plus, Moon, Brain, Footprints, Utensils, Droplet, Activity } from "lucide-react";

export const Route = createFileRoute("/_app/logs")({
  head: () => ({ meta: [{ title: "Logs — HealthOS" }] }),
  component: Logs,
});

const iconMap: Record<string, any> = { moon: Moon, brain: Brain, activity: Footprints, utensils: Utensils, droplet: Droplet };

function Logs() {
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Health Logs</h1>
            <p className="text-sm text-muted-foreground">Everything you've logged. Manual entries + device sync.</p>
          </div>
          <Button onClick={() => setOpen(true)} className="bg-gradient-brand text-primary-foreground rounded-full">
            <Plus className="h-4 w-4 mr-1" /> Add log
          </Button>
        </header>
        <div className="rounded-2xl bg-card border border-border shadow-card divide-y divide-border">
          {recentLogs.map((l) => {
            const Icon = iconMap[l.icon] ?? Activity;
            return (
              <div key={l.id} className="flex items-center gap-4 p-4">
                <div className="h-10 w-10 rounded-xl bg-accent-soft/60 flex items-center justify-center text-accent">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{l.type}</p>
                  <p className="text-xs text-muted-foreground">{l.value}</p>
                </div>
                <span className="text-xs text-muted-foreground">{l.time}</span>
              </div>
            );
          })}
        </div>
      </div>

      <aside className={`lg:block ${open ? "block" : "hidden lg:block"}`}>
        <div className="rounded-2xl bg-card border border-border shadow-card p-5 space-y-4 lg:sticky lg:top-20">
          <h3 className="font-bold">Quick log</h3>
          <div className="space-y-3">
            <div><Label>Sleep (hours)</Label><Input className="rounded-xl mt-1" placeholder="7.5" /></div>
            <div><Label>Energy (1–10)</Label><Input className="rounded-xl mt-1" placeholder="7" /></div>
            <div><Label>Stress (1–10)</Label><Input className="rounded-xl mt-1" placeholder="4" /></div>
            <div><Label>Water (L)</Label><Input className="rounded-xl mt-1" placeholder="2.0" /></div>
            <div><Label>Exercise (min)</Label><Input className="rounded-xl mt-1" placeholder="30" /></div>
            <div><Label>Notes</Label><Textarea className="rounded-xl mt-1" placeholder="Mood, meals, symptoms…" /></div>
          </div>
          <Button className="w-full bg-gradient-brand text-primary-foreground rounded-xl">Save log</Button>
        </div>
      </aside>
    </div>
  );
}
