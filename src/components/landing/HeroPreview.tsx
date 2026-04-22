import { Activity, Droplet, Moon, ChevronRight } from "lucide-react";

export function HeroPreview() {
  return (
    <div className="relative">
      <div className="absolute -inset-8 bg-gradient-brand opacity-20 blur-3xl rounded-full" />
      <div className="relative rounded-3xl bg-card shadow-elegant border border-border/60 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-gradient-brand" />
          <div className="flex-1">
            <h3 className="text-lg font-bold">Good morning, Alex 👋</h3>
            <p className="text-xs text-muted-foreground">Here's your health summary</p>
          </div>
          <div className="text-xs px-3 py-1.5 rounded-full bg-muted text-muted-foreground">Today</div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">Health Score</p>
            <div className="mt-2 flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold">82</span>
                <span className="text-sm text-muted-foreground">/100</span>
                <p className="text-xs text-success mt-1">● Great</p>
              </div>
              <ScoreRing value={82} />
            </div>
          </div>
          <div className="rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-medium text-muted-foreground">Risk Forecast</p>
            <p className="mt-2 text-2xl font-bold text-success">Low</p>
            <MiniSpark />
            <p className="text-[10px] text-muted-foreground mt-1">Next 7 days</p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="col-span-2 rounded-2xl bg-muted/50 p-4">
            <p className="text-xs font-semibold mb-3">Top Priorities</p>
            <div className="space-y-2.5">
              {[
                { icon: Moon, label: "Improve Sleep Consistency", sub: "Sleep score low 3 days this week" },
                { icon: Activity, label: "Manage Stress", sub: "Elevated stress in the afternoon" },
                { icon: Droplet, label: "Hydration", sub: "Increase water intake by 20%" },
              ].map((p) => (
                <div key={p.label} className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-accent-soft flex items-center justify-center text-accent">
                    <p.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{p.sub}</p>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl bg-gradient-dark text-white p-4 flex flex-col">
            <p className="text-[10px] font-semibold text-accent">AI Recommendation</p>
            <p className="text-sm font-bold mt-1.5 leading-snug">Take a 30-min walk outdoors today</p>
            <p className="text-[10px] text-white/70 mt-1.5 flex-1">Based on your energy and stress patterns.</p>
            <button className="mt-2 bg-accent text-accent-foreground text-[11px] font-semibold rounded-full py-1.5">
              Mark as Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ value }: { value: number }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <svg width="56" height="56" viewBox="0 0 56 56">
      <circle cx="28" cy="28" r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
      <circle
        cx="28" cy="28" r={r} fill="none" stroke="url(#g)"
        strokeWidth="6" strokeLinecap="round"
        strokeDasharray={c} strokeDashoffset={offset}
        transform="rotate(-90 28 28)"
      />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--primary)" />
          <stop offset="100%" stopColor="var(--accent)" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function MiniSpark() {
  return (
    <svg viewBox="0 0 100 30" className="w-full h-8 mt-2">
      <polyline
        fill="none" stroke="var(--accent)" strokeWidth="2"
        points="0,22 12,18 24,20 36,15 48,12 60,14 72,9 84,11 100,6"
      />
    </svg>
  );
}
