export const runtime = "nodejs";

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import {
  employeeMissingDocument,
  parseMissingDocumentFilter,
} from "@/lib/completeness/missing-document";
import { categoryFilterLabels, type DocumentCategory } from "@/lib/document-category";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import {
  getDossierCompleteness,
  getViewerTrackedCategories,
} from "@/lib/search/documents";
import { applyRateLimit } from "@/lib/security/api";
import type { Role } from "@prisma/client";

/**
 * Sans paramètre : une ligne par salarié incomplet, une colonne par dossier.
 * Avec ?category=ETAT_CIVIL&document=CIN : une ligne par salarié qui n'a pas ce fichier.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "completeness-export", 20, 60 * 1000);
  if (limited) return limited;

  const missing = readMissingFilter(new URL(request.url));
  if (missing === "invalid") {
    return NextResponse.json({ error: "Document invalide." }, { status: 400 });
  }

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );

  const trackedCategories = getViewerTrackedCategories(viewerAccess);
  const employees = await getDossierCompleteness(viewerAccess);
  const stamp = new Date().toISOString().slice(0, 10);

  if (missing) {
    if (!trackedCategories.includes(missing.category)) {
      return NextResponse.json({ error: "Document invalide." }, { status: 400 });
    }

    const withoutFile = employees.filter((employee) =>
      employeeMissingDocument(employee, missing.category, missing.key),
    );
    const label =
      withoutFile
        .flatMap((employee) => employee.categories)
        .flatMap((category) => [...category.required, ...category.optional])
        .find((doc) => doc.key === missing.key)?.label ?? missing.key;

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sans document");
    sheet.columns = [
      { header: "Matricule", key: "matricule", width: 14 },
      { header: "Nom", key: "displayName", width: 28 },
      { header: "Service", key: "service", width: 22 },
      { header: "Poste", key: "poste", width: 24 },
      { header: "Direction", key: "direction", width: 22 },
      { header: "Catégorie", key: "category", width: 24 },
      { header: "Document manquant", key: "document", width: 32 },
    ];
    sheet.getRow(1).font = { bold: true };

    for (const employee of withoutFile) {
      sheet.addRow({
        matricule: employee.matricule,
        displayName: employee.displayName,
        service: employee.service ?? "",
        poste: employee.poste ?? "",
        direction: employee.direction ?? "",
        category: categoryFilterLabels[missing.category],
        document: label,
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    return excelResponse(buffer, `sans-${fileSlug(label)}-${stamp}.xlsx`);
  }

  const incomplete = employees.filter((employee) => employee.missingCount > 0);

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
      const status = employee.categories.find((item) => item.category === cat);
      if (!status || !status.applicable) {
        row[cat] = "";
        continue;
      }
      row[cat] = status.required
        .filter((doc) => !doc.present)
        .map((doc) => doc.label)
        .join(" ; ");
    }

    sheet.addRow(row);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return excelResponse(buffer, `dossiers-manquants-${stamp}.xlsx`);
}

function readMissingFilter(url: URL): { category: DocumentCategory; key: string } | "invalid" | null {
  const category = url.searchParams.get("category");
  const documentKey = url.searchParams.get("document");
  if (!category && !documentKey) return null;
  const parsed = parseMissingDocumentFilter(
    category && documentKey ? `${category}::${documentKey}` : "",
  );
  return parsed ?? "invalid";
}

function fileSlug(label: string) {
  const slug = label
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug.slice(0, 40) || "document";
}

function excelResponse(buffer: ExcelJS.Buffer, filename: string) {
  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
