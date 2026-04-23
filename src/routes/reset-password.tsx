import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { Loader2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — HealthOS" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  // Recovery gate: only allow updateUser({password}) after Supabase has
  // fired a PASSWORD_RECOVERY event (or after the URL hash is confirmed
  // to include type=recovery). Without this, any already-signed-in user
  // who lands on this page could overwrite their own password with no
  // current-password check — a classic account-takeover surface.
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === "undefined") return;
    // detectSessionInUrl (Supabase default) parses the recovery hash and
    // emits a PASSWORD_RECOVERY event. Subscribe FIRST so we don't miss it.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryReady(true);
    });

    // If the hash does not look like a recovery token, treat the link
    // as invalid. (If the user arrived from a real Supabase reset email
    // the hash will carry `type=recovery` plus an access token.)
    const hash = window.location.hash.slice(1);
    const hashParams = new URLSearchParams(hash);
    const looksLikeRecovery = hashParams.get("type") === "recovery";
    if (!looksLikeRecovery) {
      // Give onAuthStateChange a brief window in case detectSessionInUrl
      // has already consumed the hash; if no event arrives shortly the
      // link is genuinely not a recovery link.
      const t = setTimeout(() => {
        setRecoveryReady((ready) => {
          if (!ready) setLinkInvalid(true);
          return ready;
        });
      }, 1500);
      return () => {
        clearTimeout(t);
        sub.subscription.unsubscribe();
      };
    }

    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recoveryReady) {
      toast.error("This reset link is no longer valid. Request a new one.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Use at least 8 characters.");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated.");
      navigate({ to: "/dashboard" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-hero">
      <div className="w-full max-w-md rounded-2xl bg-card border border-border shadow-elegant p-8">
        <Logo />
        <h1 className="mt-6 text-2xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>

        {linkInvalid ? (
          <div className="mt-6 rounded-xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-destructive mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-destructive">Invalid or expired link</p>
              <p className="text-xs text-muted-foreground mt-1">
                Request a new password reset from the sign-in page.
              </p>
              <button
                type="button"
                onClick={() => navigate({ to: "/auth" })}
                className="mt-2 text-xs text-primary font-semibold hover:underline"
              >
                Back to sign in
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <Label htmlFor="pw">New password</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl mt-1"
                autoComplete="new-password"
              />
            </div>
            <div>
              <Label htmlFor="pw2">Confirm new password</Label>
              <Input
                id="pw2"
                type="password"
                required
                minLength={8}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-xl mt-1"
                autoComplete="new-password"
              />
            </div>
            <Button
              disabled={loading || !recoveryReady}
              className="w-full h-11 bg-gradient-brand text-primary-foreground rounded-xl"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : recoveryReady ? (
                "Update password"
              ) : (
                "Waiting for reset link…"
              )}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
