// ORACLE match card: kit-chip flags + banner team names, the score (or
// kickoff time) in floodlight gold, a mono meta line, and each prophet's
// call — with the points banked once the final whistle blows.

import Link from "next/link";
import FlagChip from "@/components/FlagChip";
import { getAIMeta } from "@/lib/ai-meta";
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

export default function MatchCard({
  match,
  href,
}: {
  match: MatchWithDetails;
  href?: string;
}) {
  const finished = match.status === "FINISHED";
  const live = match.status === "LIVE";
  const pointsByModel = new Map(
    match.leaderboardEntries.map((e) => [e.aiModel, e.pointsEarned])
  );

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

  const body = (
    <>
      <div className="matchcard__body">
        <span className="regmark" style={{ top: 12, right: 12 }} />
        <div className="mc-teams">
          <div className="mc-team">
            <FlagChip team={match.homeTeam} />
            <span className="mc-team__name">{match.homeTeam.name}</span>
          </div>
          <div className="mc-score">
            <span className="mc-score__big">{big}</span>
            <span className="mc-score__tag">{tag}</span>
          </div>
          <div className="mc-team">
            <FlagChip team={match.awayTeam} />
            <span className="mc-team__name">{match.awayTeam.name}</span>
          </div>
        </div>
        <p className="mc-meta">{meta}</p>
      </div>
      {match.predictions.length > 0 && (
        <div className="mc-preds">
          {match.predictions.map((p) => {
            const meta = getAIMeta(p.aiModel);
            const points = pointsByModel.get(p.aiModel);
            const cls = finished
              ? (points ?? 0) > 0
                ? " win"
                : " miss"
              : "";
            return (
              <div className={"pred" + cls} key={p.aiModel}>
                <span className="pred__badge">{meta.short}</span>
                <span className="pred__name">{p.aiModel}</span>
                <span className="pred__score data">
                  {p.predictedHomeScore}–{p.predictedAwayScore}
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
            );
          })}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} className="matchcard reveal">
        {body}
      </Link>
    );
  }
  return <div className="matchcard reveal">{body}</div>;
}
