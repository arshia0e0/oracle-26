// Asks all five AI models to predict the World Cup winner,
// Golden Boot, and Golden Glove, and saves the answers to the
// TournamentPrediction table. Each AI is asked once only: if a
// TournamentPrediction already exists for that AI, it is skipped.
//
// Usage: npx tsx scripts/predict-tournament.ts

import "dotenv/config";
import { prisma } from "../lib/db";
import { buildTournamentPrompt, TOURNAMENT_AI_MODELS } from "../lib/predictor";

async function main() {
  const teams = await prisma.team.findMany({
    include: { players: true },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) {
    throw new Error(
      'No teams found in the database. Run "npm run sync-data" first.'
    );
  }

  console.log(`Building tournament prompt with ${teams.length} teams...`);
  const prompt = buildTournamentPrompt(teams);
  const compactPrompt = buildTournamentPrompt(teams, { includePlayers: false });

  const existing = await prisma.tournamentPrediction.findMany({
    select: { aiModel: true },
  });
  const alreadyPredicted = new Set(existing.map((p) => p.aiModel));

  let saved = 0;
  for (const ai of TOURNAMENT_AI_MODELS) {
    if (alreadyPredicted.has(ai.name)) {
      console.log(`[${ai.name}] already has a tournament prediction, skipping.`);
      continue;
    }

    console.log(`[${ai.name}] requesting tournament prediction...`);
    const outcome = await ai.predict(ai.compactPrompt ? compactPrompt : prompt);
    if (!outcome) continue; // errors were already logged by the predictor

    await prisma.tournamentPrediction.create({
      data: {
        aiModel: ai.name,
        predictedWinner: outcome.winner,
        predictedGoldenBoot: outcome.goldenBoot,
        predictedGoldenGlove: outcome.goldenGlove,
        reasoning: outcome.reasoning,
      },
    });
    saved++;
    console.log(
      `[${ai.name}] winner: ${outcome.winner}, Golden Boot: ${outcome.goldenBoot}, Golden Glove: ${outcome.goldenGlove}\n  ${outcome.reasoning}`
    );
  }

  console.log(`Done. Saved ${saved} new tournament prediction(s).`);
}

main()
  .catch((err) => {
    console.error(
      "Tournament prediction failed:",
      err instanceof Error ? err.message : err
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
