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

function sideCells(
  matches: MatchWithDetails[],
  stage: string,
  perSide: number
): { left: Cell[]; right: Cell[] } {
  const all = matches
    .filter((m) => m.stage === stage)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const left: Cell[] = [];
  const right: Cell[] = [];
  for (let i = 0; i < perSide; i++) left.push(all[i] ?? null);
  for (let i = 0; i < perSide; i++) right.push(all[perSide + i] ?? null);
  return { left, right };
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
      {showFlag && (
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
  const showFlags = stage === "ROUND_OF_32";
  return (
    <div className={"kb-round kb-round--" + stage.toLowerCase()}>
      {cells.map((m, i) => (
        <div className="kb-slot" key={m ? m.id : `tbd-${stage}-${side}-${i}`}>
          <Tie m={m} showFlags={showFlags} flip={side === "right" && showFlags} />
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
            <Tie m={finalMatch} />
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
