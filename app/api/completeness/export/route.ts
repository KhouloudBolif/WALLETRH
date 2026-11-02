export const runtime = "nodejs";

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { categoryFilterLabels } from "@/lib/document-category";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import {
  getDossierCompleteness,
  getViewerTrackedCategories,
} from "@/lib/search/documents";
import { applyRateLimit } from "@/lib/security/api";
import type { Role } from "@prisma/client";

/**
 * One row per employee with mandatory gaps.
 * One column per dossier (Recrutement, État civil…) — cell lists the missing
 * required documents belonging to that folder. Then a total count column.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "completeness-export", 20, 60 * 1000);
  if (limited) return limited;

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );

  const trackedCategories = getViewerTrackedCategories(viewerAccess);
  const employees = await getDossierCompleteness(viewerAccess);
  const incomplete = employees.filter((e) => e.missingCount > 0);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Dossiers incomplets");

  sheet.columns = [
    { header: "Matricule", key: "matricule", width: 14 },
    { header: "Nom", key: "displayName", width: 28 },
    { header: "Service", key: "service", width: 22 },
    { header: "Poste", key: "poste", width: 24 },
    { header: "Direction", key: "direction", width: 22 },
    ...trackedCategories.map((cat) => ({
      header: categoryFilterLabels[cat],
      key: cat,
      width: 40,
    })),
    { header: "Total manquants", key: "missingCount", width: 16 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const employee of incomplete) {
    const row: Record<string, string | number> = {
      matricule: employee.matricule,
      displayName: employee.displayName,
      service: employee.service ?? "",
      poste: employee.poste ?? "",
      direction: employee.direction ?? "",
      missingCount: employee.missingCount,
    };

    for (const cat of trackedCategories) {
      const status = employee.categories.find((c) => c.category === cat);
      if (!status || !status.applicable) {
        row[cat] = "";
        continue;
      }
      const missing = status.required.filter((d) => !d.present).map((d) => d.label);
      row[cat] = missing.join(" ; ");
    }

    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `dossiers-manquants-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
