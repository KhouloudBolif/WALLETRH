export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { applyRateLimit, assertSafeMutation } from "@/lib/security/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, context: RouteContext) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "saved-queries-write", 30, 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const { id } = await context.params;
    if (!id || id.length > 40) {
      return NextResponse.json({ error: "Requête introuvable." }, { status: 404 });
    }

    const existing = await prisma.savedQuery.findFirst({
      where: { id, userId: session.user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Requête introuvable." }, { status: 404 });
    }

    await prisma.savedQuery.delete({ where: { id: existing.id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("ORIGIN")) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
