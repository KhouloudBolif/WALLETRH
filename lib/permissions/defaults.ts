import type { Role } from "@prisma/client";
import { allCategories, type DocumentCategory } from "@/lib/document-category";
import { expectedDocumentTypes, matchesDocumentType } from "@/lib/document-types";
import type { CategoryAccessMap, ResolvedAccess } from "@/lib/permissions/types";

export function getDefaultAccessMap(role: Role): CategoryAccessMap {
  const allTrue = Object.fromEntries(
    allCategories.map((c) => [c, true]),
  ) as CategoryAccessMap;

  if (role === "ADMIN" || role === "RH_MANAGER") {
    return allTrue;
  }

  return {
    RECRUTEMENT: true,
    ETAT_CIVIL: true,
    ARRETES: false,
    MESURES_DISCIPLINAIRES: false,
    MALADIES_ACCIDENTS_TRAVAIL: false,
    DEPART: false,
    DIVERS: false,
  };
}

export function canViewCategoryFromMap(
  access: CategoryAccessMap,
  category: DocumentCategory,
): boolean {
  return access[category] === true;
}

/**
 * Maps a raw stored `documentType` (e.g. "CIN_Conjoint", "Tableau d'avancement_1988")
 * to the canonical catalog key overrides are actually keyed by (e.g. "CIN"), reusing
 * the same fuzzy alias/prefix matching the dossier-completeness feature already uses —
 * an override set on the canonical key must also apply to spouse/child/dated variants.
 * Categories with no catalog (DIVERS, MESURES_DISCIPLINAIRES, MALADIES_ACCIDENTS_TRAVAIL)
 * have no aliasing to resolve, so the raw value is used as-is.
 */
function resolveDocumentTypeKey(category: DocumentCategory, documentType: string): string {
  const catalog = expectedDocumentTypes[category];
  if (!catalog) return documentType;
  // Prefer the employee ("self") catalog row so spouse/child variants don't steal the key.
  const match =
    catalog.find(
      (entry) =>
        (!entry.familyRole || entry.familyRole === "self") &&
        matchesDocumentType(documentType, entry),
    ) ?? catalog.find((entry) => matchesDocumentType(documentType, entry));
  return match?.key ?? documentType;
}

/**
 * Resolves access for one document: a document-type override wins if present,
 * otherwise falls back to the category baseline. `documentType` is nullable
 * since not every stored file has one parsed from its filename.
 */
export function canViewDocument(
  access: ResolvedAccess,
  category: DocumentCategory,
  documentType: string | null,
): boolean {
  if (documentType) {
    const key = resolveDocumentTypeKey(category, documentType);
    const override = access.documentTypes[category]?.[key];
    if (override !== undefined) return override;
  }
  return access.category[category] === true;
}

/** Categories the viewer may see. A category hidden entirely, or whose every catalog type is denied, is omitted. */
export function visibleCategories(access: ResolvedAccess): DocumentCategory[] {
  return allCategories.filter((category) => {
    if (!canViewCategoryFromMap(access.category, category)) return false;
    const catalog = expectedDocumentTypes[category];
    if (!catalog || catalog.length === 0) return true;
    return catalog.some((entry) => canViewDocument(access, category, entry.key));
  });
}

/** Catalog types the viewer may pick or see, optionally limited to selected categories. */
export function visibleDocumentTypes(
  access: ResolvedAccess,
  categories?: DocumentCategory[],
): { value: string; label: string; category: DocumentCategory }[] {
  const allowed = new Set(visibleCategories(access));
  const scope =
    categories && categories.length > 0
      ? categories.filter((category) => allowed.has(category))
      : [...allowed];
  const seen = new Set<string>();
  const options: { value: string; label: string; category: DocumentCategory }[] = [];
  for (const category of scope) {
    for (const entry of expectedDocumentTypes[category] ?? []) {
      if (seen.has(entry.key) || !canViewDocument(access, category, entry.key)) continue;
      seen.add(entry.key);
      options.push({ value: entry.key, label: entry.label, category });
    }
  }
  return options;
}

/**
 * Employee-level scope check — independent of, and evaluated before, category/
 * document-type access. Empty arrays mean unrestricted; when both direction and
 * service allowlists are set, an employee must match both (AND).
 */
export function canViewEmployee(
  access: ResolvedAccess,
  employee: { direction: string | null; service: string | null },
): boolean {
  const { allowedDirections, allowedServices } = access.employeeScope;
  if (allowedDirections.length > 0 && !allowedDirections.includes(employee.direction ?? "")) {
    return false;
  }
  if (allowedServices.length > 0 && !allowedServices.includes(employee.service ?? "")) {
    return false;
  }
  return true;
}
