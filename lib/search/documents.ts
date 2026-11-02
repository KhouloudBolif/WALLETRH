/**
 * PostgreSQL-backed document search (Phase 3) — replaces lib/mock/search.ts.
 *
 * All functions are server-only (Prisma). Permission enforcement happens here:
 * denied documents are returned without any view URL.
 */

import type { Prisma } from "@prisma/client";
import {
  loadEmployeeInformationByMatricule,
  resolveExpectedDocumentTypes,
} from "@/lib/completeness/sheet-catalog";
import { prisma } from "@/lib/db";
import type { DocumentCategory } from "@/lib/document-category";
import {
  expectedDocumentTypes,
  isDocumentRequiredForEmployee,
  matchesDocumentType,
  matchesFamilyRole,
  trackedCategories,
  type ExpectedDocumentType,
  type FileFamilyMeta,
} from "@/lib/document-types";
import { normalizeForSearch } from "@/lib/import/parseExcelBase";
import { canViewDocument, canViewEmployee, visibleCategories } from "@/lib/permissions/defaults";
import type { ResolvedAccess } from "@/lib/permissions/types";
import type { DocumentSearchQuery } from "@/lib/validations/document-search";

export type EmployeeSummary = {
  matricule: string;
  displayName: string;
  genre: string | null;
  cin: string | null;
  age: number | null;
  anciennete: number | null;
  direction: string | null;
  service: string | null;
  poste: string | null;
  statut: string | null;
  situation: string | null;
  childrenCount: number;
  documentCount: number;
  zone: string | null;
  agence: string | null;
  position: string | null;
  encadrant: boolean | null;
  managerMatricule: string | null;
  categorieRh: string | null;
  dateEntree: string | null;
  /** Normalized full-text blob (all Base fields) for client-side filtering */
  searchText: string;
  /** Base sheet label → value, for the dossier details panel */
  metadata: Record<string, string> | null;
  /** ISO date when the Drive folder disappeared; null while the folder exists. */
  archivedAt: string | null;
};

export type DocumentResult = {
  id: string;
  fileName: string;
  folderName: string;
  category: DocumentCategory;
  documentType: string | null;
  modifiedAt: string | null;
  authorized: boolean;
  /** Authorized only — Drive webViewLink or local streaming route */
  viewUrl?: string;
  employee: {
    matricule: string;
    displayName: string;
    service: string | null;
  };
};

export type SearchFilters = DocumentSearchQuery;

/** Tokenized AND match against Employee.searchText (accent/case-insensitive) */
function searchTextCondition(query: string): Prisma.EmployeeWhereInput {
  const tokens = normalizeForSearch(query).split(" ").filter(Boolean);
  return { AND: tokens.map((token) => ({ searchText: { contains: token } })) };
}

type FileWithEmployee = Prisma.DriveFileGetPayload<{
  include: { employee: true };
}>;

/** Employee fields matched by exact equality against a single value when present. */
const SCALAR_EQUALITY_FIELDS = [
  "genre",
  "managerMatricule",
] as const satisfies readonly (keyof SearchFilters)[];

/** Employee fields matched via `in` (OR) against a non-empty array — multi-select dropdowns. */
const MULTI_EQUALITY_FIELDS = [
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
] as const satisfies readonly (keyof SearchFilters)[];

/** Employee fields matched with a case-insensitive `contains` (free text, high cardinality). */
const CONTAINS_FIELDS = ["poste", "cin"] as const satisfies readonly (keyof SearchFilters)[];

function applyRange(
  target: object,
  field: string,
  min: number | Date | undefined,
  max: number | Date | undefined,
) {
  if (min === undefined && max === undefined) return;
  (target as Record<string, unknown>)[field] = {
    ...(min !== undefined ? { gte: min } : {}),
    ...(max !== undefined ? { lte: max } : {}),
  };
}

/** Folds a viewer's employee-level scope into a Prisma where clause — empty
 * arrays (unrestricted) add no constraint. */
