import type { Role } from "@prisma/client";

export function getRoleHomePath(role: Role): string {
  return role === "ADMIN" ? "/admin" : "/dashboard";
}
