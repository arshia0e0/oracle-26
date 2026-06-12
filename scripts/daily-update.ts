// Daily maintenance: syncs results from football-data.org, predicts
// matches kicking off in the next 48 hours, and scores newly finished
// matches. Safe to re-run at any time.
//
// Usage: npx tsx scripts/daily-update.ts

import "dotenv/config";
import { prisma } from "../lib/db";
import { runDailyUpdate } from "../lib/daily-update";

async function main() {
  await runDailyUpdate();
}

main()
  .catch((err) => {
    console.error(
      "Daily update failed:",
      err instanceof Error ? err.message : err
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
