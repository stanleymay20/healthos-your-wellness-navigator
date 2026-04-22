import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { devices } from "@/lib/mock-data";
import { Watch, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isIntegratedProvider } from "@/lib/providers";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/devices")({
  head: () => ({ meta: [{ title: "Devices — HealthOS" }] }),
  component: Devices,
});

type ConnectionStatus = "connected" | "disconnected" | "pending";
type ConnectionRow = {
  provider: string;
  status: ConnectionStatus;
  external_user_id: string | null;
  last_synced_at: string | null;
};

function Devices() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, ConnectionRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("device_connections")
        .select("provider, status, external_user_id, last_synced_at")
        .eq("user_id", user.id);
      if (!active) return;
      if (error) toast.error(error.message);
      else {
        const map: Record<string, ConnectionRow> = {};
        for (const r of data ?? []) map[r.provider] = r as ConnectionRow;
        setRows(map);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function toggle(provider: string, next: ConnectionStatus) {
    if (!user || busy.has(provider)) return;
    setBusy((b) => new Set(b).add(provider));
    const prev = rows[provider];
    const nowIso = new Date().toISOString();
    const optimistic: ConnectionRow = {
      provider,
      status: next,
      external_user_id: prev?.external_user_id ?? null,
      last_synced_at: next === "connected" ? nowIso : (prev?.last_synced_at ?? null),
    };
    setRows((r) => ({ ...r, [provider]: optimistic }));
    const { error } = await supabase.from("device_connections").upsert(
      {
        user_id: user.id,
        provider,
        status: next,
        last_synced_at: optimistic.last_synced_at,
      },
      { onConflict: "user_id,provider" },
    );
    setBusy((b) => {
      const n = new Set(b);
      n.delete(provider);
      return n;
    });
    if (error) {
      setRows((r) => {
        const n = { ...r };
        if (prev) n[provider] = prev;
        else delete n[provider];
        return n;
      });
      toast.error(error.message);
      return;
    }
    toast.success(next === "connected" ? "Device connected" : "Device disconnected");
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Connected Devices</h1>
        <p className="text-sm text-muted-foreground">Sync your wearables and health apps to enrich your insights.</p>
      </header>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {devices.map((d) => {
            const row = rows[d.id];
            const connected = row?.status === "connected";
            const comingSoon = d.status === "coming-soon";
            const pending = busy.has(d.id);
            return (
              <div key={d.id} className="rounded-2xl bg-card border border-border shadow-card p-6">
                <div className="flex items-start justify-between">
                  <div className="h-12 w-12 rounded-xl bg-gradient-brand flex items-center justify-center text-white">
                    <Watch className="h-5 w-5" />
                  </div>
                  {comingSoon ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-muted text-muted-foreground rounded-full px-2 py-1">
                      Coming Soon
                    </span>
                  ) : connected ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-success/15 text-success rounded-full px-2 py-1">
                      Connected
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-4 font-bold">{d.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{d.description}</p>
                {connected && row?.last_synced_at && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Last synced {new Date(row.last_synced_at).toLocaleString()}
                  </p>
                )}
                <Button
                  disabled={comingSoon || pending}
                  onClick={() => {
                    if (comingSoon) return;
                    if (isIntegratedProvider(d.id) && !connected) {
                      toast.info("Real OAuth connection is landing soon.");
                      return;
                    }
                    toggle(d.id, connected ? "disconnected" : "connected");
                  }}
                  className={`mt-5 w-full rounded-xl ${
                    comingSoon
                      ? "bg-muted text-muted-foreground"
                      : connected
                        ? "bg-muted text-foreground hover:bg-muted/80"
                        : "bg-gradient-brand text-primary-foreground"
                  }`}
                >
                  {pending ? (
                    <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Working…</>
                  ) : comingSoon ? (
                    "Notify me"
                  ) : connected ? (
                    <><RefreshCw className="h-4 w-4 mr-1" /> Disconnect</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-1" /> Connect</>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
