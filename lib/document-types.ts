/**
 * Expected document-type catalog per category — see doc/debut/exercice/CODIFICATION.md.
 *
 * Completeness rules:
 * - `obligation: false` → never counted as missing
 * - `obligation: true` without `condition` → always required when the category applies
 * - `obligation: true` with `condition` → required only if the employee matches
 *
 * Family variants (CIN_Conjoint, *_Enfant_*) are separate catalog rows. After
 * parseFilename(), DriveFile.documentType is the base label and conjoint/enfant
 * live in parsedMetadata — matching uses `familyRole` for that.
 */

import type { DocumentCategory } from "@/lib/document-category";

/** Who the file concerns after parseFilename() strips _Conjoint / _Enfant_ tokens. */
export type FamilyRole = "self" | "conjoint" | "enfant";

export type DocumentCondition =
  | { kind: "situation"; values: string[] }
  | { kind: "statut"; values: string[] }
  | { kind: "hasChildren" };

export type ExpectedDocumentType = {
  /** Canonical catalog key (permissions + attestations) */
  key: string;
  label: string;
  /** Base DriveFile.documentType labels that satisfy this entry */
  aliases?: string[];
  /** true = can count toward missing when applicable */
  obligation: boolean;
  /** If set, obligation applies only when the employee matches */
  condition?: DocumentCondition;
  /**
   * How parsedMetadata must look for a file to count as this entry.
   * Default `self` = neither conjoint nor enfant token.
   */
  familyRole?: FamilyRole;
};

