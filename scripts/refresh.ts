// Full refresh: pulls in the latest match results from football-data.org,
// gets predictions from every AI model for ANY scheduled match that hasn't
// been predicted yet (not just the next 48h), and scores newly finished
// matches. Safe to re-run at any time — every step is idempotent.
//
// Usage: npm run refresh

import "dotenv/config";
import { prisma } from "../lib/db";
import { runDailyUpdate } from "../lib/daily-update";

async function main() {
  // predictWindowHours: null => predict every unpredicted scheduled match.
  const summary = await runDailyUpdate({ predictWindowHours: null });
  console.log(
    `\nRefresh complete: synced ${summary.synced} match(es), ` +
      `predicted ${summary.predicted} match(es), scored ${summary.scored} match(es).`
  );
}

main()
  .catch((err) => {
    console.error("Refresh failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
