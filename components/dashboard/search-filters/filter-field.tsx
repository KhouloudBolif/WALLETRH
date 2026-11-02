import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Labeled wrapper for a single filter control — the label is always visible above the control. */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}
