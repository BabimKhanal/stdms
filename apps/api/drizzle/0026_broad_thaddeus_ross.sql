ALTER TABLE "events" ADD COLUMN "event_type" text DEFAULT 'event' NOT NULL;--> statement-breakpoint
ALTER TABLE "homework" DROP COLUMN IF EXISTS "event_type";
