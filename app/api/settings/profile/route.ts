export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/auth/require-admin";
import { updateProfileSchema } from "@/lib/validations/user";
import { assertSafeMutation, parseJsonBody } from "@/lib/security/api";

export async function PATCH(request: Request) {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    assertSafeMutation(request);
    const body = updateProfileSchema.parse(await parseJsonBody(request));

    if (body.email) {
      const conflict = await prisma.user.findFirst({
        where: { email: body.email, NOT: { id: session.user.id } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé." },
          { status: 409 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json({ user });
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
