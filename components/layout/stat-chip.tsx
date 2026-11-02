import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type StatChipProps = {
  label: string;
  value: string | number;
  className?: string;
};

export function StatChip({ label, value, className }: StatChipProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-border/80 bg-card px-3 py-1 text-xs shadow-elevation-xs",
        className,
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums text-foreground">{value}</span>
    </div>
  );
}

export function StatRow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>
  );
}

/** Quiet editorial metric — used inside panels, not as a standalone card. */
export function StatTile({
  label,
  value,
  icon: Icon,
  className,
}: {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-muted/50 px-3.5 py-3", className)}>
      {Icon && (
        <span className="mb-2 flex size-8 items-center justify-center rounded-full bg-brand-soft text-primary">
          <Icon className="size-4" />
        </span>
      )}
      <p className="font-serif text-[1.65rem] leading-none font-medium tracking-tight tabular-nums text-foreground">
        {value}
      </p>
      <p className="mt-1.5 text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </p>
    </div>
  );
}
