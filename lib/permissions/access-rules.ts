import type { DocumentCategory as PrismaCategory, Role } from "@prisma/client";
import { allCategories, type DocumentCategory } from "@/lib/document-category";
import { prisma } from "@/lib/db";
import { getDefaultAccessMap } from "@/lib/permissions/defaults";
import type {
  CategoryAccessMap,
  DocumentTypeOverrides,
  EmployeeScope,
  PermissionRoleRow,
  PermissionUserRow,
  ResolvedAccess,
} from "@/lib/permissions/types";

const UNRESTRICTED_SCOPE: EmployeeScope = { allowedDirections: [], allowedServices: [] };

export { canViewCategoryFromMap, canViewDocument, getDefaultAccessMap } from "@/lib/permissions/defaults";

const ALL_ROLES: Role[] = ["ADMIN", "RH_MANAGER", "RH_AGENT"];

const prismaToApp: Record<PrismaCategory, DocumentCategory> = {
  RECRUTEMENT: "RECRUTEMENT",
  ETAT_CIVIL: "ETAT_CIVIL",
  ARRETES: "ARRETES",
  MESURES_DISCIPLINAIRES: "MESURES_DISCIPLINAIRES",
  MALADIES_ACCIDENTS_TRAVAIL: "MALADIES_ACCIDENTS_TRAVAIL",
  DEPART: "DEPART",
  DIVERS: "DIVERS",
};

const appToPrisma: Record<DocumentCategory, PrismaCategory> = {
  RECRUTEMENT: "RECRUTEMENT",
  ETAT_CIVIL: "ETAT_CIVIL",
  ARRETES: "ARRETES",
  MESURES_DISCIPLINAIRES: "MESURES_DISCIPLINAIRES",
  MALADIES_ACCIDENTS_TRAVAIL: "MALADIES_ACCIDENTS_TRAVAIL",
  DEPART: "DEPART",
  DIVERS: "DIVERS",
};

function emptyResolvedAccess(baseline: CategoryAccessMap): ResolvedAccess {
  return { category: { ...baseline }, documentTypes: {}, employeeScope: UNRESTRICTED_SCOPE };
}

/** Applies one rule row ("*" = category-wide, else a document-type override) onto a ResolvedAccess. */
function applyRuleRow(
  access: ResolvedAccess,
  category: DocumentCategory,
  documentType: string,
  canView: boolean,
) {
  if (documentType === "*") {
    access.category[category] = canView;
    return;
  }
  if (!access.documentTypes[category]) {
    access.documentTypes[category] = {};
  }
  access.documentTypes[category]![documentType] = canView;
}

function cloneResolvedAccess(access: ResolvedAccess): ResolvedAccess {
  const documentTypes: DocumentTypeOverrides = {};
  for (const [category, overrides] of Object.entries(access.documentTypes)) {
    documentTypes[category as DocumentCategory] = { ...overrides };
  }
  return {
    category: { ...access.category },
    documentTypes,
    employeeScope: {
      allowedDirections: [...access.employeeScope.allowedDirections],
      allowedServices: [...access.employeeScope.allowedServices],
    },
  };
}

/** Lazily seeds RolePermission's category-wide baseline rows for a role from the
 * hardcoded defaults, the first time that role is resolved. Only 3 roles total, so
 * this runs at most once per role, ever. */
export async function ensureDefaultRolePermissions(role: Role) {
  if (role === "ADMIN") return;

  const existing = await prisma.rolePermission.count({ where: { role } });
  if (existing > 0) return;

  const defaults = getDefaultAccessMap(role);
  await prisma.rolePermission.createMany({
    data: allCategories.map((category) => ({
      role,
      category: appToPrisma[category],
      documentType: "*",
      canView: defaults[category],
    })),
  });
}

/** Fallback ResolvedAccess for the rare case a page renders without a session
 * (should generally not happen behind route protection, but keeps call sites safe). */
export function unauthenticatedAccess(role: Role): ResolvedAccess {
  return emptyResolvedAccess(getDefaultAccessMap(role));
}

