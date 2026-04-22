import logoSrc from "@/assets/healthos-logo.png";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  variant?: "dark" | "light";
}

export function Logo({ className = "", showWordmark = true, variant = "dark" }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-gradient-brand blur-md opacity-40" />
        <img
          src={logoSrc}
          alt="HealthOS logo"
          className="relative h-9 w-9 object-contain"
          style={{ objectPosition: "center 30%", clipPath: "circle(42% at 50% 38%)" }}
        />
      </div>
      {showWordmark && (
        <span
          className={`text-xl font-bold tracking-tight ${
            variant === "light" ? "text-white" : "text-foreground"
          }`}
        >
          Health<span className="text-accent">OS</span>
        </span>
      )}
    </div>
  );
}