export const expectedDocumentTypes: Partial<Record<DocumentCategory, ExpectedDocumentType[]>> = {
  RECRUTEMENT: [
    { key: "Demande d'Emploi", label: "Demande d'Emploi", obligation: true },
    { key: "Curriculum vitae", label: "Curriculum vitae", obligation: true },
    {
      key: "Contrat de travail",
      label: "Contrat de travail",
      aliases: ["Contrat"],
      obligation: true,
    },
    {
      key: "Fiches d'entretien",
      label: "Fiche d'entretien",
      aliases: ["Fiche d'entretien"],
      obligation: true,
    },
    { key: "Fiches d'Embauche", label: "Fiche d'Embauche", obligation: true },
    { key: "Fiche de Renseignement", label: "Fiche de Renseignement", obligation: false },
    { key: "Aptitude Médicale", label: "Aptitude Médicale", obligation: false },
    {
      key: "Engagement et Déclaration sur l'Honneur",
      label: "Engagement et Déclaration sur l'Honneur",
      obligation: true,
      condition: { kind: "statut", values: ["ST"] },
    },
    {
      key: "Lettre d'engagement",
      label: "Lettre d'engagement",
      obligation: true,
      condition: { kind: "statut", values: ["ST"] },
    },
    { key: "Décision de recrutement", label: "Décision de recrutement", obligation: true },
    {
      key: "Attestation de déclaration des salaires CNSS",
      label: "Attestation CNSS",
      obligation: true,
      condition: { kind: "statut", values: ["ANAPEC", "CDD"] },
    },
    { key: "Démission", label: "Démission", obligation: false },
    { key: "Note de création BP", label: "Note de création BP", obligation: true },
    {
      key: "Proposition de passage",
      label: "Proposition de passage",
      obligation: true,
      condition: { kind: "statut", values: ["ST"] },
    },
    { key: "Formulaire droit à l'image", label: "Formulaire droit à l'image", obligation: true },
  ],
  ETAT_CIVIL: [
    { key: "CIN", label: "CIN", familyRole: "self", obligation: true },
    {
      key: "CIN_Conjoint",
      label: "CIN conjoint",
      aliases: ["CIN"],
      familyRole: "conjoint",
      obligation: true,
      condition: { kind: "situation", values: ["Marié", "Mariée", "Marié(e)"] },
    },
    { key: "CNSS", label: "CNSS", obligation: false },
    { key: "Photo", label: "Photo", obligation: true },
    {
      key: "Acte de Mariage",
      label: "Acte de Mariage",
      obligation: true,
      condition: { kind: "situation", values: ["Marié", "Mariée", "Marié(e)"] },
    },
    { key: "Acte de Mariage_1", label: "Acte de Mariage (copie)", obligation: false },
    { key: "Fiche Anthropométrique", label: "Fiche Anthropométrique", obligation: false },
    { key: "Attestation de RIB", label: "Attestation de RIB", obligation: true },
    { key: "Casier judicier", label: "Casier judiciaire", obligation: true },
    {
      key: "Extrait Acte de Naissance",
      label: "Acte de Naissance",
      aliases: ["Acte de Naissance"],
      familyRole: "self",
      obligation: true,
    },
    {
      key: "Extrait Acte de Naissance_Conjoint",
      label: "Acte de Naissance conjoint",
      aliases: ["Extrait Acte de Naissance", "Acte de Naissance"],
      familyRole: "conjoint",
      obligation: true,
      condition: { kind: "situation", values: ["Marié", "Mariée", "Marié(e)"] },
    },
    {
      key: "jugement de divorce",
      label: "Jugement de divorce",
      obligation: true,
      condition: { kind: "situation", values: ["Divorcé", "Divorcée", "Divorcé(e)"] },
    },
    {
      key: "Extrait Acte de Naissance_Enfant",
      label: "Acte de Naissance enfant",
      aliases: ["Extrait Acte de Naissance", "Acte de Naissance"],
      familyRole: "enfant",
      obligation: true,
      condition: { kind: "hasChildren" },
    },
    { key: "Certificat de Vie", label: "Certificat de Vie", familyRole: "self", obligation: false },
    {
      key: "Certificat Vie Collective",
      label: "Certificat Vie Collective",
      aliases: ["Certificat de Vie Collective", "Certificat de Vie_Collectif"],
      obligation: true,
      condition: { kind: "situation", values: ["Marié", "Mariée", "Marié(e)"] },
    },
    {
      key: "Certificat de Vie_Conjoint",
      label: "Certificat de Vie conjoint",
      aliases: ["Certificat de Vie"],
      familyRole: "conjoint",
      obligation: true,
      condition: { kind: "situation", values: ["Marié", "Mariée", "Marié(e)"] },
    },
    {
      key: "Certificat de Vie_Enfant",
      label: "Certificat de Vie enfant",
      aliases: ["Certificat de Vie"],
      familyRole: "enfant",
      obligation: true,
      condition: { kind: "hasChildren" },
    },
    {
      key: "Certificat de Vie_Collectif",
      label: "Certificat de Vie collectif",
      aliases: ["Certificat Vie Collective", "Certificat de Vie Collective"],
      obligation: true,
      condition: { kind: "hasChildren" },
    },
  ],
  ARRETES: [
    { key: "Tableau d'avancement", label: "Tableau d'avancement", obligation: false },
    { key: "Décision de nomination", label: "Décision de nomination", obligation: false },
    { key: "Note de Mutation", label: "Note de Mutation", obligation: false },
    {
      key: "Diplôme",
      label: "Diplôme",
      obligation: true,
    },
  ],
  MESURES_DISCIPLINAIRES: [
    { key: "Demande d'explication", label: "Demande d'explication", obligation: false },
    { key: "Décision d'avertissement", label: "Décision d'avertissement", obligation: false },
  ],
  MALADIES_ACCIDENTS_TRAVAIL: [
    { key: "Maladie", label: "Maladie", obligation: false },
    { key: "AT", label: "AT", obligation: false },
  ],
  DEPART: [
    { key: "Demande de Démission", label: "Demande de Démission", obligation: false },
    {
      key: "Lettre d'acceptation de la démission",
      label: "Lettre d'acceptation de la démission",
      obligation: false,
    },
    { key: "STC", label: "STC", obligation: false },
    { key: "Certificat de Travail", label: "Certificat de Travail", obligation: false },
  ],
  DIVERS: [{ key: "Mutation", label: "Mutation", obligation: false }],
};

