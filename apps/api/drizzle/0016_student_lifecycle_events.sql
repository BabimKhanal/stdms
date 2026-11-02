CREATE TABLE "student_lifecycle_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organisation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"actor_id" uuid NOT NULL,
	"action" text NOT NULL,
	"reason" text NOT NULL,
	"effective_date" date NOT NULL,
	"previous_status" text,
	"new_status" text,
	"source_academic_year_id" uuid,
	"source_class_id" uuid,
	"source_section_id" uuid,
	"destination_academic_year_id" uuid,
	"destination_class_id" uuid,
	"destination_section_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_organisation_id_organisations_id_fk" FOREIGN KEY ("organisation_id") REFERENCES "public"."organisations"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_source_academic_year_id_academic_years_id_fk" FOREIGN KEY ("source_academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_source_class_id_classes_id_fk" FOREIGN KEY ("source_class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_source_section_id_sections_id_fk" FOREIGN KEY ("source_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_destination_academic_year_id_academic_years_id_fk" FOREIGN KEY ("destination_academic_year_id") REFERENCES "public"."academic_years"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_destination_class_id_classes_id_fk" FOREIGN KEY ("destination_class_id") REFERENCES "public"."classes"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "student_lifecycle_events" ADD CONSTRAINT "student_lifecycle_events_destination_section_id_sections_id_fk" FOREIGN KEY ("destination_section_id") REFERENCES "public"."sections"("id") ON DELETE set null ON UPDATE no action;