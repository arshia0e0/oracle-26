// Thin client for the football-data.org API v4.
// Requires FOOTBALL_DATA_API_KEY in .env (sent as the X-Auth-Token header).

const BASE_URL = "https://api.football-data.org/v4";
const COMPETITION_CODE = "WC";

// ---------- API response types ----------

export interface ApiSquadMember {
  id: number;
  name: string;
  position: string | null;
  shirtNumber?: number | null;
  // football-data.org person objects don't document a photo field, but
  // capture one if any of these ever appear in the payload.
  photo?: string | null;
  image?: string | null;
  photoUrl?: string | null;
}

export interface ApiTeam {
  id: number;
  name: string;
  tla: string; // 3-letter code, e.g. "BRA"
  crest: string; // flag/crest image URL
  squad: ApiSquadMember[];
}

export interface ApiTeamRef {
  id: number | null;
  name: string | null;
  tla: string | null;
  crest: string | null;
}

export interface ApiMatch {
  id: number;
  utcDate: string;
  status: string; // SCHEDULED | TIMED | IN_PLAY | PAUSED | FINISHED | ...
  matchday: number | null;
  stage: string; // GROUP_STAGE | LAST_32 | LAST_16 | QUARTER_FINALS | SEMI_FINALS | FINAL | ...
  group: string | null; // e.g. "GROUP_A"
  venue?: string | null;
  homeTeam: ApiTeamRef;
  awayTeam: ApiTeamRef;
  score: {
    // Decides knockout ties even after extra time / penalties, where
    // fullTime alone can't tell you who advanced.
    winner?: "HOME_TEAM" | "AWAY_TEAM" | "DRAW" | null;
    // REGULAR | EXTRA_TIME | PENALTY_SHOOTOUT (only on finished ties).
    duration?: string | null;
    // NOTE: for a PENALTY_SHOOTOUT the API folds the shootout INTO fullTime
    // (fullTime = regularTime + extraTime + penalties, e.g. 1-1 + 4-2 = "5-3").
    // The true match result is regularTime (+ extraTime); the shootout is
    // `penalties`. See resultScore() in lib/sync.ts.
    fullTime: { home: number | null; away: number | null };
    regularTime?: { home: number | null; away: number | null } | null;
    extraTime?: { home: number | null; away: number | null } | null;
    penalties?: { home: number | null; away: number | null } | null;
  };
}

interface TeamsResponse {
  teams: ApiTeam[];
}

interface MatchesResponse {
  matches: ApiMatch[];
}

// ---------- Fetch helpers ----------

function getApiKey(): string {
  const key = process.env.FOOTBALL_DATA_API_KEY;
  if (!key) {
    throw new Error(
      "FOOTBALL_DATA_API_KEY is not set. Add it to your .env file (get a free key at https://www.football-data.org/client/register)."
    );
  }
  return key;
}

async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": getApiKey() },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `football-data.org request failed: ${res.status} ${res.statusText} for ${path}${body ? ` — ${body}` : ""}`
    );
  }
  return (await res.json()) as T;
}

// ---------- Public API ----------

/** All World Cup 2026 matches. */
export async function fetchMatches(): Promise<ApiMatch[]> {
  const data = await apiGet<MatchesResponse>(
    `/competitions/${COMPETITION_CODE}/matches`
  );
  return data.matches;
}

/** All World Cup 2026 teams, including squads. */
export async function fetchTeams(): Promise<ApiTeam[]> {
  const data = await apiGet<TeamsResponse>(
    `/competitions/${COMPETITION_CODE}/teams`
  );
  return data.teams;
}

/** A single match by its football-data.org match ID. */
export async function fetchMatchById(matchId: number): Promise<ApiMatch> {
  return apiGet<ApiMatch>(`/matches/${matchId}`);
}