/** Role-level baseline access — ADMIN always resolves to full access, never stored. */
export async function getRoleResolvedAccess(role: Role): Promise<ResolvedAccess> {
  if (role === "ADMIN") {
    return emptyResolvedAccess(getDefaultAccessMap("ADMIN"));
  }

  await ensureDefaultRolePermissions(role);

  const rows = await prisma.rolePermission.findMany({ where: { role } });
  const access = emptyResolvedAccess(getDefaultAccessMap(role));
  for (const row of rows) {
    applyRuleRow(access, prismaToApp[row.category], row.documentType, row.canView);
  }
  return access;
}

/** Full resolution: role baseline, overlaid by this user's explicit AccessRule
 * overrides (if any — AccessRule only ever contains genuine per-user overrides,
 * never pre-seeded). */
export async function getResolvedAccessForUser(userId: string, role: Role): Promise<ResolvedAccess> {
  if (role === "ADMIN") {
    return emptyResolvedAccess(getDefaultAccessMap("ADMIN"));
  }

  const roleAccess = await getRoleResolvedAccess(role);
  const access = cloneResolvedAccess(roleAccess);

  const userRules = await prisma.accessRule.findMany({ where: { userId } });
  for (const rule of userRules) {
    applyRuleRow(access, prismaToApp[rule.category], rule.documentType, rule.canView);
  }

  access.employeeScope = await getEmployeeScopeForUser(userId);
  return access;
}

/** Empty arrays = unrestricted. ADMIN is never scoped — callers should already
 * short-circuit ADMIN before reaching here, but this is safe to call regardless. */
export async function getEmployeeScopeForUser(userId: string): Promise<EmployeeScope> {
  const row = await prisma.employeeScope.findUnique({ where: { userId } });
  if (!row) return { ...UNRESTRICTED_SCOPE };
  return { allowedDirections: row.allowedDirections, allowedServices: row.allowedServices };
}

export async function setEmployeeScopeForUser(
  userId: string,
  scope: EmployeeScope,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!user || user.role === "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  await prisma.employeeScope.upsert({
    where: { userId },
    create: {
      userId,
      allowedDirections: scope.allowedDirections,
      allowedServices: scope.allowedServices,
    },
    update: {
      allowedDirections: scope.allowedDirections,
      allowedServices: scope.allowedServices,
    },
  });
}

export async function listPermissionMatrix(): Promise<PermissionUserRow[]> {
  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
    },
  });

  const rows: PermissionUserRow[] = [];
  for (const user of users) {
    const access = await getResolvedAccessForUser(user.id, user.role);
    rows.push({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      access,
    });
  }
  return rows;
}

export async function listRolePermissions(): Promise<PermissionRoleRow[]> {
  const rows: PermissionRoleRow[] = [];
  for (const role of ALL_ROLES) {
    rows.push({ role, access: await getRoleResolvedAccess(role) });
  }
  return rows;
}

export async function setCategoryAccess(
  userId: string,
  category: DocumentCategory,
  canView: boolean,
  documentType = "*",
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role === "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  await prisma.accessRule.upsert({
    where: {
      userId_category_documentType: {
        userId,
        category: appToPrisma[category],
        documentType,
      },
    },
    create: {
      userId,
      category: appToPrisma[category],
      documentType,
      canView,
    },
    update: { canView },
  });
}

export async function setUserAccessBulk(
  userId: string,
  access: Partial<CategoryAccessMap>,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || user.role === "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  for (const category of allCategories) {
    if (access[category] === undefined) continue;
    await setCategoryAccess(userId, category, access[category]!);
  }
}

export async function setColumnAccessForAllUsers(
  category: DocumentCategory,
  canView: boolean,
  documentType = "*",
) {
  const users = await prisma.user.findMany({
    where: { isActive: true, role: { not: "ADMIN" } },
    select: { id: true },
  });

  for (const user of users) {
    await setCategoryAccess(user.id, category, canView, documentType);
  }
}

/** Sets a role-level baseline or document-type override. ADMIN is rejected — it
 * always resolves to full access regardless of any stored rule. */
export async function setRolePermission(
  role: Role,
  category: DocumentCategory,
  documentType: string,
  canView: boolean,
) {
  if (role === "ADMIN") {
    throw new Error("FORBIDDEN");
  }

  await ensureDefaultRolePermissions(role);
  await prisma.rolePermission.upsert({
    where: {
      role_category_documentType: {
        role,
        category: appToPrisma[category],
        documentType,
      },
    },
    create: {
      role,
      category: appToPrisma[category],
      documentType,
      canView,
    },
    update: { canView },
  });
}
