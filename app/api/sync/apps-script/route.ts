export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { applyRateLimit } from "@/lib/security/api";
import { verifyWebhookSignature } from "@/lib/security/webhook-signature";
import { driveSyncWebhookSchema } from "@/lib/validations/drive-sync";
import { reconcileDriveIndex, startSyncRun } from "@/lib/sync/syncDriveIndex";

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const SOURCE = "google-apps-script";

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "apps-script-sync", 30, 60 * 60 * 1000);
  if (limited) return limited;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Charge utile trop volumineuse." }, { status: 413 });
  }

  const secret = process.env.DRIVE_SYNC_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[sync/apps-script] DRIVE_SYNC_WEBHOOK_SECRET is not configured");
    return NextResponse.json({ error: "Synchronisation non configurée." }, { status: 500 });
  }

  const signatureValid = verifyWebhookSignature(
    rawBody,
    request.headers.get("x-signature"),
    request.headers.get("x-timestamp"),
    secret,
  );
  if (!signatureValid) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "JSON invalide." }, { status: 400 });
  }

  const parsed = driveSyncWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Charge utile invalide.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const { syncLogId: incomingSyncLogId, isFinal, employees, files, employeeInformation, driveMatricules } =
    parsed.data;

  try {
    const syncLogId = incomingSyncLogId ?? (await startSyncRun(SOURCE)).id;

    const result = await reconcileDriveIndex(
      syncLogId,
      SOURCE,
      { employees, files, employeeInformation, driveMatricules },
      { isFinal, storeLocalPath: false },
    );

    if (result.status === "FAILED") {
      return NextResponse.json(
        { error: result.errorMessage ?? "La synchronisation a échoué.", result },
        { status: 500 },
      );
    }

    return NextResponse.json({ result });
  } catch (error) {
    console.error("[sync/apps-script]", error);
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
