import { useEffect, useState } from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getOnboardingStatus } from "@/lib/onboarding";
import {
  ACTIVE_VERSIONS,
  CONSENT_DOCS,
  DOC_LABELS,
  DOC_URLS,
} from "@/lib/consent/versions";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Welcome — HealthOS" }] }),
  component: Onboarding,
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth" });
  },
});

const GOALS = [
  "Better sleep",
  "Reduce stress",
  "More energy",
  "Build consistency",
  "General wellness",
  "Athletic performance",
];

function Onboarding() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [goal, setGoal] = useState("");
  const [hydrating, setHydrating] = useState(true);
  const [saving, setSaving] = useState(false);
  const [acceptedTos, setAcceptedTos] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;
    (async () => {
      try {
        const status = await getOnboardingStatus(user.id);
        if (!active) return;
        if (status.complete) {
          navigate({ to: "/dashboard" });
          return;
        }
        const seedName =
          status.fullName ||
          ((user.user_metadata?.full_name as string | undefined) ?? "").trim();
        setFullName(seedName);
        setGoal(status.healthGoal);
        setHydrating(false);
      } catch (e) {
        if (!active) return;
        toast.error((e as Error).message);
        setHydrating(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, loading, navigate]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    const name = fullName.trim();
    if (!name || !goal) {
      toast.error("Please enter your name and pick a goal.");
      return;
    }
    if (!acceptedTos || !acceptedPrivacy) {
      toast.error("Please accept the Terms and Privacy Policy to continue.");
      return;
    }
    setSaving(true);
    // consent_acceptances isn't in the generated Supabase types yet —
    // boundary cast on this client. Idempotent: ignoreDuplicates so a
    // re-submit with the same versions doesn't 409.
    const consentClient = supabase as unknown as { from: (t: string) => any };
    const consentRows = CONSENT_DOCS.map((doc) => ({
      user_id: user.id,
      document: doc,
      version: ACTIVE_VERSIONS[doc],
    }));
    const [{ error: profileErr }, { error: prefsErr }, { error: consentErr }] =
      await Promise.all([
        supabase.from("profiles").upsert({ id: user.id, full_name: name }, { onConflict: "id" }),
        supabase
          .from("user_preferences")
          .upsert({ user_id: user.id, health_goal: goal }, { onConflict: "user_id" }),
        consentClient.from("consent_acceptances").upsert(consentRows, {
          onConflict: "user_id,document,version",
          ignoreDuplicates: true,
        }),
      ]);
    setSaving(false);
    if (profileErr || prefsErr || consentErr) {
      toast.error((profileErr ?? prefsErr ?? consentErr)!.message);
      return;
    }
    toast.success("You're all set!");
    navigate({ to: "/dashboard" });
  }

  if (loading || hydrating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-2xl bg-card border border-border shadow-card p-8">
        <div className="flex justify-center mb-6"><Logo /></div>
        <h1 className="text-2xl font-bold text-center">Welcome to HealthOS</h1>
        <p className="mt-2 text-sm text-muted-foreground text-center">
          Two quick details so we can tailor your experience.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <Label htmlFor="full_name">What should we call you?</Label>
            <Input
              id="full_name"
              className="mt-1 rounded-xl"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              autoFocus
            />
          </div>
          <div>
            <Label>What's your main goal?</Label>
            <div className="mt-2 grid sm:grid-cols-2 gap-2">
              {GOALS.map((g) => (
                <label
                  key={g}
                  className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer text-sm transition-colors ${
                    goal === g
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="goal"
                    checked={goal === g}
                    onChange={() => setGoal(g)}
                    className="accent-primary"
                  />
                  {g}
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-2 rounded-xl border border-border p-3 text-sm">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTos}
                onChange={(e) => setAcceptedTos(e.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>
                I agree to the{" "}
                <a href={DOC_URLS.tos} target="_blank" rel="noreferrer" className="text-primary underline">
                  {DOC_LABELS.tos}
                </a>{" "}
                <span className="text-muted-foreground">(v{ACTIVE_VERSIONS.tos})</span>
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedPrivacy}
                onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                className="mt-1 accent-primary"
              />
              <span>
                I agree to the{" "}
                <a href={DOC_URLS.privacy} target="_blank" rel="noreferrer" className="text-primary underline">
                  {DOC_LABELS.privacy}
                </a>{" "}
                <span className="text-muted-foreground">(v{ACTIVE_VERSIONS.privacy})</span>
              </span>
            </label>
          </div>
          <Button
            type="submit"
            className="w-full rounded-full"
            disabled={saving || !acceptedTos || !acceptedPrivacy}
          >
            {saving ? "Saving..." : "Continue to dashboard"}
          </Button>
        </form>
      </div>
    </div>
  );
}
