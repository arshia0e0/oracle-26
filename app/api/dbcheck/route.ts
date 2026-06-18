// TEMPORARY diagnostic route — reports which database the running
// deployment is actually reading. Remove after debugging.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { buildProphetRows } from "@/lib/prophets";

export const dynamic = "force-dynamic";

export async function GET() {
  const tursoUrl = process.env.TURSO_DATABASE_URL ?? null;
  const dbUrl = process.env.DATABASE_URL ?? null;
  let entryCount = -1;
  let distinctMatches = -1;
  let prophetTop = "n/a";
  let prophetEntrySum = -1;
  let error: string | null = null;
  try {
    entryCount = await prisma.leaderboardEntry.count();
    const rows = await prisma.leaderboardEntry.findMany({
      where: { id: { gte: 0 } },
      select: { matchId: true },
    });
    distinctMatches = new Set(rows.map((r) => r.matchId)).size;

    // Run the actual leaderboard aggregation to compare.
    const prophetRows = await buildProphetRows();
    const top = prophetRows[0];
    prophetTop = top
      ? `${top.aiModel}:${top.totalPoints}pts:${top.matchesPredicted}matches`
      : "none";
    prophetEntrySum = prophetRows.reduce(
      (s, r) => s + r.matchesPredicted,
      0
    );
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }
  return NextResponse.json({
    tursoUrlSet: Boolean(tursoUrl && tursoUrl.trim()),
    tursoUrlLen: tursoUrl?.length ?? 0,
    tursoUrlHost: tursoUrl ? tursoUrl.replace(/^libsql:\/\//, "").slice(0, 30) : null,
    databaseUrlSet: Boolean(dbUrl && dbUrl.trim()),
    databaseUrlLen: dbUrl?.length ?? 0,
    entryCount,
    distinctMatches,
    prophetTop,
    prophetEntrySum,
    error,
  });
}
