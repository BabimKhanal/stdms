ALTER TABLE "email_settings" ADD COLUMN "provider_domain" text;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_secure" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "smtp_username" text;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "last_tested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "email_settings" ADD COLUMN "last_test_error" text;--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"text_body" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"template_key" text,
	"to_email" text NOT NULL,
	"subject" text NOT NULL,
	"html_body" text,
	"provider" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error" text,
	"created_by" uuid,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "email_templates_org_key_uq" ON "email_templates" USING btree ("organisation_id","key");--> statement-breakpoint
CREATE INDEX "email_templates_org_idx" ON "email_templates" USING btree ("organisation_id");--> statement-breakpoint
CREATE INDEX "email_deliveries_org_created_idx" ON "email_deliveries" USING btree ("organisation_id","created_at");--> statement-breakpoint
CREATE INDEX "email_deliveries_status_idx" ON "email_deliveries" USING btree ("organisation_id","status");