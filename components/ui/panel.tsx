import { cn } from "@/lib/utils";

type PanelProps = React.ComponentProps<"section"> & {
  padding?: "none" | "sm" | "md";
  /** Slightly stronger shadow + hover lift — for a page's single primary panel. */
  elevated?: boolean;
};

export function Panel({
  className,
  padding = "sm",
  elevated = false,
  children,
  ...props
}: PanelProps) {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/80 bg-card",
        elevated ? "shadow-elevation-md" : "shadow-elevation-sm",
        padding === "sm" && "p-3 sm:p-4",
        padding === "md" && "p-4 sm:p-5",
        padding === "none" && "overflow-hidden",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  );
}

export function PanelHeader({
  className,
  title,
  description,
  action,
}: {
  className?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="font-serif text-lg font-medium tracking-tight text-balance">
          {title}
        </h2>
        {description && (
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
