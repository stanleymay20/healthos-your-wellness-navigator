import { createFileRoute } from "@tanstack/react-router";
import { MarketingHeader } from "@/components/landing/Header";
import { MarketingFooter } from "@/components/landing/Footer";

export const Route = createFileRoute("/blog")({
  head: () => ({
    meta: [
      { title: "Blog — HealthOS" },
      { name: "description", content: "Insights on preventive health, AI, sleep, recovery, and longevity." },
      { property: "og:title", content: "HealthOS Blog" },
      { property: "og:description", content: "Insights on preventive health and longevity." },
    ],
  }),
  component: Blog,
});

const posts = [
  { t: "The science behind health scoring", c: "Science", d: "How we combine sleep, recovery, and stress into a single number that actually means something." },
  { t: "Why predictive beats reactive", c: "Product", d: "The case for catching patterns before they become problems." },
  { t: "Sleep consistency > sleep duration", c: "Research", d: "What the latest research tells us about consistent bedtimes." },
];

function Blog() {
  return (
    <div className="min-h-screen bg-background">
      <MarketingHeader />
      <section className="py-20 bg-gradient-hero">
        <div className="mx-auto max-w-7xl px-6">
          <h1 className="text-4xl md:text-5xl font-bold">The HealthOS Journal</h1>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl">
            Research, product notes, and ideas on preventive health intelligence.
          </p>
        </div>
      </section>
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-6 grid gap-6 md:grid-cols-3">
          {posts.map((p) => (
            <article key={p.t} className="rounded-2xl bg-card border border-border shadow-card overflow-hidden">
              <div className="h-40 bg-gradient-brand" />
              <div className="p-6">
                <p className="text-xs font-semibold text-accent uppercase tracking-widest">{p.c}</p>
                <h3 className="mt-2 text-lg font-bold">{p.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{p.d}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
      <MarketingFooter />
    </div>
  );
}
