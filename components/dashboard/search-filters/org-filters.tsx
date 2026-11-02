"use client";

import { Input } from "@/components/ui/input";
import { FilterField } from "./filter-field";
import { FilterSelect, MultiFilterSelect } from "./filter-select";
import type { FiltersState } from "./reducer";
import type { FilterOptionsResponse } from "./use-filter-options";

export const ORG_KEYS: (keyof FiltersState)[] = [
  "direction",
  "service",
  "entite",
  "sousEntite",
  "zone",
  "agence",
  "poste",
  "statut",
  "college",
  "admTech",
  "position",
  "encadrant",
  "categorieRh",
  "niveau",
  "grade",
];

function dropdownField(
  options: FilterOptionsResponse,
  field: keyof FilterOptionsResponse,
): { value: string; label: string }[] {
  return (options[field] ?? []).map((v) => ({ value: v, label: v }));
}

export function OrgFilters({
  state,
  patch,
  options,
}: {
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
  options: FilterOptionsResponse;
}) {
  return (
    <>
      <FilterField label="Direction">
        <MultiFilterSelect
          value={state.direction}
          onValueChange={(v) => patch({ direction: v })}
          placeholder="Toutes"
          options={dropdownField(options, "direction")}
        />
      </FilterField>
      <FilterField label="Service">
        <MultiFilterSelect
          value={state.service}
          onValueChange={(v) => patch({ service: v })}
          placeholder="Tous"
          options={dropdownField(options, "service")}
        />
      </FilterField>
      <FilterField label="Entité">
        <MultiFilterSelect
          value={state.entite}
          onValueChange={(v) => patch({ entite: v })}
          placeholder="Toutes"
          options={dropdownField(options, "entite")}
        />
      </FilterField>
      <FilterField label="Sous-entité">
        <MultiFilterSelect
          value={state.sousEntite}
          onValueChange={(v) => patch({ sousEntite: v })}
          placeholder="Toutes"
          options={dropdownField(options, "sousEntite")}
        />
      </FilterField>
      <FilterField label="Zone">
        <MultiFilterSelect
          value={state.zone}
          onValueChange={(v) => patch({ zone: v })}
          placeholder="Toutes"
          options={dropdownField(options, "zone")}
        />
      </FilterField>
      <FilterField label="Agence">
        <MultiFilterSelect
          value={state.agence}
          onValueChange={(v) => patch({ agence: v })}
          placeholder="Toutes"
          options={dropdownField(options, "agence")}
        />
      </FilterField>
      <FilterField label="Poste (texte libre)">
        <Input
          className="h-8"
          placeholder="Ex. Chargé de clientèle"
          value={state.poste}
          onChange={(e) => patch({ poste: e.target.value })}
        />
      </FilterField>
      <FilterField label="Statut">
        <MultiFilterSelect
          value={state.statut}
          onValueChange={(v) => patch({ statut: v })}
          placeholder="Tous"
          options={dropdownField(options, "statut")}
        />
      </FilterField>
      <FilterField label="Collège">
        <MultiFilterSelect
          value={state.college}
          onValueChange={(v) => patch({ college: v })}
          placeholder="Tous"
          options={dropdownField(options, "college")}
        />
      </FilterField>
      <FilterField label="Administratif / Technique">
        <MultiFilterSelect
          value={state.admTech}
          onValueChange={(v) => patch({ admTech: v })}
          placeholder="Tous"
          options={dropdownField(options, "admTech")}
        />
      </FilterField>
      <FilterField label="Position">
        <MultiFilterSelect
          value={state.position}
          onValueChange={(v) => patch({ position: v })}
          placeholder="Toutes"
          options={dropdownField(options, "position")}
        />
      </FilterField>
      <FilterField label="Encadrant">
        <FilterSelect
          value={state.encadrant}
          onValueChange={(v) => patch({ encadrant: v as FiltersState["encadrant"] })}
          placeholder="Peu importe"
          options={[
            { value: "ALL", label: "Peu importe" },
            { value: "OUI", label: "Encadrant" },
            { value: "NON", label: "Non encadrant" },
          ]}
        />
      </FilterField>
      <FilterField label="Catégorie RH">
        <MultiFilterSelect
          value={state.categorieRh}
          onValueChange={(v) => patch({ categorieRh: v })}
          placeholder="Toutes"
          options={dropdownField(options, "categorieRh")}
        />
      </FilterField>
      <FilterField label="Niveau">
        <MultiFilterSelect
          value={state.niveau}
          onValueChange={(v) => patch({ niveau: v })}
          placeholder="Tous"
          options={dropdownField(options, "niveau")}
        />
      </FilterField>
      <FilterField label="Grade">
        <MultiFilterSelect
          value={state.grade}
          onValueChange={(v) => patch({ grade: v })}
          placeholder="Tous"
          options={dropdownField(options, "grade")}
        />
      </FilterField>
    </>
  );
}
