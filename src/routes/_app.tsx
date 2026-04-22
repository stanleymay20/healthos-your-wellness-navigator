import { createFileRoute, Outlet, Link, useLocation } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import {
  LayoutDashboard, Sparkles, Activity, Target, NotebookPen,
  FileText, Watch, Settings, Bell, ChevronDown, Calendar,
} from "lucide-react";

export const Route = createFileRoute("/_app")({
  component: AppShell,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/insights", label: "Insights", icon: Sparkles },
  { to: "/metrics", label: "Metrics", icon: Activity },
  { to: "/plan", label: "Plan", icon: Target },
  { to: "/logs", label: "Logs", icon: NotebookPen },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/devices", label: "Devices", icon: Watch },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

function AppShell() {
  const location = useLocation();
  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden lg:flex w-64 shrink-0 bg-sidebar text-sidebar-foreground flex-col">
        <div className="px-6 h-16 flex items-center border-b border-sidebar-border/60">
          <Link to="/"><Logo variant="light" /></Link>
        </div>
        <nav className="flex-1 px-3 py-6 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4">
          <div className="rounded-2xl bg-gradient-brand p-4 text-white">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" /> Upgrade to Pro
            </div>
            <p className="mt-2 text-xs text-white/80">Unlock AI coaching, advanced insights, and unlimited devices.</p>
            <button className="mt-3 w-full bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-2 rounded-lg backdrop-blur">
              Upgrade Now
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-30">
          <div>
            <h1 className="text-lg font-bold">Good morning, Alex 👋</h1>
            <p className="text-xs text-muted-foreground">Here's your health overview for today</p>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-card text-sm">
              <Calendar className="h-4 w-4 text-muted-foreground" /> Today, May 24
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </button>
            <button className="relative h-10 w-10 rounded-xl border border-border bg-card flex items-center justify-center">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-bold">3</span>
            </button>
            <button className="h-10 w-10 rounded-xl bg-gradient-brand" />
          </div>
        </header>
        <main className="flex-1 p-6 overflow-x-hidden"><Outlet /></main>
      </div>
    </div>
  );
}
