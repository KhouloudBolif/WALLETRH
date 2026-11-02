/**
 * RH Drive sous-dossier categories — aligned with doc/debut exercise.
 * Shared by mock layer now; becomes Prisma enum in Phase 2.
 */
export type DocumentCategory =
  | "RECRUTEMENT"
  | "ETAT_CIVIL"
  | "ARRETES"
  | "MESURES_DISCIPLINAIRES"
  | "MALADIES_ACCIDENTS_TRAVAIL"
  | "DEPART"
  | "DIVERS";

export const allCategories: DocumentCategory[] = [
  "RECRUTEMENT",
  "ETAT_CIVIL",
  "ARRETES",
  "MESURES_DISCIPLINAIRES",
  "MALADIES_ACCIDENTS_TRAVAIL",
  "DEPART",
  "DIVERS",
];

/** French labels matching Drive folder names */
export const categoryLabels: Record<DocumentCategory, string> = {
  RECRUTEMENT: "1- Recrutement",
  ETAT_CIVIL: "2- Etat Civil",
  ARRETES: "3- Arrêtés",
  MESURES_DISCIPLINAIRES: "4- Mesures Disciplinaires",
  MALADIES_ACCIDENTS_TRAVAIL: "5- Maladies et Accidents de Travail",
  DEPART: "6- Départ",
  DIVERS: "7- Divers",
};

/** Short labels for permissions matrix columns */
export const categoryShort: Record<DocumentCategory, string> = {
  RECRUTEMENT: "Recrut.",
  ETAT_CIVIL: "État civ.",
  ARRETES: "Arrêtés",
  MESURES_DISCIPLINAIRES: "Discip.",
  MALADIES_ACCIDENTS_TRAVAIL: "Maladie",
  DEPART: "Départ",
  DIVERS: "Divers",
};

/** Readable UI labels (filters, badges) — no Drive folder numbers */
export const categoryFilterLabels: Record<DocumentCategory, string> = {
  RECRUTEMENT: "Recrutement",
  ETAT_CIVIL: "État civil",
  ARRETES: "Arrêtés",
  MESURES_DISCIPLINAIRES: "Mesures disciplinaires",
  MALADIES_ACCIDENTS_TRAVAIL: "Maladies & AT",
  DEPART: "Départ",
  DIVERS: "Divers",
};

export const driveFolderToCategory: Record<string, DocumentCategory> = {
  "1- Recrutement": "RECRUTEMENT",
  "2- Etat Civil": "ETAT_CIVIL",
  "3- Arrêtés": "ARRETES",
  "4- Mesures Disciplinaires": "MESURES_DISCIPLINAIRES",
  "5- Maladies et Accidents de Travail": "MALADIES_ACCIDENTS_TRAVAIL",
  "6- Départ": "DEPART",
  "7- Divers": "DIVERS",
};
