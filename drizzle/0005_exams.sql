CREATE TABLE "exam_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetable_id" integer NOT NULL,
	"date" text NOT NULL,
	"session" integer NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'paper' NOT NULL,
	"venues" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"year" text,
	"note" text DEFAULT '' NOT NULL,
	"chief_id" uuid,
	"invigilator_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_timetables" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_id" integer NOT NULL,
	"programme" text NOT NULL,
	"dept" text,
	"title" text NOT NULL,
	"sessions" jsonb NOT NULL,
	"dates" jsonb NOT NULL,
	"notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signatory_name" text DEFAULT '' NOT NULL,
	"signatory_role" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"signed_on" text,
	"signature_image" text,
	"signature_width" integer,
	"signature_height" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "short_name" text;--> statement-breakpoint
ALTER TABLE "venues" ADD COLUMN "in_lecture_grid" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_timetable_id_exam_timetables_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."exam_timetables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_papers" ADD CONSTRAINT "exam_papers_chief_id_lecturers_id_fk" FOREIGN KEY ("chief_id") REFERENCES "public"."lecturers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_timetables" ADD CONSTRAINT "exam_timetables_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;