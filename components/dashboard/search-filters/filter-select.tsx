"use client";

import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type FilterOption = { value: string; label: string };

/** A `Select` where the first option (index 0) is treated as the "no filter" default. */
export function FilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder: string;
  options: FilterOption[];
  className?: string;
}) {
  const active = options.find((o) => o.value === value);
  const isDefault = options[0]?.value === value;

  return (
    <Select value={value} onValueChange={(v) => v && onValueChange(v)}>
      <SelectTrigger className={cn("h-8 w-full", isDefault && "text-muted-foreground", className)}>
        <SelectValue>{isDefault ? placeholder : (active?.label ?? placeholder)}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Same idea as `FilterSelect`, but lets the user pick several values at once (e.g. two directions). */
export function MultiFilterSelect({
  value,
  onValueChange,
  placeholder,
  options,
  className,
}: {
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  options: FilterOption[];
  className?: string;
}) {
  const isDefault = value.length === 0;
  const label =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? value[0])
        : `${value.length} sélectionnés`;

  return (
    <Select multiple value={value} onValueChange={(v) => onValueChange(v)}>
      <SelectTrigger className={cn("h-8 w-full", isDefault && "text-muted-foreground", className)}>
        <SelectValue>{label}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
