/**
 * Agrège l’export Excel : 1 ligne par employé.
 * Les colonnes « document » qui varient deviennent Document 1, Document 2, …
 */

import type { DocumentExportRow } from "@/lib/search/documents";
import {
  getExportCellValue,
  getExportColumnHeader,
  isLinkColumn,
  type ExportColumnId,
} from "@/lib/search/export-columns";
import { categoryFilterLabels } from "@/lib/document-category";

/** Colonnes qui dépendent du fichier (peuvent différer d’un doc à l’autre). */
const DOCUMENT_VARYING_IDS = new Set<ExportColumnId>([
  "category",
  "documentTypes",
  "documentType",
  "folderName",
  "modifiedFrom",
  "docLink",
  "docUrl",
]);

export function isDocumentVaryingColumn(id: ExportColumnId): boolean {
  return DOCUMENT_VARYING_IDS.has(id);
}

export type ResolvedLink = string | null;

export type AggregateColumn = {
  key: string;
  header: string;
  width: number;
  /** Colonne document indexée (1-based) pour hyperliens */
  link?: { id: ExportColumnId; fileIndex: number };
};

export type AggregateSheetRow = {
  values: Record<string, string | number>;
  /** key → url pour appliquer HYPERLINK après addRow */
  links: Record<string, string>;
};

function groupByMatricule(rows: DocumentExportRow[]): Map<string, DocumentExportRow[]> {
  const map = new Map<string, DocumentExportRow[]>();
  for (const row of rows) {
    const list = map.get(row.matricule) ?? [];
    list.push(row);
    map.set(row.matricule, list);
  }
  return map;
}

/**
 * Construit colonnes + lignes : 1 employé = 1 ligne.
 * Colonnes employé uniques ; colonnes document → « Type 1 », « Type 2 », …
 */
export function buildEmployeeAggregatedSheet(
  rows: DocumentExportRow[],
  selectedColumns: ExportColumnId[],
  resolveLink: (row: DocumentExportRow) => ResolvedLink,
): { columns: AggregateColumn[]; sheetRows: AggregateSheetRow[] } {
  const groups = groupByMatricule(rows);
  const employeeCols = selectedColumns.filter((id) => !isDocumentVaryingColumn(id));
  const documentCols = selectedColumns.filter((id) => isDocumentVaryingColumn(id));

  // Dédupliquer en-têtes employé (ex. enfants min / exact)
  const empColumns: AggregateColumn[] = [];
  const seenEmpHeaders = new Set<string>();
  for (const id of employeeCols) {
    const header = getExportColumnHeader(id);
    if (seenEmpHeaders.has(header)) continue;
    seenEmpHeaders.add(header);
    empColumns.push({ key: id, header, width: 18 });
  }

  const maxFiles = Math.max(1, ...[...groups.values()].map((g) => g.length));

  const docColumns: AggregateColumn[] = [];
  for (const id of documentCols) {
    const base = getExportColumnHeader(id);
    for (let i = 1; i <= maxFiles; i++) {
      const header = maxFiles === 1 ? base : `${base} ${i}`;
      const key = `${id}__${i}`;
      docColumns.push({
        key,
        header,
        width: 18,
        link: isLinkColumn(id) ? { id, fileIndex: i } : undefined,
      });
    }
  }

  const columns = [...empColumns, ...docColumns];
  const sheetRows: AggregateSheetRow[] = [];

  for (const [, files] of groups) {
    const first = files[0];
    const values: Record<string, string | number> = {};
    const links: Record<string, string> = {};

    for (const col of empColumns) {
      const id = col.key as ExportColumnId;
      const link = resolveLink(first);
      values[col.key] = getExportCellValue(id, first, { link });
    }

    for (const id of documentCols) {
      for (let i = 0; i < maxFiles; i++) {
        const key = `${id}__${i + 1}`;
        const file = files[i];
        if (!file) {
          values[key] = "";
          continue;
        }
        const link = resolveLink(file);
        values[key] = getExportCellValue(id, file, { link });
        if (isLinkColumn(id) && link) {
          links[key] = link;
        }
      }
    }

    sheetRows.push({ values, links });
  }

  return { columns, sheetRows };
}

