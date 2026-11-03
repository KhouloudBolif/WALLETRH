export const runtime = "nodejs";

import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  MAX_SAVED_QUERIES,
  sanitizeActiveFields,
  sanitizeExportColumns,
  sanitizeFilters,
  saveQueryBodySchema,
  type SavedQueryDto,
} from "@/lib/search/saved-query";
import { applyRateLimit, assertSafeMutation, parseJsonBody } from "@/lib/security/api";

function toDto(row: {
  id: string;
  name: string;
  filters: Prisma.JsonValue;
  activeFields: string[];
  exportColumns: string[];
  updatedAt: Date;
}): SavedQueryDto {
  return {
    id: row.id,
    name: row.name,
    filters: sanitizeFilters(row.filters),
    activeFields: sanitizeActiveFields(row.activeFields),
    exportColumns: sanitizeExportColumns(row.exportColumns),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "saved-queries", 60, 60 * 1000);
  if (limited) return limited;

  const rows = await prisma.savedQuery.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ queries: rows.map(toDto) });
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "saved-queries-write", 30, 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = saveQueryBodySchema.parse(await parseJsonBody(request));
    const filters = sanitizeFilters(body.filters);
    const activeFields = sanitizeActiveFields(body.activeFields);
    const exportColumns = sanitizeExportColumns(body.exportColumns);

    if (activeFields.length === 0 && exportColumns.length === 0) {
      return NextResponse.json(
        { error: "Ajoutez au moins un filtre ou une colonne avant d'enregistrer." },
        { status: 400 },
      );
    }

    const data = {
      filters: filters as Prisma.InputJsonValue,
      activeFields,
      exportColumns,
    };

    const existing = await prisma.savedQuery.findUnique({
      where: { userId_name: { userId: session.user.id, name: body.name } },
    });

    if (existing) {
      const updated = await prisma.savedQuery.update({
        where: { id: existing.id },
        data,
      });
      return NextResponse.json({ query: toDto(updated), updated: true });
    }

    const count = await prisma.savedQuery.count({ where: { userId: session.user.id } });
    if (count >= MAX_SAVED_QUERIES) {
      return NextResponse.json(
        { error: `Limite de ${MAX_SAVED_QUERIES} requêtes enregistrées atteinte.` },
        { status: 400 },
      );
    }

    const created = await prisma.savedQuery.create({
      data: {
        userId: session.user.id,
        name: body.name,
        ...data,
      },
    });

    return NextResponse.json({ query: toDto(created), updated: false }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError || (error instanceof Error && error.message === "BODY_TOO_LARGE")) {
      return NextResponse.json({ error: "Données invalides." }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("ORIGIN")) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Une requête porte déjà ce nom." },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: "Une erreur est survenue." }, { status: 500 });
  }
}
