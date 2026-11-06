CREATE TABLE "student_documents" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
  "document_type" text NOT NULL,
  "title" text NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text,
  "mime_type" text,
  "uploaded_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "student_documents_org_student_title_uq" ON "student_documents" USING btree ("organisation_id", "student_id", "title");
