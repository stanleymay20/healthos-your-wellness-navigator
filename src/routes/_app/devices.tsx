import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { devices } from "@/lib/mock-data";
import { Watch, CheckCircle2, Loader2, RefreshCw, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { isIntegratedProvider } from "@/lib/providers";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/devices")({
  head: () => ({ meta: [{ title: "Devices — HealthOS" }] }),
  component: Devices,
});

type ConnectionStatus = "connected" | "disconnected" | "pending" | "syncing";
type ConnectionRow = {
  provider: string;
  status: ConnectionStatus;
  external_user_id: string | null;
  last_synced_at: string | null;
  sync_error: string | null;
};

function Devices() {
  const { user, session } = useAuth();
  const [rows, setRows] = useState<Record<string, ConnectionRow>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState<Set<string>>(new Set());

  async function loadRows(userId: string) {
    // sync_error landed in a later migration; the generated types file
    // hasn't been regenerated yet. Pin the select return type.
    const { data, error } = await supabase
      .from("device_connections")
      .select("provider, status, external_user_id, last_synced_at, sync_error")
      .eq("user_id", userId)
      .returns<ConnectionRow[]>();
    if (error) {
      toast.error(error.message);
      return;
    }
    const map: Record<string, ConnectionRow> = {};
    for (const r of data ?? []) map[r.provider] = r;
    setRows(map);
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      await loadRows(user.id);
      if (active) setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  // Handle ?oauth=... on mount (from the server-side Oura callback redirect).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("oauth");
    if (!outcome) return;
    if (outcome === "connected") toast.success("Oura connected.");
    else if (outcome.startsWith("denied")) toast.error("Oura authorization was denied.");
    else if (outcome.startsWith("error")) toast.error("Oura connection failed. Please try again.");
    params.delete("oauth");
    const qs = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
    );
  }, []);

  async function toggle(provider: string, next: "connected" | "disconnected") {
    if (!user || busy.has(provider)) return;
    setBusy((b) => new Set(b).add(provider));
    const prev = rows[provider];
    const nowIso = new Date().toISOString();
    const optimistic: ConnectionRow = {
      provider,
      status: next,
      external_user_id: prev?.external_user_id ?? null,
      last_synced_at: next === "connected" ? nowIso : (prev?.last_synced_at ?? null),
      sync_error: null,
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

  async function syncNow(provider: string) {
    if (!user || syncing.has(provider)) return;
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("Not signed in.");
      return;
    }
    setSyncing((s) => new Set(s).add(provider));
    try {
      const res = await fetch(`/api/integrations/${provider}/sync`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || body?.ok === false) {
        const msg = (body?.error as string) || `Sync failed (${res.status})`;
        toast.error(msg);
      } else {
        const days = Number(body?.daysWritten ?? 0);
        toast.success(days > 0 ? `Synced ${days} day${days === 1 ? "" : "s"}.` : "Sync complete — no new data.");
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSyncing((s) => {
        const n = new Set(s);
        n.delete(provider);
        return n;
      });
      await loadRows(user.id);
    }
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
            const status = row?.status;
            const connected = status === "connected" || status === "syncing";
            const isSyncing = status === "syncing" || syncing.has(d.id);
            const comingSoon = d.status === "coming-soon";
            const pending = busy.has(d.id);
            const integrated = isIntegratedProvider(d.id);
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
                  ) : isSyncing ? (
                    <span className="text-[10px] font-semibold uppercase tracking-wider bg-primary/15 text-primary rounded-full px-2 py-1 flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> Syncing
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
                {row?.sync_error && (
                  <div className="mt-2 flex items-start gap-1.5 rounded-lg bg-destructive/5 border border-destructive/20 px-2 py-1.5 text-xs text-destructive">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span className="min-w-0 break-words">{row.sync_error}</span>
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2">
                  <Button
                    disabled={comingSoon || pending || isSyncing}
                    onClick={() => {
                      if (comingSoon) return;
                      if (integrated && !connected) {
                        toast.info("Real OAuth connection is landing soon.");
                        return;
                      }
                      toggle(d.id, connected ? "disconnected" : "connected");
                    }}
                    className={`w-full rounded-xl ${
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
                  {integrated && connected && (
                    <Button
                      variant="outline"
                      disabled={isSyncing}
                      onClick={() => syncNow(d.id)}
                      className="w-full rounded-xl"
                    >
                      {isSyncing ? (
                        <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Syncing…</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-1" /> Sync now</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
