export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { applyRateLimit } from "@/lib/security/api";
import { signWebhookPayload } from "@/lib/security/webhook-signature";

/**
 * Prépare un déclenchement de sync via le navigateur (form POST → Apps Script).
 * Accessible à tous les utilisateurs connectés.
 */
export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "sync-trigger", 4, 60 * 1000);
  if (limited) return limited;

  const webhookUrl = process.env.APPS_SCRIPT_EXPORT_URL?.trim();
  const secret = process.env.DRIVE_SYNC_WEBHOOK_SECRET?.trim();
  if (!webhookUrl || !secret) {
    return NextResponse.json(
      {
        error:
          "Synchronisation à distance non configurée : renseignez APPS_SCRIPT_EXPORT_URL et DRIVE_SYNC_WEBHOOK_SECRET.",
      },
      { status: 500 },
    );
  }

  const payload = JSON.stringify({
    action: "runSync",
    triggeredByUserId: session.user.id,
  });
  const { timestamp, signature } = signWebhookPayload(payload, secret);
  const envelope = JSON.stringify({ timestamp, signature, payload });

  return NextResponse.json({
    url: webhookUrl,
    envelope,
  });
}
