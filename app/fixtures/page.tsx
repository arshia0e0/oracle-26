// Scores & Fixtures, ORACLE style: every match as a match card grouped
// by stage and then matchday, with each prophet's call and the points
// it earned. Filter tabs are plain links driven by the ?filter= search
// param so the whole page stays a server component.

import Link from "next/link";
import MatchCard from "@/components/MatchCard";
import Bracket from "@/components/Bracket";
import { prisma } from "@/lib/db";
import type { MatchWithDetails } from "@/components/MatchCard";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Scores & Fixtures — ORACLE /26",
};

const STAGE_ORDER = [
  "GROUP",
  "ROUND_OF_32",
  "ROUND_OF_16",
  "QUARTER",
  "SEMI",
  "THIRD_PLACE",
  "FINAL",
] as const;

const STAGE_TITLES: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER: "Quarter Finals",
  SEMI: "Semi Finals",
  THIRD_PLACE: "Third Place Play-off",
  FINAL: "Final",
};

interface Tab {
  key: string; // value of ?filter=
  label: string;
}

function buildTabs(matches: MatchWithDetails[]): Tab[] {
  const groups = Array.from(
    new Set(
      matches
        .filter((m) => m.stage === "GROUP" && m.group)
        .map((m) => m.group as string)
    )
  ).sort();

  const knockoutStages = STAGE_ORDER.filter(
    (s) => s !== "GROUP" && matches.some((m) => m.stage === s)
  );

  return [
    { key: "all", label: "All" },
    ...groups.map((g) => ({ key: `group-${g}`, label: `Group ${g}` })),
    ...knockoutStages.map((s) => ({ key: s, label: STAGE_TITLES[s] })),
  ];
}

function applyFilter(
  matches: MatchWithDetails[],
  filter: string
): MatchWithDetails[] {
  if (filter.startsWith("group-")) {
    const group = filter.slice("group-".length);
    return matches.filter((m) => m.stage === "GROUP" && m.group === group);
  }
  if (filter !== "all") {
    return matches.filter((m) => m.stage === filter);
  }
  return matches;
}

// Group a stage's matches into sub-sections: matchdays for the group
// stage, a single unlabelled block for knockout rounds.
function subSections(
  stage: string,
  matches: MatchWithDetails[]
): [string | null, MatchWithDetails[]][] {
  if (stage !== "GROUP") return [[null, matches]];

  const byMatchday = new Map<number, MatchWithDetails[]>();
  for (const match of matches) {
    const existing = byMatchday.get(match.matchday);
    if (existing) {
      existing.push(match);
    } else {
      byMatchday.set(match.matchday, [match]);
    }
  }
  return Array.from(byMatchday.entries())
    .sort(([a], [b]) => a - b)
    .map(([day, dayMatches]) => [`Matchday ${day}`, dayMatches]);
}

export default async function FixturesPage({
  searchParams,
}: {
  searchParams: { filter?: string };
}) {
  const filter = searchParams.filter ?? "all";

  // IMPORTANT: do NOT filter these reads by `where: { id: { gte: 0 } }`. On
  // Turso's HTTP libSQL adapter that clause is served STALE (it left just-
  // finished matches still showing as upcoming); bare findMany reads current.
  // We also avoid a wide relational include (which can return partial rows on
  // this stack) and stitch the flat reads together in memory.
  const [rawMatches, teams, predictions, leaderboardEntries] = await Promise.all(
    [
      prisma.match.findMany({ orderBy: { date: "asc" } }),
      prisma.team.findMany(),
      prisma.prediction.findMany({ orderBy: { aiModel: "asc" } }),
      prisma.leaderboardEntry.findMany(),
    ]
  );

  const teamById = new Map(teams.map((t) => [t.id, t]));
  const predsByMatch = new Map<number, typeof predictions>();
  for (const p of predictions) {
    const list = predsByMatch.get(p.matchId);
    if (list) list.push(p);
    else predsByMatch.set(p.matchId, [p]);
  }
  const entriesByMatch = new Map<number, typeof leaderboardEntries>();
  for (const e of leaderboardEntries) {
    const list = entriesByMatch.get(e.matchId);
    if (list) list.push(e);
    else entriesByMatch.set(e.matchId, [e]);
  }

  const matches: MatchWithDetails[] = rawMatches
    .map((m) => {
      const homeTeam = teamById.get(m.homeTeamId);
      const awayTeam = teamById.get(m.awayTeamId);
      if (!homeTeam || !awayTeam) return null;
      return {
        ...m,
        homeTeam,
        awayTeam,
        predictions: predsByMatch.get(m.id) ?? [],
        leaderboardEntries: entriesByMatch.get(m.id) ?? [],
      };
    })
    .filter((m): m is MatchWithDetails => m !== null);

  const tabs = buildTabs(matches);
  const filtered = applyFilter(matches, filter);
  const stages = STAGE_ORDER.filter((s) =>
    filtered.some((m) => m.stage === s)
  );
  // The bracket sits above the cards and only covers the knockout rounds that
  // are in view; every node links down to its card via the #match-{id} anchor.
  const knockoutMatches = filtered.filter((m) => m.stage !== "GROUP");

  return (
    <div className="wrap page">
      <header className="page-head">
        <div className="page-eyebrows reveal">
          <span className="eyebrow">World Cup 2026</span>
          <span className="label-mono">{"// 104 MATCHES · 48 NATIONS"}</span>
        </div>
        <h1 className="page-title reveal">
          Scores &amp; <em>Fixtures</em>
        </h1>
        <p className="page-intro reveal">
          Every match of the tournament — all six models&apos; calls, the
          consensus verdict, and the points each banked once the final
          whistle blew.
        </p>
      </header>

      <div className="tabs reveal">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.key === "all" ? "/fixtures" : `/fixtures?filter=${tab.key}`}
            className={"tab" + (filter === tab.key ? " tab--active" : "")}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      {knockoutMatches.length > 0 && <Bracket matches={knockoutMatches} />}

      {filtered.length === 0 ? (
        <p className="notice reveal">
          No matches found
          {filter === "all"
            ? " in the database yet. Run the data sync to pull the schedule from football-data.org."
            : " for this filter yet — knockout pairings appear once the bracket is decided."}
        </p>
      ) : (
        stages.map((stage) => {
          const stageMatches = filtered.filter((m) => m.stage === stage);
          return (
            <section className="stage-block" key={stage}>
              <h2 className="stage-title reveal">
                <span className="grass">{STAGE_TITLES[stage]}</span>
                <span className="stage-title__count">
                  {stageMatches.length}{" "}
                  {stageMatches.length === 1 ? "match" : "matches"}
                </span>
              </h2>
              {subSections(stage, stageMatches).map(([label, subMatches]) => (
                <div key={label ?? "all"}>
                  {label && <span className="md-label reveal">{label}</span>}
                  <div className="fixtures-grid">
                    {subMatches.map((match) => (
                      <MatchCard
                        key={match.id}
                        match={match}
                        id={`match-${match.id}`}
                        href={`/matches/${match.id}`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          );
        })
      )}
    </div>
  );
}
