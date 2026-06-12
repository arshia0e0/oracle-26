// Fuzzy player-name matcher for the Prophets page.
//
// Problem: AI predictions store player names as the model wrote them (e.g.
// "Vinícius Jr.") which may differ from the canonical DB row ("Vinicius Junior")
// due to accents, punctuation, abbreviations, or middle-name omissions.
// A plain Prisma `name: { in: [...] }` exact-match silently drops these.
//
// This module resolves a picked name against a list of candidate Player rows
// using token-level fuzzy matching:
//   1. Strip accent diacritics (NFD + remove combining chars)
//   2. Strip punctuation, lowercase
//   3. Expand common suffix abbreviations: jr→junior, sr→senior
//   4. Require every token of the SHORTER name to appear in the LONGER name
//      (handles omitted middle names and abbreviations simultaneously)
//
// Scoring returns null for genuinely unmatchable names so the card degrades
// gracefully to initials — the same behaviour as before for unknown players.

const ABBREV_MAP: Record<string, string> = {
  jr: "junior",
  sr: "senior",
  jr2: "junior", // just in case "jr." remains after punctuation strip
};

function tokenize(name: string): string[] {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "") // strip punctuation
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => ABBREV_MAP[t] ?? t);
}

export type CandidatePlayer = {
  name: string;
  team: { name: string; flagUrl: string | null } | null;
};

/**
 * Given a name as stored in a TournamentPrediction row, find the best
 * matching Player from `candidates`. Returns null if no match is found.
 *
 * Matching rule: every token of the shorter tokenized form must appear
 * in the longer one (after accent-strip + abbrev-expand).
 *
 * To avoid false positives (e.g. "Messi" matching "Lionel Messi" AND
 * "Leo Messi"), when multiple candidates match we prefer the one whose
 * token count is closest to the pick's token count. Ties keep first.
 */
export function resolvePlayerName(
  pickName: string,
  candidates: CandidatePlayer[]
): CandidatePlayer | null {
  const pickTokens = tokenize(pickName);
  if (pickTokens.length === 0) return null;

  let best: CandidatePlayer | null = null;
  let bestDiff = Infinity;

  for (const candidate of candidates) {
    const dbTokens = tokenize(candidate.name);
    if (dbTokens.length === 0) continue;

    const shorter = pickTokens.length <= dbTokens.length ? pickTokens : dbTokens;
    const longer = pickTokens.length <= dbTokens.length ? dbTokens : pickTokens;

    if (shorter.every((t) => longer.includes(t))) {
      const diff = Math.abs(pickTokens.length - dbTokens.length);
      if (diff < bestDiff) {
        bestDiff = diff;
        best = candidate;
      }
    }
  }

  return best;
}

/**
 * Build a lookup map: normalised-pick-name → CandidatePlayer.
 * Call once per page render with all pick names and all candidate players.
 */
export function buildPlayerResolutionMap(
  pickNames: string[],
  candidates: CandidatePlayer[]
): Map<string, CandidatePlayer> {
  const map = new Map<string, CandidatePlayer>();
  for (const pick of pickNames) {
    const resolved = resolvePlayerName(pick, candidates);
    if (resolved) {
      map.set(pick, resolved);
    }
  }
  return map;
}