function applyEmployeeScope(
  where: Prisma.EmployeeWhereInput,
  viewerAccess: ResolvedAccess,
): Prisma.EmployeeWhereInput {
  const { allowedDirections, allowedServices } = viewerAccess.employeeScope;
  if (allowedDirections.length > 0) {
    where.direction = { in: allowedDirections };
  }
  if (allowedServices.length > 0) {
    where.service = { in: allowedServices };
  }
  return where;
}

function buildEmployeeWhere(filters: SearchFilters): Prisma.EmployeeWhereInput {
  const employeeFilter: Prisma.EmployeeWhereInput = { archivedAt: null };

  for (const field of SCALAR_EQUALITY_FIELDS) {
    const value = filters[field];
    if (value !== undefined) {
      (employeeFilter as Record<string, unknown>)[field] = value;
    }
  }

  for (const field of MULTI_EQUALITY_FIELDS) {
    const value = filters[field] as string[] | undefined;
    if (value && value.length > 0) {
      (employeeFilter as Record<string, unknown>)[field] = { in: value };
    }
  }

  for (const field of CONTAINS_FIELDS) {
    const value = filters[field];
    if (typeof value === "string" && value.trim()) {
      (employeeFilter as Record<string, unknown>)[field] = {
        contains: value.trim(),
        mode: "insensitive",
      };
    }
  }

  if (filters.encadrant !== undefined) {
    employeeFilter.encadrant = filters.encadrant;
  }
  if (filters.hasSpouseDocument !== undefined) {
    employeeFilter.hasSpouseDocument = filters.hasSpouseDocument;
  }

  if (filters.matricule?.trim()) {
    employeeFilter.matricule = {
      contains: filters.matricule.trim(),
      mode: "insensitive",
    };
  }

  const identityAnd: Prisma.EmployeeWhereInput[] = [];
  if (filters.nom?.trim()) {
    const nom = filters.nom.trim();
    identityAnd.push({
      OR: [
        { metadata: { path: ["Nom"], string_contains: nom } },
        { displayName: { contains: nom, mode: "insensitive" } },
      ],
    });
  }
  if (filters.prenom?.trim()) {
    const prenom = filters.prenom.trim();
    identityAnd.push({
      OR: [
        { metadata: { path: ["Prénom"], string_contains: prenom } },
        { displayName: { contains: prenom, mode: "insensitive" } },
      ],
    });
  }
  if (identityAnd.length > 0) {
    employeeFilter.AND = [...(Array.isArray(employeeFilter.AND) ? employeeFilter.AND : []), ...identityAnd];
  }

  // Enfants : filtrés via EmployeeInformation.nbEnfants (Complétude), pas ici.

  applyRange(employeeFilter, "age", filters.minAge, filters.maxAge);
  applyRange(employeeFilter, "anciennete", filters.minAnciennete, filters.maxAnciennete);
  applyRange(employeeFilter, "dateEntree", filters.dateEntreeFrom, filters.dateEntreeTo);
  applyRange(employeeFilter, "dateDepart", filters.dateDepartFrom, filters.dateDepartTo);

  return employeeFilter;
}

/** All catalog entries across every category, flattened once for documentTypes lookups. */
const ALL_EXPECTED_DOCUMENT_TYPES: ExpectedDocumentType[] = Object.values(
  expectedDocumentTypes,
).flat();

/** OR-of-contains against a document's label + known aliases, for a set of catalog keys. */
function documentTypesWhere(keys: string[]): Prisma.DriveFileWhereInput | undefined {
  const entries = ALL_EXPECTED_DOCUMENT_TYPES.filter((entry) => keys.includes(entry.key));
  if (entries.length === 0) return undefined;

  const OR = entries.flatMap((entry) =>
    [entry.key, ...(entry.aliases ?? [])].map((candidate) => ({
      documentType: { contains: candidate, mode: "insensitive" as const },
    })),
  );
  return { OR };
}

