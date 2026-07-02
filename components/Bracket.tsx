// Knockout bracket — the classic two-sided World Cup tree. Round of 32 fans in
// from both outer edges (8 ties a side) through R16 → QF → SF into the Final at
// the dead centre, with the trophy beneath it. Each real tie is an anchor to
// "#match-{id}" so clicking it smooth-scrolls the page down to that match's full
// card. Rounds that aren't seeded yet show TBD nodes so the whole path is
// visible from the first kickoff. Connector lines are pure CSS (see globals).

import type { MatchWithDetails } from "@/components/MatchCard";

// Each knockout round and how many ties live on ONE side of the tree.
const SIDE_ROUNDS = [
  { stage: "ROUND_OF_32", perSide: 8 },
  { stage: "ROUND_OF_16", perSide: 4 },
  { stage: "QUARTER", perSide: 2 },
  { stage: "SEMI", perSide: 1 },
] as const;

type Cell = MatchWithDetails | null;

// Official FIFA 2026 knockout topology, given as football-data.org match ids in
// bracket order — top-to-bottom of the full single-column tree. The two-sided
// layout below takes the first half of each round as the LEFT side and the
// second half as the RIGHT, and consecutive pairs feed the next round. Kickoff
// date does NOT follow the bracket (the feed cross-schedules halves), so the
// order is pinned here; ids not listed fall back to date order, appended last.
// These ids are stable for the WC competition feed and identical in dev.db and
// Turso (both synced from the same source).
const BRACKET_ORDER: Record<number, number> = Object.fromEntries(
  [
    // Round of 32 — left half (rows 1–8) then right half (rows 9–16)
    537417, 537418, 537415, 537416, 537422, 537421, 537420, 537419,
    537423, 537424, 537425, 537426, 537429, 537430, 537428, 537427,
    // Round of 16 — left (rows 1–4) then right (rows 5–8)
    537376, 537375, 537380, 537379, 537377, 537378, 537382, 537381,
    // Quarter-finals (left 2, right 2)
    537383, 537384, 537385, 537386,
    // Semi-finals (left, right)
    537387, 537388,
    // Final
    537390,
  ].map((id, i) => [id, i] as const)
);

// Where each stage's block starts inside BRACKET_ORDER, so a match's rank maps
// to an absolute slot within its stage (rank − base). Matches must land at
// their fixed slot even when neighbouring ties are still undecided and absent
// from the DB — packing present matches sequentially would drag a right-half
// tie into the left column.
const STAGE_BASE: Record<string, number> = {
  ROUND_OF_32: 0,
  ROUND_OF_16: 16,
  QUARTER: 24,
  SEMI: 28,
};

function sideCells(
  matches: MatchWithDetails[],
  stage: string,
  perSide: number
): { left: Cell[]; right: Cell[] } {
  const all = matches.filter((m) => m.stage === stage);
  const cells: Cell[] = new Array(perSide * 2).fill(null);
  const base = STAGE_BASE[stage] ?? 0;

  const unranked: MatchWithDetails[] = [];
  for (const m of all) {
    const rank = BRACKET_ORDER[m.id];
    const slot = rank === undefined ? -1 : rank - base;
    if (slot >= 0 && slot < cells.length && cells[slot] === null) {
      cells[slot] = m;
    } else {
      unranked.push(m);
    }
  }
  // Ids not pinned in BRACKET_ORDER fall into the remaining empty slots by
  // kickoff date, so an unexpected feed id still renders somewhere sensible.
  unranked.sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const m of unranked) {
    const free = cells.indexOf(null);
    if (free === -1) break;
    cells[free] = m;
  }

  return { left: cells.slice(0, perSide), right: cells.slice(perSide) };
}

function TieRow({
  team,
  score,
  win,
  dim,
  showFlag,
}: {
  team: MatchWithDetails["homeTeam"];
  score: number | null;
  win: boolean;
  dim: boolean;
  showFlag: boolean;
}) {
  return (
    <span className={"kbt-row" + (win ? " is-win" : "") + (dim ? " is-dim" : "")}>
      {showFlag && team.flagUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="kbt-flag" src={team.flagUrl} alt="" aria-hidden="true" />
      )}
      <span className="kbt-code">{team.code}</span>
      <span className="kbt-name">{team.name}</span>
      {score !== null && <span className="kbt-score">{score}</span>}
    </span>
  );
}

