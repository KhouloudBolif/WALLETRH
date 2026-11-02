"use client";

import { Input } from "@/components/ui/input";
import { FilterField } from "./filter-field";
import { FilterSelect, MultiFilterSelect } from "./filter-select";
import type { FiltersState } from "./reducer";
import type { FilterOptionsResponse } from "./use-filter-options";

export const IDENTITY_KEYS: (keyof FiltersState)[] = [
  "matricule",
  "nom",
  "prenom",
  "genre",
  "cin",
  "ageRange",
  "minChildren",
  "childrenExact",
  "hasSpouseDocument",
  "childName",
  "situation",
];

export function IdentityFilters({
  state,
  patch,
  options = {},
}: {
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
  options?: FilterOptionsResponse;
}) {
  return (
    <>
      <FilterField label="Matricule">
        <Input
          className="h-8"
          placeholder="Ex. 100002"
          value={state.matricule}
          onChange={(e) => patch({ matricule: e.target.value })}
        />
      </FilterField>
      <FilterField label="Nom">
        <Input
          className="h-8"
          placeholder="Ex. Bennani"
          value={state.nom}
          onChange={(e) => patch({ nom: e.target.value })}
        />
      </FilterField>
      <FilterField label="Prénom">
        <Input
          className="h-8"
          placeholder="Ex. Sara"
          value={state.prenom}
          onChange={(e) => patch({ prenom: e.target.value })}
        />
      </FilterField>
      <FilterField label="Genre">
        <FilterSelect
          value={state.genre}
          onValueChange={(v) => patch({ genre: v as FiltersState["genre"] })}
          placeholder="Tous genres"
          options={[
            { value: "ALL", label: "Tous genres" },
            { value: "H", label: "Hommes" },
            { value: "F", label: "Femmes" },
          ]}
        />
      </FilterField>
      <FilterField label="Situation">
        <MultiFilterSelect
          value={state.situation}
          onValueChange={(v) => patch({ situation: v })}
          placeholder="Toutes"
          options={(options.situation ?? []).map((v) => ({ value: v, label: v }))}
        />
      </FilterField>
      <FilterField label="Âge">
        <FilterSelect
          value={state.ageRange}
          onValueChange={(v) => patch({ ageRange: v })}
          placeholder="Tous âges"
          options={[
            { value: "ALL", label: "Tous âges" },
            { value: "-29", label: "Moins de 30 ans" },
            { value: "30-39", label: "30 à 39 ans" },
            { value: "40-49", label: "40 à 49 ans" },
            { value: "50-", label: "50 ans et plus" },
          ]}
        />
      </FilterField>
      <FilterField label="CIN">
        <Input
          className="h-8"
          placeholder="Ex. AB123456"
          value={state.cin}
          onChange={(e) => patch({ cin: e.target.value })}
        />
      </FilterField>
      <FilterField label="Matricule du responsable">
        <Input
          className="h-8"
          placeholder="Optionnel"
          value={state.managerMatricule}
          onChange={(e) => patch({ managerMatricule: e.target.value })}
        />
      </FilterField>
      <FilterField label="Enfants (au moins)">
        <FilterSelect
          value={state.minChildren}
          onValueChange={(v) => patch({ minChildren: v })}
          placeholder="Tous"
          options={[
            { value: "0", label: "Tous" },
            { value: "1", label: "1 enfant ou plus" },
            { value: "2", label: "2 enfants ou plus" },
            { value: "3", label: "3 enfants ou plus" },
            { value: "4", label: "4 enfants ou plus" },
          ]}
        />
      </FilterField>
      <FilterField label="Enfants (exactement)">
        <MultiFilterSelect
          value={state.childrenExact}
          onValueChange={(v) => patch({ childrenExact: v })}
          placeholder="Tous"
          options={[
            { value: "0", label: "0 enfant" },
            { value: "1", label: "1 enfant" },
            { value: "2", label: "2 enfants" },
            { value: "3", label: "3 enfants" },
            { value: "4", label: "4 enfants" },
          ]}
        />
      </FilterField>
      <FilterField label="Conjoint au dossier">
        <FilterSelect
          value={state.hasSpouseDocument}
          onValueChange={(v) => patch({ hasSpouseDocument: v as FiltersState["hasSpouseDocument"] })}
          placeholder="Peu importe"
          options={[
            { value: "ALL", label: "Peu importe" },
            { value: "OUI", label: "Conjoint au dossier" },
            { value: "NON", label: "Sans conjoint au dossier" },
          ]}
        />
      </FilterField>
      <FilterField label="Prénom de l'enfant (dossier)">
        <Input
          className="h-8"
          placeholder="Ex. Sara"
          value={state.childName}
          onChange={(e) => patch({ childName: e.target.value })}
        />
      </FilterField>
    </>
  );
}
