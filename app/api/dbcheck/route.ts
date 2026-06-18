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
    rows,
  });
}