function Tie({
  m,
  showFlags = false,
  flip = false,
}: {
  m: Cell;
  showFlags?: boolean;
  flip?: boolean;
}) {
  if (!m) {
    return (
      <div className="kbt kbt--tbd" aria-hidden="true">
        <span className="kbt-row">
          <span className="kbt-name">TBD</span>
        </span>
        <span className="kbt-row">
          <span className="kbt-name">TBD</span>
        </span>
      </div>
    );
  }

  const finished = m.status === "FINISHED";
  const live = m.status === "LIVE";
  const homeWin = finished && (m.homeScore ?? 0) > (m.awayScore ?? 0);
  const awayWin = finished && (m.awayScore ?? 0) > (m.homeScore ?? 0);

  return (
    <a
      className={
        "kbt" + (flip ? " kbt--flip" : "") + (live ? " kbt--live" : "")
      }
      href={`#match-${m.id}`}
      title={`${m.homeTeam.name} v ${m.awayTeam.name} — jump to match`}
    >
      {live && <span className="kbt-live" aria-hidden="true" />}
      <TieRow
        team={m.homeTeam}
        score={finished ? m.homeScore : null}
        win={homeWin}
        dim={finished && !homeWin}
        showFlag={showFlags}
      />
      <TieRow
        team={m.awayTeam}
        score={finished ? m.awayScore : null}
        win={awayWin}
        dim={finished && !awayWin}
        showFlag={showFlags}
      />
    </a>
  );
}

function Column({
  stage,
  cells,
  side,
}: {
  stage: string;
  cells: Cell[];
  side: "left" | "right";
}) {
  // Flags on every round now — a side that has advanced past the Round of 32
  // should keep its flag as it moves up the tree.
  return (
    <div className={"kb-round kb-round--" + stage.toLowerCase()}>
      {cells.map((m, i) => (
        <div className="kb-slot" key={m ? m.id : `tbd-${stage}-${side}-${i}`}>
          <Tie m={m} showFlags flip={side === "right"} />
        </div>
      ))}
    </div>
  );
}

export default function Bracket({ matches }: { matches: MatchWithDetails[] }) {
  if (matches.length === 0) return null;

  const splits = SIDE_ROUNDS.map((r) => ({
    ...r,
    ...sideCells(matches, r.stage, r.perSide),
  }));
  const finalMatch =
    matches
      .filter((m) => m.stage === "FINAL")
      .sort((a, b) => a.date.getTime() - b.date.getTime())[0] ?? null;

  return (
    <section className="kb-wrap reveal" aria-label="Knockout bracket">
      <div className="kb">
        <div className="kb-half kb-half--l">
          {splits.map((r) => (
            <Column key={r.stage} stage={r.stage} cells={r.left} side="left" />
          ))}
        </div>

        <div className="kb-center">
          <span className="kb-center__title">Final</span>
          <div className="kb-final">
            <Tie m={finalMatch} showFlags />
          </div>
          <svg
            className="kb-trophy"
            viewBox="0 0 64 96"
            aria-hidden="true"
            role="img"
          >
            <defs>
              <linearGradient id="kbGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f6e08a" />
                <stop offset="0.5" stopColor="#d9a83a" />
                <stop offset="1" stopColor="#9c6f1d" />
              </linearGradient>
            </defs>
            <g fill="url(#kbGold)">
              <path d="M20 6h24c0 22-4 40-12 46C24 46 20 28 20 6z" />
              <path d="M20 10H8c0 12 6 18 14 18v-6c-5 0-8-4-8-12z" />
              <path d="M44 10h12c0 12-6 18-14 18v-6c5 0 8-4 8-12z" />
              <rect x="28" y="50" width="8" height="14" />
              <path d="M18 64h28l-4 10H22z" />
              <rect x="14" y="76" width="36" height="8" rx="1" />
            </g>
          </svg>
          <span className="kb-center__sub">World Cup 2026</span>
        </div>

        <div className="kb-half kb-half--r">
          {[...splits].reverse().map((r) => (
            <Column key={r.stage} stage={r.stage} cells={r.right} side="right" />
          ))}
        </div>
      </div>
    </section>
  );
}