function buildDocumentWhere(
  filters: SearchFilters,
  viewerAccess: ResolvedAccess,
  /** Matricules Complétude (situation / enfants) — null = pas de contrainte. */
  completenessMatricules?: string[] | null,
): Prisma.DriveFileWhereInput {
  const where: Prisma.DriveFileWhereInput = {};
  const and: Prisma.DriveFileWhereInput[] = [];

  if (filters.category && filters.category.length > 0) {
    where.category = { in: filters.category };
  }
  if (filters.documentType?.trim()) {
    where.documentType = { contains: filters.documentType.trim(), mode: "insensitive" };
  }
  if (filters.documentTypes && filters.documentTypes.length > 0) {
    const documentTypeFilter = documentTypesWhere(filters.documentTypes);
    if (documentTypeFilter) and.push(documentTypeFilter);
  }
  if (filters.folderName && filters.folderName.length > 0) {
    where.folderName = { in: filters.folderName };
  }
  if (filters.childName?.trim()) {
    and.push({
      parsedMetadata: { path: ["enfant"], string_contains: filters.childName.trim() },
    });
  }
  applyRange(where, "driveModifiedAt", filters.modifiedFrom, filters.modifiedTo);

  const employeeFilter = applyEmployeeScope(buildEmployeeWhere(filters), viewerAccess);

  // Situation + enfants liés à la table Complétude (EmployeeInformation)
  if (completenessMatricules !== undefined && completenessMatricules !== null) {
    employeeFilter.matricule = {
      in: completenessMatricules.length > 0 ? completenessMatricules : ["__aucun_matricule__"],
    };
  }

  if (Object.keys(employeeFilter).length > 0) {
    where.employee = employeeFilter;
  }
  if (and.length > 0) {
    where.AND = and;
  }

  const query = filters.query?.trim();
  if (query) {
    where.OR = [
      { name: { contains: query, mode: "insensitive" } },
      { documentType: { contains: query, mode: "insensitive" } },
      { employee: searchTextCondition(query) },
    ];
  }

  return where;
}

/** Matricules dont la situation (feuille Complétude) correspond au filtre. */
async function resolveSituationMatricules(
  situations: string[] | undefined,
): Promise<string[] | null> {
  if (!situations || situations.length === 0) return null;
  const rows = await prisma.employeeInformation.findMany({
    where: { situation: { in: situations } },
    select: { matricule: true },
  });
  return rows.map((row) => row.matricule);
}

/** Matricules dont nbEnfants (Complétude) correspond au filtre enfants. */
async function resolveChildrenMatricules(
  filters: SearchFilters,
): Promise<string[] | null> {
  const exact = filters.childrenExact;
  const min = filters.minChildren;

  if (exact && exact.length > 0) {
    const rows = await prisma.employeeInformation.findMany({
      where: { nbEnfants: { in: exact } },
      select: { matricule: true },
    });
    return rows.map((row) => row.matricule);
  }

  if (min !== undefined && min > 0) {
    const rows = await prisma.employeeInformation.findMany({
      where: { nbEnfants: { gte: min } },
      select: { matricule: true },
    });
    return rows.map((row) => row.matricule);
  }

  return null;
}

/** Intersection de listes de matricules (null = pas de filtre sur cette dimension). */
function intersectMatricules(
  a: string[] | null,
  b: string[] | null,
): string[] | null {
  if (a === null && b === null) return null;
  if (a === null) return b;
  if (b === null) return a;
  const setB = new Set(b);
  return a.filter((m) => setB.has(m));
}

async function queryDocuments(
  filters: SearchFilters,
  viewerAccess: ResolvedAccess,
  take: number,
): Promise<FileWithEmployee[]> {
  const [situationMatricules, childrenMatricules] = await Promise.all([
    resolveSituationMatricules(filters.situation),
    resolveChildrenMatricules(filters),
  ]);
  const completenessMatricules = intersectMatricules(
    situationMatricules,
    childrenMatricules,
  );
  return prisma.driveFile.findMany({
    where: buildDocumentWhere(filters, viewerAccess, completenessMatricules),
    include: { employee: true },
    orderBy: [{ employee: { matricule: "asc" } }, { folderName: "asc" }, { name: "asc" }],
    take,
  });
}

