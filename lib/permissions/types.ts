import type { Role } from "@prisma/client";
import type { DocumentCategory } from "@/lib/document-category";

export type CategoryAccessMap = Record<DocumentCategory, boolean>;

/** Per-category document-type overrides — only categories/types with an explicit
 * override present; anything absent falls back to the category baseline. */
export type DocumentTypeOverrides = Partial<Record<DocumentCategory, Record<string, boolean>>>;

/** Empty arrays = unrestricted (no scoping applied), consistent with the
 * absence-means-no-restriction convention DocumentTypeOverrides already uses. */
export type EmployeeScope = {
  allowedDirections: string[];
  allowedServices: string[];
};

/** Fully resolved access for a user or role: a category baseline plus any
 * document-type-level overrides layered on top, plus an employee-level scope. */
export type ResolvedAccess = {
  category: CategoryAccessMap;
  documentTypes: DocumentTypeOverrides;
  employeeScope: EmployeeScope;
};

export type PermissionUserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  access: ResolvedAccess;
};

export type PermissionRoleRow = {
  role: Role;
  access: ResolvedAccess;
};

/** { key, label } document-type catalog entries, keyed by category, for the admin UI. */
export type DocumentTypeCatalogMap = Partial<Record<DocumentCategory, { key: string; label: string }[]>>;
