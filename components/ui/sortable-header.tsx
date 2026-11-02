"use client";

import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { TableHead } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { SortDirection } from "@/lib/sort";

type SortableHeaderProps<T extends string> = {
  label: string;
  sortKey: T;
  activeKey: T | null;
  direction: SortDirection;
  onSort: (key: T) => void;
  className?: string;
};

export function SortableHeader<T extends string>({
  label,
  sortKey,
  activeKey,
  direction,
  onSort,
  className,
}: SortableHeaderProps<T>) {
  const active = activeKey === sortKey;

  return (
    <TableHead className={cn("h-8 p-0 text-xs", className)}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={cn(
          "flex h-8 w-full items-center gap-1 px-2 text-left font-medium transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? (
          direction === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ChevronsUpDown className="size-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}
