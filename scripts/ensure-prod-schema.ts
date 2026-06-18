// Build-time guard: makes sure the production Turso database has the columns
// the current code expects, so a deploy can't crash with "no such column".
// Runs as part of `npm run build`. When TURSO_DATABASE_URL is unset (local
// builds) it is a no-op. Idempotent — safe on every deploy.

import "dotenv/config";
import { createClient } from "@libsql/client";

// Columns added after the initial migration that must exist on Turso.
const REQUIRED_COLUMNS: { table: string; column: string; type: string }[] = [
  { table: "Prediction", column: "confidence", type: "INTEGER" },
];

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) {
    console.log(
      "[ensure-prod-schema] No TURSO_DATABASE_URL — local build, skipping."
    );
    return;
  }

  const turso = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  try {
    for (const { table, column, type } of REQUIRED_COLUMNS) {
      const info = await turso.execute(`PRAGMA table_info('${table}')`);
      const exists = info.rows.some((r) => r.name === column);
      if (exists) {
        console.log(`[ensure-prod-schema] ${table}.${column} present.`);
        continue;
      }
      await turso.execute(
        `ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`
      );
      console.log(`[ensure-prod-schema] Added ${table}.${column} to Turso.`);
    }
  } finally {
    turso.close();
  }
}

main().catch((err) => {
  // Fail the build rather than deploy a schema-mismatched (crashing) app.
  console.error("[ensure-prod-schema] FAILED:", err);
  process.exit(1);
});
