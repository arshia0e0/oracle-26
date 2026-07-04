// ORACLE match card: a team-tinted accent bar, kit-chip flags + banner team
// names (winner highlighted once full-time), the score (or kickoff) in
// floodlight gold, a consensus-confidence meter, a one-glance spread of how
// the models clustered, then each prophet's call — points banked, and the
// exact-score callers crowned — when the final whistle blows.

import Link from "next/link";
import FlagChip from "@/components/FlagChip";
import { CONSENSUS_MODEL_NAME, getAIMeta } from "@/lib/ai-meta";
import { teamAccent } from "@/lib/country-themes";
import { matchWinner, penaltiesLabel } from "@/lib/match-result";
import type {
  LeaderboardEntry,
  Match,
  Prediction,
  Team,
} from "@/lib/generated/prisma/client";

export type MatchWithDetails = Match & {
  homeTeam: Team;
  awayTeam: Team;
  predictions: Prediction[];
  leaderboardEntries: LeaderboardEntry[];
};

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER: "Quarter-final",
  SEMI: "Semi-final",
  THIRD_PLACE: "Third Place Play-off",
  FINAL: "Final",
};

function kickoffTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

function kickoffDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

interface SpreadBucket {
  label: string; // "2–0"
  count: number;
  correct: boolean; // matches the actual result (finished only)
}

// Groups the individual models' scorelines into buckets, biggest first, so
// the card can show how tightly the prophets agreed.
function buildSpread(
  predictions: Prediction[],
  actual: { home: number | null; away: number | null }
): SpreadBucket[] {
  const buckets = new Map<string, SpreadBucket>();
  for (const p of predictions) {
    const label = `${p.predictedHomeScore}–${p.predictedAwayScore}`;
    const correct =
      actual.home !== null &&
      p.predictedHomeScore === actual.home &&
      p.predictedAwayScore === actual.away;
    const b = buckets.get(label);
    if (b) b.count += 1;
    else buckets.set(label, { label, count: 1, correct });
  }
  return Array.from(buckets.values()).sort((a, b) => b.count - a.count);
}

