import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/landing/Header";
import { MarketingFooter } from "@/components/landing/Footer";
import { HeroPreview } from "@/components/landing/HeroPreview";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, Play, ShieldCheck, Activity, Brain, Target,
  TrendingUp, Lock, CheckCircle2, Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "HealthOS — Understand. Predict. Act. Live Better." },
      {
        name: "description",
        content:
          "HealthOS is the AI-powered preventive health platform. Turn your daily data into personalized insights, predictions, and actions.",
      },
      { property: "og:title", content: "HealthOS — Your Personal Health Operating System" },
      { property: "og:description", content: "AI-powered preventive health intelligence." },
    ],
  }),
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <Hero />
      <TrustRow />
      <Features />
      <Showcase />
      <Testimonial />
      <CTASection />
      <MarketingFooter />
    </div>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden bg-gradient-hero">
      <div className="absolute top-20 right-0 h-96 w-96 bg-primary/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 h-96 w-96 bg-accent/10 rounded-full blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent-soft/50 px-3 py-1 text-xs font-semibold text-accent">
            <Sparkles className="h-3 w-3" /> AI-POWERED HEALTH INTELLIGENCE
          </div>
          <h1 className="mt-6 text-5xl md:text-6xl font-bold leading-[1.05]">
            Understand.<br />
            Predict. Act.<br />
            <span className="text-gradient-brand">Live Better.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
            HealthOS turns your daily data into personalized insights, predicts what's ahead,
            and guides you to take the right action—every day.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-brand text-primary-foreground rounded-full px-7 h-12 shadow-elegant hover:opacity-95">
                Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Button size="lg" variant="outline" className="rounded-full px-7 h-12 border-border bg-card">
              <Play className="mr-2 h-4 w-4" /> See How It Works
            </Button>
          </div>
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Your data is encrypted and 100% private
          </div>
        </div>
        <HeroPreview />
      </div>
    </section>
  );
}

function TrustRow() {
  const logos = ["Google for Startups", "IIT Bombay", "Indian Angel Network", "EXIST", "NASSCOM"];
  return (
    <section className="border-y border-border/50 bg-background py-10">
      <div className="mx-auto max-w-7xl px-6">
        <p className="text-center text-xs font-semibold tracking-widest text-muted-foreground">
          TRUSTED BY INNOVATORS AND HEALTH LEADERS
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-12 gap-y-4 opacity-70">
          {logos.map((l) => (
            <span key={l} className="text-sm font-semibold text-muted-foreground tracking-tight">
              {l}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Features() {
  const items = [
    { icon: Activity, title: "All Your Data, Unified", desc: "Connect wearables, apps, and inputs in one place. We organize the noise." },
    { icon: Brain, title: "AI Health Intelligence", desc: "Our AI finds patterns, detects risks early, and predicts what's next." },
    { icon: Target, title: "Personalized Actions", desc: "Get daily recommendations that are specific, actionable, and easy to follow." },
    { icon: TrendingUp, title: "Track What Matters", desc: "See what improves your health and what doesn't—clearly." },
    { icon: Lock, title: "Privacy First", desc: "Bank-level encryption. Your data belongs to you, always." },
  ];
  return (
    <section id="features" className="py-24 bg-background">
      <div className="mx-auto max-w-7xl px-6">
        <h2 className="text-center text-3xl md:text-4xl font-bold max-w-3xl mx-auto">
          Everything you need to stay <span className="text-gradient-brand">ahead</span> of your health
        </h2>
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {items.map((it) => (
            <div key={it.title} className="text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-accent-soft/60 flex items-center justify-center text-primary shadow-card">
                <it.icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-base font-bold">{it.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{it.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="how" className="py-20 bg-background">
      <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-3xl bg-gradient-dark text-white p-10 md:p-14 relative overflow-hidden">
          <div className="absolute -right-10 top-10 h-72 w-72 bg-accent/20 blur-3xl rounded-full" />
          <p className="text-xs font-semibold tracking-widest text-accent">PREDICT. PREVENT. PERFORM.</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold leading-tight">
            Stay Ahead.<br />Not Just Aware.
          </h2>
          <p className="mt-5 max-w-md text-white/70 leading-relaxed">
            HealthOS doesn't just show you what happened. It predicts what's coming—so you can
            take action before it affects you.
          </p>
          <ul className="mt-7 space-y-3 max-w-md">
            {[
              "Illness & fatigue prediction",
              "Burnout risk detection",
              "Performance optimization",
              "Habit impact analysis",
            ].map((b) => (
              <li key={b} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-accent" /> {b}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl bg-accent-soft/40 p-8 flex flex-col justify-between">
          <div>
            <p className="text-3xl text-accent font-serif">"</p>
            <p className="mt-2 text-base font-semibold leading-relaxed">
              HealthOS changed the way I understand my body. I have more energy, sleep better,
              and feel in control.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-brand" />
              <div>
                <p className="text-sm font-bold">Rohan Mehta</p>
                <p className="text-xs text-muted-foreground">Product Manager</p>
              </div>
            </div>
          </div>
          <div className="mt-8 grid grid-cols-3 gap-2 text-center">
            {[["10K+", "Active Users"], ["4.8★", "Rating"], ["25+", "Integrations"]].map(([v, l]) => (
              <div key={l}>
                <p className="text-xl font-bold">{v}</p>
                <p className="text-[10px] text-muted-foreground">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Testimonial() { return null; }

function CTASection() {
  return (
    <section className="py-20">
      <div className="mx-auto max-w-5xl px-6 rounded-3xl bg-card border border-border shadow-card p-10 md:p-14 text-center">
        <h2 className="text-3xl md:text-4xl font-bold">Ready to take control of your health?</h2>
        <p className="mt-3 text-muted-foreground">Join thousands using HealthOS to live better every day.</p>
        <div className="mt-7 flex justify-center">
          <Link to="/auth">
            <Button size="lg" className="bg-gradient-brand text-primary-foreground rounded-full px-8 h-12 shadow-elegant">
              Get Started Free <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
