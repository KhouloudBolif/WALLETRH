import { z } from "zod";
import { allCategories, type DocumentCategory } from "@/lib/document-category";
import { isExportColumnId, type ExportColumnId } from "@/lib/search/export-columns";
import { initialFiltersState, type FiltersState } from "@/components/dashboard/search-filters/reducer";

/** Champs que la page Requête peut poser en filtre. */
const QUERY_FIELD_IDS = [
  "query",
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
  "managerMatricule",
  "situation",
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
  "ancienneteRange",
  "dateEntree",
  "dateDepart",
  "modifiedDate",
  "category",
  "documentTypes",
  "docLink",
  "docUrl",
] as const;

export type SavedQueryFieldId = (typeof QUERY_FIELD_IDS)[number];

const FIELD_ID_SET = new Set<string>(QUERY_FIELD_IDS);

const CATEGORY_SET = new Set<string>(allCategories);

export const MAX_SAVED_QUERIES = 40;

export const saveQueryBodySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Donnez un nom d'au moins 2 caractères.")
    .max(80, "Le nom est trop long."),
  filters: z.unknown(),
  activeFields: z.array(z.string().max(40)).max(40),
  exportColumns: z.array(z.string().max(40)).max(40),
});

export type SavedQueryDto = {
  id: string;
  name: string;
  filters: FiltersState;
  activeFields: SavedQueryFieldId[];
  exportColumns: ExportColumnId[];
  updatedAt: string;
};

function clampText(value: string, max: number) {
  return value.trim().slice(0, max);
}

function asStringList(value: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const text = clampText(item, maxLen);
    if (!text || out.includes(text)) continue;
    out.push(text);
    if (out.length >= maxItems) break;
  }
  return out;
}

function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

/** Ne conserve que les clés et valeurs que le formulaire sait réafficher. */
export function sanitizeFilters(input: unknown): FiltersState {
  const source =
    input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const next: FiltersState = { ...initialFiltersState };

  const textKeys = [
    "query",
    "documentType",
    "matricule",
    "nom",
    "prenom",
    "cin",
    "childName",
    "poste",
    "managerMatricule",
    "ageRange",
    "ancienneteRange",
    "minChildren",
    "modifiedFrom",
    "modifiedTo",
    "dateEntreeFrom",
    "dateEntreeTo",
    "dateDepartFrom",
    "dateDepartTo",
  ] as const satisfies readonly (keyof FiltersState)[];

  for (const key of textKeys) {
    const raw = source[key];
    if (typeof raw === "string") next[key] = clampText(raw, 120);
  }

  next.genre = pickEnum(source.genre, ["ALL", "H", "F"] as const, "ALL");
  next.hasSpouseDocument = pickEnum(
    source.hasSpouseDocument,
    ["ALL", "OUI", "NON"] as const,
    "ALL",
  );
  next.encadrant = pickEnum(source.encadrant, ["ALL", "OUI", "NON"] as const, "ALL");
  next.modifiedMode = pickEnum(source.modifiedMode, ["interval", "untilToday"] as const, "interval");
  next.dateEntreeMode = pickEnum(
    source.dateEntreeMode,
    ["interval", "untilToday"] as const,
    "interval",
  );
  next.dateDepartMode = pickEnum(
    source.dateDepartMode,
    ["interval", "untilToday"] as const,
    "interval",
  );

  if (!/^\d{0,2}$/.test(next.minChildren)) next.minChildren = "0";

  next.category = asStringList(source.category, 12, 40).filter((value): value is DocumentCategory =>
    CATEGORY_SET.has(value),
  );
  next.documentTypes = asStringList(source.documentTypes, 40, 80);
  next.folderName = asStringList(source.folderName, 40, 120);
  next.childrenExact = asStringList(source.childrenExact, 20, 8);

  const multiKeys = [
    "direction",
    "service",
    "entite",
    "sousEntite",
    "zone",
    "agence",
    "statut",
    "college",
    "admTech",
    "position",
    "categorieRh",
    "niveau",
    "grade",
    "situation",
  ] as const satisfies readonly (keyof FiltersState)[];

  for (const key of multiKeys) {
    next[key] = asStringList(source[key], 40, 120);
  }

  return next;
}

export function sanitizeActiveFields(input: string[]): SavedQueryFieldId[] {
  const out: SavedQueryFieldId[] = [];
  for (const value of input) {
    if (!FIELD_ID_SET.has(value) || out.includes(value as SavedQueryFieldId)) continue;
    out.push(value as SavedQueryFieldId);
  }
  return out;
}

export function sanitizeExportColumns(input: string[]): ExportColumnId[] {
  const out: ExportColumnId[] = [];
  for (const value of input) {
    if (!isExportColumnId(value) || out.includes(value)) continue;
    out.push(value);
  }
  return out;
}