function toResult(file: FileWithEmployee, access: ResolvedAccess): DocumentResult {
  const category = file.category as DocumentCategory;
  const authorized = canViewDocument(access, category, file.documentType);

  let viewUrl: string | undefined;
  if (authorized) {
    viewUrl = file.webViewLink ?? `/api/documents/${file.id}/view`;
  }

  return {
    id: file.id,
    fileName: file.name,
    folderName: file.folderName,
    category,
    documentType: file.documentType,
    modifiedAt: file.driveModifiedAt?.toISOString() ?? null,
    authorized,
    viewUrl,
    employee: {
      matricule: file.employee.matricule,
      displayName: file.employee.displayName,
      service: file.employee.service,
    },
  };
}

const SEARCH_ROW_LIMIT = 200;
export const EXPORT_ROW_LIMIT = Number(process.env.EXPORT_ROW_LIMIT ?? 20_000);

export async function searchDocuments(
  filters: SearchFilters,
  viewerAccess: ResolvedAccess,
): Promise<DocumentResult[]> {
  const files = await queryDocuments(filters, viewerAccess, SEARCH_ROW_LIMIT);
  return files
    .filter((file) =>
      canViewDocument(viewerAccess, file.category as DocumentCategory, file.documentType),
    )
    .map((file) => toResult(file, viewerAccess));
}

export type DocumentExportRow = {
  /** Base sheet label → value, one column per original French header */
  employeeMetadata: Record<string, string>;
  matricule: string;
  displayName: string;
  childrenCount: number;
  hasSpouseDocument: boolean;
  category: DocumentCategory;
  folderName: string;
  documentType: string | null;
  fileName: string;
  modifiedAt: string | null;
  /** Drive webViewLink, or null when only servable via the local streaming route */
  webViewLink: string | null;
  localViewPath: string | null;
};

function toExportRow(file: FileWithEmployee): DocumentExportRow {
  return {
    employeeMetadata: (file.employee.metadata as Record<string, string> | null) ?? {},
    matricule: file.employee.matricule,
    displayName: file.employee.displayName,
    childrenCount: file.employee.childrenCount,
    hasSpouseDocument: file.employee.hasSpouseDocument,
    category: file.category as DocumentCategory,
    folderName: file.folderName,
    documentType: file.documentType,
    fileName: file.name,
    modifiedAt: file.driveModifiedAt?.toISOString() ?? null,
    webViewLink: file.webViewLink,
    localViewPath: `/api/documents/${file.id}/view`,
  };
}

/**
 * Same filters as `searchDocuments`, but for the Excel export: uncapped (up to
 * `EXPORT_ROW_LIMIT`) and unauthorized documents are excluded entirely — never
 * included without a link, matching the Model B "denied = invisible" rule.
 */
export async function searchDocumentsForExport(
  filters: SearchFilters,
  viewerAccess: ResolvedAccess,
): Promise<{ rows: DocumentExportRow[]; truncated: boolean }> {
  const files = await queryDocuments(filters, viewerAccess, EXPORT_ROW_LIMIT);
  const authorizedFiles = files.filter((file) =>
    canViewDocument(viewerAccess, file.category as DocumentCategory, file.documentType),
  );
  return {
    rows: authorizedFiles.map(toExportRow),
    truncated: files.length >= EXPORT_ROW_LIMIT,
  };
}

type EmployeeWithCount = Prisma.EmployeeGetPayload<{
  include: { _count: { select: { files: true } } };
}>;

