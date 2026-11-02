export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { isSmtpConfigured, sendMail, verifySmtpConnection } from "@/lib/mail";
import { testEmailHtml } from "@/lib/mail/templates";
import { isProduction } from "@/lib/security/env";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";

const schema = z.object({
  to: z.string().email().max(254),
});

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "admin-mail-test", 5, 60 * 60 * 1000);
  if (limited) return limited;

  if (!isSmtpConfigured()) {
    return NextResponse.json(
      { error: "SMTP non configuré." },
      { status: 400 },
    );
  }

  try {
    assertSafeMutation(request);
    const { to } = schema.parse(await parseJsonBody(request));
    await verifySmtpConnection();

    const result = await sendMail({
      to,
      subject: "Test SMTP — Portail RH",
      html: testEmailHtml(),
      text: "La configuration SMTP du Portail RH fonctionne.",
    });

    return NextResponse.json({
      message: `Email de test envoyé.`,
      messageId: result.messageId,
    });
  } catch (error) {
    if (!isProduction()) {
      console.error("[mail/test]", error);
    }
    return NextResponse.json(
      { error: "Échec de l'envoi. Vérifiez la configuration SMTP." },
      { status: 503 },
    );
  }
}
