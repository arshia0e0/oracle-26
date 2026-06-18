// Asks all AI models to predict the World Cup winner, Golden Boot,
// Golden Glove, and Golden Ball, and saves the answers to the
// TournamentPrediction table. An AI is skipped only if it already has a
// complete row (including a Golden Ball pick); rows created before the
// Golden Ball pick existed are topped up with just that pick, preserving
// the AI's original winner/boot/glove/reasoning.
//
// Usage: npx tsx scripts/predict-tournament.ts

import "dotenv/config";
import { upsertConsensusTournamentPrediction } from "../lib/consensus";
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

  const existing = await prisma.tournamentPrediction.findMany();
  const existingByName = new Map(existing.map((p) => [p.aiModel, p]));

  let saved = 0;
  for (const ai of TOURNAMENT_AI_MODELS) {
    const current = existingByName.get(ai.name);
    if (current && current.predictedGoldenBall) {
      console.log(
        `[${ai.name}] already has a complete tournament prediction, skipping.`
      );
      continue;
    }

    console.log(`[${ai.name}] requesting tournament prediction...`);
    const outcome = await ai.predict(ai.compactPrompt ? compactPrompt : prompt);
    if (!outcome) continue; // errors were already logged by the predictor

    if (current) {
      // Existing row predates the Golden Ball pick: only fill in that field
      // so the AI's original winner/boot/glove/reasoning are preserved.
      await prisma.tournamentPrediction.update({
        where: { aiModel: ai.name },
        data: { predictedGoldenBall: outcome.goldenBall },
      });
      console.log(`[${ai.name}] Golden Ball: ${outcome.goldenBall}`);
    } else {
      await prisma.tournamentPrediction.create({
        data: {
          aiModel: ai.name,
          predictedWinner: outcome.winner,
          predictedGoldenBoot: outcome.goldenBoot,
          predictedGoldenGlove: outcome.goldenGlove,
          predictedGoldenBall: outcome.goldenBall,
          reasoning: outcome.reasoning,
        },
      });
      console.log(
        `[${ai.name}] winner: ${outcome.winner}, Golden Boot: ${outcome.goldenBoot}, Golden Glove: ${outcome.goldenGlove}, Golden Ball: ${outcome.goldenBall}\n  ${outcome.reasoning}`
      );
    }
    saved++;
  }

  // Recompute the ensemble's majority-vote picks from all individual rows.
  const hasConsensus = await upsertConsensusTournamentPrediction();
  if (hasConsensus) console.log("[Oracle Consensus] tournament picks updated by majority vote.");

  console.log(`Done. Saved/updated ${saved} tournament prediction(s).`);
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