/** Export « toutes colonnes » : 1 ligne / employé, docs en colonnes numérotées. */
export function buildFullAggregatedSheet(
  rows: DocumentExportRow[],
  resolveLink: (row: DocumentExportRow) => ResolvedLink,
): { columns: AggregateColumn[]; sheetRows: AggregateSheetRow[] } {
  const groups = groupByMatricule(rows);

  const metadataHeaders: string[] = [];
  const seenHeaders = new Set<string>();
  for (const row of rows) {
    for (const header of Object.keys(row.employeeMetadata)) {
      if (!seenHeaders.has(header)) {
        seenHeaders.add(header);
        metadataHeaders.push(header);
      }
    }
  }

  const maxFiles = Math.max(1, ...[...groups.values()].map((g) => g.length));

  const empColumns: AggregateColumn[] = [
    ...metadataHeaders.map((header) => ({ header, key: `meta:${header}`, width: 18 })),
    { header: "Enfants (nb)", key: "__childrenCount", width: 12 },
    { header: "Conjoint au dossier", key: "__hasSpouseDocument", width: 16 },
  ];

  const docFields: { keyPrefix: string; header: string; link?: boolean }[] = [
    { keyPrefix: "__folder", header: "Document — Dossier" },
    { keyPrefix: "__documentType", header: "Document — Type" },
    { keyPrefix: "__fileName", header: "Document — Nom de fichier" },
    { keyPrefix: "__modifiedAt", header: "Document — Dernière modification" },
    { keyPrefix: "__link", header: "Document — Lien", link: true },
    { keyPrefix: "__url", header: "Document — URL", link: true },
  ];

  const docColumns: AggregateColumn[] = [];
  for (const field of docFields) {
    for (let i = 1; i <= maxFiles; i++) {
      const header = maxFiles === 1 ? field.header : `${field.header} ${i}`;
      docColumns.push({
        key: `${field.keyPrefix}__${i}`,
        header,
        width: 18,
        link: field.link ? { id: field.keyPrefix === "__link" ? "docLink" : "docUrl", fileIndex: i } : undefined,
      });
    }
  }

  const columns = [...empColumns, ...docColumns];
  const sheetRows: AggregateSheetRow[] = [];

  for (const [, files] of groups) {
    const first = files[0];
    const values: Record<string, string | number> = {
      ...Object.fromEntries(metadataHeaders.map((h) => [`meta:${h}`, first.employeeMetadata[h] ?? ""])),
      __childrenCount: first.childrenCount,
      __hasSpouseDocument: first.hasSpouseDocument ? "Oui" : "Non",
    };
    const links: Record<string, string> = {};

    for (let i = 0; i < maxFiles; i++) {
      const file = files[i];
      const n = i + 1;
      if (!file) {
        values[`__folder__${n}`] = "";
        values[`__documentType__${n}`] = "";
        values[`__fileName__${n}`] = "";
        values[`__modifiedAt__${n}`] = "";
        values[`__link__${n}`] = "";
        values[`__url__${n}`] = "";
        continue;
      }
      const link = resolveLink(file);
      values[`__folder__${n}`] = categoryFilterLabels[file.category] ?? file.category;
      values[`__documentType__${n}`] = file.documentType ?? "";
      values[`__fileName__${n}`] = file.fileName;
      values[`__modifiedAt__${n}`] = file.modifiedAt
        ? new Date(file.modifiedAt).toLocaleDateString("fr-FR")
        : "";
      values[`__link__${n}`] = link ? "Ouvrir" : "—";
      values[`__url__${n}`] = link ?? "";
      if (link) {
        links[`__link__${n}`] = link;
        links[`__url__${n}`] = link;
      }
    }

    sheetRows.push({ values, links });
  }

  return { columns, sheetRows };
}
