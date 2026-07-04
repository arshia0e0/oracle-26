// One-off local migration: adds the penalty columns to dev.db so it matches
// the updated Prisma schema. Idempotent — checks each column first. The
// production Turso DB gets the same columns via scripts/ensure-prod-schema.ts.

import "dotenv/config";
import { prisma } from "../lib/db";

const COLUMNS: { table: string; column: string; type: string }[] = [
  { table: "Match", column: "homePenalties", type: "INTEGER" },
  { table: "Match", column: "awayPenalties", type: "INTEGER" },
  { table: "Prediction", column: "predictedPenaltyWinner", type: "TEXT" },
];

async function main() {
  for (const { table, column, type } of COLUMNS) {
    const info = (await prisma.$queryRawUnsafe(
      `PRAGMA table_info('${table}')`
    )) as { name: string }[];
    if (info.some((r) => r.name === column)) {
      console.log(`${table}.${column} already present.`);
      continue;
    }
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`
    );
    console.log(`Added ${table}.${column}.`);
  }
}

main()
  .catch((err) => {
    console.error("add-penalty-columns failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
