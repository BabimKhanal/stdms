CREATE TYPE "payment_submission_status" AS ENUM('pending', 'approved', 'rejected');
CREATE TABLE "payment_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE cascade,
  "method" "payment_method" NOT NULL,
  "label" text NOT NULL,
  "enabled" integer DEFAULT 1 NOT NULL,
  "instructions" text,
  "bank_name" text,
  "account_name" text,
  "account_number" text,
  "branch" text,
  "qr_image_url" text,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "payment_methods_org_idx" ON "payment_methods" USING btree ("organisation_id");
CREATE TABLE "payment_submissions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE cascade,
  "invoice_id" uuid NOT NULL REFERENCES "invoices"("id") ON DELETE cascade,
  "payment_method_id" uuid NOT NULL REFERENCES "payment_methods"("id") ON DELETE restrict,
  "amount" numeric(12, 2) NOT NULL,
  "reference" text,
  "proof_url" text,
  "status" "payment_submission_status" DEFAULT 'pending' NOT NULL,
  "submitted_by" uuid NOT NULL REFERENCES "users"("id") ON DELETE restrict,
  "reviewed_by" uuid REFERENCES "users"("id") ON DELETE set null,
  "reviewed_at" timestamp with time zone,
  "review_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "payment_submissions_org_status_idx" ON "payment_submissions" USING btree ("organisation_id", "status");
CREATE INDEX "payment_submissions_invoice_idx" ON "payment_submissions" USING btree ("invoice_id");
