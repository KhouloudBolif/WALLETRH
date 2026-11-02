import { prisma } from "@/lib/db";
import { allCategories, type DocumentCategory } from "@/lib/document-category";
import { expectedDocumentTypes } from "@/lib/document-types";
import type { DocumentTypeCatalogMap } from "@/lib/permissions/types";

/**
 * The set of document types a category can be split into, for the permissions UI.
 * RECRUTEMENT/ETAT_CIVIL/ARRETES/DEPART have a curated catalog (lib/document-types.ts,
 * built for dossier completeness); the other 3 categories have no such catalog, so this
 * falls back to whatever document-type strings are actually present in the DB —
 * meaning a newly-uploaded/synced document type just appears as a new controllable row
 * next time the admin page loads, no code change required.
 */
export async function getDocumentTypeCatalog(): Promise<DocumentTypeCatalogMap> {
  const catalog: DocumentTypeCatalogMap = {};

  for (const category of allCategories) {
    const curated = expectedDocumentTypes[category];
    if (curated) {
      catalog[category] = curated.map((entry) => ({ key: entry.key, label: entry.label }));
      continue;
    }

    const rows = await prisma.driveFile.findMany({
      where: { category, documentType: { not: null } },
      select: { documentType: true },
      distinct: ["documentType"],
      orderBy: { documentType: "asc" },
    });

    catalog[category] = rows
      .map((row) => row.documentType)
      .filter((value): value is string => Boolean(value))
      .map((value) => ({ key: value, label: value }));
  }

  return catalog;
}

export type { DocumentTypeCatalogMap };
export type CategoryDocumentTypes = { category: DocumentCategory; types: { key: string; label: string }[] };
