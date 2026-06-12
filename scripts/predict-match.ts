// Gets score predictions for one match from all five AI models
// and saves them to the Prediction table. AIs that already predicted
// this match are skipped, so it's safe to re-run.
//
// Usage: npx tsx scripts/predict-match.ts -- --matchId=12345

import "dotenv/config";
import { prisma } from "../lib/db";
import { buildMatchPrompt, MATCH_AI_MODELS } from "../lib/predictor";

function parseMatchId(argv: string[]): number {
  for (const arg of argv) {
    const match = arg.match(/^--matchId=(\d+)$/);
    if (match) return Number(match[1]);
  }
  throw new Error(
    "Missing --matchId. Usage: npx tsx scripts/predict-match.ts -- --matchId=12345"
  );
}

async function main() {
  const matchId = parseMatchId(process.argv.slice(2));

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
  });
  if (!match) {
    throw new Error(
      `Match ${matchId} not found in the database. Run "npm run sync-data" first.`
    );
  }

  console.log(
    `Predicting ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.stage}, ${match.date.toISOString()})`
  );

  const prompt = buildMatchPrompt(
    match,
    match.homeTeam,
    match.awayTeam,
    match.homeTeam.players,
    match.awayTeam.players
  );

  const existing = await prisma.prediction.findMany({
    where: { matchId },
    select: { aiModel: true },
  });
  const alreadyPredicted = new Set(existing.map((p) => p.aiModel));

  let saved = 0;
  for (const ai of MATCH_AI_MODELS) {
    if (alreadyPredicted.has(ai.name)) {
      console.log(`[${ai.name}] already has a prediction for this match, skipping.`);
      continue;
    }

    console.log(`[${ai.name}] requesting prediction...`);
    const prediction = await ai.predict(prompt);
    if (!prediction) continue; // errors were already logged by the predictor

    await prisma.prediction.create({
      data: {
        aiModel: ai.name,
        matchId,
        predictedHomeScore: prediction.homeScore,
        predictedAwayScore: prediction.awayScore,
        reasoning: prediction.reasoning,
      },
    });
    saved++;
    console.log(
      `[${ai.name}] predicted ${prediction.homeScore}-${prediction.awayScore}: ${prediction.reasoning}`
    );
  }

  console.log(`Done. Saved ${saved} new prediction(s) for match ${matchId}.`);
}

main()
  .catch((err) => {
    console.error("Prediction failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
