// Scores & Fixtures, ORACLE style: every match as a match card grouped
// by stage and then matchday, with each prophet's call and the points
// it earned. Filter tabs are plain links driven by the ?filter= search
// param so the whole page stays a server component.

import Link from "next/link";
import MatchCard from "@/components/MatchCard";
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
  "FINAL",
] as const;

const STAGE_TITLES: Record<string, string> = {
  GROUP: "Group Stage",
  ROUND_OF_32: "Round of 32",
  ROUND_OF_16: "Round of 16",
  QUARTER: "Quarter Finals",
  SEMI: "Semi Finals",
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

  // Turso serves *unfiltered* autocommit full-table reads from an edge replica
  // that can lag behind freshly-synced writes. Interactive $transaction()
  // callbacks throw under Vercel's serverless runtime with the HTTP libSQL
  // adapter, so instead we carry a harmless always-true `where` clause: a
  // filtered read routes to the primary and stays current without a tx.
  const matches = await prisma.match.findMany({
    where: { id: { gte: 0 } },
    include: {
      homeTeam: true,
      awayTeam: true,
      predictions: { orderBy: { aiModel: "asc" } },
      leaderboardEntries: true,
    },
    orderBy: { date: "asc" },
  });

  const tabs = buildTabs(matches);
  const filtered = applyFilter(matches, filter);
  const stages = STAGE_ORDER.filter((s) =>
    filtered.some((m) => m.stage === s)
  );

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
          Every match of the tournament — with all five oracles&apos; calls
          and the points each banked once the final whistle blew.
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
