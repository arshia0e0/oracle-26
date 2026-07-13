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
import { matchWinner, type Side } from "./match-result";

// Per-match points. The three checks stack, so MATCH_POINTS_MAX is their sum.
export const MATCH_POINTS = {
  winner: 3,
  goalDiff: 2,
  exactScore: 5,
} as const;
export const MATCH_POINTS_MAX =
  MATCH_POINTS.winner + MATCH_POINTS.goalDiff + MATCH_POINTS.exactScore; // 10

// The scoring rule as the UI chrome prints it (ticker, page eyebrows).
export const SCORING_TAGLINE = `WINNER ${MATCH_POINTS.winner} · GOAL DIFF +${MATCH_POINTS.goalDiff} · EXACT +${MATCH_POINTS.exactScore}`;

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

// Canonical form for case-insensitive name comparison; tolerates minor
// punctuation/accent noise in AI-written names (e.g. "Kylian Mbappe" vs
// "Kylian Mbappé"). Exported so the consensus majority vote groups names
// exactly the way scoring compares them.
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/gi, "")
    .trim()
    .toLowerCase();
}

function sameName(a: string, b: string): boolean {
  return normalizeName(a) === normalizeName(b);
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

export interface ActualResult {
  // Score at the end of play (regulation + extra time), excluding penalties.
  home: number;
  away: number;
  // Shootout score; non-null only when the tie was decided on penalties.
  homePenalties: number | null;
  awayPenalties: number | null;
}

export interface PredictedResult {
  home: number;
  away: number;
  // For a predicted draw in a knockout tie, the side the model backed to win
  // the shootout ("HOME" | "AWAY"). Null for decisive scorelines and group
  // draws, where the scoreline itself already implies the winner.
  penaltyWinner: Side | null;
}

// The side a predicted scoreline points to, using the model's shootout pick
// to break a predicted draw when it named one.
function predictedSide(p: PredictedResult): Side {
  if (p.home > p.away) return "HOME";
  if (p.away > p.home) return "AWAY";
  return p.penaltyWinner ?? "DRAW";
}

/**
 * Scores a prediction against a finished result.
 *
 * Goal-difference and exact-score are judged on the actual scoreline the match
 * finished on (regulation + extra time, penalties excluded) — so a 1-1 tie won
 * on penalties still rewards a predicted 1-1 as an exact score. The winner
 * point goes to whoever correctly called who *advanced*: for a shootout that's
 * the penalty winner, matched against the model's own shootout pick when it
 * predicted a draw.
 */
export function scorePrediction(
  actual: ActualResult,
  predicted: PredictedResult
): ScoreBreakdown {
  const actualWinner = matchWinner({
    homeScore: actual.home,
    awayScore: actual.away,
    homePenalties: actual.homePenalties,
    awayPenalties: actual.awayPenalties,
  });
  const winner = predictedSide(predicted) === actualWinner;
  const goalDiff = predicted.home - predicted.away === actual.home - actual.away;
  const exactScore =
    predicted.home === actual.home && predicted.away === actual.away;

  const points =
    (winner ? MATCH_POINTS.winner : 0) +
    (goalDiff ? MATCH_POINTS.goalDiff : 0) +
    (exactScore ? MATCH_POINTS.exactScore : 0);

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
      {
        home: match.homeScore,
        away: match.awayScore,
        homePenalties: match.homePenalties,
        awayPenalties: match.awayPenalties,
      },
      {
        home: prediction.predictedHomeScore,
        away: prediction.predictedAwayScore,
        penaltyWinner:
          (prediction.predictedPenaltyWinner as Side | null) ?? null,
      }
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

    const pens =
      match.homePenalties !== null && match.awayPenalties !== null
        ? ` (${match.homePenalties}-${match.awayPenalties} pens)`
        : "";
    console.log(
      `[${prediction.aiModel}] predicted ${prediction.predictedHomeScore}-${prediction.predictedAwayScore}, actual ${match.homeScore}-${match.awayScore}${pens}: ${breakdown.points} pts ` +
        `(winner: ${breakdown.winner}, goalDiff: ${breakdown.goalDiff}, exactScore: ${breakdown.exactScore})`
    );
  }
}

/**
 * Aggregates all leaderboard entries per AI model,
 * sorted by total points descending.
 */
export async function getLeaderboard(): Promise<LeaderboardRow[]> {
  // NOTE: a `where: { id: { gte: 0 } }` filter here reads STALE on Turso's
  // HTTP libSQL adapter; bare findMany reads current data.
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
