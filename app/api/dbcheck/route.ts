// TEMPORARY diagnostic — compares how production reads the same Match rows
// via bulk findMany vs findUnique. Remove after debugging.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const IDS = [537403, 537409, 537410, 537404];

export async function GET() {
  const bulk = await prisma.match.findMany({
    where: { id: { gte: 0 } },
    orderBy: { date: "asc" },
  });
  const bulkById = new Map(bulk.map((m) => [m.id, m]));

  const finishedInBulk = bulk.filter((m) => m.status === "FINISHED").length;

  const bare = await prisma.match.findMany({ orderBy: { date: "asc" } });
  const finishedBare = bare.filter((m) => m.status === "FINISHED").length;

  const whereStatus = await prisma.match.findMany({
    where: { status: "FINISHED" },
  });
  const finishedWhereStatus = whereStatus.length;

  // Does raw SQL read fresh where the ORM bulk read is stale?
  let rawFinished = -1;
  try {
    const res = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM "Match" WHERE status = 'FINISHED'`;
    rawFinished = Number(res[0]?.n ?? -1);
  } catch {
    rawFinished = -2;
  }

  const rows: Record<string, unknown>[] = [];
  for (const id of IDS) {
    const fromBulk = bulkById.get(id);
    const fromUnique = await prisma.match.findUnique({ where: { id } });
    rows.push({
      id,
      bulkStatus: fromBulk?.status ?? "ABSENT",
      bulkScore: `${fromBulk?.homeScore ?? "?"}-${fromBulk?.awayScore ?? "?"}`,
      uniqueStatus: fromUnique?.status ?? "ABSENT",
      uniqueScore: `${fromUnique?.homeScore ?? "?"}-${fromUnique?.awayScore ?? "?"}`,
    });
  }

  return NextResponse.json({
    totalMatchesInBulk: bulk.length,
    finishedInBulk,
    finishedBare,
    finishedWhereStatus,
    rawFinished,
    rows,
  });
}
