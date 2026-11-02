"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import { initialFiltersState, isFieldActive, type FiltersState } from "./reducer";

/** French display label for every filter field except `query` (shown separately). */
const FIELD_LABELS: Record<Exclude<keyof FiltersState, "query">, string> = {
  category: "Catégorie de document",
  documentType: "Type de document (texte libre)",
  documentTypes: "Type de document (catalogue)",
  folderName: "Sous-dossier Drive",
  modifiedFrom: "Modifié depuis",
  modifiedTo: "Modifié jusqu'à",
  genre: "Genre",
  matricule: "Matricule",
  nom: "Nom",
  prenom: "Prénom",
  cin: "CIN",
  ageRange: "Âge",
  minChildren: "Enfants (min.)",
  childrenExact: "Enfants (exact)",
  hasSpouseDocument: "Conjoint au dossier",
  childName: "Prénom de l'enfant",
  direction: "Direction",
  service: "Service",
  entite: "Entité",
  sousEntite: "Sous-entité",
  zone: "Zone",
  agence: "Agence",
  poste: "Poste",
  statut: "Statut",
  college: "Collège",
  admTech: "Adm. / Tech.",
  position: "Position",
  encadrant: "Encadrant",
  categorieRh: "Catégorie RH",
  niveau: "Niveau",
  grade: "Grade",
  managerMatricule: "Matricule responsable",
  situation: "Situation",
  ancienneteRange: "Ancienneté",
  dateEntreeFrom: "Entrée depuis",
  dateEntreeTo: "Entrée jusqu'à",
  dateEntreeMode: "Mode entrée",
  dateDepartFrom: "Départ depuis",
  dateDepartTo: "Départ jusqu'à",
  dateDepartMode: "Mode départ",
  modifiedMode: "Mode modification",
};

const GENRE_LABELS: Record<string, string> = { H: "Hommes", F: "Femmes" };
const AGE_LABELS: Record<string, string> = {
  "-29": "Moins de 30 ans",
  "30-39": "30 à 39 ans",
  "40-49": "40 à 49 ans",
  "50-": "50 ans et plus",
};
const ANCIENNETE_LABELS: Record<string, string> = {
  "-4": "Moins de 5 ans",
  "5-9": "5 à 9 ans",
  "10-19": "10 à 19 ans",
  "20-": "20 ans et plus",
};
const YES_NO_LABELS: Record<string, string> = { OUI: "Oui", NON: "Non" };

const DATE_KEYS = new Set<keyof FiltersState>([
  "modifiedFrom",
  "modifiedTo",
  "dateEntreeFrom",
  "dateEntreeTo",
  "dateDepartFrom",
  "dateDepartTo",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function formatValue(key: keyof FiltersState, value: unknown): string {
  switch (key) {
    case "genre":
      return GENRE_LABELS[value as string] ?? String(value);
    case "ageRange":
      return AGE_LABELS[value as string] ?? String(value);
    case "ancienneteRange":
      return ANCIENNETE_LABELS[value as string] ?? String(value);
    case "hasSpouseDocument":
    case "encadrant":
      return YES_NO_LABELS[value as string] ?? String(value);
    case "minChildren":
      return `${value}+ enfant${value === "1" ? "" : "s"}`;
    case "childrenExact":
      return (value as string[]).map((v) => `${v} enfant${v === "1" ? "" : "s"}`).join(", ");
    case "category":
      return (value as DocumentCategory[]).map((c) => categoryFilterLabels[c]).join(", ");
    default:
      if (DATE_KEYS.has(key) && typeof value === "string") return formatDate(value);
      return Array.isArray(value) ? value.join(", ") : String(value);
  }
}

type ActiveFiltersBarProps = {
  state: FiltersState;
  patch: (partial: Partial<FiltersState>) => void;
  onClearAll: () => void;
};

export function ActiveFiltersBar({ state, patch, onClearAll }: ActiveFiltersBarProps) {
  const chips: { key: string; label: string; onRemove: () => void }[] = [];

  if (state.query.trim()) {
    chips.push({
      key: "query",
      label: `Recherche : "${state.query.trim()}"`,
      onRemove: () => patch({ query: "" }),
    });
  }

  for (const key of Object.keys(FIELD_LABELS) as (keyof FiltersState)[]) {
    if (!isFieldActive(state, key)) continue;
    chips.push({
      key,
      label: `${FIELD_LABELS[key as Exclude<keyof FiltersState, "query">]} : ${formatValue(key, state[key])}`,
      onRemove: () => patch({ [key]: initialFiltersState[key] } as Partial<FiltersState>),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {chips.map((chip) => (
        <span
          key={chip.key}
          className="inline-flex items-center gap-1 rounded-md border bg-card py-1 pr-1 pl-2 text-xs"
        >
          <span className="max-w-[220px] truncate text-muted-foreground">{chip.label}</span>
          <button
            type="button"
            onClick={chip.onRemove}
            className="flex size-4 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={`Retirer le filtre ${chip.label}`}
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      {chips.length > 1 && (
        <Button variant="ghost" size="xs" onClick={onClearAll}>
          Tout effacer
        </Button>
      )}
    </div>
  );
}
