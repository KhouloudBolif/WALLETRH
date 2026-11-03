import { z } from "zod";

const MAX_FILES_PER_CALL = 2000;
const MAX_EMPLOYEES_PER_CALL = 5000;

const nullableString = () => z.string().max(500).nullable();

export const driveSyncEmployeeSchema = z
  .object({
    matricule: z.string().min(1).max(64),
    displayName: z.string().min(1).max(200),
    genre: nullableString(),
    cin: nullableString(),
    age: z.number().int().nullable(),
    anciennete: z.number().int().nullable(),
    direction: nullableString(),
    service: nullableString(),
    poste: nullableString(),
    statut: nullableString(),
    situation: nullableString(),
    entite: nullableString(),
    sousEntite: nullableString(),
    zone: nullableString(),
    agence: nullableString(),
    college: nullableString(),
    admTech: nullableString(),
    position: nullableString(),
    encadrant: z.boolean().nullable(),
    niveau: nullableString(),
    grade: nullableString(),
    categorieRh: nullableString(),
    managerMatricule: nullableString(),
    dateEntree: z.coerce.date().nullable(),
    dateDepart: z.coerce.date().nullable(),
    metadata: z.record(z.string(), z.string()),
    searchText: z.string().max(20_000),
  })
  .strict();

export const driveSyncFileSchema = z
  .object({
    matricule: z.string().min(1).max(64),
    folderName: z.string().min(1).max(200),
    backendFileId: z.string().min(1).max(200),
    name: z.string().min(1).max(300),
    mimeType: z.string().min(1).max(150),
    webViewLink: z.string().url().max(2000).nullable(),
    modifiedAt: z.coerce.date().nullable(),
  })
  .strict();

export const driveSyncEmployeeInformationSchema = z
  .object({
    matricule: z.string().min(1).max(64),
    prenom: z.string().max(200).nullable(),
    nom: z.string().max(200).nullable(),
    genre: z.string().max(50).nullable(),
    statut: z.string().max(100).nullable(),
    college: z.string().max(100).nullable(),
    situation: z.string().max(100).nullable(),
    nbEnfants: z.number().int().min(0).max(50),
  })
  .strict();

export const driveSyncWebhookSchema = z
  .object({
    /** Absent on the first call of a run — the server creates the SyncLog and returns its id. */
    syncLogId: z.string().min(1).max(64).optional(),
    /** True on the last call of a run — triggers stale-row removal and closes the SyncLog. */
    isFinal: z.boolean(),
    employees: z.array(driveSyncEmployeeSchema).max(MAX_EMPLOYEES_PER_CALL).optional(),
    files: z.array(driveSyncFileSchema).max(MAX_FILES_PER_CALL),
    /** From Sheet "Complétude des dossiers" — situation / statut / nb enfants per matricule. */
    employeeInformation: z.array(driveSyncEmployeeInformationSchema).max(MAX_EMPLOYEES_PER_CALL).optional(),
    /** Matricule folders still present on Drive. Sent on the final chunk. */
    driveMatricules: z.array(z.string().min(1).max(64)).max(MAX_EMPLOYEES_PER_CALL).optional(),
    /** Utilisateur portail ayant déclenché la synchro (premier chunk uniquement). */
    triggeredByUserId: z.string().min(1).max(64).optional(),
    /** @deprecated kept for older Apps Script copies — ignored if employeeInformation is present */
    completenessRules: z.array(z.record(z.string(), z.unknown())).max(2000).optional(),
  })
  .strict();

export type DriveSyncWebhookPayload = z.infer<typeof driveSyncWebhookSchema>;
