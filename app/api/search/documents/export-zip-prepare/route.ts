export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { countUniqueMatricules, logDownload } from "@/lib/downloads/log-download";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { searchDocumentsForExport } from "@/lib/search/documents";
import { buildZipManifest, ZIP_EXPORT_ROW_LIMIT } from "@/lib/search/zip-export";
import { applyRateLimit } from "@/lib/security/api";
import { signWebhookPayload } from "@/lib/security/webhook-signature";
import { readDocumentSearchParams } from "@/lib/validations/document-search";
import type { Role } from "@prisma/client";

/**
 * Prépare un export ZIP à lancer **depuis le navigateur** (form POST vers Apps Script).
 * Nécessaire quand la Web App est limitée au domaine Veolia : le serveur Next.js
 * n'a pas de session Google, mais le navigateur de l'utilisateur oui.
 */
export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "search-documents-export-zip-prepare", 12, 60 * 1000);
  if (limited) return limited;

  const webhookUrl = process.env.APPS_SCRIPT_EXPORT_URL?.trim();
  const secret = process.env.DRIVE_SYNC_WEBHOOK_SECRET?.trim();
  if (!webhookUrl || !secret) {
    return NextResponse.json(
      {
        error:
          "Export fichiers non configuré : renseignez APPS_SCRIPT_EXPORT_URL dans .env.",
      },
      { status: 500 },
    );
  }

  const url = new URL(request.url);
  const parsed = readDocumentSearchParams(url.searchParams);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );

  const { rows } = await searchDocumentsForExport(parsed.data, viewerAccess);

  if (rows.length === 0) {
    return NextResponse.json({ error: "Aucun document à exporter." }, { status: 400 });
  }
  if (rows.length > ZIP_EXPORT_ROW_LIMIT) {
    return NextResponse.json(
      {
        error: `Trop de résultats (${rows.length}, max ${ZIP_EXPORT_ROW_LIMIT}). Affinez la requête.`,
      },
      { status: 400 },
    );
  }

  const { items, skipped } = buildZipManifest(rows);
  if (items.length === 0) {
    return NextResponse.json(
      { error: "Aucun de ces documents n'est disponible sur Drive." },
      { status: 400 },
    );
  }

  const payload = JSON.stringify({ items });
  const { timestamp, signature } = signWebhookPayload(payload, secret);
  const envelope = JSON.stringify({ timestamp, signature, payload });

  const sourceParam = url.searchParams.get("source");
  const source = sourceParam === "recherche" ? "recherche" : "requete";
  const filename = `export-documents-${new Date().toISOString().slice(0, 10)}.zip`;
  const employeeCount = countUniqueMatricules(rows.map((row) => row.matricule));

  await logDownload({
    userId: session.user.id,
    filename,
    kind: "ZIP",
    source,
    fileCount: items.length,
    employeeCount,
    summary: `${employeeCount} salarié(s) · ${items.length} fichier(s)`,
  });

  return NextResponse.json({
    url: webhookUrl,
    envelope,
    fileCount: items.length,
    skipped,
  });
}
