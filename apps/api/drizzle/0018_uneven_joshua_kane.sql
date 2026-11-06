CREATE TABLE "backup_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"provider" text NOT NULL,
	"object_key" text,
	"size_bytes" bigint,
	"sha256" text,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "backup_jobs_started_at_idx" ON "backup_jobs" USING btree ("started_at");