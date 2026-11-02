/**
 * Aggregate reporting stats for RH — workforce demographics (Employee-level, not
 * permission-gated) and a dossier-completeness overview (permission-gated, reuses
 * getDossierCompleteness() rather than re-querying).
 */

import { loadEmployeeInformationByMatricule } from "@/lib/completeness/sheet-catalog";
import { prisma } from "@/lib/db";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import { getDossierCompleteness } from "@/lib/search/documents";
import type { ResolvedAccess } from "@/lib/permissions/types";

export type BucketCount = { label: string; count: number };

export type WorkforceDemographics = {
  totalEmployees: number;
  averageAge: number | null;
  averageAnciennete: number | null;
  managerRatio: number;
  spouseDocumentRatio: number;
  genderSplit: BucketCount[];
  ageDistribution: BucketCount[];
  seniorityDistribution: BucketCount[];
  childrenDistribution: BucketCount[];
  /** Top 10 by headcount, remainder folded into "Autres". */
  headcountByDirection: BucketCount[];
  /** Full list, sorted descending — rendered as a table, not a chart (long tail). */
  headcountByService: BucketCount[];
};

const UNSPECIFIED = "Non renseigné";

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function bucketAge(age: number | null): string {
  if (age === null) return UNSPECIFIED;
  if (age < 30) return "Moins de 30 ans";
  if (age < 40) return "30 à 39 ans";
  if (age < 50) return "40 à 49 ans";
  return "50 ans et plus";
}
const AGE_BUCKET_ORDER = ["Moins de 30 ans", "30 à 39 ans", "40 à 49 ans", "50 ans et plus", UNSPECIFIED];

function bucketSeniority(anciennete: number | null): string {
  if (anciennete === null) return UNSPECIFIED;
  if (anciennete < 5) return "0 à 4 ans";
  if (anciennete < 10) return "5 à 9 ans";
  if (anciennete < 20) return "10 à 19 ans";
  return "20 ans et plus";
}
const SENIORITY_BUCKET_ORDER = ["0 à 4 ans", "5 à 9 ans", "10 à 19 ans", "20 ans et plus", UNSPECIFIED];

function bucketChildren(count: number): string {
  if (count <= 0) return "0 enfant";
  if (count === 1) return "1 enfant";
  if (count === 2) return "2 enfants";
  if (count === 3) return "3 enfants";
  return "4 enfants ou plus";
}
const CHILDREN_BUCKET_ORDER = ["0 enfant", "1 enfant", "2 enfants", "3 enfants", "4 enfants ou plus"];

function orderedBuckets(counts: Map<string, number>, order: string[]): BucketCount[] {
  return order
    .filter((label) => counts.has(label))
    .map((label) => ({ label, count: counts.get(label)! }));
}

function incrementBucket(counts: Map<string, number>, label: string) {
  counts.set(label, (counts.get(label) ?? 0) + 1);
}

function directionLabel(value: string | null): string {
  return value?.trim() || UNSPECIFIED;
}

type WorkforceEmployee = {
  genre: string | null;
  age: number | null;
  anciennete: number | null;
  childrenCount: number;
  encadrant: boolean | null;
  hasSpouseDocument: boolean;
  direction: string | null;
  service: string | null;
};

