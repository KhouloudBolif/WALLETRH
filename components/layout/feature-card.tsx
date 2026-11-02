import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type FeatureCardProps = {
  href: string;
  icon: LucideIcon;
  title: string;
  description: string;
  className?: string;
  /** Ink surface — the one action that should be noticed first. */
  featured?: boolean;
};

export function FeatureCard({
  href,
  icon: Icon,
  title,
  description,
  className,
  featured = false,
}: FeatureCardProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col rounded-2xl border p-4 shadow-elevation-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-elevation-md",
        featured
          ? "border-transparent bg-rail text-white hover:bg-[oklch(0.26_0.05_285)]"
          : "border-border/80 bg-card text-foreground hover:border-primary/30",
        className,
      )}
    >
      <span className="flex items-start justify-between gap-3">
        <span
          className={cn(
            "flex size-10 items-center justify-center rounded-xl",
            featured ? "bg-white/10 text-white" : "bg-accent text-primary",
          )}
        >
          <Icon className="size-4.5" />
        </span>
        <ArrowRight
          className={cn(
            "size-4 transition-transform duration-200 group-hover:translate-x-0.5",
            featured ? "text-gold" : "text-primary/70",
          )}
        />
      </span>
      <p className="mt-4 text-sm font-medium leading-tight">{title}</p>
      <p
        className={cn(
          "mt-1.5 line-clamp-3 text-xs leading-relaxed",
          featured ? "text-white/65" : "text-muted-foreground",
        )}
      >
        {description}
      </p>
    </Link>
  );
}
