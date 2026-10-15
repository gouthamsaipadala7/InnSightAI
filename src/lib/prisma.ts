import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * Shared Prisma Client instance for typed, schema-aware queries.
 *
 * Prisma 7 removed the built-in Rust query engine — Prisma Client now talks
 * to Postgres through a driver adapter (`@prisma/adapter-pg`, built on the
 * `pg` package) instead of connecting on its own. `DATABASE_URL` is read
 * directly here for the adapter; `prisma.config.ts` at the project root
 * supplies the same URL to the Prisma CLI for `generate`/`migrate`.
 *
 * `src/lib/db.ts` still exists for raw `pg` Pool access if a query ever
 * needs to drop below the ORM. Most application code should import `prisma`
 * from here instead.
 *
 * Cached on `globalThis` in development so Next.js's hot-reload doesn't open
 * a fresh connection pool on every file change.
 */

declare global {
  // eslint-disable-next-line no-var
  var _prismaClient: PrismaClient | undefined;
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in your PostgreSQL connection string."
    );
  }

  const adapter = new PrismaPg({
  connectionString,
  ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
});
  return new PrismaClient({ adapter });
}

export const prisma = global._prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  global._prismaClient = prisma;
}