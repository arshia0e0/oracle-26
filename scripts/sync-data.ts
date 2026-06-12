// Syncs World Cup 2026 teams, squads, and matches from football-data.org
// into the local SQLite database. Safe to re-run: all writes are upserts.
//
// Usage: npx tsx scripts/sync-data.ts

import "dotenv/config";
import { prisma } from "../lib/db";
import { syncAll } from "../lib/sync";

async function main() {
  await syncAll();
  console.log("Sync complete.");
}

main()
  .catch((err) => {
    console.error("Sync failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
