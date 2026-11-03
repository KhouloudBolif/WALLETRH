import { prisma } from "@/lib/db";

export type LogDownloadInput = {
  userId: string;
  filename: string;
  kind?: "ZIP" | "EXCEL";
  source?: "requete" | "recherche";
  fileCount: number;
  employeeCount: number;
  summary?: string | null;
};

/** Enregistre un téléchargement. Échec silencieux pour ne pas bloquer l'export. */
export async function logDownload(input: LogDownloadInput): Promise<void> {
  try {
    await prisma.downloadLog.create({
      data: {
        userId: input.userId,
        filename: input.filename,
        kind: input.kind ?? "ZIP",
        source: input.source ?? "requete",
        fileCount: input.fileCount,
        employeeCount: input.employeeCount,
        summary: input.summary ?? null,
      },
    });
  } catch (error) {
    console.error("[download-log] impossible d'enregistrer:", error);
  }
}

export function countUniqueMatricules(matricules: string[]): number {
  return new Set(matricules.filter(Boolean)).size;
}
