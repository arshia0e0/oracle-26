import { PrismaClient } from "./generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Reuse a single PrismaClient across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Strips BOM and whitespace that can sneak in when env values are pasted
// or piped into hosting dashboards/CLIs.
function cleanEnv(value: string | undefined): string | undefined {
  const cleaned = value?.replace(/^\uFEFF/, "").trim();
  return cleaned || undefined;
}

// Turso (libsql) in production, local SQLite file in development.
// Setting TURSO_DATABASE_URL is what flips the switch, so a local
// `npm run dev` without it keeps using dev.db.
function createAdapter() {
  const tursoUrl = cleanEnv(process.env.TURSO_DATABASE_URL);
  if (tursoUrl) {
    return new PrismaLibSql({
      url: tursoUrl,
      authToken: cleanEnv(process.env.TURSO_AUTH_TOKEN),
    });
  }
  return new PrismaBetterSqlite3({
    url: cleanEnv(process.env.DATABASE_URL) ?? "file:./dev.db",
  });
}

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter: createAdapter() });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
