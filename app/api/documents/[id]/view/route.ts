export const runtime = "nodejs";

import { promises as fs } from "node:fs";
import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import type { DocumentCategory } from "@/lib/document-category";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { canViewDocument, canViewEmployee } from "@/lib/permissions/defaults";
import { getStorageProvider } from "@/lib/storage/storageProvider";
import type { Role } from "@prisma/client";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * Serve a document after a server-side AccessRule check.
 * Local provider: streams the PDF. Drive provider (Phase 2b): redirects to webViewLink.
 * Denied or unknown documents return 404 — no information leak.
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const { id } = await params;
  const file = await prisma.driveFile.findUnique({ where: { id }, include: { employee: true } });
  if (!file) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  const viewerAccess = await getResolvedAccessForUser(
    session.user.id,
    session.user.role as Role,
  );
  if (
    !canViewDocument(viewerAccess, file.category as DocumentCategory, file.documentType) ||
    !canViewEmployee(viewerAccess, file.employee)
  ) {
    return NextResponse.json({ error: "Document introuvable." }, { status: 404 });
  }

  if (file.webViewLink) {
    return NextResponse.redirect(file.webViewLink);
  }

  if (!file.localPath) {
    return NextResponse.json({ error: "Document non disponible." }, { status: 404 });
  }

  const provider = getStorageProvider();
  if (!provider.getLocalPath) {
    return NextResponse.json({ error: "Document non disponible." }, { status: 404 });
  }

  try {
    const absolutePath = provider.getLocalPath(file.localPath);
    const data = await fs.readFile(absolutePath);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Document non disponible." }, { status: 404 });
  }
}
