import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  ACTIVE_VERSIONS,
  CONSENT_DOCS,
  DOC_LABELS,
  DOC_URLS,
  type ConsentDoc,
} from "@/lib/consent/versions";

export const Route = createFileRoute("/_app/settings")({
  head: () => ({ meta: [{ title: "Settings — HealthOS" }] }),
  component: Settings,
});

const HEALTH_GOALS = [
  "Better sleep",
  "Reduce stress",
  "More energy",
  "Build consistency",
  "General wellness",
  "Athletic performance",
];

type UnitSystem = "metric" | "imperial";

type NotificationPrefs = {
  daily_checkin: boolean;
  weekly_report: boolean;
  ai_recommendations: boolean;
  milestones: boolean;
};

const DEFAULT_NOTIFS: NotificationPrefs = {
  daily_checkin: true,
  weekly_report: true,
  ai_recommendations: true,
  milestones: false,
};

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
  const { user, session } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [healthGoal, setHealthGoal] = useState<string>("");
  const [unitSystem, setUnitSystem] = useState<UnitSystem>("metric");
  const [notifs, setNotifs] = useState<NotificationPrefs>(DEFAULT_NOTIFS);
  const [pendingDeleteAt, setPendingDeleteAt] = useState<string | null>(null);
  const [deletionBusy, setDeletionBusy] = useState(false);
  // Consent state: latest accepted version per document, or null if never.
  const [consentByDoc, setConsentByDoc] = useState<Record<ConsentDoc, { version: string; accepted_at: string } | null>>({
    tos: null,
    privacy: null,
  });
  const [consentBusy, setConsentBusy] = useState<ConsentDoc | null>(null);

  async function refreshConsent(userId: string) {
    const client = supabase as unknown as { from: (t: string) => any };
    const { data } = await client
      .from("consent_acceptances")
      .select("document, version, accepted_at")
      .eq("user_id", userId)
      .order("accepted_at", { ascending: false });
    const rows = (data ?? []) as Array<{
      document: ConsentDoc;
      version: string;
      accepted_at: string;
    }>;
    const next: Record<ConsentDoc, { version: string; accepted_at: string } | null> = {
      tos: null,
      privacy: null,
    };
    for (const row of rows) {
      // First row per document wins because we ordered DESC by accepted_at.
      if (next[row.document] === null) {
        next[row.document] = { version: row.version, accepted_at: row.accepted_at };
      }
    }
    setConsentByDoc(next);
  }

  async function acceptDoc(doc: ConsentDoc) {
    if (!user) return;
    setConsentBusy(doc);
    try {
      const client = supabase as unknown as { from: (t: string) => any };
      const { error } = await client.from("consent_acceptances").upsert(
        { user_id: user.id, document: doc, version: ACTIVE_VERSIONS[doc] },
        { onConflict: "user_id,document,version", ignoreDuplicates: true },
      );
      if (error) {
        toast.error(error.message);
        return;
      }
      await refreshConsent(user.id);
      toast.success(`Accepted ${DOC_LABELS[doc]} v${ACTIVE_VERSIONS[doc]}.`);
    } finally {
      setConsentBusy(null);
    }
  }

  async function refreshDeletionState(userId: string) {
    // account_deletions isn't in the generated Supabase types yet;
    // cast at the boundary (matches the pattern used in server-only files
    // for tables added after the last codegen).
    const client = supabase as unknown as { from: (t: string) => any };
    const { data } = await client
      .from("account_deletions")
      .select("scheduled_for, cancelled_at, executed_at")
      .eq("user_id", userId)
      .maybeSingle();
    const row = data as
      | { scheduled_for: string; cancelled_at: string | null; executed_at: string | null }
      | null;
    if (row && !row.cancelled_at && !row.executed_at) {
      setPendingDeleteAt(row.scheduled_for);
    } else {
      setPendingDeleteAt(null);
    }
  }

  async function requestDeletion() {
    const accessToken = session?.access_token;
    if (!user || !accessToken) {
      toast.error("Not signed in.");
      return;
    }
    if (!window.confirm(
      "Schedule your account for deletion in 30 days?\n\n" +
      "Your data stays intact during the grace period and you can undo at any time before then.",
    )) return;
    setDeletionBusy(true);
    try {
      const res = await fetch("/api/me/delete", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ confirm: true }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error((body?.error as string) || `Could not schedule deletion (${res.status})`);
        return;
      }
      setPendingDeleteAt(body.scheduledFor as string);
      toast.success("Account scheduled for deletion. You can undo any time before then.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletionBusy(false);
    }
  }

  async function cancelDeletion() {
    const accessToken = session?.access_token;
    if (!user || !accessToken) {
      toast.error("Not signed in.");
      return;
    }
    setDeletionBusy(true);
    try {
      const res = await fetch("/api/me/delete", {
        method: "DELETE",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || !body?.ok) {
        toast.error((body?.error as string) || `Could not cancel (${res.status})`);
        return;
      }
      setPendingDeleteAt(null);
      toast.success("Deletion cancelled. Your account is back to normal.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDeletionBusy(false);
    }
  }

  async function exportMyData() {
    const accessToken = session?.access_token;
    if (!accessToken) {
      toast.error("Not signed in.");
      return;
    }
    setExporting(true);
    try {
      const res = await fetch("/api/me/export", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        let msg = `Export failed (${res.status})`;
        try {
          const body = await res.json();
          if (body?.error) msg = body.error as string;
        } catch {
          /* swallow — keep generic message */
        }
        toast.error(msg);
        return;
      }
      // Browser download. Filename comes from the server's
      // Content-Disposition; fall back to a date-stamped default.
      const blob = await res.blob();
      const dispo = res.headers.get("Content-Disposition") ?? "";
      const match = dispo.match(/filename="?([^"]+)"?/i);
      const filename = match?.[1] ?? `healthos-export-${new Date().toISOString().slice(0, 10)}.json`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExporting(false);
    }
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("health_goal, unit_system, notification_preferences")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        toast.error(error.message);
      } else if (data) {
        setHealthGoal(data.health_goal ?? "");
        setUnitSystem(data.unit_system);
        setNotifs({ ...DEFAULT_NOTIFS, ...(data.notification_preferences as Partial<NotificationPrefs>) });
      }
      // Best-effort: surface a pending deletion if one exists.
      try { await refreshDeletionState(user.id); } catch { /* ignore */ }
      try { await refreshConsent(user.id); } catch { /* ignore */ }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [user]);

  async function save() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_preferences").upsert(
      {
        user_id: user.id,
        health_goal: healthGoal || null,
        unit_system: unitSystem,
        notification_preferences: notifs,
      },
      { onConflict: "user_id" },
    );
    setSaving(false);
    if (error) toast.error(error.message);
    else toast.success("Preferences saved.");
  }

  return (
    <div className="max-w-3xl space-y-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-muted-foreground">Personalize HealthOS to fit your life.</p>
        </div>
        <Button onClick={save} disabled={loading || saving || !user} className="rounded-full">
          {saving ? "Saving..." : "Save changes"}
        </Button>
      </header>

      <Section title="Profile" desc="Your basic information.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div><Label>Full name</Label><Input className="mt-1 rounded-xl" defaultValue="Alex Rivera" /></div>
          <div><Label>Email</Label><Input className="mt-1 rounded-xl" defaultValue={user?.email ?? ""} readOnly /></div>
        </div>
      </Section>

      <Section title="Health Goal" desc="What are you optimizing for?">
        <div className="grid sm:grid-cols-2 gap-3">
          {HEALTH_GOALS.map((g) => (
            <label key={g} className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted">
              <input
                type="radio"
                name="health_goal"
                checked={healthGoal === g}
                onChange={() => setHealthGoal(g)}
                className="accent-primary"
              />
              <span className="text-sm">{g}</span>
            </label>
          ))}
        </div>
      </Section>

      <Section title="Units & Preferences" desc="Display preferences.">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label>Unit system</Label>
            <Select value={unitSystem} onValueChange={(v) => setUnitSystem(v as UnitSystem)}>
              <SelectTrigger className="mt-1 rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="metric">Metric</SelectItem>
                <SelectItem value="imperial">Imperial</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Time zone</Label><Input className="mt-1 rounded-xl" defaultValue="Asia/Kolkata" /></div>
        </div>
      </Section>

      <Section title="Notifications" desc="Stay informed without the noise.">
        {([
          ["Daily check-in reminder", "daily_checkin"],
          ["Weekly report", "weekly_report"],
          ["AI recommendations", "ai_recommendations"],
          ["Milestones & streaks", "milestones"],
        ] as const).map(([label, key]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <Switch
              checked={notifs[key]}
              onCheckedChange={(v) => setNotifs((n) => ({ ...n, [key]: v }))}
            />
          </div>
        ))}
      </Section>

      <Section title="Legal" desc="Your acceptance history.">
        <ul className="space-y-3">
          {CONSENT_DOCS.map((doc) => {
            const accepted = consentByDoc[doc];
            const stale = accepted !== null && accepted.version !== ACTIVE_VERSIONS[doc];
            return (
              <li key={doc} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <a
                      href={DOC_URLS[doc]}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                    >
                      {DOC_LABELS[doc]}
                    </a>
                  </p>
                  {accepted ? (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Accepted v{accepted.version} on{" "}
                      {new Date(accepted.accepted_at).toLocaleDateString(undefined, {
                        dateStyle: "long",
                      })}
                      {stale && (
                        <span className="ml-2 text-warning font-semibold">
                          (current version is v{ACTIVE_VERSIONS[doc]})
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Not yet accepted. Current version v{ACTIVE_VERSIONS[doc]}.
                    </p>
                  )}
                </div>
                {(!accepted || stale) && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full shrink-0"
                    onClick={() => acceptDoc(doc)}
                    disabled={consentBusy === doc}
                  >
                    {consentBusy === doc ? "Accepting…" : "Accept now"}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Privacy" desc="Your data is yours. Always.">
        <div className="flex items-center justify-between">
          <span className="text-sm">Allow anonymized research use</span>
          <Switch />
        </div>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            variant="outline"
            className="rounded-full"
            onClick={exportMyData}
            disabled={exporting || !session?.access_token}
          >
            {exporting ? "Preparing…" : "Export my data"}
          </Button>
          {pendingDeleteAt ? (
            <Button
              variant="outline"
              className="rounded-full"
              onClick={cancelDeletion}
              disabled={deletionBusy}
            >
              {deletionBusy ? "Cancelling…" : "Undo deletion"}
            </Button>
          ) : (
            <Button
              variant="outline"
              className="rounded-full text-destructive border-destructive/30"
              onClick={requestDeletion}
              disabled={deletionBusy || !session?.access_token}
            >
              {deletionBusy ? "Scheduling…" : "Delete account"}
            </Button>
          )}
        </div>
        {pendingDeleteAt && (
          <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
            Account scheduled for deletion on{" "}
            <span className="font-semibold">
              {new Date(pendingDeleteAt).toLocaleDateString(undefined, { dateStyle: "long" })}
            </span>
            . Until then, your data is intact and you can undo at any time.
          </div>
        )}
      </Section>
    </div>
  );
}
