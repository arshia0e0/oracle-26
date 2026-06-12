// Scores all AI predictions for one finished match and updates
// the LeaderboardEntry table. Safe to re-run (entries are upserted).
//
// Usage: npx tsx scripts/score-match.ts -- --matchId=12345

import "dotenv/config";
import { prisma } from "../lib/db";
import { scoreMatch } from "../lib/scoring";

function parseMatchId(argv: string[]): number {
  for (const arg of argv) {
    const match = arg.match(/^--matchId=(\d+)$/);
    if (match) return Number(match[1]);
  }
  throw new Error(
    "Missing --matchId. Usage: npx tsx scripts/score-match.ts -- --matchId=12345"
  );
}

async function main() {
  const matchId = parseMatchId(process.argv.slice(2));
  await scoreMatch(matchId);
  console.log(`Done scoring match ${matchId}.`);
}

main()
  .catch((err) => {
    console.error("Scoring failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
