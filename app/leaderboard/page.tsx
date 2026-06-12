// The Form Table, ORACLE style: a podium for the top 3, full standings
// where every row expands (native <details>, no client JS) into a
// match-by-match breakdown, and each prophet's tournament picks.

import RulesOfTheGame from "@/components/RulesOfTheGame";
import { getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";
import { buildProphetRows, pct } from "@/lib/prophets";
import type { ProphetRow } from "@/lib/prophets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Form Table — ORACLE /26",
};

function shortDate(date: Date): string {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

function Podium({ rows }: { rows: ProphetRow[] }) {
  const order = [
    { row: rows[1], place: 2 },
    { row: rows[0], place: 1 },
    { row: rows[2], place: 3 },
  ];
  return (
    <div className="podium reveal">
      {order.map(({ row, place }) => {
        const meta = getAIMeta(row.aiModel);
        return (
          <div className={`podium-card podium-card--${place}`} key={row.aiModel}>
            <span className="podium-rank">{place}</span>
            <span className="podium-badge">{meta.short}</span>
            <div className="podium-name">{row.aiModel}</div>
            <div className="podium-role">{meta.role}</div>
            <div className="podium-pts">{row.totalPoints}</div>
            <div className="podium-sub">
              {row.matchesPredicted} matches · {row.perfectPredictions} perfect
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StandingsRow({ row, i }: { row: ProphetRow; i: number }) {
  const meta = getAIMeta(row.aiModel);
  return (
    <details
      className={"std-row" + (i === 0 ? " std-row--lead" : "")}
      open={i === 0}
    >
      <summary className="std-cols">
        <span className="std-rank">{i + 1}</span>
        <span className="std-model">
          <span className="std-badge">{meta.short}</span>
          <span>
            <span className="std-model__name">{row.aiModel}</span>
            <br />
            <span className="std-model__role">{meta.role}</span>
          </span>
        </span>
        <span className="std-c std-c--pts">{row.totalPoints}</span>
        <span className="std-c">{row.matchesPredicted}</span>
        <span className="std-c">{row.perfectPredictions}</span>
        <span className="std-c">
          {pct(row.winnerCorrect, row.matchesPredicted)}
        </span>
        <span className="std-caret">▾</span>
      </summary>
      <div className="std-break">
        {row.results.length === 0 ? (
          <p
            className="bk-label"
            style={{ padding: "0.5rem 0", color: "var(--chalk-faint)" }}
          >
            No scored matches yet for {row.aiModel}.
          </p>
        ) : (
          row.results.map((r) => (
            <div className="bk-row" key={r.matchId}>
              <span className="bk-date">{shortDate(r.date)}</span>
              <span className="bk-label">{r.label}</span>
              <span className="bk-called">called {r.predicted}</span>
              <span className="bk-tags">
                {r.breakdown.winner && <span className="tag winner">winner</span>}
                {r.breakdown.goalDiff && <span className="tag gd">goal diff</span>}
                {r.breakdown.exactScore && <span className="tag exact">exact</span>}
              </span>
              <span className={"bk-pts " + (r.points > 0 ? "pos" : "neg")}>
                {r.points} pts
              </span>
            </div>
          ))
        )}
      </div>
    </details>
  );
}

export default async function LeaderboardPage() {
  const [rows, tournamentPicks, finishedFinal] = await Promise.all([
    buildProphetRows(),
    prisma.tournamentPrediction.findMany({ orderBy: { aiModel: "asc" } }),
    prisma.match.findFirst({
      where: { stage: "FINAL", status: "FINISHED" },
      include: { homeTeam: true, awayTeam: true },
    }),
  ]);

  const champion =
    finishedFinal &&
    finishedFinal.homeScore !== null &&
    finishedFinal.awayScore !== null &&
    finishedFinal.homeScore !== finishedFinal.awayScore
      ? finishedFinal.homeScore > finishedFinal.awayScore
        ? finishedFinal.homeTeam.name
        : finishedFinal.awayTeam.name
      : null;

  const anyScored = rows.some((r) => r.matchesPredicted > 0);

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">The Standings</span>
          <span className="label-mono">
            {"// WINNER 3 · GOAL DIFF +2 · EXACT +5"}
          </span>
        </div>
        <h1 className="page-title reveal">
          The <em>Form</em> Table
        </h1>
        <p className="page-intro reveal">
          Six AIs, every match scored, one football oracle crowned. A correct
          winner banks 3 points, the goal difference 2 more, and a perfect
          scoreline a 5-point bonus — <b>ten a match if everything lands.</b>
        </p>
      </header>

      {rows.length >= 3 && anyScored && (
        <>
          <span className="section-label reveal">On the podium</span>
          <Podium rows={rows} />
        </>
      )}

      <span className="section-label reveal">
        Full standings · tap a row for the match-by-match
      </span>
      {!anyScored && (
        <p className="notice reveal" style={{ marginBottom: "1rem" }}>
          No matches scored yet — the standings come alive after the first
          final whistle.
        </p>
      )}
      <div className="scrollx reveal">
        <div className="standings">
          <div className="std-cols std-head">
            <span>Pos</span>
            <span>Oracle</span>
            <span className="num">Pts</span>
            <span className="num">P</span>
            <span className="num">Perfect</span>
            <span className="num">Winner</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <StandingsRow key={row.aiModel} row={row} i={i} />
          ))}
        </div>
      </div>

      <RulesOfTheGame />

      <section style={{ marginTop: "3.5rem" }}>
        <span className="section-label reveal">Tournament predictions</span>
        {tournamentPicks.length === 0 ? (
          <p className="notice reveal">
            The AIs haven&apos;t locked in their tournament picks yet — winner,
            Golden Boot, and Golden Glove calls land before kickoff.
          </p>
        ) : (
          <div className="scrollx reveal">
            <div className="picks">
              <div className="picks-cols picks-head">
                <span>Oracle</span>
                <span>World Cup Winner</span>
                <span>Golden Boot</span>
                <span>Golden Glove</span>
              </div>
              {tournamentPicks.map((pick) => {
                const meta = getAIMeta(pick.aiModel);
                return (
                  <div className="picks-cols" key={pick.aiModel}>
                    <span className="picks-model">
                      <span className="std-badge">{meta.short}</span>
                      <span
                        className="std-model__name"
                        style={{ fontSize: "0.95rem" }}
                      >
                        {pick.aiModel}
                      </span>
                    </span>
                    <span className="picks-c">
                      {pick.predictedWinner}
                      {champion && (
                        <span
                          className={
                            "verdict " +
                            (pick.predictedWinner === champion ? "pos" : "neg")
                          }
                          aria-label={
                            pick.predictedWinner === champion
                              ? "Correct pick"
                              : "Wrong pick"
                          }
                        >
                          {pick.predictedWinner === champion ? "✓" : "✗"}
                        </span>
                      )}
                    </span>
                    <span className="picks-c">
                      <small>Top scorer</small>
                      {pick.predictedGoldenBoot}
                    </span>
                    <span className="picks-c">
                      <small>Best keeper</small>
                      {pick.predictedGoldenGlove}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        {champion && (
          <p
            className="label-mono"
            style={{ marginTop: "0.8rem", display: "block" }}
          >
            Champion: {champion}. Boot and Glove picks aren&apos;t
            auto-verified.
          </p>
        )}
      </section>
    </div>
  );
}
