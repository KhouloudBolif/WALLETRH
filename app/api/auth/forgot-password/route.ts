export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSmtpConfigured, sendMail } from "@/lib/mail";
import { passwordResetEmailHtml } from "@/lib/mail/templates";
import { isProduction } from "@/lib/security/env";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";
import { generateResetToken } from "@/lib/security/tokens";

const schema = z.object({
  email: z.string().email().max(254).transform((v) => v.toLowerCase().trim()),
});

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "forgot-password", 5, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = schema.parse(await parseJsonBody(request));
    const email = body.email;

    const user = await prisma.user.findUnique({ where: { email } });

    let devResetUrl: string | undefined;
    let devPreviewUrl: string | undefined;
    const useRealSmtp = isSmtpConfigured();

    if (user?.isActive) {
      await prisma.passwordResetToken.updateMany({
        where: { email, used: false },
        data: { used: true },
      });

      const { raw, hash } = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: { email, token: hash, expiresAt },
      });

      const baseUrl = process.env.AUTH_URL ?? "http://localhost:3000";
      const resetUrl = `${baseUrl}/reset-password?token=${raw}`;
      devResetUrl = resetUrl;

      try {
        const mailResult = await sendMail({
          to: email,
          subject: "Réinitialisation de votre mot de passe — Portail RH",
          html: passwordResetEmailHtml({ name: user.name, resetUrl }),
          text: `Bonjour ${user.name},\n\nRéinitialisez votre mot de passe : ${resetUrl}\n\nCe lien expire dans 1 heure.`,
        });
        devPreviewUrl = mailResult.previewUrl ?? undefined;
      } catch (mailError) {
        if (!isProduction()) {
          console.error("[forgot-password] Mail send failed:", mailError);
        }
        return NextResponse.json(
          {
            error: useRealSmtp
              ? "Impossible d'envoyer l'email. Réessayez plus tard."
              : "Impossible d'envoyer l'email de test.",
          },
          { status: 503 },
        );
      }
    }

    const showDevFallback =
      !isProduction() && devResetUrl && !useRealSmtp;

    return NextResponse.json({
      message:
        "Si un compte actif existe avec cet email, un lien de réinitialisation a été envoyé.",
      ...(showDevFallback
        ? {
            dev: true,
            devResetUrl,
            devPreviewUrl,
            devHint: "SMTP non configuré — lien de test ci-dessous uniquement.",
          }
        : {}),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    }
    if (error instanceof Error && error.message.startsWith("ORIGIN")) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }
}
