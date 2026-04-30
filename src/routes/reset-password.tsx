import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Logo } from "@/components/brand/Logo";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — HealthOS" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verifiedRecovery, setVerifiedRecovery] = useState(false);
  const [checkingRecovery, setCheckingRecovery] = useState(true);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const searchParams = new URLSearchParams(window.location.search);
    const isRecovery = hashParams.get("type") === "recovery" || searchParams.get("type") === "recovery";

    supabase.auth.getSession().then(({ data }) => {
      setVerifiedRecovery(isRecovery && Boolean(data.session));
      setCheckingRecovery(false);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!verifiedRecovery) {
      toast.error("Use the password reset link from your email to continue.");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
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
        {checkingRecovery ? (
          <div className="mt-8 flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin text-primary" /> Verifying reset link…
          </div>
        ) : !verifiedRecovery ? (
          <div className="mt-8 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <ShieldAlert className="h-5 w-5" />
              <h1 className="text-2xl font-bold">Reset link required</h1>
            </div>
            <p className="text-sm text-muted-foreground">Request a fresh password reset email before choosing a new password.</p>
            <Button asChild className="w-full h-11 bg-gradient-brand text-primary-foreground rounded-xl">
              <Link to="/auth">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <>
        <h1 className="mt-6 text-2xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Choose a strong password you haven't used before.</p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <Label htmlFor="pw">New password</Label>
            <Input id="pw" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 rounded-xl mt-1" />
          </div>
          <div>
            <Label htmlFor="confirm-pw">Confirm password</Label>
            <Input id="confirm-pw" type="password" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="h-11 rounded-xl mt-1" />
          </div>
          <Button disabled={loading} className="w-full h-11 bg-gradient-brand text-primary-foreground rounded-xl">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Update password"}
          </Button>
        </form>
          </>
        )}
      </div>
    </div>
  );
}
