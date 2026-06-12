// Team detail page, ORACLE style: kit-chip header, the likely eleven on
// a formation pitch, then fixtures and results with each prophet's
// accuracy across this team's finished matches.

import Link from "next/link";
import { notFound } from "next/navigation";
import FlagChip from "@/components/FlagChip";
import LineupPitch from "@/components/LineupPitch";
import MatchCard from "@/components/MatchCard";
import { getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";
import type { MatchWithDetails } from "@/components/MatchCard";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

async function getTeam(id: number) {
  if (!Number.isInteger(id)) return null;
  return prisma.team.findUnique({
    where: { id },
    include: { players: true },
  });
}

export async function generateMetadata({ params }: Props) {
  const team = await getTeam(Number(params.id));
  return {
    title: `${team?.name ?? "Team"} — ORACLE /26`,
  };
}

// Per-AI accuracy across this team's finished matches: total points and
// how many of its predictions scored at all.
function accuracySummary(finished: MatchWithDetails[]) {
  const byModel = new Map<
    string,
    { points: number; scored: number; total: number }
  >();
  for (const match of finished) {
    const points = new Map(
      match.leaderboardEntries.map((e) => [e.aiModel, e.pointsEarned])
    );
    for (const p of match.predictions) {
      const entry = byModel.get(p.aiModel) ?? { points: 0, scored: 0, total: 0 };
      const earned = points.get(p.aiModel) ?? 0;
      entry.points += earned;
      entry.scored += earned > 0 ? 1 : 0;
      entry.total += 1;
      byModel.set(p.aiModel, entry);
    }
  }
  return Array.from(byModel.entries())
    .map(([aiModel, stats]) => ({ aiModel, ...stats }))
    .sort((a, b) => b.points - a.points);
}

export default async function TeamPage({ params }: Props) {
  const id = Number(params.id);
  const team = await getTeam(id);
  if (!team) notFound();

  const matches = await prisma.match.findMany({
    where: { OR: [{ homeTeamId: id }, { awayTeamId: id }] },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: { orderBy: { aiModel: "asc" } },
      leaderboardEntries: true,
    },
    orderBy: { date: "asc" },
  });

  const upcoming = matches.filter((m) => m.status !== "FINISHED");
  const finished = matches.filter((m) => m.status === "FINISHED").reverse();
  const summary = accuracySummary(finished);

  return (
    <div className="wrap page">
      <Link className="backlink reveal" href="/teams">
        <span aria-hidden="true">←</span> All teams
      </Link>

      <header className="page-head" style={{ paddingTop: "1.6rem" }}>
        <div className="page-eyebrows reveal">
          <FlagChip team={team} size="lg" />
          <span className="label-mono">
            GROUP {team.group} · {team.code}
            {team.fifaRanking ? ` · FIFA #${team.fifaRanking}` : ""}
          </span>
        </div>
        <h1 className="page-title reveal">{team.name}</h1>
      </header>

      <section style={{ marginBottom: "3.5rem" }}>
        <span className="section-label reveal">Likely eleven · 4-3-3</span>
        {team.players.length === 0 ? (
          <p className="notice reveal">
            No squad data yet — run the data sync to pull players from
            football-data.org.
          </p>
        ) : (
          <div className="reveal" style={{ maxWidth: 560 }}>
            <LineupPitch players={team.players} />
          </div>
        )}
      </section>

      <section style={{ marginBottom: "3.5rem" }}>
        <span className="section-label reveal">Upcoming fixtures</span>
        {upcoming.length === 0 ? (
          <p className="notice reveal">
            No upcoming matches scheduled for {team.name}.
          </p>
        ) : (
          <div className="fixtures-grid">
            {upcoming.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                href={`/matches/${match.id}`}
              />
            ))}
          </div>
        )}
      </section>

      <section>
        <span className="section-label reveal">
          Results &amp; oracle accuracy
        </span>
        {finished.length === 0 ? (
          <p className="notice reveal">
            No finished matches yet — results and each oracle&apos;s accuracy
            show up here after the final whistle.
          </p>
        ) : (
          <>
            {summary.length > 0 && (
              <div className="acc-strip reveal">
                {summary.map((row) => {
                  const meta = getAIMeta(row.aiModel);
                  return (
                    <div className="acc-row" key={row.aiModel}>
                      <span className="std-badge">{meta.short}</span>
                      <span className="acc-row__name">{row.aiModel}</span>
                      <span className="acc-row__hits">
                        {row.scored}/{row.total} scored
                      </span>
                      <span className="acc-row__pts">{row.points} pts</span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="fixtures-grid">
              {finished.map((match) => (
                <MatchCard
                  key={match.id}
                  match={match}
                  href={`/matches/${match.id}`}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
