import { z } from "zod";

const boolParam = z
  .enum(["true", "false"])
  .optional()
  .transform((v) => (v === undefined ? undefined : v === "true"));

const categoryEnum = z.enum([
  "RECRUTEMENT",
  "ETAT_CIVIL",
  "ARRETES",
  "MESURES_DISCIPLINAIRES",
  "MALADIES_ACCIDENTS_TRAVAIL",
  "DEPART",
  "DIVERS",
]);

/** Query params that accept multiple values (repeated `?field=a&field=b`) for an OR match. */
const MULTI_PARAMS = [
  "category",
  "documentTypes",
  "folderName",
  "childrenExact",
  "direction",
  "service",
  "entite",
  "sousEntite",
  "zone",
  "agence",
  "statut",
  "college",
  "admTech",
  "position",
  "categorieRh",
  "niveau",
  "grade",
  "situation",
  "columns",
] as const;

function multiString() {
  return z.array(z.string().max(120)).max(30).optional();
}

/**
 * Shared by the live search route and the Excel export route so both
 * validate identical query params and never drift as filters grow.
 */
export const documentSearchQuerySchema = z.object({
  // Free text
  query: z.string().max(120).optional(),

  // Document
  category: z.array(categoryEnum).max(7).optional(),
  documentType: z.string().max(120).optional(),
  /** Catalog keys from lib/document-types.ts, matched via label+alias contains (OR). */
  documentTypes: multiString(),
  folderName: multiString(),
  modifiedFrom: z.coerce.date().optional(),
  modifiedTo: z.coerce.date().optional(),

  // Identité & état civil
  genre: z.enum(["H", "F"]).optional(),
  matricule: z.string().max(40).optional(),
  nom: z.string().max(80).optional(),
  prenom: z.string().max(80).optional(),
  cin: z.string().max(40).optional(),
  minAge: z.coerce.number().int().min(0).max(120).optional(),
  maxAge: z.coerce.number().int().min(0).max(120).optional(),
  minChildren: z.coerce.number().int().min(0).max(20).optional(),
  childrenExact: z.array(z.coerce.number().int().min(0).max(20)).max(20).optional(),
  hasSpouseDocument: boolParam,
  /** Enfant prénom parsed from filename (DriveFile.parsedMetadata.enfant) */
  childName: z.string().max(80).optional(),

  // Poste & organisation
  direction: multiString(),
  service: multiString(),
  entite: multiString(),
  sousEntite: multiString(),
  zone: multiString(),
  agence: multiString(),
  poste: z.string().max(120).optional(),
  statut: multiString(),
  college: multiString(),
  admTech: multiString(),
  position: multiString(),
  encadrant: boolParam,
  categorieRh: multiString(),
  niveau: multiString(),
  grade: multiString(),
  managerMatricule: z.string().max(20).optional(),

  // Ancienneté & dates
  situation: multiString(),
  minAnciennete: z.coerce.number().int().min(0).max(60).optional(),
  maxAnciennete: z.coerce.number().int().min(0).max(60).optional(),
  dateEntreeFrom: z.coerce.date().optional(),
  dateEntreeTo: z.coerce.date().optional(),
  dateDepartFrom: z.coerce.date().optional(),
  dateDepartTo: z.coerce.date().optional(),

  /** Colonnes Excel choisies dans la barre Export (ids export-columns). */
  columns: multiString(),
});

export type DocumentSearchQuery = z.infer<typeof documentSearchQuerySchema>;

const MULTI_PARAM_SET = new Set<string>(MULTI_PARAMS);

/** Read every field of documentSearchQuerySchema out of a URLSearchParams instance. */
export function readDocumentSearchParams(searchParams: URLSearchParams) {
  const raw: Record<string, string | string[] | undefined> = {};
  for (const key of Object.keys(documentSearchQuerySchema.shape)) {
    if (MULTI_PARAM_SET.has(key)) {
      const values = searchParams.getAll(key);
      raw[key] = values.length > 0 ? values : undefined;
    } else {
      raw[key] = searchParams.get(key) ?? undefined;
    }
  }
  return documentSearchQuerySchema.safeParse(raw);
}
