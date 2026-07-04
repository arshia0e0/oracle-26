// The daily maintenance routine, shared by scripts/daily-update.ts and
// the /api/cron route:
//   1. Sync match results from football-data.org.
//   2. Score finished matches that have no leaderboard entries yet
//      (give the AIs their points first, before the slower predict step).
//   3. Predict upcoming matches that have no predictions yet.

import { upsertConsensusPrediction } from "./consensus";
import { prisma } from "./db";
import type { Side } from "./match-result";
import { buildMatchPrompt, MATCH_AI_MODELS } from "./predictor";
import { normalizeName, scoreMatch } from "./scoring";
import { syncAll, TBD_TEAM_ID } from "./sync";

// Resolves a model's free-text shootout pick to the side it names, or null if
// it doesn't clearly match either team (tolerating accent/punctuation noise).
export function penaltyWinnerSide(
  rawName: string | null,
  homeName: string,
  awayName: string
): Side | null {
  if (!rawName) return null;
  const n = normalizeName(rawName);
  if (n === normalizeName(homeName)) return "HOME";
  if (n === normalizeName(awayName)) return "AWAY";
  return null;
}

export interface DailyUpdateSummary {
  synced: number;
  predicted: number;
  scored: number;
}

/**
 * Predicts SCHEDULED matches that are missing one or more oracle predictions.
 * By default it only looks at matches kicking off within `windowHours` of now;
 * pass `null` to consider every unfinished scheduled match regardless of date.
 *
 * For each match it only calls the oracles that don't already have a prediction
 * stored, so a model that failed transiently on an earlier run (e.g. a provider
 * 503) gets retried and backfilled rather than being skipped forever — a match
 * is no longer skipped just because it already has *some* predictions.
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
      // Skip half-decided knockout ties: an oracle can't call a match whose
      // opponent (the TBD sentinel) isn't known yet.
      homeTeamId: { not: TBD_TEAM_ID },
      awayTeamId: { not: TBD_TEAM_ID },
      ...dateFilter,
    },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      predictions: { select: { aiModel: true } },
    },
    orderBy: { date: "asc" },
  });

  // Keep only matches still missing at least one oracle prediction.
  const matchesNeedingPredictions = matches.filter((match) => {
    const have = new Set(match.predictions.map((p) => p.aiModel));
    return MATCH_AI_MODELS.some((ai) => !have.has(ai.name));
  });
  console.log(
    `${matchesNeedingPredictions.length} upcoming match(es) need predictions.`
  );

  let predicted = 0;
  for (const match of matchesNeedingPredictions) {
    const have = new Set(match.predictions.map((p) => p.aiModel));
    const missing = MATCH_AI_MODELS.filter((ai) => !have.has(ai.name));
    console.log(
      `Predicting ${match.homeTeam.name} vs ${match.awayTeam.name} (${match.date.toISOString()})` +
        ` — ${missing.length} model(s): ${missing.map((ai) => ai.name).join(", ")}`
    );
    const prompt = buildMatchPrompt(
      match,
      match.homeTeam,
      match.awayTeam,
      match.homeTeam.players,
      match.awayTeam.players
    );

    let saved = 0;
    for (const ai of missing) {
      const prediction = await ai.predict(prompt);
      if (!prediction) continue; // errors were already logged by the predictor

      const penaltyWinner = penaltyWinnerSide(
        prediction.penaltyWinner,
        match.homeTeam.name,
        match.awayTeam.name
      );
      await prisma.prediction.create({
        data: {
          aiModel: ai.name,
          matchId: match.id,
          predictedHomeScore: prediction.homeScore,
          predictedAwayScore: prediction.awayScore,
          predictedPenaltyWinner: penaltyWinner,
          reasoning: prediction.reasoning,
          confidence: prediction.confidence,
        },
      });
      saved++;
      const pensNote = penaltyWinner
        ? ` (pens: ${penaltyWinner === "HOME" ? match.homeTeam.name : match.awayTeam.name})`
        : "";
      console.log(
        `[${ai.name}] predicted ${prediction.homeScore}-${prediction.awayScore}${pensNote}`
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
  // Score first so the AIs get their points for freshly finished matches even
  // if the slower, API-heavy predict step errors out partway through.
  const scored = await scoreFinishedMatches();
  const predicted = await predictUpcomingMatches(predictWindowHours);

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
