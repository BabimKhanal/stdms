CREATE TABLE "fee_access_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "student_visible" integer DEFAULT 1 NOT NULL,
  "student_online_payment" integer DEFAULT 0 NOT NULL,
  "guardian_visible" integer DEFAULT 1 NOT NULL,
  "show_discounts" integer DEFAULT 1 NOT NULL,
  "due_reminders" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "fee_access_settings_org_uq" ON "fee_access_settings" USING btree ("organisation_id");
