import { Pool } from "pg";

/**
 * Shared PostgreSQL connection pool.
 *
 * No schema, models, or queries live here yet — this is Phase 1 skeleton
 * only. A later phase will add the tenant/employee/booking/room tables and
 * query helpers on top of this pool.
 *
 * Cached on `globalThis` in development so Next.js's hot-reload doesn't spin
 * up a fresh pool (and fresh connections) on every file change.
 */

declare global {
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined;
}

function createPool() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env and fill in your PostgreSQL connection string."
    );
  }

  return new Pool({
    connectionString,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
}

export const pool = global._pgPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  global._pgPool = pool;
}
