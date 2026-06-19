// The daily maintenance routine, shared by scripts/daily-update.ts and
// the /api/cron route:
//   1. Sync match results from football-data.org.
//   2. Predict upcoming matches (next 48h) that have no predictions yet.
//   3. Score finished matches that have no leaderboard entries yet.

import { upsertConsensusPrediction } from "./consensus";
import { prisma } from "./db";
import { buildMatchPrompt, MATCH_AI_MODELS } from "./predictor";
import { scoreMatch } from "./scoring";
import { syncAll } from "./sync";

export interface DailyUpdateSummary {
  synced: number;
  predicted: number;
  scored: number;
}

/**
 * Predicts SCHEDULED matches that have no predictions yet. By default it
 * only looks at matches kicking off within `windowHours` of now; pass
 * `null` to predict every unpredicted scheduled match regardless of date.
 * Returns the number of matches that received at least one new prediction.
 */
async function predictUpcomingMatches(
  windowHours: number | null = 48
): Promise<number> {
  const now = new Date();
  const dateFilter =
    windowHours === null
      ? {}
      : {
          date: {
            gte: now,
            lte: new Date(now.getTime() + windowHours * 60 * 60 * 1000),
          },
        };
  const matches = await prisma.match.findMany({
    where: {
      status: "SCHEDULED",
      ...dateFilter,
      predictions: { none: {} },
    },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
    },
    orderBy: { date: "asc" },
  });
  console.log(`${matches.length} upcoming match(es) need predictions.`);

  let predicted = 0;
  for (const match of matches) {
    console.log(
      `Predicting ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.date.toISOString()})`
    );
    const prompt = buildMatchPrompt(
      match,
      match.homeTeam,
      match.awayTeam,
      match.homeTeam.players,
      match.awayTeam.players
    );

    let saved = 0;
    for (const ai of MATCH_AI_MODELS) {
      const prediction = await ai.predict(prompt);
      if (!prediction) continue; // errors were already logged by the predictor

      await prisma.prediction.create({
        data: {
          aiModel: ai.name,
          matchId: match.id,
          predictedHomeScore: prediction.homeScore,
          predictedAwayScore: prediction.awayScore,
          reasoning: prediction.reasoning,
          confidence: prediction.confidence,
        },
      });
      saved++;
      console.log(
        `[${ai.name}] predicted ${prediction.homeScore}-${prediction.awayScore}`
      );
    }
    if (saved > 0) {
      // The ensemble row: average of every model that answered for this match.
      await upsertConsensusPrediction(match.id);
      predicted++;
    }
  }

  return predicted;
}

/**
 * Scores every FINISHED match that has predictions but no leaderboard
 * entries yet. Returns the number of matches scored.
 */
async function scoreFinishedMatches(): Promise<number> {
  const matches = await prisma.match.findMany({
    where: {
      status: "FINISHED",
      predictions: { some: {} },
      leaderboardEntries: { none: {} },
    },
    select: { id: true },
    orderBy: { date: "asc" },
  });
  console.log(`${matches.length} finished match(es) need scoring.`);

  let scored = 0;
  for (const match of matches) {
    try {
      await scoreMatch(match.id);
      scored++;
    } catch (err) {
      // Don't let one bad match (e.g. missing final score) stop the rest.
      console.error(
        `Failed to score match ${match.id}:`,
        err instanceof Error ? err.message : err
      );
    }
  }

  return scored;
}

export interface RunDailyUpdateOptions {
  /**
   * How far ahead to look for matches needing predictions, in hours.
   * Defaults to 48. Pass `null` to predict every unpredicted scheduled
   * match regardless of when it kicks off.
   */
  predictWindowHours?: number | null;
}

export async function runDailyUpdate(
  options: RunDailyUpdateOptions = {}
): Promise<DailyUpdateSummary> {
  const { predictWindowHours = 48 } = options;
  const sync = await syncAll();
  const predicted = await predictUpcomingMatches(predictWindowHours);
  const scored = await scoreFinishedMatches();

  const summary: DailyUpdateSummary = {
    synced: sync.matchesSynced,
    predicted,
    scored,
  };
  console.log(
    `Synced ${summary.synced} matches. Made predictions for ${summary.predicted} matches. Scored ${summary.scored} matches.`
  );
  return summary;
}
