// One-off: adds the nullable `confidence` column to the Prediction table on
// the local dev.db without a destructive migrate reset. Idempotent.
const Database = require("better-sqlite3");
const db = new Database("./dev.db");
const cols = db
  .prepare("PRAGMA table_info('Prediction')")
  .all()
  .map((c) => c.name);
if (cols.includes("confidence")) {
  console.log("confidence column already exists");
} else {
  db.exec('ALTER TABLE "Prediction" ADD COLUMN "confidence" INTEGER');
  console.log("Added confidence column to Prediction");
}
db.close();