function toEmployeeSummary(e: EmployeeWithCount): EmployeeSummary {
  return {
    matricule: e.matricule,
    displayName: e.displayName,
    genre: e.genre,
    cin: e.cin,
    age: e.age,
    anciennete: e.anciennete,
    direction: e.direction,
    service: e.service,
    poste: e.poste,
    statut: e.statut,
    situation: e.situation,
    childrenCount: e.childrenCount,
    documentCount: e._count.files,
    zone: e.zone,
    agence: e.agence,
    position: e.position,
    encadrant: e.encadrant,
    managerMatricule: e.managerMatricule,
    categorieRh: e.categorieRh,
    dateEntree: e.dateEntree?.toISOString() ?? null,
    searchText: e.searchText,
    metadata: (e.metadata as Record<string, string> | null) ?? null,
    archivedAt: e.archivedAt?.toISOString() ?? null,
  };
}

export async function listEmployees(
  viewerAccess: ResolvedAccess,
  query?: string,
): Promise<EmployeeSummary[]> {
  const trimmed = query?.trim();
  const where: Prisma.EmployeeWhereInput = trimmed
    ? searchTextCondition(trimmed)
    : {};
  applyEmployeeScope(where, viewerAccess);

  const employees = await prisma.employee.findMany({
    where,
    include: { _count: { select: { files: true } } },
    orderBy: { matricule: "asc" },
  });

  return employees.map(toEmployeeSummary);
}

export async function getEmployeeWithDocuments(
  matricule: string,
  viewerAccess: ResolvedAccess,
): Promise<{ employee: EmployeeSummary; documents: DocumentResult[] } | null> {
  const employee = await prisma.employee.findUnique({
    where: { matricule },
    include: {
      files: { include: { employee: true }, orderBy: [{ folderName: "asc" }, { name: "asc" }] },
      _count: { select: { files: true } },
    },
  });

  if (!employee) return null;
  if (!canViewEmployee(viewerAccess, employee)) return null;

  return {
    employee: toEmployeeSummary(employee),
    documents: employee.files
      .filter((file) =>
        canViewDocument(viewerAccess, file.category as DocumentCategory, file.documentType),
      )
      .map((file) => toResult(file, viewerAccess)),
  };
}

export type DocumentTypeStatus = {
  key: string;
  label: string;
  present: boolean;
  /** Manually attested by RH — distinct from `present`; a verified-but-still-missing
   * document stays counted as missing everywhere (see CompletenessAttestation). */
  verified: boolean;
  verifiedAt: string | null;
  verifiedByName: string | null;
};

export type CategoryCompleteness = {
  category: DocumentCategory;
  /** False only for DEPART when the employee hasn't left — render as "—", not a gap. */
  applicable: boolean;
  /** Number of indexed DriveFile rows in this category (inventory, independent of obligation). */
  fileCount: number;
  /** Obligation=oui and condition met — counted toward missingCount. */
  required: DocumentTypeStatus[];
  /** Obligation=non, or condition not met — shown for reference only. */
  optional: DocumentTypeStatus[];
};

export type EmployeeCompleteness = {
  matricule: string;
  displayName: string;
  service: string | null;
  poste: string | null;
  direction: string | null;
  categories: CategoryCompleteness[];
  missingCount: number;
  /** All indexed DriveFile rows for this employee (inventory, not only obligatory). */
  totalFileCount: number;
};

/** Tracked categories the given viewer is authorized to see — drives the completeness table's columns. */
export function getViewerTrackedCategories(viewerAccess: ResolvedAccess): DocumentCategory[] {
  const visible = new Set(visibleCategories(viewerAccess));
  return trackedCategories.filter((c) => visible.has(c));
}

/**
 * Per-employee checklist against the synced Sheet catalog (or hardcoded fallback),
 * scoped to categories/types the viewer may see. Derived from DriveFile rows +
 * employee statut/situation/childrenCount — gaps clear after upload + sync.
 */
