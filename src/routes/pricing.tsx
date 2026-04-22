import { createFileRoute, Link } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/landing/Header";
import { MarketingFooter } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — HealthOS" },
      { name: "description", content: "Simple plans for proactive health. Start free." },
      { property: "og:title", content: "HealthOS Pricing" },
      { property: "og:description", content: "Simple plans for proactive health. Start free." },
    ],
  }),
  component: Pricing,
});

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    desc: "Get started with daily tracking and core insights.",
    features: ["Daily health score", "Manual logging", "Basic insights", "1 device connection"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    price: "$12",
    period: "/month",
    desc: "AI coaching, predictions, and unlimited integrations.",
    features: ["Everything in Free", "AI recommendations", "Risk forecasts", "Unlimited devices", "Weekly reports", "Priority support"],
    cta: "Start 14-day Trial",
    highlight: true,
  },
  {
    name: "Family",
    price: "$24",
    period: "/month",
    desc: "Up to 5 members on one plan.",
    features: ["Everything in Pro", "5 family members", "Shared insights", "Family dashboard"],
    cta: "Get Family",
    highlight: false,
  },
];

function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="py-20 bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold">Simple, honest pricing</h1>
          <p className="mt-4 text-lg text-muted-foreground">Start free. Upgrade when you're ready.</p>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 grid gap-6 md:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`rounded-3xl p-8 border ${
                t.highlight
                  ? "bg-gradient-dark text-white border-transparent shadow-elegant"
                  : "bg-card border-border shadow-card"
              }`}
            >
              <h3 className="text-sm font-semibold uppercase tracking-widest opacity-70">{t.name}</h3>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="text-5xl font-bold">{t.price}</span>
                <span className={`text-sm ${t.highlight ? "text-white/60" : "text-muted-foreground"}`}>{t.period}</span>
              </div>
              <p className={`mt-3 text-sm ${t.highlight ? "text-white/70" : "text-muted-foreground"}`}>{t.desc}</p>
              <ul className="mt-6 space-y-3">
                {t.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`h-4 w-4 mt-0.5 ${t.highlight ? "text-accent" : "text-primary"}`} />
                    {f}
                  </li>
                ))}
              </ul>
              <Link to="/auth" className="block mt-8">
                <Button
                  className={`w-full h-11 rounded-xl ${
                    t.highlight
                      ? "bg-accent text-accent-foreground hover:opacity-95"
                      : "bg-gradient-brand text-primary-foreground"
                  }`}
                >
                  {t.cta}
                </Button>
              </Link>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
