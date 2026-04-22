import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { devices } from "@/lib/mock-data";
import { Watch, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_app/devices")({
  head: () => ({ meta: [{ title: "Devices — HealthOS" }] }),
  component: Devices,
});

function Devices() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Connected Devices</h1>
        <p className="text-sm text-muted-foreground">Sync your wearables and health apps to enrich your insights.</p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {devices.map((d) => (
          <div key={d.id} className="rounded-2xl bg-card border border-border shadow-card p-6">
            <div className="flex items-start justify-between">
              <div className="h-12 w-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white">
                <Watch className="h-5 w-5" />
              </div>
              {d.status === "coming-soon" && (
                <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground rounded-full px-2 py-1">
                  Coming Soon
                </span>
              )}
            </div>
            <h3 className="mt-4 font-bold">{d.name}</h3>
            <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
            <Button
              disabled={d.status === "coming-soon"}
              className={`mt-5 w-full rounded-xl ${
                d.status === "available"
                  ? "bg-gradient-brand text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {d.status === "available" ? <><CheckCircle2 className="h-4 w-4 mr-1" /> Connect</> : "Notify me"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
