export const runtime = "nodejs";

import ExcelJS from "exceljs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { searchDocumentsForExport } from "@/lib/search/documents";
import {
  buildEmployeeAggregatedSheet,
  buildFullAggregatedSheet,
} from "@/lib/search/export-aggregate";
import { parseExportColumnIds } from "@/lib/search/export-columns";
import { extractDriveFileId } from "@/lib/search/zip-export";
import { applyRateLimit } from "@/lib/security/api";
import { readDocumentSearchParams } from "@/lib/validations/document-search";
import type { Role } from "@prisma/client";
import type { DocumentExportRow } from "@/lib/search/documents";

/** URL ouverte dans le navigateur (Excel échoue souvent sur les /view?usp=drivesdk). */
function resolveExportLink(
  webViewLink: string | null,
  localViewPath: string | null,
  origin: string,
): string | null {
  if (webViewLink) {
    const fileId = extractDriveFileId(webViewLink);
    if (fileId) {
      return `https://drive.google.com/open?id=${fileId}`;
    }
    return webViewLink;
  }
  if (localViewPath) {
    return new URL(localViewPath, origin).toString();
  }
  return null;
}

function escapeExcelFormulaString(value: string): string {
  return value.replace(/"/g, '""');
}

function applyHyperlinks(
  sheet: ExcelJS.Worksheet,
  excelRow: ExcelJS.Row,
  links: Record<string, string>,
) {
  for (const [key, url] of Object.entries(links)) {
    const cell = excelRow.getCell(key);
    if (key.includes("url") || key.includes("docUrl") || key.startsWith("__url")) {
      cell.value = { text: url, hyperlink: url };
    } else {
      cell.value = {
        formula: `HYPERLINK("${escapeExcelFormulaString(url)}","Ouvrir")`,
      };
    }
    cell.font = { color: { argb: "FF1155CC" }, underline: true };
  }
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "search-documents-export", 20, 60 * 1000);
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = readDocumentSearchParams(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );

  const { rows, truncated } = await searchDocumentsForExport(parsed.data, viewerAccess);
  const selectedColumns = parseExportColumnIds(parsed.data.columns);

  const resolveLink = (row: DocumentExportRow) =>
    resolveExportLink(row.webViewLink, row.localViewPath, url.origin);

  const { columns, sheetRows } =
    selectedColumns.length > 0
      ? buildEmployeeAggregatedSheet(rows, selectedColumns, resolveLink)
      : buildFullAggregatedSheet(rows, resolveLink);

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Documents");
  sheet.columns = columns.map(({ key, header, width }) => ({ key, header, width }));

  for (const sheetRow of sheetRows) {
    const excelRow = sheet.addRow(sheetRow.values);
    applyHyperlinks(sheet, excelRow, sheetRow.links);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `export-documents-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      ...(truncated ? { "X-Export-Truncated": "true" } : {}),
    },
  });
}
