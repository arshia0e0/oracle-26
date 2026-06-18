// The ensemble "Oracle Consensus" prediction: the average of every
// individual model's scoreline for a match, stored as its own prediction
// row so scoring and the leaderboard pick it up like any other contestant.

import { prisma } from "./db";
import {
  buildConsensusPrediction,
  buildTournamentConsensus,
  CONSENSUS_MODEL_NAME,
} from "./predictor";

/**
 * Recomputes the consensus prediction for a match from the individual
 * models' rows and upserts it. Idempotent — safe to re-run; it always
 * reflects whichever models have predicted so far. Returns true if a
 * consensus row was written, false if no individual predictions exist yet.
 */
export async function upsertConsensusPrediction(
  matchId: number
): Promise<boolean> {
  const predictions = await prisma.prediction.findMany({ where: { matchId } });
  const individual = predictions.filter(
    (p) => p.aiModel !== CONSENSUS_MODEL_NAME
  );

  const consensus = buildConsensusPrediction(
    individual.map((p) => ({
      homeScore: p.predictedHomeScore,
      awayScore: p.predictedAwayScore,
      reasoning: "",
      confidence: p.confidence,
    }))
  );
  if (!consensus) return false;

  await prisma.prediction.upsert({
    where: { aiModel_matchId: { aiModel: CONSENSUS_MODEL_NAME, matchId } },
    create: {
      aiModel: CONSENSUS_MODEL_NAME,
      matchId,
      predictedHomeScore: consensus.homeScore,
      predictedAwayScore: consensus.awayScore,
      reasoning: consensus.reasoning,
      confidence: consensus.confidence,
    },
    update: {
      predictedHomeScore: consensus.homeScore,
      predictedAwayScore: consensus.awayScore,
      reasoning: consensus.reasoning,
      confidence: consensus.confidence,
    },
  });
  return true;
}

/**
 * Recomputes the ensemble's tournament prediction — a per-prize majority
 * vote across the individual models — and upserts it. Idempotent. Returns
 * true if a consensus row was written, false if no model has predicted yet.
 */
export async function upsertConsensusTournamentPrediction(): Promise<boolean> {
  const rows = await prisma.tournamentPrediction.findMany();
  const individual = rows.filter((r) => r.aiModel !== CONSENSUS_MODEL_NAME);

  const consensus = buildTournamentConsensus(
    individual.map((r) => ({
      winner: r.predictedWinner,
      goldenBoot: r.predictedGoldenBoot,
      goldenGlove: r.predictedGoldenGlove,
      // A missing Golden Ball votes as "" and is stored back as null below.
      goldenBall: r.predictedGoldenBall ?? "",
      reasoning: "",
    }))
  );
  if (!consensus) return false;

  await prisma.tournamentPrediction.upsert({
    where: { aiModel: CONSENSUS_MODEL_NAME },
    create: {
      aiModel: CONSENSUS_MODEL_NAME,
      predictedWinner: consensus.winner,
      predictedGoldenBoot: consensus.goldenBoot,
      predictedGoldenGlove: consensus.goldenGlove,
      predictedGoldenBall: consensus.goldenBall || null,
      reasoning: consensus.reasoning,
    },
    update: {
      predictedWinner: consensus.winner,
      predictedGoldenBoot: consensus.goldenBoot,
      predictedGoldenGlove: consensus.goldenGlove,
      predictedGoldenBall: consensus.goldenBall || null,
      reasoning: consensus.reasoning,
    },
  });
  return true;
}
