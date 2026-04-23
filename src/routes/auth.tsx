import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, ShieldCheck, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { getOnboardingStatus } from "@/lib/onboarding";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — HealthOS" }] }),
  component: AuthPage,
});

type Mode = "signin" | "signup" | "forgot";

function AuthPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  // When signup succeeds but email confirmation is required, Supabase
  // returns user=null,session=null. We stay on this page and show an
  // explicit "check your inbox" state instead of redirecting to a
  // dashboard that will just bounce the user right back.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword } = useAuth();

  // Handle the return from a confirmation email and route existing
  // sessions via the onboarding gate so users with incomplete profiles
  // don't flash the dashboard on their way to /onboarding.
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("confirmed") === "1") {
        toast.success("Email confirmed. Sign in to continue.");
        params.delete("confirmed");
        const qs = params.toString();
        window.history.replaceState(
          {},
          "",
          window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash,
        );
      }
    }
    if (!user) return;
    let active = true;
    (async () => {
      try {
        const status = await getOnboardingStatus(user.id);
        if (!active) return;
        navigate({ to: status.complete ? "/dashboard" : "/onboarding" });
      } catch {
        if (active) navigate({ to: "/dashboard" });
      }
    })();
    return () => {
      active = false;
    };
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Welcome back!");
        // Route via onboarding status so incomplete profiles don't
        // flash the dashboard before being redirected.
        // user state will update via onAuthStateChange; the effect
        // above handles the navigate.
      } else if (mode === "signup") {
        const { session, error } = await signUp(email, password, fullName);
        if (error) throw error;
        if (!session) {
          // Email confirmation required — stay on this page with a
          // clear "check your inbox" state instead of a silent redirect.
          setAwaitingConfirmation(email);
          toast.success("Account created. Check your email to confirm.");
        } else {
          toast.success("Account created.");
          // Same route-via-onboarding pathway as sign-in.
        }
      } else {
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast.success("Password reset email sent.");
        setMode("signin");
      }
    } catch (err) {
      toast.error((err as Error).message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const title = mode === "signin" ? "Welcome back" : mode === "signup" ? "Create your account" : "Reset your password";
  const subtitle =
    mode === "signin"
      ? "Sign in to continue to your dashboard"
      : mode === "signup"
        ? "Start your preventive health journey"
        : "We'll email you a reset link";

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-gradient-dark text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -top-20 -left-20 h-80 w-80 bg-primary/30 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 h-80 w-80 bg-accent/30 blur-3xl rounded-full" />
        <Link to="/" className="relative z-10"><Logo variant="light" /></Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Your personal health<br />operating system.
          </h2>
          <p className="mt-4 text-white/70">Predict, prevent, and perform — every single day.</p>
          <div className="mt-8 grid grid-cols-3 gap-4 text-center">
            {[["10K+", "Users"], ["4.8★", "Rating"], ["25+", "Devices"]].map(([v, l]) => (
              <div key={l} className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-xl font-bold">{v}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-wider">{l}</p>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-white/50">© HealthOS · Encrypted · 100% private</p>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8"><Link to="/"><Logo /></Link></div>
          <h1 className="text-3xl font-bold">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          {awaitingConfirmation && (
            <div className="mt-6 rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-start gap-3">
              <Mail className="h-5 w-5 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-semibold">Check your inbox</p>
                <p className="text-xs text-muted-foreground mt-1 break-words">
                  We sent a confirmation link to <span className="font-semibold">{awaitingConfirmation}</span>. Open it to activate your account, then sign in here.
                </p>
                <button
                  type="button"
                  onClick={() => { setAwaitingConfirmation(null); setMode("signin"); }}
                  className="mt-2 text-xs text-primary font-semibold hover:underline"
                >
                  Back to sign in
                </button>
              </div>
            </div>
          )}
          <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" className="h-11 rounded-xl" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="h-11 rounded-xl" />
            </div>
            {mode !== "forgot" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {mode === "signin" && (
                    <button type="button" onClick={() => setMode("forgot")} className="text-xs text-primary hover:underline">
                      Forgot?
                    </button>
                  )}
                </div>
                <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="h-11 rounded-xl" />
              </div>
            )}
            <Button disabled={loading} className="w-full h-11 bg-gradient-brand text-primary-foreground rounded-xl shadow-elegant">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <>
                  {mode === "signin" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </>
              )}
            </Button>
          </form>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signin" && (
              <>No account yet? <button onClick={() => setMode("signup")} className="text-primary font-semibold hover:underline">Sign up</button></>
            )}
            {mode === "signup" && (
              <>Already have an account? <button onClick={() => setMode("signin")} className="text-primary font-semibold hover:underline">Sign in</button></>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("signin")} className="text-primary font-semibold hover:underline">Back to sign in</button>
            )}
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Encrypted in transit and at rest
          </div>
        </div>
      </div>
    </div>
  );
}
