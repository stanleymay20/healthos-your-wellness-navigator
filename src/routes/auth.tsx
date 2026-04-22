import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — HealthOS" }] }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const navigate = useNavigate();

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex relative bg-gradient-dark text-white p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -top-20 -left-20 h-80 w-80 bg-primary/30 blur-3xl rounded-full" />
        <div className="absolute bottom-0 right-0 h-80 w-80 bg-accent/30 blur-3xl rounded-full" />
        <Link to="/" className="relative z-10">
          <Logo variant="light" />
        </Link>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-bold leading-tight">
            Your personal health<br />operating system.
          </h2>
          <p className="mt-4 text-white/70">
            Predict, prevent, and perform — every single day.
          </p>
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
          <h1 className="text-3xl font-bold">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {mode === "signin" ? "Sign in to continue to your dashboard" : "Start your preventive health journey"}
          </p>
          <form
            className="mt-8 space-y-4"
            onSubmit={(e) => { e.preventDefault(); navigate({ to: "/dashboard" }); }}
          >
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" placeholder="Alex Rivera" className="h-11 rounded-xl" />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required placeholder="you@email.com" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required placeholder="••••••••" className="h-11 rounded-xl" />
            </div>
            <Button className="w-full h-11 bg-gradient-brand text-primary-foreground rounded-xl shadow-elegant">
              {mode === "signin" ? "Sign in" : "Create account"} <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </form>
          <p className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signin" ? "No account yet?" : "Already have an account?"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "signin" ? "Sign up" : "Sign in"}
            </button>
          </p>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3 w-3" /> Bank-level encryption · GDPR compliant
          </div>
        </div>
      </div>
    </div>
  );
}
