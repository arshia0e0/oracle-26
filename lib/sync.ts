// Syncs World Cup 2026 teams, squads, and matches from football-data.org
// into the local SQLite database. Safe to re-run: all writes are upserts.

import { prisma } from "./db";
import {
  fetchMatches,
  fetchTeams,
  type ApiMatch,
  type ApiTeam,
} from "./football-api";

export interface SyncResult {
  teamsSynced: number;
  playersSynced: number;
  matchesSynced: number;
  matchesSkipped: number;
}

// Map football-data.org stage values onto the schema's stage values.
const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "ROUND_OF_32",
  LAST_16: "ROUND_OF_16",
  QUARTER_FINALS: "QUARTER",
  SEMI_FINALS: "SEMI",
  FINAL: "FINAL",
};

function mapStage(stage: string): string {
  return STAGE_MAP[stage] ?? stage;
}

function mapStatus(status: string): string {
  switch (status) {
    case "IN_PLAY":
    case "PAUSED":
    case "SUSPENDED":
      return "LIVE";
    case "FINISHED":
    case "AWARDED":
      return "FINISHED";
    default:
      // SCHEDULED, TIMED, POSTPONED, CANCELLED, ...
      return "SCHEDULED";
  }
}

/** "GROUP_A" -> "A" */
function normalizeGroup(group: string | null): string | null {
  if (!group) return null;
  return group.replace(/^GROUP_/, "");
}

/** Build teamId -> group ("A".."L") from group-stage matches. */
function buildGroupMap(matches: ApiMatch[]): Map<number, string> {
  const groups = new Map<number, string>();
  for (const match of matches) {
    const group = normalizeGroup(match.group);
    if (!group) continue;
    if (match.homeTeam.id != null) groups.set(match.homeTeam.id, group);
    if (match.awayTeam.id != null) groups.set(match.awayTeam.id, group);
  }
  return groups;
}

async function syncTeams(
  teams: ApiTeam[],
  groupMap: Map<number, string>
): Promise<number> {
  let playerCount = 0;

  for (const team of teams) {
    const data = {
      name: team.name,
      code: team.tla ?? "",
      group: groupMap.get(team.id) ?? "TBD",
      flagUrl: team.crest ?? "",
    };
    // Use the football-data.org team ID as our primary key so matches
    // can reference teams directly.
    await prisma.team.upsert({
      where: { id: team.id },
      create: { id: team.id, ...data },
      update: data,
    });

    for (const member of team.squad ?? []) {
      const playerData = {
        name: member.name,
        teamId: team.id,
        position: member.position ?? "Unknown",
        shirtNumber: member.shirtNumber ?? 0,
        photoUrl: member.photo ?? member.image ?? member.photoUrl ?? null,
      };
      await prisma.player.upsert({
        where: { id: member.id },
        create: { id: member.id, ...playerData },
        update: playerData,
      });
      playerCount++;
    }
  }

  return playerCount;
}

async function syncMatches(
  matches: ApiMatch[]
): Promise<{ synced: number; skipped: number }> {
  let synced = 0;
  let skipped = 0;

  for (const match of matches) {
    // Knockout matches without decided participants have null team IDs.
    if (match.homeTeam.id == null || match.awayTeam.id == null) {
      skipped++;
      continue;
    }

    const data = {
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      matchday: match.matchday ?? 0,
      date: new Date(match.utcDate),
      stage: mapStage(match.stage),
      venue: match.venue ?? "",
      status: mapStatus(match.status),
      homeScore: match.score.fullTime.home,
      awayScore: match.score.fullTime.away,
      group: normalizeGroup(match.group),
    };
    await prisma.match.upsert({
      where: { id: match.id },
      create: { id: match.id, ...data },
      update: data,
    });
    synced++;
  }

  return { synced, skipped };
}

/** Fetches everything from football-data.org and upserts it locally. */
export async function syncAll(): Promise<SyncResult> {
  console.log("Fetching data from football-data.org...");
  const [teams, matches] = await Promise.all([fetchTeams(), fetchMatches()]);
  console.log(`Fetched ${teams.length} teams and ${matches.length} matches.`);

  // Group assignments come from the matches feed (the teams endpoint
  // doesn't include them), so compute them before saving teams.
  const groupMap = buildGroupMap(matches);

  const playersSynced = await syncTeams(teams, groupMap);
  console.log(`Synced ${teams.length} teams and ${playersSynced} players.`);

  const { synced, skipped } = await syncMatches(matches);
  console.log(
    `Synced ${synced} matches${skipped ? ` (skipped ${skipped} with undecided teams)` : ""}.`
  );

  return {
    teamsSynced: teams.length,
    playersSynced,
    matchesSynced: synced,
    matchesSkipped: skipped,
  };
}
