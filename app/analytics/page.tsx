// The Lab: the analytical view of the league. A stat band, the headline
// crowd-vs-mind duel, ranked accuracy and points charts (with model badges),
// and a confidence-calibration chart. Pure server-rendered CSS/SVG.

import Link from "next/link";
import CountUp from "@/components/CountUp";
import { CONSENSUS_MODEL_NAME, getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";
import { buildProphetRows } from "@/lib/prophets";
import type { ProphetRow } from "@/lib/prophets";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Lab — ORACLE /26",
};

function pctNum(part: number, total: number): number {
  return total === 0 ? 0 : (part / total) * 100;
}

interface BarItem {
  name: string;
  pct: number; // 0–100 bar width
  label: string; // formatted value
}

function RankedBars({ items }: { items: BarItem[] }) {
  return (
    <div className="chart">
      {items.map((it, i) => {
        const meta = getAIMeta(it.name);
        return (
          <div
            className={"bar-row" + (i === 0 ? " is-leader" : "")}
            key={it.name}
          >
            <span className="bar-row__rank">{i + 1}</span>
            {/* Monogram is decorative — the full name sits right beside it. */}
            <span className="bar-row__badge" title={it.name} aria-hidden="true">
              {meta.short}
            </span>
            <span className="bar-row__name">{it.name}</span>
            <span className="bar-row__track">
              <span className="bar-row__fill" style={{ width: `${it.pct}%` }} />
            </span>
            <span className="bar-row__val data">{it.label}</span>
          </div>
        );
      })}
    </div>
  );
}

interface CalibBucket {
  lo: number;
  hi: number;
  n: number;
  hits: number;
}

