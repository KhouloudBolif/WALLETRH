import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const before = await prisma.employee.count();
  const filesBefore = await prisma.driveFile.count();
  console.log(`Before: ${before} employees, ${filesBefore} files`);

  const deleted = await prisma.employee.deleteMany({});
  console.log(`Deleted ${deleted.count} employees (files cascade-deleted)`);

  const after = await prisma.employee.count();
  const filesAfter = await prisma.driveFile.count();
  console.log(`After: ${after} employees, ${filesAfter} files`);
}
main().finally(() => prisma.$disconnect());
