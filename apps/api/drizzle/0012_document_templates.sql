CREATE TABLE "document_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "document_type" text NOT NULL,
  "design" jsonb NOT NULL,
  "is_default" integer DEFAULT 0 NOT NULL,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "document_templates_org_name_uq" ON "document_templates" USING btree ("organisation_id", "name");--> statement-breakpoint
CREATE INDEX "document_templates_org_type_idx" ON "document_templates" USING btree ("organisation_id", "document_type");
