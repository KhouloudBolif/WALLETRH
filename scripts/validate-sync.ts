/**
 * Validate the PostgreSQL index against the exercise filesystem.
 * Expected: every PDF under doc/debut/Dossiers Digitaux has exactly one
 * DriveFile row with the right employee + category, and no stale rows.
 *
 * Usage: npm run validate:sync (after npm run sync:exercise)
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "../lib/db";
import { folderToCategory } from "../lib/storage/codification";

const ROOT = path.resolve(__dirname, "..");
const DRIVE = path.join(ROOT, "doc", "debut", "Dossiers Digitaux");

type ExpectedFile = {
  matricule: string;
  folderName: string;
  fileName: string;
  category: string | null;
};

function scanFilesystem(): ExpectedFile[] {
  const expected: ExpectedFile[] = [];
  for (const matricule of fs.readdirSync(DRIVE)) {
    const employeeDir = path.join(DRIVE, matricule);
    if (!fs.statSync(employeeDir).isDirectory()) continue;

    for (const folder of fs.readdirSync(employeeDir)) {
      const folderDir = path.join(employeeDir, folder);
      if (!fs.statSync(folderDir).isDirectory()) continue;

      for (const file of fs.readdirSync(folderDir)) {
        if (!file.toLowerCase().endsWith(".pdf")) continue;
        expected.push({
          matricule: matricule.normalize("NFC"),
          folderName: folder.normalize("NFC"),
          fileName: file.normalize("NFC"),
          category: folderToCategory(folder),
        });
      }
    }
  }
  return expected;
}

async function main() {
  let failures = 0;
  const fail = (message: string) => {
    failures += 1;
    console.error(`✗ ${message}`);
  };

  const expected = scanFilesystem();
  const dbFiles = await prisma.driveFile.findMany({
    include: { employee: { select: { matricule: true } } },
  });
  const dbEmployees = await prisma.employee.count();

  console.log(`Filesystem : ${expected.length} PDFs`);
  console.log(`Database   : ${dbFiles.length} DriveFile rows, ${dbEmployees} employees`);

  if (dbFiles.length !== expected.length) {
    fail(`Count mismatch: filesystem ${expected.length} vs DB ${dbFiles.length}`);
  }

  const dbKey = (matricule: string, folderName: string, name: string) =>
    `${matricule}|${folderName.normalize("NFC")}|${name.normalize("NFC")}`;

  const dbIndex = new Map(
    dbFiles.map((f) => [dbKey(f.employee.matricule, f.folderName, f.name), f]),
  );

  for (const file of expected) {
    const row = dbIndex.get(dbKey(file.matricule, file.folderName, file.fileName));
    if (!row) {
      fail(`Missing in DB: ${file.matricule}/${file.folderName}/${file.fileName}`);
      continue;
    }
    if (file.category && row.category !== file.category) {
      fail(
        `Category mismatch for ${file.fileName}: DB=${row.category}, expected=${file.category}`,
      );
    }
    dbIndex.delete(dbKey(file.matricule, file.folderName, file.fileName));
  }

  for (const stale of dbIndex.values()) {
    fail(`Stale DB row (not on filesystem): ${stale.employee.matricule}/${stale.name}`);
  }

  if (failures === 0) {
    console.log(`✓ 0 diff — index matches the exercise tree (${expected.length} files)`);
  } else {
    console.error(`${failures} problem(s) found.`);
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
