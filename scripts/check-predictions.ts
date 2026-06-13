import "dotenv/config";
import { prisma } from "../lib/db";

async function main() {
  const matchIds = [537334, 537339, 537340, 537346, 537351];
  for (const matchId of matchIds) {
    const match = await prisma.match.findUnique({
      where: { id: matchId },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: true,
      },
    });
    if (!match) { console.log(`Match ${matchId} not found`); continue; }
    console.log(`\n=== Match ${matchId}: ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.date.toISOString()}) ===`);
    console.log(`Predictions: ${match.predictions.length}`);
    for (const p of match.predictions) {
      console.log(`  [${p.aiModel}] ${p.predictedHomeScore}-${p.predictedAwayScore}: ${p.reasoning}`);
    }
  }
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
