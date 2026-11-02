import {
  canAdminViewPassword,
  decryptVisiblePassword,
} from "@/lib/auth/password";
import type { PasswordOrigin, Role } from "@prisma/client";

export type AdminUserRecord = {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  passwordOrigin: PasswordOrigin;
  adminVisiblePassword: string | null;
  createdAt: Date;
};

/** Never expose password hash or encryption internals. */
export function serializeUserForAdmin(user: AdminUserRecord) {
  const viewable = canAdminViewPassword(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    passwordOrigin: user.passwordOrigin,
    canViewPassword: viewable,
    viewablePassword: viewable
      ? decryptVisiblePassword(user.adminVisiblePassword)
      : null,
    createdAt: user.createdAt.toISOString(),
  };
}
