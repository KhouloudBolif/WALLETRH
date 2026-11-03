import { allCategories, type DocumentCategory } from "@/lib/document-category";
import type { EmployeeCompleteness } from "@/lib/search/documents";

const CATEGORY_SET = new Set<string>(allCategories);

/** « ETAT_CIVIL::CIN » — le séparateur ne figure pas dans les catégories. */
export function missingDocumentValue(category: DocumentCategory, documentKey: string) {
  return `${category}::${documentKey}`;
}

export function parseMissingDocumentFilter(
  value: string | null | undefined,
): { category: DocumentCategory; key: string } | null {
  if (!value || value === "ALL") return null;
  const sep = value.indexOf("::");
  if (sep <= 0) return null;
  const category = value.slice(0, sep);
  const key = value.slice(sep + 2);
  if (!CATEGORY_SET.has(category) || key.length === 0 || key.length > 120) return null;
  return { category: category as DocumentCategory, key };
}

/** Le salarié n'a pas ce fichier, et la catégorie le concerne. */
export function employeeMissingDocument(
  employee: EmployeeCompleteness,
  category: DocumentCategory,
  documentKey: string,
): boolean {
  const status = employee.categories.find((item) => item.category === category);
  if (!status?.applicable) return false;
  const doc = [...status.required, ...status.optional].find((item) => item.key === documentKey);
  if (!doc) return false;
  return !doc.present;
}
