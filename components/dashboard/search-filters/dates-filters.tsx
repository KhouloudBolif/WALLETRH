"use client";

import { Input } from "@/components/ui/input";
import { FilterField } from "./filter-field";
import { FilterSelect } from "./filter-select";
import type { FiltersState } from "./reducer";

export type DateFilterMode = "interval" | "untilToday";

const MODE_OPTIONS = [
  { value: "interval", label: "Intervalle (depuis → jusqu'à)" },
  { value: "untilToday", label: "Jusqu'à aujourd'hui" },
];

/** Contrôle date unifié : mode + 1 ou 2 champs selon le choix. */
export function DateRangeFilterControl({
  mode,
  from,
  to,
  onModeChange,
  onFromChange,
  onToChange,
  fromLabel = "Depuis",
  toLabel = "Jusqu'à",
}: {
  mode: DateFilterMode;
  from: string;
  to: string;
  onModeChange: (mode: DateFilterMode) => void;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  fromLabel?: string;
  toLabel?: string;
}) {
  return (
    <div className="space-y-2">
      <FilterSelect
        value={mode}
        onValueChange={(v) => onModeChange(v as DateFilterMode)}
        placeholder="Mode"
        options={MODE_OPTIONS}
      />
      {mode === "interval" ? (
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{fromLabel}</span>
            <Input
              type="date"
              className="h-8"
              value={from}
              onChange={(e) => onFromChange(e.target.value)}
            />
          </div>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">{toLabel}</span>
            <Input
              type="date"
              className="h-8"
              value={to}
              onChange={(e) => onToChange(e.target.value)}
            />
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">À partir du</span>
          <Input
            type="date"
            className="h-8"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
          <span className="text-[10px] text-muted-foreground">→ jusqu'à aujourd'hui</span>
        </div>
      )}
    </div>
  );
}

export const DATES_KEYS: (keyof FiltersState)[] = [
  "ancienneteRange",
  "dateEntreeFrom",
  "dateEntreeTo",
  "dateDepartFrom",
  "dateDepartTo",
];

export function DatesFilters({
  state,
  patch,
}: {
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
}) {
  return (
    <>
      <FilterField label="Ancienneté">
        <FilterSelect
          value={state.ancienneteRange}
          onValueChange={(v) => patch({ ancienneteRange: v })}
          placeholder="Toute ancienneté"
          options={[
            { value: "ALL", label: "Toute ancienneté" },
            { value: "-4", label: "Moins de 5 ans" },
            { value: "5-9", label: "5 à 9 ans" },
            { value: "10-19", label: "10 à 19 ans" },
            { value: "20-", label: "20 ans et plus" },
          ]}
        />
      </FilterField>
      <FilterField label="Date d'entrée">
        <DateRangeFilterControl
          mode={state.dateEntreeMode}
          from={state.dateEntreeFrom}
          to={state.dateEntreeTo}
          onModeChange={(dateEntreeMode) => patch({ dateEntreeMode, dateEntreeTo: "" })}
          onFromChange={(dateEntreeFrom) => patch({ dateEntreeFrom })}
          onToChange={(dateEntreeTo) => patch({ dateEntreeTo })}
        />
      </FilterField>
      <FilterField label="Date de départ">
        <DateRangeFilterControl
          mode={state.dateDepartMode}
          from={state.dateDepartFrom}
          to={state.dateDepartTo}
          onModeChange={(dateDepartMode) => patch({ dateDepartMode, dateDepartTo: "" })}
          onFromChange={(dateDepartFrom) => patch({ dateDepartFrom })}
          onToChange={(dateDepartTo) => patch({ dateDepartTo })}
        />
      </FilterField>
    </>
  );
}
