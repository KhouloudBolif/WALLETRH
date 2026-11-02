/**
 * Colonnes Excel sélectionnables depuis la barre « Export » de la Requête.
 * Les ids alignés sur les champs filtre (QUERY_FIELDS) quand c’est possible.
 */

import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import type { DocumentExportRow } from "@/lib/search/documents";

export type ExportColumnId =
  | "matricule"
  | "nom"
  | "prenom"
  | "genre"
  | "cin"
  | "ageRange"
  | "situation"
  | "minChildren"
  | "childrenExact"
  | "hasSpouseDocument"
  | "managerMatricule"
  | "direction"
  | "service"
  | "entite"
  | "sousEntite"
  | "zone"
  | "agence"
  | "poste"
  | "statut"
  | "college"
  | "admTech"
  | "position"
  | "encadrant"
  | "categorieRh"
  | "niveau"
  | "grade"
  | "ancienneteRange"
  | "dateEntreeFrom"
  | "dateDepartFrom"
  | "category"
  | "documentTypes"
  | "documentType"
  | "folderName"
  | "modifiedFrom"
  | "docLink"
  | "docUrl";

type ExportColumnDef = {
  id: ExportColumnId;
  /** En-tête Excel */
  header: string;
  /** Clé metadata Base (si applicable) */
  metadataKey?: string;
};

/** Colonnes exportables (ordre d’affichage dans la palette = ordre QUERY_FIELDS pertinent). */
export const EXPORT_COLUMN_DEFS: ExportColumnDef[] = [
  { id: "matricule", header: "Matricule" },
  { id: "nom", header: "Nom", metadataKey: "Nom" },
  { id: "prenom", header: "Prénom", metadataKey: "Prénom" },
  { id: "genre", header: "Genre", metadataKey: "Genre" },
  { id: "cin", header: "CIN", metadataKey: "CIN" },
  { id: "ageRange", header: "Âge", metadataKey: "Age" },
  { id: "situation", header: "Situation", metadataKey: "Situation" },
  { id: "minChildren", header: "Enfants (nb)" },
  { id: "childrenExact", header: "Enfants (nb)" },
  { id: "hasSpouseDocument", header: "Conjoint au dossier" },
  { id: "managerMatricule", header: "Matricule responsable", metadataKey: "Matricule Responsable Hirérachique" },
  { id: "direction", header: "Direction", metadataKey: "Direction" },
  { id: "service", header: "Service", metadataKey: "Service" },
  { id: "entite", header: "Entité", metadataKey: "Entité" },
  { id: "sousEntite", header: "Sous-entité", metadataKey: "Sous-Entité" },
  { id: "zone", header: "Zone", metadataKey: "Zone" },
  { id: "agence", header: "Agence", metadataKey: "Agence" },
  { id: "poste", header: "Poste", metadataKey: "Poste" },
  { id: "statut", header: "Statut", metadataKey: "Statut" },
  { id: "college", header: "Collège", metadataKey: "Collège" },
  { id: "admTech", header: "Adm. / Tech.", metadataKey: "Adm./Tech." },
  { id: "position", header: "Position", metadataKey: "Position" },
  { id: "encadrant", header: "Encadrant", metadataKey: "Encadrant" },
  { id: "categorieRh", header: "Catégorie RH", metadataKey: "Catégorie" },
  { id: "niveau", header: "Niveau", metadataKey: "Niveau" },
  { id: "grade", header: "Grade", metadataKey: "Grade" },
  { id: "ancienneteRange", header: "Ancienneté", metadataKey: "Anc" },
  { id: "dateEntreeFrom", header: "Date d'entrée", metadataKey: "Date d'Entrée" },
  { id: "dateDepartFrom", header: "Date de départ", metadataKey: "Date Départ" },
  { id: "category", header: "Document — Dossier" },
  { id: "documentTypes", header: "Document — Type" },
  { id: "documentType", header: "Document — Type" },
  { id: "folderName", header: "Document — Sous-dossier" },
  { id: "modifiedFrom", header: "Document — Dernière modification" },
  { id: "docLink", header: "Document — Lien" },
  { id: "docUrl", header: "Document — URL" },
];

const DEF_BY_ID = Object.fromEntries(EXPORT_COLUMN_DEFS.map((d) => [d.id, d])) as Record<
  ExportColumnId,
  ExportColumnDef
>;

export function isExportColumnId(value: string): value is ExportColumnId {
  return value in DEF_BY_ID;
}

export function getExportColumnHeader(id: ExportColumnId): string {
  return DEF_BY_ID[id].header;
}

/** Ids reconnus depuis les query params `columns=`. */
export function parseExportColumnIds(raw: string[] | undefined): ExportColumnId[] {
  if (!raw?.length) return [];
  const seen = new Set<ExportColumnId>();
  const out: ExportColumnId[] = [];
  for (const value of raw) {
    if (!isExportColumnId(value) || seen.has(value)) continue;
    seen.add(value);
    out.push(value);
  }
  return out;
}

type LinkHelpers = {
  link: string | null;
};

function meta(row: DocumentExportRow, key: string): string {
  return row.employeeMetadata[key] ?? "";
}

export function getExportCellValue(
  id: ExportColumnId,
  row: DocumentExportRow,
  helpers: LinkHelpers,
): string | number {
  const def = DEF_BY_ID[id];
  switch (id) {
    case "matricule":
      return row.matricule;
    case "nom":
      return meta(row, "Nom") || row.displayName.split(" ").slice(1).join(" ") || "";
    case "prenom":
      return meta(row, "Prénom") || row.displayName.split(" ")[0] || "";
    case "minChildren":
    case "childrenExact":
      return row.childrenCount;
    case "hasSpouseDocument":
      return row.hasSpouseDocument ? "Oui" : "Non";
    case "category":
      return categoryFilterLabels[row.category as DocumentCategory] ?? row.category;
    case "documentTypes":
    case "documentType":
      return row.documentType ?? "";
    case "folderName":
      return row.folderName;
    case "modifiedFrom":
      return row.modifiedAt ? new Date(row.modifiedAt).toLocaleDateString("fr-FR") : "";
    case "docLink":
      return helpers.link ? "Ouvrir" : "—";
    case "docUrl":
      return helpers.link ?? "";
    default:
      if (def.metadataKey) return meta(row, def.metadataKey);
      return "";
  }
}

/** Colonnes spéciales qui ont besoin d’un hyperlien Excel. */
export function isLinkColumn(id: ExportColumnId): boolean {
  return id === "docLink" || id === "docUrl";
}
