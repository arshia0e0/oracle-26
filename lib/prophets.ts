// Aggregated per-AI stats with a match-by-match history, shared by the
// homepage stickers, The Prophets page, and the Form Table. Built from
// LeaderboardEntry rows (one per AI per scored match).

import { AI_META } from "./ai-meta";
import { prisma } from "./db";
import type { ScoreBreakdown } from "./scoring";

export interface ProphetResult {
  matchId: number;
  date: Date;
  label: string; // "Mexico 2–1 South Africa"
  predicted: string; // "1–1"
  points: number;
  breakdown: ScoreBreakdown;
}

export interface ProphetRow {
  aiModel: string;
  totalPoints: number;
  matchesPredicted: number;
  perfectPredictions: number;
  winnerCorrect: number;
  results: ProphetResult[]; // ordered by match date ascending
  /** Last 5 scored matches, oldest first: w = exact, d = scored, l = blank */
  form: ("w" | "d" | "l")[];
}

export function pct(part: number, total: number): string {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)}%`;
}

export function avg(points: number, total: number): string {
  return total === 0 ? "—" : (points / total).toFixed(1);
}

export async function buildProphetRows(): Promise<ProphetRow[]> {
  // Turso serves *unfiltered* autocommit full-table reads from an edge replica
  // that can lag behind freshly-synced writes. Interactive $transaction()
  // callbacks throw under Vercel's serverless runtime with the HTTP libSQL
  // adapter, so instead we carry a harmless always-true `where` clause: a
  // filtered read routes to the primary and stays current without a tx.
  const entries = await prisma.leaderboardEntry.findMany({
    where: { id: { gte: 0 } },
    include: { match: { include: { homeTeam: true, awayTeam: true } } },
    orderBy: { match: { date: "asc" } },
  });
  const predictions = await prisma.prediction.findMany({
    where: { id: { gte: 0 } },
  });

  const predictionByKey = new Map(
    predictions.map((p) => [
      `${p.aiModel}:${p.matchId}`,
      `${p.predictedHomeScore}–${p.predictedAwayScore}`,
    ])
  );

  // Seed with every contestant so the table is complete even before
  // the first match is scored.
  const rows = new Map<string, ProphetRow>(
    AI_META.map((ai) => [
      ai.name,
      {
        aiModel: ai.name,
        totalPoints: 0,
        matchesPredicted: 0,
        perfectPredictions: 0,
        winnerCorrect: 0,
        results: [],
        form: [],
      },
    ])
  );

  for (const entry of entries) {
    let row = rows.get(entry.aiModel);
    if (!row) {
      row = {
        aiModel: entry.aiModel,
        totalPoints: 0,
        matchesPredicted: 0,
        perfectPredictions: 0,
        winnerCorrect: 0,
        results: [],
        form: [],
      };
      rows.set(entry.aiModel, row);
    }

    const breakdown: ScoreBreakdown = JSON.parse(entry.breakdown);
    row.totalPoints += entry.pointsEarned;
    row.matchesPredicted += 1;
    if (breakdown.exactScore) row.perfectPredictions += 1;
    if (breakdown.winner) row.winnerCorrect += 1;
    row.results.push({
      matchId: entry.matchId,
      date: entry.match.date,
      label: `${entry.match.homeTeam.name} ${entry.match.homeScore ?? "?"}–${
        entry.match.awayScore ?? "?"
      } ${entry.match.awayTeam.name}`,
      predicted:
        predictionByKey.get(`${entry.aiModel}:${entry.matchId}`) ?? "?",
      points: entry.pointsEarned,
      breakdown,
    });
  }

  for (const row of Array.from(rows.values())) {
    row.form = row.results
      .slice(-5)
      .map((r) =>
        r.breakdown.exactScore ? "w" : r.points > 0 ? "d" : "l"
      );
  }

  return Array.from(rows.values()).sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      b.perfectPredictions - a.perfectPredictions ||
      a.aiModel.localeCompare(b.aiModel)
  );
}
