CREATE TABLE "payment_gateway_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "provider" text NOT NULL,
  "enabled" integer DEFAULT 0 NOT NULL,
  "merchant_code" text,
  "secret_key" text,
  "public_key" text,
  "api_url" text,
  "success_url" text,
  "failure_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "payment_gateway_settings_org_provider_uq" ON "payment_gateway_settings" USING btree ("organisation_id", "provider");
