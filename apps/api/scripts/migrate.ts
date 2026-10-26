/**
 * Runs database migrations, then enables Row Level Security.
 * Usage: npm run db:migrate
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { enableRowLevelSecurity } from "./rls";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

  const pool = new pg.Pool({ connectionString: url, max: 2 });
  console.log("→ applying SQL migrations...");
  await migrate(drizzle(pool), { migrationsFolder: "./drizzle" });

  console.log("→ enabling Row Level Security on tenant tables...");
  await enableRowLevelSecurity(pool);

  await pool.end();
  console.log("✓ migrations + RLS complete");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
