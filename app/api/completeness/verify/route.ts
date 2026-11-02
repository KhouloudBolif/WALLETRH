export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { canViewDocument } from "@/lib/permissions/defaults";
import { getResolvedAccessForUser } from "@/lib/permissions/access-rules";
import { applyRateLimit, assertSafeMutation, parseJsonBody } from "@/lib/security/api";
import { verifyCompletenessSchema } from "@/lib/validations/completeness";
import type { Role } from "@prisma/client";

async function resolveEmployeeAndCheckAccess(
  matricule: string,
  category: Parameters<typeof canViewDocument>[1],
  documentType: string,
  session: NonNullable<Awaited<ReturnType<typeof requireSession>>>,
) {
  const employee = await prisma.employee.findUnique({
    where: { matricule },
    select: { id: true },
  });
  if (!employee) {
    return { error: NextResponse.json({ error: "Employé introuvable." }, { status: 404 }) };
  }

  const viewerAccess = await getResolvedAccessForUser(session.user.id, session.user.role as Role);
  const rawDocumentType = documentType === "*" ? null : documentType;
  if (!canViewDocument(viewerAccess, category, rawDocumentType)) {
    return { error: NextResponse.json({ error: "Accès refusé." }, { status: 403 }) };
  }

  return { employeeId: employee.id };
}

export async function POST(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    assertSafeMutation(request);
  } catch {
    return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "completeness-verify", 30, 60 * 1000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = verifyCompletenessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }
  const { matricule, category, documentType, note } = parsed.data;

  const resolved = await resolveEmployeeAndCheckAccess(matricule, category, documentType, session);
  if ("error" in resolved) return resolved.error;

  const attestation = await prisma.completenessAttestation.upsert({
    where: {
      employeeId_category_documentType: {
        employeeId: resolved.employeeId,
        category,
        documentType,
      },
    },
    create: {
      employeeId: resolved.employeeId,
      category,
      documentType,
      verifiedById: session.user.id,
      note,
    },
    update: {
      verifiedById: session.user.id,
      verifiedAt: new Date(),
      note,
    },
  });

  return NextResponse.json({ verifiedAt: attestation.verifiedAt.toISOString() });
}

/** Undoes a manual attestation — same access check as verifying, so a user can only
 * un-verify a gap they'd have been allowed to verify in the first place. */
export async function DELETE(request: Request) {
  const session = await requireSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  try {
    assertSafeMutation(request);
  } catch {
    return NextResponse.json({ error: "Origine invalide." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "completeness-verify", 30, 60 * 1000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await parseJsonBody(request);
  } catch {
    return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  }

  const parsed = verifyCompletenessSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Paramètres invalides." }, { status: 400 });
  }
  const { matricule, category, documentType } = parsed.data;

  const resolved = await resolveEmployeeAndCheckAccess(matricule, category, documentType, session);
  if ("error" in resolved) return resolved.error;

  await prisma.completenessAttestation.deleteMany({
    where: { employeeId: resolved.employeeId, category, documentType },
  });

  return NextResponse.json({ ok: true });
}
