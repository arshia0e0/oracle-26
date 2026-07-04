// One-off backfill: knockout draw predictions made before the shootout-pick
// feature have no predictedPenaltyWinner, so their model can't earn the winner
// point on a tie that goes to penalties. For every SCHEDULED knockout match
// with such a prediction, this re-asks that model (with the new prompt, which
// requires a shootout pick on a draw) and updates the row in place, then
// recomputes the ensemble. Only touches upcoming matches — finished ones keep
// the calls they were scored on. Idempotent: once a pick is stored, skipped.
//
// Usage: npx tsx scripts/backfill-penalty-winners.ts

import "dotenv/config";
import { upsertConsensusPrediction } from "../lib/consensus";
import { penaltyWinnerSide } from "../lib/daily-update";
import { prisma } from "../lib/db";
import {
  buildMatchPrompt,
  CONSENSUS_MODEL_NAME,
  MATCH_AI_MODELS,
} from "../lib/predictor";

async function main() {
  const matches = await prisma.match.findMany({
    where: { status: "SCHEDULED", stage: { not: "GROUP" } },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      predictions: true,
    },
  });

  let updated = 0;
  for (const match of matches) {
    // Individual (non-ensemble) draw predictions still missing a shootout pick.
    const incomplete = match.predictions.filter(
      (p) =>
        p.aiModel !== CONSENSUS_MODEL_NAME &&
        p.predictedHomeScore === p.predictedAwayScore &&
        p.predictedPenaltyWinner === null
    );
    if (incomplete.length === 0) continue;

    const prompt = buildMatchPrompt(
      match,
      match.homeTeam,
      match.awayTeam,
      match.homeTeam.players,
      match.awayTeam.players
    );

    let touched = false;
    for (const row of incomplete) {
      const model = MATCH_AI_MODELS.find((m) => m.name === row.aiModel);
      if (!model) continue;
      console.log(
        `Re-asking ${row.aiModel} for ${match.homeTeam.name} vs ${match.awayTeam.name} (had ${row.predictedHomeScore}-${row.predictedAwayScore}, no shootout pick)...`
      );
      const prediction = await model.predict(prompt);
      if (!prediction) continue;

      const penaltyWinner = penaltyWinnerSide(
        prediction.penaltyWinner,
        match.homeTeam.name,
        match.awayTeam.name
      );
      await prisma.prediction.update({
        where: { aiModel_matchId: { aiModel: row.aiModel, matchId: match.id } },
        data: {
          predictedHomeScore: prediction.homeScore,
          predictedAwayScore: prediction.awayScore,
          predictedPenaltyWinner: penaltyWinner,
          reasoning: prediction.reasoning,
          confidence: prediction.confidence,
        },
      });
      updated++;
      touched = true;
      const pick =
        prediction.homeScore === prediction.awayScore
          ? penaltyWinner
            ? ` → ${penaltyWinner === "HOME" ? match.homeTeam.name : match.awayTeam.name} on pens`
            : " → still no shootout pick"
          : " (now a decisive scoreline)";
      console.log(
        `  ${row.aiModel} now ${prediction.homeScore}-${prediction.awayScore}${pick}`
      );
    }

    if (touched) await upsertConsensusPrediction(match.id);
  }

  console.log(`Done. Updated ${updated} prediction(s).`);
}

main()
  .catch((err) => {
    console.error("Backfill failed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
