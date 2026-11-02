export const runtime = "nodejs";

import { hash } from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { encryptVisiblePassword } from "@/lib/auth/password";
import { serializeUserForAdmin } from "@/lib/api/user-serializer";
import { z } from "zod";
import { createUserSchema } from "@/lib/validations/user";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      passwordOrigin: true,
      adminVisiblePassword: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    users: users.map(serializeUserForAdmin),
  });
}

export async function POST(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "admin-create-user", 20, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = createUserSchema.parse(await parseJsonBody(request));
    const email = body.email;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Un utilisateur avec cet email existe déjà." },
        { status: 409 },
      );
    }

    const hashed = await hash(body.password, 12);

    const user = await prisma.user.create({
      data: {
        name: body.name,
        email,
        password: hashed,
        passwordOrigin: "ADMIN",
        adminVisiblePassword: encryptVisiblePassword(body.password),
        role: body.role,
        isActive: true,
      },
    });

    return NextResponse.json(
      { user: serializeUserForAdmin(user) },
      { status: 201 },
    );
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
