import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/landing/Header";
import { MarketingFooter } from "@/components/landing/Footer";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — HealthOS" },
      { name: "description", content: "Our mission is to make preventive health intelligence accessible to everyone." },
      { property: "og:title", content: "About HealthOS" },
      { property: "og:description", content: "Our mission is to make preventive health intelligence accessible to everyone." },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="py-20 bg-gradient-hero">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <h1 className="text-4xl md:text-5xl font-bold">
            Helping people <span className="text-gradient-brand">stay ahead</span> of their health
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
            Healthcare today is reactive. We treat problems after they appear. HealthOS is built on a
            different premise: with the right data and intelligence, most health problems can be prevented.
          </p>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6 grid md:grid-cols-3 gap-6">
          {[
            { t: "Our Mission", d: "Make personalized preventive health accessible to everyone—not just elite athletes or biohackers." },
            { t: "Our Approach", d: "Combine wearable data, daily logs, and AI to surface what matters and what to do next." },
            { t: "Our Promise", d: "Your data is yours. Encrypted, private, never sold. Always exportable." },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl bg-card border border-border p-6 shadow-card">
              <h3 className="font-bold">{b.t}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.d}</p>
            </div>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