function summarize(employees: WorkforceEmployee[], foldDirections: boolean): WorkforceDemographics {
  const totalEmployees = employees.length;
  const genderCounts = new Map<string, number>();
  const ageCounts = new Map<string, number>();
  const seniorityCounts = new Map<string, number>();
  const childrenCounts = new Map<string, number>();
  const directionCounts = new Map<string, number>();
  const serviceCounts = new Map<string, number>();

  let managerCount = 0;
  let spouseDocumentCount = 0;

  for (const e of employees) {
    incrementBucket(genderCounts, e.genre === "H" ? "Hommes" : e.genre === "F" ? "Femmes" : UNSPECIFIED);
    incrementBucket(ageCounts, bucketAge(e.age));
    incrementBucket(seniorityCounts, bucketSeniority(e.anciennete));
    incrementBucket(childrenCounts, bucketChildren(e.childrenCount));
    incrementBucket(directionCounts, directionLabel(e.direction));
    incrementBucket(serviceCounts, e.service?.trim() || UNSPECIFIED);
    if (e.encadrant) managerCount += 1;
    if (e.hasSpouseDocument) spouseDocumentCount += 1;
  }

  const sortedDirections = [...directionCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const TOP_DIRECTIONS = 10;
  const headcountByDirection =
    foldDirections && sortedDirections.length > TOP_DIRECTIONS
      ? [
          ...sortedDirections.slice(0, TOP_DIRECTIONS),
          {
            label: "Autres",
            count: sortedDirections.slice(TOP_DIRECTIONS).reduce((sum, d) => sum + d.count, 0),
          },
        ]
      : sortedDirections;

  const headcountByService = [...serviceCounts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalEmployees,
    averageAge: average(employees.map((e) => e.age).filter((v): v is number => v !== null)),
    averageAnciennete: average(
      employees.map((e) => e.anciennete).filter((v): v is number => v !== null),
    ),
    managerRatio: totalEmployees > 0 ? managerCount / totalEmployees : 0,
    spouseDocumentRatio: totalEmployees > 0 ? spouseDocumentCount / totalEmployees : 0,
    genderSplit: [...genderCounts.entries()].map(([label, count]) => ({ label, count })),
    ageDistribution: orderedBuckets(ageCounts, AGE_BUCKET_ORDER),
    seniorityDistribution: orderedBuckets(seniorityCounts, SENIORITY_BUCKET_ORDER),
    childrenDistribution: orderedBuckets(childrenCounts, CHILDREN_BUCKET_ORDER),
    headcountByDirection,
    headcountByService,
  };
}

async function loadWorkforceEmployees(viewerAccess: ResolvedAccess): Promise<WorkforceEmployee[]> {
  const { allowedDirections, allowedServices } = viewerAccess.employeeScope;
  const [employees, infoByMatricule] = await Promise.all([
    prisma.employee.findMany({
      where: {
        archivedAt: null,
        ...(allowedDirections.length > 0 ? { direction: { in: allowedDirections } } : {}),
        ...(allowedServices.length > 0 ? { service: { in: allowedServices } } : {}),
      },
      select: {
        matricule: true,
        genre: true,
        age: true,
        anciennete: true,
        childrenCount: true,
        encadrant: true,
        hasSpouseDocument: true,
        direction: true,
        service: true,
      },
    }),
    loadEmployeeInformationByMatricule(),
  ]);

  return employees.map(({ matricule, childrenCount, ...employee }) => ({
    ...employee,
    // Feuille Complétude (nbEnfants). Le compteur issu des noms de fichiers
    // reste le repli quand le salarié n'a pas de ligne dans cette feuille.
    childrenCount: infoByMatricule.get(matricule)?.nbEnfants ?? childrenCount,
  }));
}

export async function getWorkforceDemographics(
  viewerAccess: ResolvedAccess,
): Promise<WorkforceDemographics> {
  return summarize(await loadWorkforceEmployees(viewerAccess), true);
}

export type DirectionWorkforce = {
  label: string;
  data: WorkforceDemographics;
};

/** Global portrait plus one portrait per direction, so the report can switch without a new query. */
export async function getWorkforceReport(viewerAccess: ResolvedAccess): Promise<{
  overall: WorkforceDemographics;
  directions: DirectionWorkforce[];
}> {
  const employees = await loadWorkforceEmployees(viewerAccess);
  const groups = new Map<string, WorkforceEmployee[]>();
  for (const employee of employees) {
    const label = directionLabel(employee.direction);
    const bucket = groups.get(label);
    if (bucket) bucket.push(employee);
    else groups.set(label, [employee]);
  }

  const directions = [...groups.entries()]
    .map(([label, rows]) => ({ label, data: summarize(rows, false) }))
    .sort((a, b) => b.data.totalEmployees - a.data.totalEmployees || a.label.localeCompare(b.label, "fr"));

  return { overall: summarize(employees, true), directions };
}

export type CompletenessOverview = {
  totalEmployees: number;
  employeesWithGaps: number;
  /** 0-1, required docs present across every tracked+visible category. */
  overallRate: number;
  /** Gaps with a manual RH attestation — a parallel signal, never subtracted from
   * missing/overallRate (a verified-but-absent document stays a real gap). */
  verifiedGapCount: number;
  byCategory: {
    category: DocumentCategory;
    label: string;
    present: number;
    required: number;
    rate: number;
  }[];
  /** Only entries with at least one gap, sorted by missing count descending. */
  byDocumentType: {
    category: DocumentCategory;
    categoryLabel: string;
    key: string;
    label: string;
    missing: number;
    total: number;
  }[];
  byDirection: { direction: string; missingCount: number; employeeCount: number }[];
  topGaps: { matricule: string; displayName: string; service: string | null; missingCount: number }[];
};

const TOP_GAPS_LIMIT = 10;

/** Reduces getDossierCompleteness()'s per-employee output into workforce-wide
 * aggregates — no second DB round-trip, same permission scoping (denied
 * categories/types are already absent from its output). */
export async function getCompletenessOverview(viewerAccess: ResolvedAccess): Promise<CompletenessOverview> {
  const employees = await getDossierCompleteness(viewerAccess);

  let totalRequired = 0;
  let totalPresent = 0;
  let verifiedGapCount = 0;
  const categoryAgg = new Map<DocumentCategory, { present: number; required: number }>();
  const typeAgg = new Map<
    string,
    { category: DocumentCategory; key: string; label: string; missing: number; total: number }
  >();
  const directionAgg = new Map<string, { missingCount: number; employeeCount: number }>();

  for (const emp of employees) {
    const direction = emp.direction?.trim() || UNSPECIFIED;
    const dirEntry = directionAgg.get(direction) ?? { missingCount: 0, employeeCount: 0 };
    dirEntry.employeeCount += 1;
    dirEntry.missingCount += emp.missingCount;
    directionAgg.set(direction, dirEntry);

    for (const cat of emp.categories) {
      if (!cat.applicable) continue;
      const catEntry = categoryAgg.get(cat.category) ?? { present: 0, required: 0 };

      for (const doc of cat.required) {
        catEntry.required += 1;
        totalRequired += 1;
        if (doc.present) {
          catEntry.present += 1;
          totalPresent += 1;
        } else if (doc.verified) {
          verifiedGapCount += 1;
        }

        const typeKey = `${cat.category}:${doc.key}`;
        const typeEntry = typeAgg.get(typeKey) ?? {
          category: cat.category,
          key: doc.key,
          label: doc.label,
          missing: 0,
          total: 0,
        };
        typeEntry.total += 1;
        if (!doc.present) typeEntry.missing += 1;
        typeAgg.set(typeKey, typeEntry);
      }

      categoryAgg.set(cat.category, catEntry);
    }
  }

  const byCategory = [...categoryAgg.entries()].map(([category, v]) => ({
    category,
    label: categoryFilterLabels[category],
    present: v.present,
    required: v.required,
    rate: v.required > 0 ? v.present / v.required : 1,
  }));

  const byDocumentType = [...typeAgg.values()]
    .filter((t) => t.missing > 0)
    .map((t) => ({ ...t, categoryLabel: categoryFilterLabels[t.category] }))
    .sort((a, b) => b.missing - a.missing);

  const byDirection = [...directionAgg.entries()]
    .map(([direction, v]) => ({ direction, ...v }))
    .sort((a, b) => b.missingCount - a.missingCount);

  const topGaps = [...employees]
    .filter((e) => e.missingCount > 0)
    .sort((a, b) => b.missingCount - a.missingCount)
    .slice(0, TOP_GAPS_LIMIT)
    .map((e) => ({
      matricule: e.matricule,
      displayName: e.displayName,
      service: e.service,
      missingCount: e.missingCount,
    }));

  return {
    totalEmployees: employees.length,
    employeesWithGaps: employees.filter((e) => e.missingCount > 0).length,
    overallRate: totalRequired > 0 ? totalPresent / totalRequired : 1,
    verifiedGapCount,
    byCategory,
    byDocumentType,
    byDirection,
    topGaps,
  };
}
