// Scores AI predictions against finished match results and writes
// the results to the LeaderboardEntry table.
//
// Points per match (they stack, max 10):
//   - Correct winner or correct draw: 3 pts
//   - Correct goal difference:        2 pts
//   - Correct exact score (bonus):    5 pts
//
// Tournament predictions (scored once, when the tournament ends):
//   - Correct World Cup winner: 100 pts
//   - Correct Golden Boot:      150 pts
//   - Correct Golden Glove:     150 pts
//   - Correct Golden Ball:      150 pts

import { prisma } from "./db";

export const TOURNAMENT_POINTS = {
  winner: 100,
  goldenBoot: 150,
  goldenGlove: 150,
  goldenBall: 150,
} as const;

export interface TournamentScoreBreakdown {
  winner: boolean;
  goldenBoot: boolean;
  goldenGlove: boolean;
  goldenBall: boolean;
  points: number;
}

// Case-insensitive comparison; tolerates minor punctuation/accent noise
// in AI-written names (e.g. "Kylian Mbappe" vs "Kylian Mbappé").
function sameName(a: string, b: string): boolean {
  const normalize = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9 ]/gi, "")
      .trim()
      .toLowerCase();
  return normalize(a) === normalize(b);
}

export function scoreTournamentPrediction(
  actual: {
    winner: string;
    goldenBoot: string;
    goldenGlove: string;
    goldenBall: string;
  },
  predicted: {
    winner: string;
    goldenBoot: string;
    goldenGlove: string;
    goldenBall: string;
  }
): TournamentScoreBreakdown {
  const winner = sameName(actual.winner, predicted.winner);
  const goldenBoot = sameName(actual.goldenBoot, predicted.goldenBoot);
  const goldenGlove = sameName(actual.goldenGlove, predicted.goldenGlove);
  const goldenBall = sameName(actual.goldenBall, predicted.goldenBall);

  const points =
    (winner ? TOURNAMENT_POINTS.winner : 0) +
    (goldenBoot ? TOURNAMENT_POINTS.goldenBoot : 0) +
    (goldenGlove ? TOURNAMENT_POINTS.goldenGlove : 0) +
    (goldenBall ? TOURNAMENT_POINTS.goldenBall : 0);

  return { winner, goldenBoot, goldenGlove, goldenBall, points };
}

export interface ScoreBreakdown {
  winner: boolean;
  goalDiff: boolean;
  exactScore: boolean;
  points: number;
}

export interface LeaderboardRow {
  aiModel: string;
  totalPoints: number;
  matchesPredicted: number;
  perfectPredictions: number;
  winnerCorrect: number;
}

// -1 = away win, 0 = draw, 1 = home win
function outcome(homeScore: number, awayScore: number): number {
  return Math.sign(homeScore - awayScore);
}

export function scorePrediction(
  actualHome: number,
  actualAway: number,
  predictedHome: number,
  predictedAway: number
): ScoreBreakdown {
  const winner =
    outcome(predictedHome, predictedAway) === outcome(actualHome, actualAway);
  const goalDiff =
    predictedHome - predictedAway === actualHome - actualAway;
  const exactScore =
    predictedHome === actualHome && predictedAway === actualAway;

  const points =
    (winner ? 3 : 0) + (goalDiff ? 2 : 0) + (exactScore ? 5 : 0);

  return { winner, goalDiff, exactScore, points };
}

/**
 * Scores every prediction for a finished match and upserts one
 * LeaderboardEntry per AI model. Safe to re-run: existing entries
 * are updated in place.
 */
export async function scoreMatch(matchId: number): Promise<void> {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new Error(`Match ${matchId} not found in the database.`);
  }
  if (match.status !== "FINISHED") {
    throw new Error(
      `Match ${matchId} is not finished yet (status: ${match.status}). Only finished matches can be scored.`
    );
  }
  if (match.homeScore === null || match.awayScore === null) {
    throw new Error(
      `Match ${matchId} is FINISHED but has no final score. Run "npm run sync-data" first.`
    );
  }

  const predictions = await prisma.prediction.findMany({
    where: { matchId },
  });
  if (predictions.length === 0) {
    console.log(`No predictions found for match ${matchId}; nothing to score.`);
    return;
  }

  for (const prediction of predictions) {
    const breakdown = scorePrediction(
      match.homeScore,
      match.awayScore,
      prediction.predictedHomeScore,
      prediction.predictedAwayScore
    );

    await prisma.leaderboardEntry.upsert({
      where: {
        aiModel_matchId: { aiModel: prediction.aiModel, matchId },
      },
      create: {
        aiModel: prediction.aiModel,
        matchId,
        pointsEarned: breakdown.points,
        breakdown: JSON.stringify(breakdown),
      },
      update: {
        pointsEarned: breakdown.points,
        breakdown: JSON.stringify(breakdown),
      },
    });

    console.log(
      `[${prediction.aiModel}] predicted ${prediction.predictedHomeScore}-${prediction.predictedAwayScore}, actual ${match.homeScore}-${match.awayScore}: ${breakdown.points} pts ` +
        `(winner: ${breakdown.winner}, goalDiff: ${breakdown.goalDiff}, exactScore: ${breakdown.exactScore})`
    );
  }
}

/**
 * Aggregates all leaderboard entries per AI model,
 * sorted by total points descending.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  const entries = await prisma.leaderboardEntry.findMany();

  const rows = new Map<string, LeaderboardRow>();
  for (const entry of entries) {
    let row = rows.get(entry.aiModel);
    if (!row) {
      row = {
        aiModel: entry.aiModel,
        totalPoints: 0,
        matchesPredicted: 0,
        perfectPredictions: 0,
        winnerCorrect: 0,
      };
      rows.set(entry.aiModel, row);
    }

    const breakdown: ScoreBreakdown = JSON.parse(entry.breakdown);
    row.totalPoints += entry.pointsEarned;
    row.matchesPredicted += 1;
    if (breakdown.exactScore) row.perfectPredictions += 1;
    if (breakdown.winner) row.winnerCorrect += 1;
  }

  return Array.from(rows.values()).sort(
    (a, b) => b.totalPoints - a.totalPoints
  );
}
