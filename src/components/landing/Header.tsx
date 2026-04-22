import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const links = [
  { label: "Features", to: "/#features" },
  { label: "How It Works", to: "/#how" },
  { label: "Science", to: "/about" },
  { label: "Pricing", to: "/pricing" },
  { label: "Blog", to: "/blog" },
  { label: "About", to: "/about" },
];

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo />
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          {links.map((l) => (
            <a key={l.label} href={l.to} className="hover:text-foreground transition-colors">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/auth" className="hidden sm:block text-sm font-medium text-foreground hover:text-primary">
            Log in
          </Link>
          <Link to="/auth">
            <Button className="bg-gradient-brand text-primary-foreground hover:opacity-95 shadow-elegant rounded-full px-5">
              Get Started <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