export async function getDossierCompleteness(
  viewerAccess: ResolvedAccess,
): Promise<EmployeeCompleteness[]> {
  const viewerTrackedCategories = getViewerTrackedCategories(viewerAccess);
  const catalogByCategory = await resolveExpectedDocumentTypes();
  const infoByMatricule = await loadEmployeeInformationByMatricule();

  const employees = await prisma.employee.findMany({
    where: applyEmployeeScope({ archivedAt: null }, viewerAccess),
    select: {
      matricule: true,
      displayName: true,
      service: true,
      poste: true,
      direction: true,
      dateDepart: true,
      statut: true,
      situation: true,
      childrenCount: true,
      hasSpouseDocument: true,
      files: {
        select: { category: true, documentType: true, parsedMetadata: true },
      },
      attestations: {
        select: {
          category: true,
          documentType: true,
          verifiedAt: true,
          verifiedBy: { select: { name: true } },
        },
      },
    },
    orderBy: { matricule: "asc" },
  });

  return employees.map((e) => {
    let missingCount = 0;
    const info = infoByMatricule.get(e.matricule);
    // Prefer Complétude sheet (EmployeeInformation) for situation / statut / enfants
    const employeeCtx = {
      statut: info?.statut ?? e.statut,
      situation: info?.situation ?? e.situation,
      childrenCount: info?.nbEnfants ?? e.childrenCount,
      hasSpouseDocument: e.hasSpouseDocument,
    };

    const attestationKey = (category: DocumentCategory, documentType: string) =>
      `${category}:${documentType}`;
    const attestationMap = new Map(
      e.attestations.map((a) => [
        attestationKey(a.category as DocumentCategory, a.documentType),
        { verifiedAt: a.verifiedAt, verifiedByName: a.verifiedBy.name },
      ]),
    );

    const categories: CategoryCompleteness[] = viewerTrackedCategories.map((category) => {
      const applicable = category !== "DEPART" || e.dateDepart !== null;
      const catalog = (catalogByCategory[category] ?? []).filter((entry) =>
        canViewDocument(viewerAccess, category, entry.key),
      );
      const filesInCategory = e.files.filter((f) => f.category === category);

      const toStatus = (entry: ExpectedDocumentType): DocumentTypeStatus => {
        const attestation =
          attestationMap.get(attestationKey(category, entry.key)) ??
          attestationMap.get(attestationKey(category, "*"));
        const role = entry.familyRole ?? "self";
        return {
          key: entry.key,
          label: entry.label,
          present: filesInCategory.some((f) => {
            const meta = f.parsedMetadata as FileFamilyMeta | null;
            return (
              matchesDocumentType(f.documentType, entry) && matchesFamilyRole(meta, role)
            );
          }),
          verified: attestation !== undefined,
          verifiedAt: attestation?.verifiedAt.toISOString() ?? null,
          verifiedByName: attestation?.verifiedByName ?? null,
        };
      };

      const requiredEntries = catalog.filter((c) =>
        isDocumentRequiredForEmployee(c, employeeCtx),
      );
      const optionalEntries = catalog.filter(
        (c) => !isDocumentRequiredForEmployee(c, employeeCtx),
      );

      const required = requiredEntries.map(toStatus);
      const optional = optionalEntries.map(toStatus);

      if (applicable) missingCount += required.filter((r) => !r.present).length;

      return {
        category,
        applicable,
        fileCount: filesInCategory.length,
        required,
        optional,
      };
    });

    return {
      matricule: e.matricule,
      displayName: e.displayName,
      service: e.service,
      poste: e.poste,
      direction: e.direction,
      categories,
      missingCount,
      totalFileCount: e.files.length,
    };
  });
}

export async function getIndexStats() {
  const [totalEmployees, totalDocuments, withThreePlusChildren] = await Promise.all([
    prisma.employee.count({ where: { archivedAt: null } }),
    prisma.driveFile.count(),
    prisma.employee.count({ where: { archivedAt: null, childrenCount: { gte: 3 } } }),
  ]);

  return { totalEmployees, totalDocuments, withThreePlusChildren };
}
