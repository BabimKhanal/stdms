import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit reads schema files to *generate* SQL migrations into ./drizzle.
 * Migrations are applied by scripts/migrate.ts (which also enables Row Level
 * Security) — never by drizzle-kit against the live database directly.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/*.ts",
  out: "./drizzle",
  verbose: true,
  strict: true,
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/edu_platform",
  },
});
