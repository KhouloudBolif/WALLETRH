import { expectedDocumentTypes, type ExpectedDocumentType } from "@/lib/document-types";
import type { DocumentCategory } from "@/lib/document-category";
import { prisma } from "@/lib/db";

export type EmployeeInformationRow = {
  matricule: string;
  prenom: string | null;
  nom: string | null;
  genre: string | null;
  statut: string | null;
  college: string | null;
  situation: string | null;
  nbEnfants: number;
};

/** Document obligation catalog — still from code (feuille Complétude = infos salarié). */
export async function resolveExpectedDocumentTypes(): Promise<
  Partial<Record<DocumentCategory, ExpectedDocumentType[]>>
> {
  return expectedDocumentTypes;
}

/** Map matricule → situation / statut / enfants from EmployeeInformation. */
export async function loadEmployeeInformationByMatricule(): Promise<
  Map<string, { situation: string | null; statut: string | null; nbEnfants: number }>
> {
  try {
    const rows = await prisma.employeeInformation.findMany({
      select: { matricule: true, situation: true, statut: true, nbEnfants: true },
    });
    return new Map(
      rows.map((r) => [
        r.matricule,
        { situation: r.situation, statut: r.statut, nbEnfants: r.nbEnfants },
      ]),
    );
  } catch (error) {
    console.warn("[completeness] EmployeeInformation unavailable — using Employee fallback.", error);
    return new Map();
  }
}

/** Replace all EmployeeInformation rows from the Complétude sheet payload. */
export async function replaceEmployeeInformation(rows: EmployeeInformationRow[]): Promise<number> {
  const data = rows
    .map((row) => {
      const matricule = String(row.matricule ?? "").trim();
      if (!matricule || !/^\d{4,}$/.test(matricule)) return null;
      return {
        matricule,
        prenom: row.prenom != null ? String(row.prenom).trim() || null : null,
        nom: row.nom != null ? String(row.nom).trim() || null : null,
        genre: row.genre != null ? String(row.genre).trim() || null : null,
        statut: row.statut != null ? String(row.statut).trim() || null : null,
        college: row.college != null ? String(row.college).trim() || null : null,
        situation: row.situation != null ? String(row.situation).trim() || null : null,
        nbEnfants: Number.isFinite(Number(row.nbEnfants))
          ? Math.max(0, Math.trunc(Number(row.nbEnfants)))
          : 0,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  if (data.length === 0) {
    console.warn(
      `[sync] EmployeeInformation: received ${rows.length} rows but none valid — keeping previous data.`,
    );
    return 0;
  }

  // Clear then insert — avoids stale Prisma client shape issues with upsert batches
  await prisma.employeeInformation.deleteMany();
  await prisma.employeeInformation.createMany({ data });

  console.info(`[sync] EmployeeInformation: stored ${data.length} employees from Complétude des dossiers.`);
  return data.length;
}

/** @deprecated use replaceEmployeeInformation */
export const replaceCompletenessCatalog = replaceEmployeeInformation;
