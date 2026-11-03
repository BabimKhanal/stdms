CREATE TABLE IF NOT EXISTS "student_lifecycle_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organisation_id" uuid NOT NULL REFERENCES "organisations"("id") ON DELETE CASCADE,
  "student_id" uuid NOT NULL REFERENCES "students"("id") ON DELETE RESTRICT,
  "actor_id" uuid NOT NULL,
  "action" text NOT NULL,
  "reason" text NOT NULL,
  "effective_date" date NOT NULL,
  "previous_status" text,
  "new_status" text,
  "source_academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "source_class_id" uuid REFERENCES "classes"("id") ON DELETE RESTRICT,
  "source_section_id" uuid REFERENCES "sections"("id") ON DELETE SET NULL,
  "destination_academic_year_id" uuid REFERENCES "academic_years"("id") ON DELETE RESTRICT,
  "destination_class_id" uuid REFERENCES "classes"("id") ON DELETE RESTRICT,
  "destination_section_id" uuid REFERENCES "sections"("id") ON DELETE SET NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
