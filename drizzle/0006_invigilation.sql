CREATE TABLE "exam_unavailability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetable_id" integer NOT NULL,
	"lecturer_id" uuid NOT NULL,
	"date" text NOT NULL,
	"session" integer,
	"reason" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "exam_papers" ADD COLUMN "assistants_needed" integer;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "invigilator_pool" jsonb;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "assistants_per_paper" integer DEFAULT 3 NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "max_duties_per_day" integer DEFAULT 2 NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "invigilation_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "invigilation_published_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "inv_signed_on" text;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "inv_signature_image" text;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "inv_signature_width" integer;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD COLUMN "inv_signature_height" integer;--> statement-breakpoint
ALTER TABLE "exam_unavailability" ADD CONSTRAINT "exam_unavailability_timetable_id_exam_timetables_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."exam_timetables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_unavailability" ADD CONSTRAINT "exam_unavailability_lecturer_id_lecturers_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturers"("id") ON DELETE cascade ON UPDATE no action;