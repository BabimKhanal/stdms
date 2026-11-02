CREATE TABLE "email_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "provider" text DEFAULT 'resend' NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "from_name" text NOT NULL,
  "from_email" text NOT NULL,
  "reply_to" text,
  "footer" text,
  "daily_limit" integer DEFAULT 1000 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "email_settings_org_uq" ON "email_settings" USING btree ("organisation_id");
