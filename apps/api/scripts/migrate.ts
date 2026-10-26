/**
 * Runs database migrations, then enables Row Level Security.
 * Usage: npm run db:migrate
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { enableRowLevelSecurity } from "./rls";

function sqlString(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

async function ensureAppRole(pool: pg.Pool) {
  const appUrl = process.env.APP_DATABASE_URL;
  if (!appUrl) throw new Error("APP_DATABASE_URL is not set (needed to configure edu_app)");
  const password = decodeURIComponent(new URL(appUrl).password);
  if (!password) throw new Error("APP_DATABASE_URL must include a password for edu_app");
  const exists = await pool.query<{ exists: boolean }>(
    "SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = $1) AS exists",
    ["edu_app"],
  );
  const statement = exists.rows[0]?.exists
    ? `ALTER ROLE edu_app LOGIN PASSWORD ${sqlString(password)}`
    : `CREATE ROLE edu_app LOGIN PASSWORD ${sqlString(password)}`;
  await pool.query(statement);
  console.log(`✓ ${exists.rows[0]?.exists ? "updated" : "created"} edu_app role`);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set (see .env.example)");

  const pool = new pg.Pool({ connectionString: url, max: 2 });
  await ensureAppRole(pool);
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
