"use client";

import { useMemo } from "react";
import { Input } from "@/components/ui/input";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import { FilterField } from "./filter-field";
import { DateRangeFilterControl } from "./dates-filters";
import type { FilterOptionsResponse } from "./use-filter-options";
import { MultiFilterSelect } from "./filter-select";
import type { FiltersState } from "./reducer";

export const DOCUMENT_KEYS: (keyof FiltersState)[] = [
  "category",
  "documentType",
  "documentTypes",
  "folderName",
  "modifiedFrom",
  "modifiedTo",
];

export function DocumentFilters({
  state,
  patch,
  options,
  allowedCategories,
  allowedDocumentTypes,
}: {
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
  options: FilterOptionsResponse;
  allowedCategories: DocumentCategory[];
  allowedDocumentTypes: { value: string; label: string; category: DocumentCategory }[];
}) {
  const documentTypeOptions = useMemo(() => {
    const categories =
      state.category.length > 0 ? state.category : allowedCategories;
    const allowed = new Set(categories);
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [];
    for (const entry of allowedDocumentTypes) {
      if (!allowed.has(entry.category) || seen.has(entry.value)) continue;
      seen.add(entry.value);
      opts.push({ value: entry.value, label: entry.label });
    }
    return opts;
  }, [state.category, allowedCategories, allowedDocumentTypes]);

  return (
    <>
      <FilterField label="Catégorie">
        <MultiFilterSelect
          value={state.category}
          onValueChange={(v) => patch({ category: v as DocumentCategory[] })}
          placeholder="Toutes"
          options={allowedCategories.map((cat) => ({ value: cat, label: categoryFilterLabels[cat] }))}
        />
      </FilterField>
      <FilterField label="Type de document (catalogue)">
        <MultiFilterSelect
          value={state.documentTypes}
          onValueChange={(v) => patch({ documentTypes: v })}
          placeholder="Tous"
          options={documentTypeOptions}
        />
      </FilterField>
      <FilterField label="Type de document — autre">
        <Input
          className="h-8"
          placeholder="Texte libre"
          value={state.documentType}
          onChange={(e) => patch({ documentType: e.target.value })}
        />
      </FilterField>
      <FilterField label="Sous-dossier Drive">
        <MultiFilterSelect
          value={state.folderName}
          onValueChange={(v) => patch({ folderName: v })}
          placeholder="Tous"
          options={(options.folderName ?? []).map((value) => ({ value, label: value }))}
        />
      </FilterField>
      <FilterField label="Date de modification">
        <DateRangeFilterControl
          mode={state.modifiedMode}
          from={state.modifiedFrom}
          to={state.modifiedTo}
          onModeChange={(modifiedMode) => patch({ modifiedMode, modifiedTo: "" })}
          onFromChange={(modifiedFrom) => patch({ modifiedFrom })}
          onToChange={(modifiedTo) => patch({ modifiedTo })}
        />
      </FilterField>
    </>
  );
}
