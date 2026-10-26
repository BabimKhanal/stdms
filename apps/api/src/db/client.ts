import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { env } from "../env";

/**
 * TWO pools on purpose:
 *
 * - appPool  → connects as `edu_app` (non-owner). PostgreSQL Row Level
 *              Security applies to every query. This is what requests use.
 * - ownerPool → connects as the table owner. ONLY for scripts
 *              (migrate/seed) that must bypass RLS during bulk setup.
 */
export const appPool = new pg.Pool({
  connectionString: env.APP_DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 30_000,
});

appPool.on("error", (err) => console.error("[pg]", err.message));

export const ownerPool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 4 });

/** Builds a Drizzle instance bound to one pooled connection (one request). */
export function makeDb(client: pg.PoolClient | pg.Pool) {
  return drizzle(client, { schema });
}

export type DB = ReturnType<typeof makeDb>;
export type { schema };
