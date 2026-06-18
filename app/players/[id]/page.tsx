// Player detail page, ORACLE style: circular portrait ringed in grass
// green, squad credentials, the team's World Cup campaign record, oracle
// tournament calls that name the player, and the team's fixtures and
// results — everything the league knows about one man's World Cup.

import Link from "next/link";
import { notFound } from "next/navigation";
import FlagChip from "@/components/FlagChip";
import MatchCard from "@/components/MatchCard";
import { getAIMeta } from "@/lib/ai-meta";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

interface Props {
  params: { id: string };
}

const POSITION_LABEL: Record<string, string> = {
  Goalkeeper: "Goalkeeper",
  Defence: "Defender",
  Midfield: "Midfielder",
  Offence: "Forward",
};

function lastName(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts[parts.length - 1] ?? name;
}

// Same fallback portrait the lineup pitch uses: initials on a dark disc.
function portraitUrl(name: string, photoUrl: string | null): string {
  if (photoUrl) return photoUrl;
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name
  )}&background=0d1117&color=4ade80&size=240&bold=true`;
}

async function getPlayer(id: number) {
  if (!Number.isInteger(id)) return null;
  return prisma.player.findUnique({
    where: { id },
    include: { team: true },
  });
}

export async function generateMetadata({ params }: Props) {
  const player = await getPlayer(Number(params.id));
  return {
    title: `${player?.name ?? "Player"} — ORACLE /26`,
  };
}

export default async function PlayerPage({ params }: Props) {
  const player = await getPlayer(Number(params.id));
  if (!player) notFound();
  const team = player.team;

  const [matches, tournamentCalls] = await Promise.all([
    prisma.match.findMany({
      where: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      include: {
        homeTeam: true,
        awayTeam: true,
        predictions: { orderBy: { aiModel: "asc" } },
        leaderboardEntries: true,
      },
      orderBy: { date: "asc" },
    }),
    // No `where: { id: { gte: 0 } }` — that filter reads stale on Turso's HTTP
    // libSQL adapter; bare findMany reads current data.
    prisma.tournamentPrediction.findMany(),
  ]);

  const upcoming = matches.filter((m) => m.status !== "FINISHED");
  const finished = matches.filter((m) => m.status === "FINISHED").reverse();

  // campaign record from the team's perspective
  let won = 0;
  let drawn = 0;
  let lost = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  for (const m of finished) {
    if (m.homeScore === null || m.awayScore === null) continue;
    const isHome = m.homeTeamId === team.id;
    const us = isHome ? m.homeScore : m.awayScore;
    const them = isHome ? m.awayScore : m.homeScore;
    goalsFor += us;
    goalsAgainst += them;
    if (us > them) won += 1;
    else if (us === them) drawn += 1;
    else lost += 1;
  }

  // oracle tournament calls that touch this player or his team
  const surname = lastName(player.name).toLowerCase();
  const bootCalls = tournamentCalls.filter((t) =>
    t.predictedGoldenBoot.toLowerCase().includes(surname)
  );
  const gloveCalls = tournamentCalls.filter((t) =>
    t.predictedGoldenGlove.toLowerCase().includes(surname)
  );
  const winnerCalls = tournamentCalls.filter(
    (t) => t.predictedWinner.toLowerCase() === team.name.toLowerCase()
  );
  const endorsements = [
    ...bootCalls.map((t) => ({ aiModel: t.aiModel, call: "Golden Boot" })),
    ...gloveCalls.map((t) => ({ aiModel: t.aiModel, call: "Golden Glove" })),
    ...winnerCalls.map((t) => ({
      aiModel: t.aiModel,
      call: `${team.name} to lift the cup`,
    })),
  ];

  return (
    <div className="wrap page">
      <Link className="backlink reveal" href={`/teams/${team.id}`}>
        <span aria-hidden="true">←</span> {team.name} squad
      </Link>

      <header className="player-hero reveal">
        <span className="player-hero__photo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={portraitUrl(player.name, player.photoUrl)} alt={player.name} />
          {player.shirtNumber > 0 && (
            <span className="player-hero__num">{player.shirtNumber}</span>
          )}
        </span>
        <div>
          <div className="page-eyebrows" style={{ marginBottom: "0.9rem" }}>
            <FlagChip team={team} />
            <span className="label-mono">
              {team.code} · {POSITION_LABEL[player.position] ?? player.position}
              {player.shirtNumber > 0 ? ` · #${player.shirtNumber}` : ""}
            </span>
          </div>
          <h1 className="page-title" style={{ marginBottom: "0.6rem" }}>
            {player.name}
          </h1>
          <p className="label-mono" style={{ color: "var(--chalk-faint)" }}>
            GROUP {team.group} ·{" "}
            <Link href={`/teams/${team.id}`} style={{ color: "var(--grass)" }}>
              {team.name}
            </Link>
            {team.fifaRanking ? ` · FIFA #${team.fifaRanking}` : ""}
          </p>
        </div>
      </header>

      <section style={{ marginBottom: "3.5rem" }}>
        <span className="section-label reveal">World Cup campaign</span>
        <div className="pstat-grid reveal">
          <div className="pstat">
            <span className="pstat__num">{finished.length}</span>
            <span className="pstat__lab">Played</span>
          </div>
          <div className="pstat">
            <span className="pstat__num">
              {won}–{drawn}–{lost}
            </span>
            <span className="pstat__lab">W · D · L</span>
          </div>
          <div className="pstat">
            <span className="pstat__num">{goalsFor}</span>
            <span className="pstat__lab">Goals for</span>
          </div>
          <div className="pstat">
            <span className="pstat__num">{goalsAgainst}</span>
            <span className="pstat__lab">Goals against</span>
          </div>
          <div className="pstat">
            <span className="pstat__num">{upcoming.length}</span>
            <span className="pstat__lab">Fixtures left</span>
          </div>
        </div>
        {finished.length === 0 && (
          <p className="notice reveal" style={{ marginTop: "1rem" }}>
            {team.name} haven&apos;t kicked off yet — campaign numbers fill in
            after the first final whistle.
          </p>
        )}
      </section>

      {endorsements.length > 0 && (
        <section style={{ marginBottom: "3.5rem" }}>
          <span className="section-label reveal">Oracle calls</span>
          <div className="acc-strip reveal">
            {endorsements.map((row, i) => {
              const meta = getAIMeta(row.aiModel);
              return (
                <div className="acc-row" key={`${row.aiModel}-${i}`}>
                  <span className="std-badge">{meta.short}</span>
                  <span className="acc-row__name">{row.aiModel}</span>
                  <span className="acc-row__pts">{row.call}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

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
        <span className="section-label reveal">Results</span>
        {finished.length === 0 ? (
          <p className="notice reveal">
            Results land here once {team.name} have played.
          </p>
        ) : (
          <div className="fixtures-grid">
            {finished.map((match) => (
              <MatchCard
                key={match.id}
                match={match}
                href={`/matches/${match.id}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
