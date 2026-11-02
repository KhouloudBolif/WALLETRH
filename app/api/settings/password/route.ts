export const runtime = "nodejs";

import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-admin";
import { setUserPassword } from "@/lib/auth/password";
import { changePasswordSchema } from "@/lib/validations/user";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Seul un administrateur peut modifier un mot de passe." },
      { status: 403 },
    );
  }

  const limited = applyRateLimit(request, "change-password", 10, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = changePasswordSchema.parse(await parseJsonBody(request));

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    });

    if (!user) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    const valid = await compare(body.currentPassword, user.password);
    if (!valid) {
      return NextResponse.json(
        { error: "Mot de passe actuel incorrect." },
        { status: 400 },
      );
    }

    await setUserPassword(session.user.id, body.newPassword, "USER");

    return NextResponse.json({
      message: "Mot de passe mis à jour. Seul vous pouvez le voir désormais.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
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
