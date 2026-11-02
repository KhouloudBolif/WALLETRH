export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { applyRateLimit } from "@/lib/security/api";

/** Employee fields exposed as dropdown options in the org/identity filter groups. */
const DISTINCT_EMPLOYEE_FIELDS = [
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
] as const;

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "search-filter-options", 60, 60 * 1000);
  if (limited) return limited;

  const entries = await Promise.all(
    DISTINCT_EMPLOYEE_FIELDS.map(async (field) => {
      const rows = await prisma.employee.findMany({
        where: { archivedAt: null, [field]: { not: null } },
        select: { [field]: true },
        distinct: [field],
        orderBy: { [field]: "asc" },
      } as Parameters<typeof prisma.employee.findMany>[0]);

      const values = (rows as unknown as Record<string, string | null>[])
        .map((row) => row[field])
        .filter((value): value is string => Boolean(value));

      return [field, values] as const;
    }),
  );

  // Situation = feuille « Complétude des dossiers » (EmployeeInformation)
  const situationRows = await prisma.employeeInformation.findMany({
    where: { situation: { not: null } },
    select: { situation: true },
    distinct: ["situation"],
    orderBy: { situation: "asc" },
  });
  const situationValues = situationRows
    .map((row) => row.situation)
    .filter((value): value is string => Boolean(value));

  const folderRows = await prisma.driveFile.findMany({
    select: { folderName: true },
    distinct: ["folderName"],
    orderBy: { folderName: "asc" },
  });

  return NextResponse.json({
    options: {
      ...Object.fromEntries(entries),
      situation: situationValues,
      folderName: folderRows.map((row) => row.folderName),
    },
  });
}
