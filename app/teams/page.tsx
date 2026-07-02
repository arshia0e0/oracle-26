// Teams: all 48 squads as kit-chip rows grouped by group letter,
// each linking to the team's detail page at /teams/[id].

import Link from "next/link";
import FlagChip from "@/components/FlagChip";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Teams — ORACLE /26",
};

export default async function TeamsPage() {
  const teams = await prisma.team.findMany({
    // Exclude the "TBD" knockout placeholder — it isn't a real squad.
    where: { group: { not: "TBD" } },
    orderBy: [{ group: "asc" }, { name: "asc" }],
  });

  const groups = new Map<string, typeof teams>();
  for (const team of teams) {
    const existing = groups.get(team.group);
    if (existing) {
      existing.push(team);
    } else {
      groups.set(team.group, [team]);
    }
  }

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">World Cup 2026</span>
          <span className="label-mono">{"// 48 NATIONS · 12 GROUPS"}</span>
        </div>
        <h1 className="page-title reveal">
          <span className="grass">Teams</span>
        </h1>
        <p className="page-intro reveal">
          Every squad heading to North America. Pick a nation to see its
          likely eleven, fixtures, and how the oracles called its matches.
        </p>
      </header>

      {teams.length === 0 ? (
        <p className="notice reveal">
          No teams in the database yet. Run the data sync to pull squads from
          football-data.org.
        </p>
      ) : (
        Array.from(groups.entries()).map(([group, groupTeams]) => (
          <section className="team-section" key={group}>
            <span className="md-label reveal">Group {group}</span>
            <div className="team-grid">
              {groupTeams.map((team) => (
                <Link
                  className="team-chip reveal"
                  href={`/teams/${team.id}`}
                  key={team.id}
                >
                  <FlagChip team={team} />
                  <span className="team-chip__txt">
                    <span className="team-chip__name">{team.name}</span>
                    <span className="team-chip__rank">
                      {team.fifaRanking
                        ? `FIFA #${team.fifaRanking}`
                        : team.code}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
