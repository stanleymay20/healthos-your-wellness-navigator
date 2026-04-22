import { Logo } from "@/components/brand/Logo";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="mx-auto max-w-7xl px-6 py-14 grid gap-10 md:grid-cols-5">
        <div className="md:col-span-2">
          <Logo />
          <p className="mt-4 text-sm text-muted-foreground max-w-xs">
            Your personal health operating system. Understand your body, predict risks, and act every day.
          </p>
        </div>
        {[
          { title: "Product", items: ["Features", "Pricing", "Devices", "Changelog"] },
          { title: "Company", items: ["About", "Blog", "Science", "Careers"] },
          { title: "Legal", items: ["Privacy", "Terms", "Security", "Contact"] },
        ].map((col) => (
          <div key={col.title}>
            <h4 className="text-sm font-semibold text-foreground">{col.title}</h4>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              {col.items.map((i) => (
                <li key={i}><a href="#" className="hover:text-foreground">{i}</a></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border/60 py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} HealthOS. Preventive health intelligence. Not a medical device.
      </div>
    </footer>
  );
}