/** Categories shown on the completeness table (columns) — all 7 Drive folders. */
export const trackedCategories: DocumentCategory[] = [
  "RECRUTEMENT",
  "ETAT_CIVIL",
  "ARRETES",
  "MESURES_DISCIPLINAIRES",
  "MALADIES_ACCIDENTS_TRAVAIL",
  "DEPART",
  "DIVERS",
];

function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/['_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Prefix match after normalization — handles year/date-suffixed variants
 * (e.g. stored "Tableau d'avancement_1988" vs catalog key "Tableau d'avancement").
 * Family-role entries match via `aliases` (base label), not the `_Conjoint` / `_Enfant` key.
 */
export function matchesDocumentType(
  documentType: string | null,
  expected: ExpectedDocumentType,
): boolean {
  if (!documentType) return false;
  const normDoc = normalizeLabel(documentType);
  const labels =
    expected.familyRole === "conjoint" || expected.familyRole === "enfant"
      ? (expected.aliases ?? [])
      : [expected.key, ...(expected.aliases ?? [])];
  if (labels.length === 0) return false;
  return labels
    .map(normalizeLabel)
    .some((candidate) => normDoc.startsWith(candidate));
}

export type FileFamilyMeta = {
  conjoint?: boolean | null;
  enfant?: string | null;
};

/** Whether a DriveFile's parsed family tokens match the catalog entry's familyRole. */
export function matchesFamilyRole(
  meta: FileFamilyMeta | null | undefined,
  role: FamilyRole = "self",
): boolean {
  const conjoint = Boolean(meta?.conjoint);
  const hasEnfant = Boolean(meta?.enfant);
  if (role === "conjoint") return conjoint;
  if (role === "enfant") return hasEnfant;
  return !conjoint && !hasEnfant;
}

export type EmployeeConditionContext = {
  statut: string | null;
  situation: string | null;
  childrenCount: number;
  /** Derived from Drive files with `_Conjoint` — used when Base.situation is not marital. */
  hasSpouseDocument?: boolean;
};

function normalizeField(value: string): string {
  return normalizeLabel(value).replace(/[()]/g, "");
}

function situationLooksMarried(situation: string | null): boolean {
  if (!situation) return false;
  const n = normalizeField(situation);
  return n.includes("marie");
}

function situationLooksDivorced(situation: string | null): boolean {
  if (!situation) return false;
  const n = normalizeField(situation);
  return n.includes("divorc");
}

/** True when the employee satisfies the catalog condition (or there is none). */
export function employeeMatchesCondition(
  employee: EmployeeConditionContext,
  condition: DocumentCondition | undefined,
): boolean {
  if (!condition) return true;

  if (condition.kind === "hasChildren") {
    return employee.childrenCount > 0;
  }

  if (condition.kind === "situation") {
    const wantsMarried = condition.values.some((v) => normalizeField(v).includes("marie"));
    const wantsDivorced = condition.values.some((v) => normalizeField(v).includes("divorc"));

    if (wantsMarried) {
      return situationLooksMarried(employee.situation) || Boolean(employee.hasSpouseDocument);
    }
    if (wantsDivorced) {
      return situationLooksDivorced(employee.situation);
    }

    if (!employee.situation) return false;
    const normalized = normalizeField(employee.situation);
    return condition.values.some((v) => {
      const target = normalizeField(v);
      return normalized === target || normalized.startsWith(target) || target.startsWith(normalized);
    });
  }

  // statut (ST, ANAPEC, CDD, CDI, …)
  if (!employee.statut) return false;
  const normalized = normalizeField(employee.statut);
  return condition.values.some((v) => {
    const target = normalizeField(v);
    return normalized === target || normalized.startsWith(target) || target.startsWith(normalized);
  });
}

/** Document counts toward completeness for this employee. */
export function isDocumentRequiredForEmployee(
  entry: ExpectedDocumentType,
  employee: EmployeeConditionContext,
): boolean {
  if (!entry.obligation) return false;
  return employeeMatchesCondition(employee, entry.condition);
}
