import { prisma } from "@/lib/db";

export async function countActiveAdmins(excludeUserId?: string) {
  return prisma.user.count({
    where: {
      role: "ADMIN",
      isActive: true,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });
}

export async function ensureNotLastAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "ADMIN" || !user.isActive) return;

  const others = await countActiveAdmins(userId);
  if (others === 0) {
    throw new Error("LAST_ADMIN");
  }
}
