import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — HealthOS" }] }),
  component: Settings,
});

function Section({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-card p-6">
      <h3 className="font-bold">{title}</h3>
      <p className="text-sm text-muted-foreground">{desc}</p>
      <div className="mt-5 space-y-4">{children}</div>
    </div>
  );
}

function Settings() {
  return (
    <div className="max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-muted-foreground">Personalize HealthOS to fit your life.</p>
      </header>

      <Section title="Profile" desc="Your basic information.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input className="mt-1 rounded-xl" defaultValue="Alex Rivera" /></div>
          <div><Label>Email</Label><Input className="mt-1 rounded-xl" defaultValue="alex@email.com" /></div>
        </div>
      </Section>

      <Section title="Health Goals" desc="What are you optimizing for?">
        <div className="grid sm:grid-cols-2 gap-3">
          {["Better sleep", "Reduce stress", "More energy", "Build consistency", "General wellness", "Athletic performance"].map((g) => (
            <label key={g} className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted">
              <input type="checkbox" defaultChecked={g === "Better sleep"} className="accent-primary" />
              <span className="text-sm">{g}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Units & Preferences" desc="Display preferences.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Unit system</Label><Input className="mt-1 rounded-xl" defaultValue="Metric" /></div>
          <div><Label>Time zone</Label><Input className="mt-1 rounded-xl" defaultValue="Asia/Kolkata" /></div>
        </div>
      </Section>

      <Section title="Notifications" desc="Stay informed without the noise.">
        {[
          ["Daily check-in reminder", true],
          ["Weekly report", true],
          ["AI recommendations", true],
          ["Milestones & streaks", false],
        ].map(([label, def]) => (
          <div key={label as string} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Switch defaultChecked={def as boolean} />
          </div>
        ))}
      </Section>

      <Section title="Privacy" desc="Your data is yours. Always.">
        <div className="flex items-center justify-between">
          <span className="text-sm">Allow anonymized research use</span>
          <Switch />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button variant="outline" className="rounded-full">Export my data</Button>
          <Button variant="outline" className="rounded-full text-destructive border-destructive/30">Delete account</Button>
        </div>
      </Section>
    </div>
  );
}
