import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
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
  const navigate = useNavigate();
  const { user, signIn, signUp, resetPassword } = useAuth();

  useEffect(() => {
    if (user) navigate({ to: "/dashboard" });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Welcome back!");
        navigate({ to: "/dashboard" });
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, fullName);
        if (error) throw error;
        toast.success("Account created. Check your email to confirm.");
        // If email confirmation is disabled, session will exist immediately
        navigate({ to: "/dashboard" });
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
            <ShieldCheck className="h-3 w-3" /> Bank-level encryption · GDPR compliant
          </div>
        </div>
      </div>
    </div>
  );
}
