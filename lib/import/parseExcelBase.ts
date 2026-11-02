/**
 * Parse the "Base" sheet of `doc/debut/Etat personnel exercice.xlsx`.
 *
 * Captures ALL columns: typed fields used by search filters (genre, CIN, âge,
 * ancienneté, …) plus a `metadata` map of every header → value for display,
 * and a normalized `searchText` so users can search on any info (CIN, diplôme,
 * zone, responsable hiérarchique, contact, …).
 *
 * Layout: row 2 = headers (row 1 = column numbers), data from row 3.
 */

import path from "node:path";
import ExcelJS from "exceljs";

export type BaseEmployeeRow = {
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
  entite: string | null;
  sousEntite: string | null;
  zone: string | null;
  agence: string | null;
  college: string | null;
  admTech: string | null;
  position: string | null;
  encadrant: boolean | null;
  niveau: string | null;
  grade: string | null;
  categorieRh: string | null;
  managerMatricule: string | null;
  dateEntree: Date | null;
  dateDepart: Date | null;
  /** Every Base column, header label → display value */
  metadata: Record<string, string>;
  /** Normalized concatenation of all values, for full-text search */
  searchText: string;
};

const DEFAULT_XLSX = path.join(
  process.cwd(),
  "doc",
  "debut",
  "Etat personnel exercice.xlsx",
);

export function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(value);
  }
  if (typeof value === "object") {
    if ("richText" in value) {
      return value.richText.map((part) => part.text).join("").trim() || null;
    }
    if ("text" in value) {
      // Hyperlink cells (e.g. E-Mail, Dossier). Plain text/hyperlink pairs give
      // a string; a *styled* hyperlink (e.g. underlined/colored, common for
      // emails) gives a nested richText object instead — recurse into it or
      // the value is silently dropped.
      if (typeof value.text === "string") {
        return value.text.trim() || null;
      }
      return cellToText(value.text as ExcelJS.CellValue);
    }
    if ("result" in value) {
      return cellToText(value.result as ExcelJS.CellValue);
    }
    return null;
  }
  const text = String(value).trim();
  return text || null;
}

function toInt(value: string | null): number | null {
  if (!value) return null;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function toBool(value: string | null): boolean | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "oui") return true;
  if (normalized === "non") return false;
  return null;
}

function toDate(value: ExcelJS.CellValue): Date | null {
  if (value instanceof Date) return value;
  if (value !== null && typeof value === "object" && "result" in value) {
    return toDate(value.result as ExcelJS.CellValue);
  }
  return null;
}

/** Header label cleanup: collapse line breaks/spaces */
function cleanHeader(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

export async function parseExcelBase(
  xlsxPath = process.env.EXERCISE_XLSX_PATH ?? DEFAULT_XLSX,
): Promise<BaseEmployeeRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(xlsxPath);

  const sheet = workbook.getWorksheet("Base");
  if (!sheet) {
    throw new Error(`Sheet "Base" not found in ${xlsxPath}`);
  }

  // Build header map from row 2
  const headerRow = sheet.getRow(2);
  const headers = new Map<number, string>();
  for (let col = 1; col <= sheet.columnCount; col++) {
    const label = cellToText(headerRow.getCell(col).value);
    if (label) headers.set(col, cleanHeader(label));
  }

  const byHeader = (row: ExcelJS.Row, label: string): string | null => {
    for (const [col, header] of headers) {
      if (header.toLowerCase() === label.toLowerCase()) {
        return cellToText(row.getCell(col).value);
      }
    }
    return null;
  };

  const byHeaderDate = (row: ExcelJS.Row, label: string): Date | null => {
    for (const [col, header] of headers) {
      if (header.toLowerCase() === label.toLowerCase()) {
        return toDate(row.getCell(col).value);
      }
    }
    return null;
  };

  const employees: BaseEmployeeRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 3) return;

    const rawMatricule = row.getCell(1).value;
    if (rawMatricule === null || rawMatricule === undefined || rawMatricule === "") {
      return;
    }
    const matricule = String(
      typeof rawMatricule === "number" ? Math.trunc(rawMatricule) : rawMatricule,
    ).trim();

    const metadata: Record<string, string> = {};
    for (const [col, header] of headers) {
      if (header.toLowerCase() === "dossier") continue; // hyperlink object, not useful
      const raw = row.getCell(col).value;
      const text =
        typeof raw === "number" && Number.isInteger(raw) && header === "Matricule"
          ? matricule
          : cellToText(raw);
      if (text) metadata[header] = text;
    }

    const prenom = byHeader(row, "Prénom") ?? "";
    const nom = byHeader(row, "Nom") ?? "";
    const displayName = `${prenom} ${nom}`.trim() || matricule;

    const searchText = normalizeForSearch(
      [matricule, displayName, ...Object.values(metadata)].join(" "),
    );

    employees.push({
      matricule,
      displayName,
      genre: byHeader(row, "Genre"),
      cin: byHeader(row, "CIN"),
      age: toInt(byHeader(row, "Age")),
      anciennete: toInt(byHeader(row, "Anc")),
      direction: byHeader(row, "Direction"),
      service: byHeader(row, "Service"),
      poste: byHeader(row, "Poste"),
      statut: byHeader(row, "Statut"),
      situation: byHeader(row, "Situation"),
      entite: byHeader(row, "Entité"),
      sousEntite: byHeader(row, "Sous-Entité"),
      zone: byHeader(row, "Zone"),
      agence: byHeader(row, "Agence"),
      college: byHeader(row, "Collège"),
      admTech: byHeader(row, "Adm./Tech."),
      position: byHeader(row, "Position"),
      encadrant: toBool(byHeader(row, "Encadrant")),
      niveau: byHeader(row, "Niveau"),
      grade: byHeader(row, "Grade"),
      categorieRh: byHeader(row, "Catégorie"),
      // Note: the Base sheet header has a typo ("Hirérachique") — match the actual export, not the corrected spelling.
      managerMatricule: byHeader(row, "Matricule Responsable Hirérachique"),
      dateEntree: byHeaderDate(row, "Date d'Entrée"),
      dateDepart: byHeaderDate(row, "Date Départ"),
      metadata,
      searchText,
    });
  });

  return employees;
}
