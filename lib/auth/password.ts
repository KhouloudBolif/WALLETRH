import { hash } from "bcryptjs";
import type { PasswordOrigin } from "@prisma/client";
import { prisma } from "@/lib/db";
import { decryptField, encryptField } from "@/lib/security/encryption";

export { passwordSchema } from "@/lib/validations/password";

const BCRYPT_ROUNDS = 12;

export function encryptVisiblePassword(plain: string): string {
  return encryptField(plain);
}

export function decryptVisiblePassword(stored: string | null): string | null {
  if (!stored) return null;
  return decryptField(stored);
}

export async function setUserPassword(
  userId: string,
  plainPassword: string,
  origin: PasswordOrigin,
) {
  const hashed = await hash(plainPassword, BCRYPT_ROUNDS);

  return prisma.user.update({
    where: { id: userId },
    data: {
      password: hashed,
      passwordOrigin: origin,
      adminVisiblePassword:
        origin === "USER" ? null : encryptVisiblePassword(plainPassword),
    },
  });
}

export function canAdminViewPassword(user: {
  adminVisiblePassword: string | null;
  passwordOrigin: PasswordOrigin;
}): boolean {
  return (
    user.adminVisiblePassword !== null &&
    (user.passwordOrigin === "ADMIN" || user.passwordOrigin === "FORGOT_PASSWORD")
  );
}
