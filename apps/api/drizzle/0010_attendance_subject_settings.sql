ALTER TABLE "attendance_records" ADD COLUMN "subject_id" uuid REFERENCES "subjects"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP INDEX IF EXISTS "attendance_records_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_records_uq" ON "attendance_records" USING btree ("organisation_id", "student_id", "date", "period_id", "subject_id");--> statement-breakpoint
CREATE TABLE "attendance_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "minimum_percentage" integer DEFAULT 75 NOT NULL,
  "count_late_as_present" integer DEFAULT 1 NOT NULL,
  "exclude_leave" integer DEFAULT 1 NOT NULL,
  "exclude_excused" integer DEFAULT 1 NOT NULL,
  "exclude_sick" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "attendance_settings_org_uq" ON "attendance_settings" USING btree ("organisation_id");
