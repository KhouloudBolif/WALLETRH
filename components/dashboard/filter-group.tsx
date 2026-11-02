"use client";

import type { ReactNode } from "react";
import { Collapsible, CollapsibleTrigger, CollapsiblePanel } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type FilterGroupProps = {
  title: string;
  description?: string;
  activeCount: number;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
};

export function FilterGroup({
  title,
  description,
  activeCount,
  defaultOpen = false,
  children,
  className,
}: FilterGroupProps) {
  return (
    <Collapsible defaultOpen={defaultOpen} className={cn("rounded-lg border border-border", className)}>
      <CollapsibleTrigger className="px-3 py-2 hover:bg-muted/30">
        <span className="flex items-center gap-2">
          <span className="text-sm font-medium">{title}</span>
          {activeCount > 0 && (
            <Badge variant="outline" className="text-[10px]">
              {activeCount}
            </Badge>
          )}
        </span>
      </CollapsibleTrigger>
      <CollapsiblePanel className="px-3 pb-3">
        {description && <p className="mb-2 text-xs text-muted-foreground">{description}</p>}
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
      </CollapsiblePanel>
    </Collapsible>
  );
}
