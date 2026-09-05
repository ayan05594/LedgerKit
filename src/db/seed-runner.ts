import { db, sql } from "./client";
import { seedReference } from "./seed";

async function main() {
  try {
    await seedReference(db);
    console.log("LedgerKit reference data seeded successfully.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
