// Match detail page, ORACLE style: banner headline, the full match card
// (score or kickoff plus every prophet's call), then both teams' likely
// elevens on formation pitches, side by side.

import Link from "next/link";
import { notFound } from "next/navigation";
import FlagChip from "@/components/FlagChip";
import LineupPitch from "@/components/LineupPitch";
import MatchCard from "@/components/MatchCard";
import { prisma } from "@/lib/db";
import type { Player, Team } from "@/lib/generated/prisma/client";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

const STAGE_LABELS: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER: "Quarter-final",
  SEMI: "Semi-final",
  FINAL: "Final",
};

async function getMatch(id: number) {
  if (!Number.isInteger(id)) return null;
  return prisma.match.findUnique({
    where: { id },
    include: {
      homeTeam: { include: { players: true } },
      awayTeam: { include: { players: true } },
      predictions: { orderBy: { aiModel: "asc" } },
      leaderboardEntries: true,
    },
  });
}

export async function generateMetadata({ params }: Props) {
  const match = await getMatch(Number(params.id));
  return {
    title: match
      ? `${match.homeTeam.name} v ${match.awayTeam.name} — ORACLE /26`
      : "Match — ORACLE /26",
  };
}

function TeamLineup({ team }: { team: Team & { players: Player[] } }) {
  return (
    <div className="reveal">
      <Link
        href={`/teams/${team.id}`}
        className="lineup-head"
        style={{ textDecoration: "none", color: "inherit" }}
      >
        <FlagChip team={team} />
        <span className="lineup-head__name">{team.name}</span>
        <span className="lineup-head__form">4-3-3 →</span>
      </Link>
      {team.players.length === 0 ? (
        <p className="notice">No squad data for {team.name} yet.</p>
      ) : (
        <LineupPitch players={team.players} />
      )}
    </div>
  );
}

export default async function MatchPage({ params }: Props) {
  const match = await getMatch(Number(params.id));
  if (!match) notFound();

  const eyebrow = match.group
    ? `Group ${match.group} · Matchday ${match.matchday}`
    : STAGE_LABELS[match.stage] ?? match.stage;

  return (
    <div className="wrap page">
      <Link className="backlink reveal" href="/fixtures">
        <span aria-hidden="true">←</span> All fixtures
      </Link>

      <header className="page-head" style={{ paddingTop: "1.6rem" }}>
        <div className="page-eyebrows reveal">
          <span className="eyebrow">{eyebrow}</span>
          <span className="label-mono">{"// FIVE CALLS ON RECORD"}</span>
        </div>
        <h1
          className="page-title reveal"
          style={{ fontSize: "clamp(2.4rem,6vw,5rem)" }}
        >
          {match.homeTeam.name} <span className="grass">v</span>{" "}
          {match.awayTeam.name}
        </h1>
      </header>

      <div style={{ maxWidth: 560, margin: "0.5rem 0 3rem" }}>
        <MatchCard match={match} showReasoning />
      </div>

      <section>
        <span className="section-label reveal">Likely lineups · 4-3-3</span>
        <div className="lineups-grid">
          <TeamLineup team={match.homeTeam} />
          <TeamLineup team={match.awayTeam} />
        </div>
      </section>
    </div>
  );
}
