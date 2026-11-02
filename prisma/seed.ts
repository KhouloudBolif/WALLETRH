import "dotenv/config";
import { hash } from "bcryptjs";
import { prisma } from "../lib/db";
import { encryptVisiblePassword } from "../lib/auth/password";

async function main() {
  const plainPassword = "Admin123!";
  const hashed = await hash(plainPassword, 12);

  await prisma.user.upsert({
    where: { email: "admin@amendis.ma" },
    update: {
      name: "Administrateur",
      password: hashed,
      passwordOrigin: "ADMIN",
      adminVisiblePassword: encryptVisiblePassword(plainPassword),
      role: "ADMIN",
      isActive: true,
    },
    create: {
      email: "admin@amendis.ma",
      name: "Administrateur",
      password: hashed,
      passwordOrigin: "ADMIN",
      adminVisiblePassword: encryptVisiblePassword(plainPassword),
      role: "ADMIN",
      isActive: true,
    },
  });

  console.info("Seed OK — admin@amendis.ma / Admin123!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
