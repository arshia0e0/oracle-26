// One-off re-score: matches decided on penalties were scored before the
// penalty-aware rules existed (against the shootout-inflated fullTime), so
// their leaderboard entries are wrong. After a fresh sync has corrected their
// stored scores, this re-scores every finished penalty tie. scoreMatch upserts,
// so it's safe to re-run and only rewrites the affected entries.
//
// Usage: npx tsx scripts/rescore-penalty-matches.ts

import "dotenv/config";
import { prisma } from "../lib/db";
import { scoreMatch } from "../lib/scoring";

async function main() {
  const matches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      homePenalties: { not: null },
      predictions: { some: {} },
    },
    include: { homeTeam: true, awayTeam: true },
    orderBy: { date: "asc" },
  });
  console.log(`${matches.length} finished penalty tie(s) to re-score.`);

  for (const match of matches) {
    console.log(
      `\nRe-scoring ${match.homeTeam.name} vs ${match.awayTeam.name} — ` +
        `${match.homeScore}-${match.awayScore} (${match.homePenalties}-${match.awayPenalties} pens):`
    );
    await scoreMatch(match.id);
  }
}

main()
  .catch((err) => {
    console.error("Re-score failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
