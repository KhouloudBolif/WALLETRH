export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { searchDocuments } from "@/lib/search/documents";
import { applyRateLimit } from "@/lib/security/api";
import { readDocumentSearchParams } from "@/lib/validations/document-search";
import type { Role } from "@prisma/client";

export async function GET(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const limited = applyRateLimit(request, "search-documents", 120, 60 * 1000);
  if (limited) return limited;

  const url = new URL(request.url);
  const parsed = readDocumentSearchParams(url.searchParams);

  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );

  const results = await searchDocuments(parsed.data, viewerAccess);
  return NextResponse.json({ results });
}
