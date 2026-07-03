// The official FIFA 2026 knockout bracket, keyed by football-data.org match
// ids. The API carries no bracket linkage — an undecided side is just null —
// and it can lag a day or more behind a finished feeder match before filling
// in who advanced. This map lets sync advance winners locally the moment the
// feeder result lands.
//
// Structure was cross-checked against the pairings the API had already filled
// in (e.g. Paraguay v France = winners of Germany-Paraguay and France-Sweden)
// plus the official schedule (FIFA match numbers 73-104). The two July 7
// round-of-16 ids are told apart by kickoff time: 16:00 UTC is noon in
// Atlanta (match 95), 20:00 UTC is 1pm in Vancouver (match 96).

import type { ApiMatch } from "./football-api";

export interface Feeder {
  match: number; // football-data.org id of the feeder match
  take: "winner" | "loser";
}

export interface BracketSlot {
  home: Feeder;
  away: Feeder;
}

const W = (match: number): Feeder => ({ match, take: "winner" });
const L = (match: number): Feeder => ({ match, take: "loser" });

/** nextMatchId -> which feeder matches decide its home and away side. */
export const BRACKET: Record<number, BracketSlot> = {
  // Round of 16 (FIFA matches 89-96)
  537375: { home: W(537415), away: W(537416) }, // M89 = W74 v W77
  537376: { home: W(537417), away: W(537418) }, // M90 = W73 v W75
  537377: { home: W(537423), away: W(537424) }, // M91 = W76 v W78
  537378: { home: W(537425), away: W(537426) }, // M92 = W79 v W80
  537379: { home: W(537419), away: W(537420) }, // M93 = W83 v W84
  537380: { home: W(537421), away: W(537422) }, // M94 = W81 v W82
  537381: { home: W(537427), away: W(537428) }, // M95 = W86 v W88
  537382: { home: W(537429), away: W(537430) }, // M96 = W85 v W87
  // Quarter-finals (FIFA matches 97-100)
  537383: { home: W(537375), away: W(537376) }, // M97 = W89 v W90
  537384: { home: W(537379), away: W(537380) }, // M98 = W93 v W94
  537385: { home: W(537377), away: W(537378) }, // M99 = W91 v W92
  537386: { home: W(537381), away: W(537382) }, // M100 = W95 v W96
  // Semi-finals (FIFA matches 101-102)
  537387: { home: W(537383), away: W(537384) }, // M101 = W97 v W98
  537388: { home: W(537385), away: W(537386) }, // M102 = W99 v W100
  // Third place & final
  537389: { home: L(537387), away: L(537388) }, // M103
  537390: { home: W(537387), away: W(537388) }, // M104
};

/**
 * The team id a feeder sends forward, or null while the feeder is unplayed
 * (or, for penalty draws the API hasn't resolved yet, has no winner field).
 */
export function resolveFeeder(
  feeder: Feeder,
  apiById: Map<number, ApiMatch>
): number | null {
  const api = apiById.get(feeder.match);
  if (!api) return null;
  if (api.status !== "FINISHED" && api.status !== "AWARDED") return null;
  // score.winner covers extra time and penalty shootouts, unlike fullTime.
  const winner = api.score.winner;
  if (winner !== "HOME_TEAM" && winner !== "AWAY_TEAM") return null;
  const homeAdvances = (winner === "HOME_TEAM") === (feeder.take === "winner");
  return homeAdvances ? api.homeTeam.id : api.awayTeam.id;
}