export default function MatchCard({
  match,
  href,
  id,
  showReasoning = false,
}: {
  match: MatchWithDetails;
  href?: string;
  // Anchor id (e.g. "match-123") so the knockout bracket can jump to this card.
  id?: string;
  // Each model's one-sentence "why". Off in list views (too noisy) and on
  // for the standalone card on a match's own page.
  showReasoning?: boolean;
}) {
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const pointsByModel = new Map(
    match.leaderboardEntries.map((e) => [e.aiModel, e.pointsEarned])
  );

  // Winner accounts for a shootout, so a 1-1 tie won on penalties still
  // highlights the side that advanced.
  const winnerSide = finished ? matchWinner(match) : "DRAW";
  const homeWin = winnerSide === "HOME";
  const awayWin = winnerSide === "AWAY";
  const pens = finished ? penaltiesLabel(match) : null;

  // Individual models drive the spread; the consensus row drives the meter.
  const individual = match.predictions.filter(
    (p) => p.aiModel !== CONSENSUS_MODEL_NAME
  );
  const consensus = match.predictions.find(
    (p) => p.aiModel === CONSENSUS_MODEL_NAME
  );
  const confVals = individual
    .map((p) => p.confidence)
    .filter((c): c is number => c !== null);
  const cardConfidence =
    consensus?.confidence ??
    (confVals.length
      ? Math.round(confVals.reduce((a, b) => a + b, 0) / confVals.length)
      : null);

  const spread = buildSpread(individual, {
    home: match.homeScore,
    away: match.awayScore,
  });

  const stage = match.group
    ? `Group ${match.group}`
    : STAGE_LABELS[match.stage] ?? match.stage;
  const meta = [kickoffDate(match.date), stage, match.venue]
    .filter(Boolean)
    .join(" · ");

  const big =
    finished || live
      ? `${match.homeScore ?? 0} – ${match.awayScore ?? 0}`
      : kickoffTime(match.date);
  const tag = finished ? "Full time" : live ? "Live" : "Kick-off (UTC)";

  const accentStyle = {
    background: `linear-gradient(90deg, ${teamAccent(
      match.homeTeam.name
    )}, ${teamAccent(match.awayTeam.name)})`,
  };

  const body = (
    <>
      <span className="mc-accent" style={accentStyle} aria-hidden="true" />
      <div className="matchcard__body">
        <span className="regmark" style={{ top: 12, right: 12 }} />
        <div className="mc-teams">
          <div className={"mc-team" + (awayWin ? " mc-team--dim" : "")}>
            <FlagChip team={match.homeTeam} />
            <span className="mc-team__name">
              {match.homeTeam.name}
              {homeWin && <span className="mc-team__win"> ▲</span>}
            </span>
          </div>
          <div className="mc-score">
            <span className="mc-score__big">
              {big}
              {pens && <span className="mc-score__pens">({pens})</span>}
            </span>
            <span className="mc-score__tag">
              {live && <span className="live-dot" aria-hidden="true" />}
              {tag}
            </span>
          </div>
          <div className={"mc-team" + (homeWin ? " mc-team--dim" : "")}>
            <FlagChip team={match.awayTeam} />
            <span className="mc-team__name">
              {match.awayTeam.name}
              {awayWin && <span className="mc-team__win"> ▲</span>}
            </span>
          </div>
        </div>

        {cardConfidence !== null && (
          <div
            className="mc-conf"
            title={`Oracle consensus confidence: ${cardConfidence}%`}
          >
            <span className="mc-conf__lab">Consensus confidence</span>
            <span className="mc-conf__track">
              <span
                className="mc-conf__fill"
                style={{ width: `${cardConfidence}%` }}
              />
            </span>
            <span className="mc-conf__num data">{cardConfidence}%</span>
          </div>
        )}

        {spread.length > 0 && (
          <div className="mc-spread" aria-label="Prediction spread">
            {spread.map((s) => (
              <span
                key={s.label}
                className={"mc-spread__seg" + (s.correct ? " is-correct" : "")}
                style={{ flexGrow: s.count }}
                title={`${s.count} model${s.count === 1 ? "" : "s"} called ${
                  s.label
                }`}
              >
                <span className="mc-spread__score data">{s.label}</span>
                <span className="mc-spread__count data">×{s.count}</span>
              </span>
            ))}
          </div>
        )}

        <p className="mc-meta">{meta}</p>
      </div>
      {match.predictions.length > 0 && (
        <div className="mc-preds">
          {match.predictions.map((p) => {
            const aiMeta = getAIMeta(p.aiModel);
            const points = pointsByModel.get(p.aiModel);
            const exact =
              finished &&
              p.predictedHomeScore === match.homeScore &&
              p.predictedAwayScore === match.awayScore;
            const cls =
              (finished ? ((points ?? 0) > 0 ? " win" : " miss") : "") +
              (exact ? " pred--exact" : "");
            return (
              <div className={"pred" + cls} key={p.aiModel}>
                <div className="pred__row">
                  <span className="pred__badge">{aiMeta.short}</span>
                  <span className="pred__id">
                    <span className="pred__name">
                      {p.aiModel}
                      {exact && <span className="pred__exact">★ EXACT</span>}
                    </span>
                    {p.confidence !== null && (
                      <span
                        className="pred__conf"
                        title={`${p.confidence}% confident`}
                      >
                        <span className="pred__conf-bar">
                          <span
                            className="pred__conf-fill"
                            style={{ width: `${p.confidence}%` }}
                          />
                        </span>
                        <span className="pred__conf-num data">
                          {p.confidence}%
                        </span>
                      </span>
                    )}
                  </span>
                  <span className="pred__score data">
                    {p.predictedHomeScore}–{p.predictedAwayScore}
                    {p.predictedPenaltyWinner && (
                      <span className="pred__pens">
                        {" "}
                        {(p.predictedPenaltyWinner === "HOME"
                          ? match.homeTeam.code
                          : match.awayTeam.code) + " pens"}
                      </span>
                    )}
                  </span>
                  {finished && (
                    <span
                      className={
                        "pred__pts data " + ((points ?? 0) > 0 ? "pos" : "neg")
                      }
                    >
                      {points ?? 0} pts
                    </span>
                  )}
                </div>
                {showReasoning && p.reasoning && (
                  <p className="pred__reason">“{p.reasoning}”</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link id={id} href={href} className="matchcard reveal">
        {body}
      </Link>
    );
  }
  return <div id={id} className="matchcard reveal">{body}</div>;
}
