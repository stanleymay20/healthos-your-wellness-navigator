import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, Activity, Moon, Droplet, Brain } from "lucide-react";
import { listLogs, type HealthLog } from "@/services/health";
import { saveLogAndRefresh } from "@/services/engine";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";

export const Route = createFileRoute("/_app/logs")({
  head: () => ({ meta: [{ title: "Logs — HealthOS" }] }),
  component: Logs,
});

const initial = {
  sleep_hours: "",
  energy_level: "",
  stress_level: "",
  water_liters: "",
  exercise_minutes: "",
  meditation_minutes: "",
  meals_note: "",
  symptoms_note: "",
  mood: "",
};

function num(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function Logs() {
  const [logs, setLogs] = useState<HealthLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initial);

  async function refresh() {
    try {
      setLogs(await listLogs(50));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { refresh(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveLogAndRefresh({
        sleep_hours: num(form.sleep_hours),
        energy_level: num(form.energy_level),
        stress_level: num(form.stress_level),
        water_liters: num(form.water_liters),
        exercise_minutes: num(form.exercise_minutes),
        meditation_minutes: num(form.meditation_minutes),
        meals_note: form.meals_note || null,
        symptoms_note: form.symptoms_note || null,
        mood: form.mood || null,
      });
      toast.success("Log saved. Score and insights updated.");
      setForm(initial);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-4">
        <header>
          <h1 className="text-2xl font-bold">Health Logs</h1>
          <p className="text-sm text-muted-foreground">Everything you've logged. Adding a log refreshes your score.</p>
        </header>
        {loading ? (
          <div className="py-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : logs.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center text-muted-foreground">
            <Plus className="h-6 w-6 mx-auto mb-2" />
            No logs yet. Use the form to add your first entry.
          </div>
        ) : (
          <div className="rounded-2xl bg-card border border-border shadow-card divide-y divide-border">
            {logs.map((l) => (
              <div key={l.id} className="p-4">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{format(parseISO(l.log_date), "EEEE, MMM d")}</p>
                  <span className="text-xs text-muted-foreground">{format(parseISO(l.created_at), "h:mm a")}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {l.sleep_hours != null && <span className="inline-flex items-center gap-1"><Moon className="h-3 w-3" />{l.sleep_hours}h sleep</span>}
                  {l.energy_level != null && <span>⚡ Energy {l.energy_level}/10</span>}
                  {l.stress_level != null && <span className="inline-flex items-center gap-1"><Brain className="h-3 w-3" />Stress {l.stress_level}/10</span>}
                  {l.water_liters != null && <span className="inline-flex items-center gap-1"><Droplet className="h-3 w-3" />{l.water_liters}L</span>}
                  {l.exercise_minutes != null && <span className="inline-flex items-center gap-1"><Activity className="h-3 w-3" />{l.exercise_minutes}m</span>}
                  {l.meditation_minutes != null && l.meditation_minutes > 0 && <span>🧘 {l.meditation_minutes}m</span>}
                  {l.mood && <span>Mood: {l.mood}</span>}
                </div>
                {(l.meals_note || l.symptoms_note) && (
                  <div className="mt-2 text-xs text-muted-foreground space-y-1">
                    {l.meals_note && <p><span className="font-semibold text-foreground">Meals: </span>{l.meals_note}</p>}
                    {l.symptoms_note && <p><span className="font-semibold text-foreground">Notes: </span>{l.symptoms_note}</p>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <aside>
        <form onSubmit={handleSubmit} className="rounded-2xl bg-card border border-border shadow-card p-5 space-y-4 lg:sticky lg:top-20">
          <div>
            <h3 className="font-bold">Add today's log</h3>
            <p className="text-xs text-muted-foreground">Saving updates your score and recommendations.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sleep (h)" v={form.sleep_hours} on={(v) => setForm({ ...form, sleep_hours: v })} placeholder="7.5" />
            <Field label="Water (L)" v={form.water_liters} on={(v) => setForm({ ...form, water_liters: v })} placeholder="2.0" />
            <Field label="Energy 1-10" v={form.energy_level} on={(v) => setForm({ ...form, energy_level: v })} placeholder="7" />
            <Field label="Stress 1-10" v={form.stress_level} on={(v) => setForm({ ...form, stress_level: v })} placeholder="4" />
            <Field label="Exercise (m)" v={form.exercise_minutes} on={(v) => setForm({ ...form, exercise_minutes: v })} placeholder="30" />
            <Field label="Meditation (m)" v={form.meditation_minutes} on={(v) => setForm({ ...form, meditation_minutes: v })} placeholder="10" />
          </div>
          <div>
            <Label className="text-xs">Mood</Label>
            <Input className="rounded-xl mt-1" placeholder="e.g. focused, tired" value={form.mood} onChange={(e) => setForm({ ...form, mood: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Meals</Label>
            <Textarea className="rounded-xl mt-1" placeholder="Quick note on what you ate" value={form.meals_note} onChange={(e) => setForm({ ...form, meals_note: e.target.value })} />
          </div>
          <div>
            <Label className="text-xs">Symptoms / notes</Label>
            <Textarea className="rounded-xl mt-1" placeholder="Anything off today?" value={form.symptoms_note} onChange={(e) => setForm({ ...form, symptoms_note: e.target.value })} />
          </div>
          <Button disabled={saving} className="w-full bg-gradient-brand text-primary-foreground rounded-xl h-11">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save log"}
          </Button>
        </form>
      </aside>
    </div>
  );
}

function Field({ label, v, on, placeholder }: { label: string; v: string; on: (v: string) => void; placeholder: string }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input className="rounded-xl mt-1" inputMode="decimal" value={v} onChange={(e) => on(e.target.value)} placeholder={placeholder} />
    </div>
  );
}
