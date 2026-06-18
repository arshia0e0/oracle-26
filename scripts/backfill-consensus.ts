// One-off backfill for the "Oracle Consensus" ensemble model.
//
// Adds the consensus prediction to every match that already had individual
// model predictions before the ensemble feature existed, and re-scores any
// finished match so the consensus appears on the leaderboard. Idempotent —
// safe to re-run.
//
// Usage: npx tsx scripts/backfill-consensus.ts

import "dotenv/config";
import {
  upsertConsensusPrediction,
  upsertConsensusTournamentPrediction,
} from "../lib/consensus";
import { prisma } from "../lib/db";
import { CONSENSUS_MODEL_NAME } from "../lib/predictor";
import { scoreMatch } from "../lib/scoring";

async function main() {
  // Every match that has at least one individual prediction.
  const predicted = await prisma.prediction.findMany({
    where: { aiModel: { not: CONSENSUS_MODEL_NAME } },
    select: { matchId: true },
  });
  const matchIds = Array.from(new Set(predicted.map((p) => p.matchId)));
  console.log(`${matchIds.length} predicted match(es) to backfill.`);

  let written = 0;
  let rescored = 0;
  for (const matchId of matchIds) {
    const ok = await upsertConsensusPrediction(matchId);
    if (!ok) continue;
    written++;

    // If the match is already scored, re-score so the consensus row gets
    // its own leaderboard entry too.
    const match = await prisma.match.findUnique({ where: { id: matchId } });
    if (match?.status === "FINISHED" && match.homeScore !== null) {
      try {
        await scoreMatch(matchId);
        rescored++;
      } catch (err) {
        console.error(
          `Failed to re-score match ${matchId}:`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  // Tournament-pick consensus (majority vote), if any model has predicted.
  const hasTournament = await upsertConsensusTournamentPrediction();
  if (hasTournament) console.log("Wrote consensus tournament picks (majority vote).");

  console.log(
    `Done. Wrote consensus for ${written} match(es), re-scored ${rescored} finished match(es).`
  );
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
