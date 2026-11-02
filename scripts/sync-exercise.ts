/**
 * Run the storage → PostgreSQL sync from the command line.
 * Usage: npm run sync:exercise
 */
import "dotenv/config";
import { prisma } from "../lib/db";
import { syncDriveIndex } from "../lib/sync/syncDriveIndex";

async function main() {
  console.log("Sync starting (source: local exercise)…");
  const result = await syncDriveIndex();

  if (result.status === "FAILED") {
    console.error(`✗ Sync failed: ${result.errorMessage}`);
    process.exitCode = 1;
    return;
  }

  console.log(`✓ Sync done (log ${result.syncLogId})`);
  console.log(`  employees indexed : ${result.employeesIndexed}`);
  console.log(`  files added       : ${result.filesAdded}`);
  console.log(`  files updated     : ${result.filesUpdated}`);
  console.log(`  files removed     : ${result.filesRemoved}`);
  if (result.unknownFolders.length > 0) {
    console.warn(`  unknown folders   : ${result.unknownFolders.join(", ")}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
