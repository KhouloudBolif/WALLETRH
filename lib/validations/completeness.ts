import { z } from "zod";

export const verifyCompletenessSchema = z.object({
  matricule: z.string().min(1).max(50),
  category: z.enum([
    "RECRUTEMENT",
    "ETAT_CIVIL",
    "ARRETES",
    "MESURES_DISCIPLINAIRES",
    "MALADIES_ACCIDENTS_TRAVAIL",
    "DEPART",
    "DIVERS",
  ]),
  /** "*" = whole-category attestation; a specific catalog key = one document-type gap. */
  documentType: z.string().min(1).max(200).default("*"),
  note: z.string().max(500).optional(),
});

export type VerifyCompletenessInput = z.infer<typeof verifyCompletenessSchema>;
