export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { setUserPassword } from "@/lib/auth/password";
import { serializeUserForAdmin } from "@/lib/api/user-serializer";
import {
  adminResetPasswordSchema,
  updateUserSchema,
} from "@/lib/validations/user";
import { z } from "zod";
import { ensureNotLastAdmin } from "@/lib/admin/guards";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const { id } = await context.params;

  if (id === session.user.id) {
    return NextResponse.json(
      { error: "Utilisez Mon compte pour modifier votre propre profil." },
      { status: 400 },
    );
  }

  try {
    assertSafeMutation(request);
    const body = updateUserSchema.parse(await parseJsonBody(request));

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
    }

    if (body.isActive === false && current.role === "ADMIN") {
      await ensureNotLastAdmin(id);
    }

    if (body.role && body.role !== "ADMIN" && current.role === "ADMIN") {
      await ensureNotLastAdmin(id);
    }

    if (body.email) {
      const conflict = await prisma.user.findFirst({
        where: { email: body.email, NOT: { id } },
      });
      if (conflict) {
        return NextResponse.json(
          { error: "Cet email est déjà utilisé." },
          { status: 409 },
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.email !== undefined && { email: body.email }),
        ...(body.role !== undefined && { role: body.role }),
        ...(body.isActive !== undefined && { isActive: body.isActive }),
      },
    });

    return NextResponse.json({ user: serializeUserForAdmin(user) });
  } catch (error) {
    if (error instanceof Error && error.message === "LAST_ADMIN") {
      return NextResponse.json(
        { error: "Impossible de modifier le dernier administrateur actif." },
        { status: 400 },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "admin-reset-password", 30, 60 * 60 * 1000);
  if (limited) return limited;

  const { id } = await context.params;

  try {
    assertSafeMutation(request);
    const { password } = adminResetPasswordSchema.parse(await parseJsonBody(request));
    const user = await setUserPassword(id, password, "ADMIN");
    return NextResponse.json({ user: serializeUserForAdmin(user) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }
    return NextResponse.json({ error: "Utilisateur introuvable." }, { status: 404 });
  }
}
