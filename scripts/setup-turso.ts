// One-shot Turso setup: recreates the schema from the local dev.db and
// copies all existing rows up to the remote database. Safe to re-run —
// remote tables are dropped and rebuilt each time (full overwrite).
//
// Prerequisites (see https://docs.turso.tech):
//   turso db create worldcup-ai
//   turso db show worldcup-ai --url        -> TURSO_DATABASE_URL in .env
//   turso db tokens create worldcup-ai     -> TURSO_AUTH_TOKEN in .env
//
// Usage: npm run setup-turso

import "dotenv/config";
import path from "node:path";
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";

const BATCH_SIZE = 100;

interface SchemaObject {
  type: string; // "table" | "index"
  name: string;
  sql: string;
}

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.error(
      "TURSO_DATABASE_URL is not set. Add it to .env along with TURSO_AUTH_TOKEN.\n" +
        "  turso db show <db-name> --url\n" +
        "  turso db tokens create <db-name>"
    );
    process.exit(1);
  }

  const localPath = path.join(process.cwd(), "dev.db");
  const local = new Database(localPath, { readonly: true });
  const turso = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });

  // The local database is the source of truth for the schema (it reflects
  // every migration and db push that has been applied).
  const objects = local
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%'
       ORDER BY rowid`
    )
    .all() as SchemaObject[];

  const tables = objects.filter((o) => o.type === "table");
  const indexes = objects.filter((o) => o.type === "index");

  // Drop in reverse creation order so children go before their FK parents.
  console.log("Dropping existing tables on Turso...");
  for (const table of [...tables].reverse()) {
    await turso.execute(`DROP TABLE IF EXISTS "${table.name}"`);
  }

  console.log("Creating schema...");
  for (const obj of [...tables, ...indexes]) {
    await turso.execute(obj.sql);
    console.log(`  ${obj.type}: ${obj.name}`);
  }

  console.log("Copying data...");
  for (const table of tables) {
    const rows = local
      .prepare(`SELECT * FROM "${table.name}"`)
      .all() as Record<string, unknown>[];
    if (rows.length === 0) {
      console.log(`  ${table.name}: empty, skipped`);
      continue;
    }

    const columns = Object.keys(rows[0]);
    const insertSql = `INSERT INTO "${table.name}" (${columns
      .map((c) => `"${c}"`)
      .join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const chunk = rows.slice(i, i + BATCH_SIZE);
      await turso.batch(
        chunk.map((row) => ({
          sql: insertSql,
          args: columns.map((c) => row[c] ?? null) as (
            | string
            | number
            | null
            | Uint8Array
          )[],
        })),
        "write"
      );
    }
    console.log(`  ${table.name}: ${rows.length} rows`);
  }

  // Sanity check: row counts must match on both sides.
  console.log("Verifying...");
  let ok = true;
  for (const table of tables) {
    const localCount = (
      local.prepare(`SELECT COUNT(*) AS n FROM "${table.name}"`).get() as {
        n: number;
      }
    ).n;
    const remote = await turso.execute(
      `SELECT COUNT(*) AS n FROM "${table.name}"`
    );
    const remoteCount = Number(remote.rows[0].n);
    if (localCount !== remoteCount) {
      ok = false;
      console.error(
        `  MISMATCH ${table.name}: local ${localCount}, turso ${remoteCount}`
      );
    }
  }

  local.close();
  turso.close();

  if (!ok) {
    console.error("Row counts do not match — check the errors above.");
    process.exit(1);
  }
  console.log("Done. Turso is in sync with the local database.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
