// Syncs World Cup 2026 teams, squads, and matches from football-data.org
// into the local SQLite database. Safe to re-run: all writes are upserts.

import { BRACKET, resolveFeeder } from "./bracket";
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
  teamsAdvanced: number;
}

// Sentinel "to-be-decided" team. A knockout tie often has one side known
// (the winner of an already-played match) while the other is still pending.
// football-data.org reports the unknown side with a null team id. Rather than
// dropping the whole match — which would hide a team that has *already*
// advanced — we store it with this placeholder on the undecided side. Its id
// is 0, which never collides with a real football-data.org team id, and it is
// excluded from squad listings and the predict step.
export const TBD_TEAM_ID = 0;

async function ensureTbdTeam(): Promise<void> {
  const data = { name: "TBD", code: "TBD", group: "TBD", flagUrl: "" };
  await prisma.team.upsert({
    where: { id: TBD_TEAM_ID },
    create: { id: TBD_TEAM_ID, ...data },
    update: data,
  });
}

// Map football-data.org stage values onto the schema's stage values.
const STAGE_MAP: Record<string, string> = {
  GROUP_STAGE: "GROUP",
  LAST_32: "ROUND_OF_32",
  LAST_16: "ROUND_OF_16",
  QUARTER_FINALS: "QUARTER",
  SEMI_FINALS: "SEMI",
  THIRD_PLACE: "THIRD_PLACE",
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
    // Knockout matches without decided participants have null team IDs. Keep a
    // tie as soon as *one* side is known (a team that has advanced) and stand
    // the TBD sentinel in for the pending side; only skip when both are unknown.
    if (match.homeTeam.id == null && match.awayTeam.id == null) {
      skipped++;
      continue;
    }

    const data = {
      homeTeamId: match.homeTeam.id ?? TBD_TEAM_ID,
      awayTeamId: match.awayTeam.id ?? TBD_TEAM_ID,
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
      update: {
        ...data,
        // Never demote a side back to TBD: a null from the API may be a team
        // we've already advanced locally through the bracket.
        homeTeamId: match.homeTeam.id ?? undefined,
        awayTeamId: match.awayTeam.id ?? undefined,
      },
    });
    synced++;
  }

  return { synced, skipped };
}

/**
 * Advances knockout winners into their next-round match ahead of the API.
 * For every bracket slot whose feeder match has FINISHED, the advancing
 * team is written into the corresponding side of the next match — but only
 * onto sides the API still reports as undecided (locally that side is either
 * the TBD sentinel or the match row doesn't exist yet because both sides
 * were unknown at sync time). API-provided team ids always win.
 * Returns the number of team slots filled in.
 */
async function advanceKnockoutWinners(matches: ApiMatch[]): Promise<number> {
  const apiById = new Map(matches.map((m) => [m.id, m]));
  let advanced = 0;

  for (const [id, slot] of Object.entries(BRACKET)) {
    const nextId = Number(id);
    const homeId = resolveFeeder(slot.home, apiById);
    const awayId = resolveFeeder(slot.away, apiById);
    if (homeId == null && awayId == null) continue;

    const existing = await prisma.match.findUnique({
      where: { id: nextId },
      select: { homeTeamId: true, awayTeamId: true },
    });

    let filledHome = false;
    let filledAway = false;
    if (existing) {
      const data: { homeTeamId?: number; awayTeamId?: number } = {};
      if (homeId != null && existing.homeTeamId === TBD_TEAM_ID) {
        data.homeTeamId = homeId;
        filledHome = true;
      }
      if (awayId != null && existing.awayTeamId === TBD_TEAM_ID) {
        data.awayTeamId = awayId;
        filledAway = true;
      }
      if (!filledHome && !filledAway) continue;
      await prisma.match.update({ where: { id: nextId }, data });
    } else {
      // The row was skipped by syncMatches (both sides unknown to the API),
      // so create it now from the API's schedule data.
      const apiNext = apiById.get(nextId);
      if (!apiNext) continue;
      await prisma.match.create({
        data: {
          id: nextId,
          homeTeamId: homeId ?? TBD_TEAM_ID,
          awayTeamId: awayId ?? TBD_TEAM_ID,
          matchday: apiNext.matchday ?? 0,
          date: new Date(apiNext.utcDate),
          stage: mapStage(apiNext.stage),
          venue: apiNext.venue ?? "",
          status: mapStatus(apiNext.status),
          homeScore: apiNext.score.fullTime.home,
          awayScore: apiNext.score.fullTime.away,
          group: normalizeGroup(apiNext.group),
        },
      });
      filledHome = homeId != null;
      filledAway = awayId != null;
    }

    for (const [filled, teamId, side] of [
      [filledHome, homeId, "home"],
      [filledAway, awayId, "away"],
    ] as const) {
      if (!filled || teamId == null) continue;
      const team = await prisma.team.findUnique({
        where: { id: teamId },
        select: { name: true },
      });
      console.log(
        `Advanced ${team?.name ?? teamId} into match ${nextId} (${side})`
      );
      advanced++;
    }
  }

  return advanced;
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

  // The TBD placeholder must exist before any half-decided knockout tie that
  // references it on its pending side.
  await ensureTbdTeam();

  const { synced, skipped } = await syncMatches(matches);
  console.log(
    `Synced ${synced} matches${skipped ? ` (skipped ${skipped} with undecided teams)` : ""}.`
  );

  // Move winners forward in the bracket before the predict step runs, so a
  // newly-decided tie gets its predictions in the same pass.
  const teamsAdvanced = await advanceKnockoutWinners(matches);
  if (teamsAdvanced > 0) {
    console.log(`Advanced ${teamsAdvanced} team(s) in the knockout bracket.`);
  }

  return {
    teamsSynced: teams.length,
    playersSynced,
    matchesSynced: synced,
    matchesSkipped: skipped,
    teamsAdvanced,
  };
}
