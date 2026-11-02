import { applyAccessToDocument } from "@/lib/mock/access";
import { mockDocuments } from "@/lib/mock/documents";
import { mockEmployees } from "@/lib/mock/employees";
import type { DocumentSearchFilters, DocumentSearchResult } from "@/lib/mock/types";
import type { CategoryAccessMap } from "@/lib/permissions/types";

function normalize(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

export function searchMockDocuments(
  filters: DocumentSearchFilters,
  viewerAccess: CategoryAccessMap,
): DocumentSearchResult[] {
  const query = filters.query?.trim();
  const normalizedQuery = query ? normalize(query) : "";

  const employeeMap = new Map(mockEmployees.map((e) => [e.matricule, e]));

  let results = mockDocuments
    .map((doc) => {
      const employee = employeeMap.get(doc.employeeMatricule);
      if (!employee) return null;
      const withAccess = applyAccessToDocument(doc, viewerAccess);
      return { ...withAccess, employee };
    })
    .filter((r): r is DocumentSearchResult => r !== null);

  if (normalizedQuery) {
    results = results.filter(
      (r) =>
        normalize(r.employee.displayName).includes(normalizedQuery) ||
        normalize(r.employee.matricule).includes(normalizedQuery) ||
        normalize(r.fileName).includes(normalizedQuery) ||
        normalize(r.employee.service).includes(normalizedQuery) ||
        normalize(r.employee.direction).includes(normalizedQuery) ||
        normalize(r.employee.poste).includes(normalizedQuery),
    );
  }

  if (filters.category && filters.category !== "ALL") {
    results = results.filter((r) => r.category === filters.category);
  }

  if (filters.minChildren !== undefined && filters.minChildren > 0) {
    results = results.filter((r) => r.employee.childrenCount >= filters.minChildren!);
  }

  return results.sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime(),
  );
}

export function filterMockEmployees(query?: string) {
  const normalizedQuery = query ? normalize(query) : "";
  if (!normalizedQuery) return mockEmployees;

  return mockEmployees.filter(
    (e) =>
      normalize(e.displayName).includes(normalizedQuery) ||
      normalize(e.matricule).includes(normalizedQuery) ||
      normalize(e.service).includes(normalizedQuery) ||
      normalize(e.direction).includes(normalizedQuery) ||
      normalize(e.poste).includes(normalizedQuery),
  );
}