export default async function AnalyticsPage() {
  const [rows, predictions, entries] = await Promise.all([
    buildProphetRows(),
    prisma.prediction.findMany(),
    prisma.leaderboardEntry.findMany(),
  ]);

  const scored = rows.filter((r) => r.matchesPredicted > 0);
  const anyScored = scored.length > 0;

  const byWinAcc = [...scored].sort(
    (a, b) =>
      pctNum(b.winnerCorrect, b.matchesPredicted) -
      pctNum(a.winnerCorrect, a.matchesPredicted)
  );
  const byAvg = [...scored].sort(
    (a, b) =>
      b.totalPoints / b.matchesPredicted - a.totalPoints / a.matchesPredicted
  );
  const maxAvg = Math.max(
    1,
    ...scored.map((r) => r.totalPoints / r.matchesPredicted)
  );

  const winAccItems: BarItem[] = byWinAcc.map((r) => {
    const v = pctNum(r.winnerCorrect, r.matchesPredicted);
    return { name: r.aiModel, pct: v, label: `${Math.round(v)}%` };
  });
  const avgItems: BarItem[] = byAvg.map((r) => {
    const v = r.totalPoints / r.matchesPredicted;
    return { name: r.aiModel, pct: (v / maxAvg) * 100, label: v.toFixed(1) };
  });

  // Consensus vs. the sharpest single model.
  const consensus = rows.find((r) => r.aiModel === CONSENSUS_MODEL_NAME);
  const bestSingle = scored
    .filter((r) => r.aiModel !== CONSENSUS_MODEL_NAME)
    .sort((a, b) => b.totalPoints - a.totalPoints)[0] as ProphetRow | undefined;

  // Calibration: confidence buckets vs. real hit-rate.
  const pointsByKey = new Map(
    entries.map((e) => [`${e.aiModel}:${e.matchId}`, e.pointsEarned])
  );
  const ranges: [number, number][] = [
    [0, 20],
    [20, 40],
    [40, 60],
    [60, 80],
    [80, 101],
  ];
  const calib: CalibBucket[] = ranges.map(([lo, hi]) => ({ lo, hi, n: 0, hits: 0 }));
  for (const p of predictions) {
    if (p.confidence === null) continue;
    const pts = pointsByKey.get(`${p.aiModel}:${p.matchId}`);
    if (pts === undefined) continue;
    const bucket = calib.find((b) => p.confidence! >= b.lo && p.confidence! < b.hi);
    if (!bucket) continue;
    bucket.n += 1;
    if (pts > 0) bucket.hits += 1;
  }
  const haveCalib = calib.some((b) => b.n > 0);

  // Stat-band headline numbers.
  const matchesScored = Math.max(0, ...scored.map((r) => r.matchesPredicted));
  const totalExact = scored.reduce((s, r) => s + r.perfectPredictions, 0);
  const accLeader = byWinAcc[0];

  // `scored` includes the Oracle Consensus row, so this counts contenders
  // (up to 7 = six models + the consensus), not independent models.
  const band: { num: string | number; label: string; title?: string }[] = [
    { num: scored.length, label: "Contenders Ranked" },
    { num: matchesScored, label: "Matches Scored" },
    { num: totalExact, label: "Exact Scores" },
    {
      num: accLeader ? getAIMeta(accLeader.aiModel).short : "—",
      label: "Accuracy Leader",
      title: accLeader ? accLeader.aiModel : undefined,
    },
  ];

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">The Lab</span>
          <span className="label-mono">{"// MODELS UNDER THE MICROSCOPE"}</span>
        </div>
        <h1 className="page-title reveal">
          The <em>Numbers</em>
        </h1>
        <p className="page-intro reveal">
          Points crown a winner, but the data tells the deeper story — who
          actually reads the game, who just rides the favourites, and whether
          the wisdom of the crowd beats the cleverest single mind. Every
          number here is computed exactly as described in the{" "}
          <Link href="/methodology" className="rules-link">
            methodology
          </Link>
          .
        </p>
      </header>

      {!anyScored ? (
        <p className="notice reveal">
          No matches scored yet — the charts come alive after the first final
          whistle.
        </p>
      ) : (
        <>
          <div className="prophet-band reveal">
            {band.map(({ num, label, title }) => (
              <div className="pb-cell" key={label}>
                {typeof num === "number" ? (
                  <CountUp className="pb-cell__num" value={num} />
                ) : (
                  <span
                    className="pb-cell__num"
                    title={title}
                    aria-label={title ? `${label}: ${title}` : undefined}
                  >
                    {num}
                  </span>
                )}
                <span className="pb-cell__lab">{label}</span>
              </div>
            ))}
          </div>

          {/* Crowd vs. the sharpest mind — the hero duel */}
          {consensus && bestSingle && (
            <section className="reveal lab-section">
              <span className="section-label">Crowd vs. the sharpest mind</span>
              <div className="vs-grid">
                <div className="vs-card vs-card--crowd">
                  <span className="vs-card__tag">Oracle Consensus</span>
                  <span className="vs-card__pts">{consensus.totalPoints}</span>
                  <span className="vs-card__sub">
                    {consensus.matchesPredicted} matches ·{" "}
                    {consensus.perfectPredictions} perfect
                  </span>
                </div>
                <div className="vs-verdict">
                  <span className="vs-emblem">VS</span>
                  <span className="vs-verdict__big">
                    {consensus.totalPoints === bestSingle.totalPoints
                      ? "DEAD LEVEL"
                      : consensus.totalPoints > bestSingle.totalPoints
                      ? "CROWD WINS"
                      : "MIND WINS"}
                  </span>
                  <span className="vs-verdict__delta">
                    {consensus.totalPoints >= bestSingle.totalPoints ? "+" : ""}
                    {consensus.totalPoints - bestSingle.totalPoints} pts
                  </span>
                </div>
                <div className="vs-card vs-card--mind">
                  <span className="vs-card__tag">
                    {bestSingle.aiModel}{" "}
                    <em>({getAIMeta(bestSingle.aiModel).role})</em>
                  </span>
                  <span className="vs-card__pts">{bestSingle.totalPoints}</span>
                  <span className="vs-card__sub">best individual model</span>
                </div>
              </div>
            </section>
          )}

          {/* Two ranked charts side by side */}
          <div className="chart-grid">
            <section className="reveal lab-card">
              <span className="section-label">Winner accuracy</span>
              <p className="chart-note">
                Share of scored matches where the model called the right result.
              </p>
              <RankedBars items={winAccItems} />
            </section>

            <section className="reveal lab-card">
              <span className="section-label">Points per match</span>
              <p className="chart-note">
                Out of 10 a game — winner 3 · goal diff 2 · exact 5.
              </p>
              <RankedBars items={avgItems} />
            </section>
          </div>

          {/* Calibration */}
          <section className="reveal lab-section">
            <span className="section-label">Confidence calibration</span>
            <p className="chart-note">
              When a model says it&apos;s <em>X%</em> sure, how often is it
              actually right? The closer the green bar climbs to the dashed
              ideal, the more honest the confidence.
            </p>
            {!haveCalib ? (
              <div className="lab-card lab-empty">
                <span className="lab-empty__big">Awaiting data</span>
                <p>
                  Predictions made from now on record how sure each model was —
                  this chart fills in as those matches finish.
                </p>
              </div>
            ) : (
              <>
                <div className="calib-legend">
                  <span className="cl-item">
                    <span className="cl-swatch cl-swatch--ideal" /> Perfect
                    calibration
                  </span>
                  <span className="cl-item">
                    <span className="cl-swatch cl-swatch--actual" /> Actual
                    hit-rate
                  </span>
                </div>
                <div className="calib">
                  {calib.map((b) => {
                    const hitRate = b.n > 0 ? (b.hits / b.n) * 100 : 0;
                    const mid = (b.lo + Math.min(b.hi, 100)) / 2;
                    return (
                      <div className="calib-col" key={b.lo}>
                        <span className="calib-col__bars">
                          <span
                            className="calib-col__ideal"
                            style={{ height: `${mid}%` }}
                            title={`ideal ${Math.round(mid)}%`}
                          />
                          <span
                            className="calib-col__actual"
                            style={{ height: `${hitRate}%` }}
                            title={`${b.hits}/${b.n} correct`}
                          >
                            <span className="calib-col__pct data">
                              {Math.round(hitRate)}%
                            </span>
                          </span>
                        </span>
                        <span className="calib-col__lab data">
                          {b.lo}–{b.hi === 101 ? 100 : b.hi}%
                        </span>
                        <span className="calib-col__n data">n={b.n}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
