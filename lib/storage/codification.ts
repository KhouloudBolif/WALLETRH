/**
 * RH filename codification parser — see doc/debut/exercice/CODIFICATION.md.
 *
 * Production pattern: `{matricule}_{document_label}.pdf`
 * Codification sheet uses `Mle_{document_label}` (Mle = matricule placeholder).
 *
 * Exercise files use shortened labels and `_` instead of apostrophes
 * (e.g. "Fiche d_entretien" for "Fiche d'entretien").
 */

import type { DocumentCategory } from "@/lib/document-category";
import { driveFolderToCategory } from "@/lib/document-category";

export type ParsedFilename = {
  matricule: string | null;
  /** Document label without matricule prefix or extension, e.g. "Acte de Naissance" */
  documentType: string | null;
  /** Child first name when the `_Enfant_{Prénom}` token is present */
  enfant: string | null;
  /** True when the `_Conjoint[N]` token is present (spouse document on file) */
  conjoint: boolean;
  /** Raw date token when present, e.g. "jj-MM-YYYY" placeholder or an actual date */
  dateToken: string | null;
};

const DATE_TOKEN = /_((?:jj|\d{2})-(?:MM|\d{2})-(?:YYYY|\d{4}))(?=\.|_|$)/i;
const ENFANT_TOKEN = /_Enfant_([^_.]+)/i;
const CONJOINT_TOKEN = /_Conjoint\d*/i;

/** Parse `{matricule}_{label}[_Enfant_{Prénom}|_Conjoint[N]][_{date}].pdf` */
export function parseFilename(fileName: string): ParsedFilename {
  const base = fileName.replace(/\.pdf$/i, "");

  const matriculeMatch = base.match(/^(\d{4,})_/);
  const matricule = matriculeMatch ? matriculeMatch[1] : null;
  let rest = matricule ? base.slice(matricule.length + 1) : base;

  const dateMatch = rest.match(DATE_TOKEN);
  const dateToken = dateMatch ? dateMatch[1] : null;
  if (dateMatch) rest = rest.replace(dateMatch[0], "");

  const enfantMatch = rest.match(ENFANT_TOKEN);
  const enfant = enfantMatch ? enfantMatch[1] : null;
  if (enfantMatch) rest = rest.replace(enfantMatch[0], "");

  const conjointMatch = rest.match(CONJOINT_TOKEN);
  const conjoint = conjointMatch !== null;
  if (conjointMatch) rest = rest.replace(conjointMatch[0], "");

  return {
    matricule,
    documentType: rest || null,
    enfant,
    conjoint,
    dateToken,
  };
}

/**
 * Map a Drive sous-dossier name to a DocumentCategory.
 * Normalizes Unicode (NFC) and apostrophe variants so the exercise export
 * matches regardless of filesystem encoding.
 */
export function folderToCategory(folderName: string): DocumentCategory | null {
  const normalized = folderName.normalize("NFC").trim();
  if (driveFolderToCategory[normalized]) {
    return driveFolderToCategory[normalized];
  }

  // Fallback: match on the leading "N-" prefix (folder numbers are stable)
  const prefix = normalized.match(/^(\d)\s*-/);
  if (prefix) {
    const byNumber: Record<string, DocumentCategory> = {
      "1": "RECRUTEMENT",
      "2": "ETAT_CIVIL",
      "3": "ARRETES",
      "4": "MESURES_DISCIPLINAIRES",
      "5": "MALADIES_ACCIDENTS_TRAVAIL",
      "6": "DEPART",
      "7": "DIVERS",
    };
    return byNumber[prefix[1]] ?? null;
  }

  return null;
}
