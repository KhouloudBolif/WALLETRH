export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth/require-admin";
import { allCategories } from "@/lib/document-category";
import {
  listPermissionMatrix,
  listRolePermissions,
  setCategoryAccess,
  setColumnAccessForAllUsers,
  setEmployeeScopeForUser,
  setRolePermission,
  setUserAccessBulk,
} from "@/lib/permissions/access-rules";
import { getDocumentTypeCatalog } from "@/lib/permissions/document-type-catalog";
import {
  applyRateLimit,
  assertSafeMutation,
  parseJsonBody,
} from "@/lib/security/api";

const categorySchema = z.enum([
  "RECRUTEMENT",
  "ETAT_CIVIL",
  "ARRETES",
  "MESURES_DISCIPLINAIRES",
  "MALADIES_ACCIDENTS_TRAVAIL",
  "DEPART",
  "DIVERS",
]);

/** Role-permission mutations don't accept ADMIN — it always resolves to full access. */
const roleSchema = z.enum(["RH_MANAGER", "RH_AGENT"]);

/** "*" = whole-category baseline; anything else = a document-type override. */
const documentTypeSchema = z.string().min(1).max(200).default("*");

const patchSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("single"),
    userId: z.string().min(1),
    category: categorySchema,
    documentType: documentTypeSchema,
    canView: z.boolean(),
  }),
  z.object({
    type: z.literal("user"),
    userId: z.string().min(1),
    access: z.record(categorySchema, z.boolean()),
  }),
  z.object({
    type: z.literal("column"),
    category: categorySchema,
    documentType: documentTypeSchema,
    canView: z.boolean(),
  }),
  z.object({
    type: z.literal("role"),
    role: roleSchema,
    category: categorySchema,
    documentType: documentTypeSchema,
    canView: z.boolean(),
  }),
  z.object({
    type: z.literal("employeeScope"),
    userId: z.string().min(1),
    allowedDirections: z.array(z.string().min(1)).max(200),
    allowedServices: z.array(z.string().min(1)).max(200),
  }),
]);

export async function GET() {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const [users, roles, documentTypesByCategory] = await Promise.all([
    listPermissionMatrix(),
    listRolePermissions(),
    getDocumentTypeCatalog(),
  ]);
  return NextResponse.json({ users, roles, documentTypesByCategory });
}

export async function PATCH(request: Request) {
  const session = await requireAdmin();
  if (!session) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 403 });
  }

  const limited = applyRateLimit(request, "admin-permissions", 60, 60 * 60 * 1000);
  if (limited) return limited;

  try {
    assertSafeMutation(request);
    const body = patchSchema.parse(await parseJsonBody(request));

    if (body.type === "single") {
      await setCategoryAccess(body.userId, body.category, body.canView, body.documentType);
    } else if (body.type === "user") {
      const access: Partial<Record<(typeof allCategories)[number], boolean>> = {};
      for (const cat of allCategories) {
        if (body.access[cat] !== undefined) {
          access[cat] = body.access[cat];
        }
      }
      await setUserAccessBulk(body.userId, access);
    } else if (body.type === "role") {
      await setRolePermission(body.role, body.category, body.documentType, body.canView);
    } else if (body.type === "employeeScope") {
      await setEmployeeScopeForUser(body.userId, {
        allowedDirections: body.allowedDirections,
        allowedServices: body.allowedServices,
      });
    } else {
      await setColumnAccessForAllUsers(body.category, body.canView, body.documentType);
    }

    const [users, roles, documentTypesByCategory] = await Promise.all([
      listPermissionMatrix(),
      listRolePermissions(),
      getDocumentTypeCatalog(),
    ]);
    return NextResponse.json({ users, roles, documentTypesByCategory });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Données invalides." },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Impossible de modifier les droits de cet utilisateur ou rôle." },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === "BODY_TOO_LARGE") {
      return NextResponse.json({ error: "Requête trop volumineuse." }, { status: 413 });
    }
    if (error instanceof Error && error.message.startsWith("ORIGIN")) {
      return NextResponse.json({ error: "Requête refusée." }, { status: 403 });
    }
    console.error("[admin/permissions]", error);
    return NextResponse.json(
      { error: "Une erreur est survenue." },
      { status: 500 },
    );
  }
}
