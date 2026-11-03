import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DownloadHistoryRow = {
  id: string;
  createdAt: string;
  filename: string;
  kind: string;
  source: string;
  fileCount: number;
  employeeCount: number;
  summary: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

const HISTORY_LIMIT = 200;

/**
 * ADMIN → tout l'historique.
 * Autres rôles → uniquement leurs propres téléchargements.
 */
export async function getDownloadHistory(params: {
  userId: string;
  role: Role;
}): Promise<DownloadHistoryRow[]> {
  const isAdmin = params.role === "ADMIN";

  const rows = await prisma.downloadLog.findMany({
    where: isAdmin ? undefined : { userId: params.userId },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    filename: row.filename,
    kind: row.kind,
    source: row.source,
    fileCount: row.fileCount,
    employeeCount: row.employeeCount,
    summary: row.summary,
    user: row.user,
  }));
}
