ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "event_type" text NOT NULL DEFAULT 'event';
CREATE INDEX IF NOT EXISTS "events_org_type_date_idx" ON "events" ("organisation_id", "event_type", "start_date");
