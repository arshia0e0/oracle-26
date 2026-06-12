// Broadcast matchday strip under the top of every page. Server component:
// pulls a few live storylines from the database and falls back to brand
// lines if the database is empty or unreachable.

import { prisma } from "@/lib/db";
import { getAIMeta } from "@/lib/ai-meta";
import { buildProphetRows } from "@/lib/prophets";

type Item = [string, string];

const BRAND_ITEMS: Item[] = [
  ["ORACLE", "THE BEAUTIFUL GAME, COMPUTED"],
  ["LEAGUE", "FIVE MACHINES · ONE TROPHY"],
  ["SCORING", "WINNER 3 · GOAL DIFF +2 · EXACT +5"],
];

function shortDate(date: Date): string {
  return date
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      timeZone: "UTC",
    })
    .toUpperCase();
}

async function buildItems(): Promise<Item[]> {
  const items: Item[] = [];
  try {
    const [next, lastFinished, rows] = await Promise.all([
      prisma.match.findFirst({
        where: { status: "SCHEDULED", date: { gte: new Date() } },
        orderBy: { date: "asc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      prisma.match.findFirst({
        where: { status: "FINISHED" },
        orderBy: { date: "desc" },
        include: { homeTeam: true, awayTeam: true },
      }),
      buildProphetRows(),
    ]);

    if (next) {
      const tag = next.group ? `GROUP ${next.group}` : "NEXT UP";
      const time = next.date.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      });
      items.push([
        tag,
        `${next.homeTeam.code} v ${next.awayTeam.code} · ${shortDate(next.date)} ${time}`,
      ]);
    }
    if (lastFinished) {
      const tag = lastFinished.group
        ? `GROUP ${lastFinished.group}`
        : "FULL TIME";
      items.push([
        tag,
        `${lastFinished.homeTeam.code} ${lastFinished.homeScore}–${lastFinished.awayScore} ${lastFinished.awayTeam.code} · FT`,
      ]);
    }
    const leader = rows[0];
    if (leader && leader.matchesPredicted > 0) {
      items.push([
        "FORM",
        `${getAIMeta(leader.aiModel).short} leads on ${leader.totalPoints} pts`,
      ]);
      const exact = rows.reduce((s, r) => s + r.perfectPredictions, 0);
      items.push(["EXACT SCORES", `${exact} calls landed`]);
    }
  } catch {
    // Database not reachable — brand lines only.
  }
  return [...items, ...BRAND_ITEMS];
}

export default async function Ticker() {
  const items = await buildItems();
  const doubled = [...items, ...items];
  return (
    <div className="ticker">
      <div className="ticker__track">
        {doubled.map(([k, v], i) => (
          <span className="ticker__item" key={i}>
            <span className="ticker__dot" /> <b>{k}</b> {v}
          </span>
        ))}
      </div>
    </div>
  );
}
