export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { setUserPassword } from "@/lib/auth/password";
import { passwordSchema } from "@/lib/validations/password";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";
import { hashToken } from "@/lib/security/tokens";

const schema = z.object({
  token: z.string().min(32).max(128),
  password: passwordSchema,
});

export async function POST(request: Request) {
  const limited = applyRateLimit(request, "reset-password", 10, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = schema.parse(await parseJsonBody(request));
    const tokenHash = hashToken(body.token);

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token: tokenHash },
    });

    if (
      !resetToken ||
      resetToken.used ||
      resetToken.expiresAt < new Date()
    ) {
      return NextResponse.json(
        { error: "Lien invalide ou expiré." },
        { status: 400 },
      );
    }

    const user = await prisma.user.findUnique({
      where: { email: resetToken.email },
    });

    if (!user?.isActive) {
      return NextResponse.json(
        { error: "Compte introuvable ou désactivé." },
        { status: 400 },
      );
    }

    await setUserPassword(user.id, body.password, "FORGOT_PASSWORD");
    await prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { used: true },
    });

    return NextResponse.json({ message: "Mot de passe mis à jour." });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    }
    if (error instanceof Error && error.message.startsWith("ORIGIN")) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 },
    );
  }
}
