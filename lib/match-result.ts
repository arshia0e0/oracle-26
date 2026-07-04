// Helpers for reading a match result that may have been decided on penalties.
//
// homeScore/awayScore hold the score at the end of play (regulation + extra
// time), EXCLUDING any shootout; home/awayPenalties hold the shootout score
// and are non-null only when the tie went to penalties. These helpers give the
// UI and scoring one place to answer "who actually won?" and "what shootout?".

export type Side = "HOME" | "AWAY" | "DRAW";

interface ResultLike {
  homeScore: number | null;
  awayScore: number | null;
  homePenalties: number | null;
  awayPenalties: number | null;
}

/** Was this tie decided by a penalty shootout? */
export function wentToPenalties(m: ResultLike): boolean {
  return m.homePenalties != null && m.awayPenalties != null;
}

/**
 * Who won, accounting for a shootout: when a knockout tie is level after extra
 * time the penalties decide it. Falls back to the scoreline otherwise, which
 * can legitimately be a draw (group stage).
 */
export function matchWinner(m: ResultLike): Side {
  if (wentToPenalties(m)) {
    return (m.homePenalties ?? 0) > (m.awayPenalties ?? 0) ? "HOME" : "AWAY";
  }
  const h = m.homeScore ?? 0;
  const a = m.awayScore ?? 0;
  if (h > a) return "HOME";
  if (a > h) return "AWAY";
  return "DRAW";
}

/** e.g. "4–2 pens", or null when the tie didn't go to a shootout. */
export function penaltiesLabel(m: ResultLike): string | null {
  if (!wentToPenalties(m)) return null;
  return `${m.homePenalties}–${m.awayPenalties} pens`;
}
