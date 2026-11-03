export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { countUniqueMatricules, logDownload } from "@/lib/downloads/log-download";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { searchDocumentsForExport } from "@/lib/search/documents";
import { encryptZipWithPassword } from "@/lib/search/encrypt-zip";
import { buildZipManifest, ZIP_EXPORT_ROW_LIMIT } from "@/lib/search/zip-export";
import { applyRateLimit } from "@/lib/security/api";
import { signWebhookPayload } from "@/lib/security/webhook-signature";
import { readDocumentSearchParams } from "@/lib/validations/document-search";
import { zipPasswordSchema } from "@/lib/validations/zip-password";
import type { Role } from "@prisma/client";
import { z } from "zod";

/**
 * Google Apps Script Web Apps reply with a 302 to script.googleusercontent.com.
 * fetch() follows redirects but turns POST into GET and drops the body — so we
 * get an HTML page instead of JSON. Re-POST to the Location header instead.
 */
async function postAppsScript(url: string, body: string, timeoutMs = 120_000): Promise<Response> {
  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body,
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  };

  let response = await fetch(url, init);
  let hops = 0;

  while (response.status >= 300 && response.status < 400 && hops < 5) {
    const location = response.headers.get("Location");
    if (!location) break;
    const nextUrl = new URL(location, url).toString();
    response = await fetch(nextUrl, init);
    hops += 1;
  }

  return response;
}

const bodySchema = z.object({
  password: zipPasswordSchema,
});

/** Export ZIP protégé : le mot de passe est obligatoire (POST). */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  // Building a zip round-trips through Apps Script + Drive — tighter than the
  // Excel export, which only touches Postgres.
  const limited = applyRateLimit(request, "search-documents-export-zip", 6, 60 * 1000);
  if (limited) return limited;

  let password: string;
  try {
    const json = await request.json();
    const parsedBody = bodySchema.safeParse(json);
    if (!parsedBody.success) {
      return NextResponse.json(
        { error: parsedBody.error.issues[0]?.message ?? "Mot de passe invalide." },
        { status: 400 },
      );
    }
    password = parsedBody.data.password;
  } catch {
    return NextResponse.json(
      { error: "Corps de requête invalide (JSON attendu avec password)." },
      { status: 400 },
    );
  }

  const webhookUrl = process.env.APPS_SCRIPT_EXPORT_URL?.trim();
  const secret = process.env.DRIVE_SYNC_WEBHOOK_SECRET?.trim();
  if (!webhookUrl || !secret) {
    console.error("[search/documents/export-zip] APPS_SCRIPT_EXPORT_URL or DRIVE_SYNC_WEBHOOK_SECRET missing");
    return NextResponse.json(
      {
        error:
          "Export ZIP non configuré : renseignez APPS_SCRIPT_EXPORT_URL dans .env (URL Web App Apps Script /exec). Voir doc/APPS_SCRIPT_SYNC_SETUP.md.",
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
        error: `Trop de résultats pour un export ZIP (${rows.length}, max ${ZIP_EXPORT_ROW_LIMIT}). Affinez la recherche.`,
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

  // Apps Script's doPost(e) can't read custom HTTP headers (unlike Next.js),
  // so — unlike the sync webhook — signature + timestamp travel inside the
  // JSON body itself, wrapping the exact string that was signed.
  const payload = JSON.stringify({ items });
  const { timestamp, signature } = signWebhookPayload(payload, secret);
  const envelope = JSON.stringify({ timestamp, signature, payload });

  try {
    const response = await postAppsScript(webhookUrl, envelope);
    const raw = await response.text();

    if (raw.trimStart().startsWith("<!DOCTYPE") || raw.trimStart().startsWith("<html")) {
      console.error(
        "[search/documents/export-zip] Apps Script returned HTML (status",
        response.status,
        ") — check Web App access = Anyone + doPost deployed",
      );
      return NextResponse.json(
        {
          error:
            "Apps Script a renvoyé une page HTML au lieu du ZIP. Redéployez la Web App : Exécuter en tant que « Moi », Qui a accès « Tous » (Anyone), puis copiez la nouvelle URL /exec dans APPS_SCRIPT_EXPORT_URL.",
        },
        { status: 502 },
      );
    }

    let data: { zipBase64?: string; error?: string };
    try {
      data = JSON.parse(raw) as { zipBase64?: string; error?: string };
    } catch {
      console.error("[search/documents/export-zip] Non-JSON response:", raw.slice(0, 200));
      return NextResponse.json(
        { error: "Réponse Apps Script invalide (pas du JSON)." },
        { status: 502 },
      );
    }

    if (!response.ok || !data.zipBase64) {
      console.error("[search/documents/export-zip] Apps Script bridge error:", data.error);
      return NextResponse.json(
        { error: data.error ?? "L'export ZIP a échoué côté Drive." },
        { status: 502 },
      );
    }

    const plainZip = Buffer.from(data.zipBase64, "base64");
    let zipBuffer: Buffer;
    try {
      zipBuffer = await encryptZipWithPassword(plainZip, password);
    } catch (error) {
      console.error("[search/documents/export-zip] encrypt failed:", error);
      return NextResponse.json(
        { error: "Impossible de protéger le ZIP par mot de passe." },
        { status: 500 },
      );
    }

    const filename = `export-documents-${new Date().toISOString().slice(0, 10)}.zip`;
    const sourceParam = url.searchParams.get("source");
    const source = sourceParam === "recherche" ? "recherche" : "requete";
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

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${filename}"`,
        ...(skipped > 0 ? { "X-Export-Zip-Skipped": String(skipped) } : {}),
      },
    });
  } catch (error) {
    console.error("[search/documents/export-zip]", error);
    return NextResponse.json(
      { error: "Impossible de contacter le pont Apps Script pour le ZIP." },
      { status: 502 },
    );
  }
}

/** Ancien GET sans mot de passe : refusé volontairement. */
export async function GET() {
  return NextResponse.json(
    {
      error:
        "L'export ZIP nécessite un mot de passe. Utilisez POST avec { \"password\": \"…\" }.",
    },
    { status: 405 },
  );
}
