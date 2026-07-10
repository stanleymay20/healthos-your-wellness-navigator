import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { MarketingHeader } from "@/components/landing/Header";
import { MarketingFooter } from "@/components/landing/Footer";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { startCheckout } from "@/lib/billing/client-actions";
import { isKnownPlan, type PlanSlug } from "@/lib/billing/plans";

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

type Tier = {
  name: string;
  slug: "free" | PlanSlug;
  price: string;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  highlight: boolean;
};

const tiers: Tier[] = [
  {
    name: "Free",
    slug: "free",
    price: "$0",
    period: "forever",
    desc: "Get started with daily tracking and core insights.",
    features: ["Daily health score", "Manual logging", "Basic insights", "1 device connection"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro",
    slug: "pro",
    price: "$12",
    period: "/month",
    desc: "AI coaching, predictions, and unlimited integrations.",
    features: ["Everything in Free", "AI recommendations", "Risk forecasts", "Unlimited devices", "Weekly reports", "Priority support"],
    cta: "Start Pro",
    highlight: true,
  },
  {
    name: "Family",
    slug: "family",
    price: "$24",
    period: "/month",
    desc: "Up to 5 members on one plan.",
    features: ["Everything in Pro", "5 family members", "Shared insights", "Family dashboard"],
    cta: "Get Family",
    highlight: false,
  },
];

function Pricing() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [busySlug, setBusySlug] = useState<PlanSlug | null>(null);

  async function chooseTier(tier: Tier) {
    // Free tier — either sign up (unauth'd) or land on the app.
    if (tier.slug === "free") {
      navigate({ to: session ? "/dashboard" : "/auth" });
      return;
    }
    // Paid tier without a session — bounce to auth and remember the intent
    // via a query param so we can resume after login. The auth flow can
    // read ?plan= and route back here.
    if (!session?.access_token) {
      navigate({ to: "/auth", search: { plan: tier.slug } as unknown as never });
      return;
    }
    setBusySlug(tier.slug);
    const res = await startCheckout(session.access_token, tier.slug);
    setBusySlug(null);
    if (!res.ok) {
      toast.error(`Couldn't start checkout: ${res.error}`);
      return;
    }
    window.location.href = res.url;
  }

  // If we returned to /pricing from a cancelled checkout or resumed from a
  // ?plan=… auth redirect, show one relevant message on mount.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "cancelled") {
      toast("Checkout cancelled. No charge was made.");
      params.delete("checkout");
      const search = params.toString();
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}${search ? `?${search}` : ""}`,
      );
    }
    // Resume-from-auth: if the user came back with ?plan=<slug> and is
    // signed in, auto-open checkout for that plan.
    const planParam = params.get("plan");
    if (session?.access_token && planParam && isKnownPlan(planParam)) {
      const tier = tiers.find((t) => t.slug === planParam);
      if (tier) void chooseTier(tier);
    }
    // Intentional: run once on mount. If session arrives after mount and
    // ?plan= is set, the user can click the CTA manually.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <Button
                onClick={() => chooseTier(t)}
                disabled={busySlug !== null && busySlug !== t.slug ? true : busySlug === t.slug}
                className={`mt-8 w-full h-11 rounded-xl ${
                  t.highlight
                    ? "bg-accent text-accent-foreground hover:opacity-95"
                    : "bg-gradient-brand text-primary-foreground"
                }`}
              >
                {busySlug === t.slug ? "Starting…" : t.cta}
              </Button>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
