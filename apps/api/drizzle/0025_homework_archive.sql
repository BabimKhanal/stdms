ALTER TABLE "homework" ADD COLUMN IF NOT EXISTS "archived_at" timestamptz;
CREATE INDEX IF NOT EXISTS "homework_org_archived_idx" ON "homework" ("organisation_id", "archived_at");
