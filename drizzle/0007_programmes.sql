CREATE TABLE "programme_courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetable_id" integer NOT NULL,
	"code" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"semester" integer DEFAULT 1 NOT NULL,
	"lecturer_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programme_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timetable_id" integer NOT NULL,
	"day" integer NOT NULL,
	"group_index" integer DEFAULT 0 NOT NULL,
	"start" integer NOT NULL,
	"span" integer DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'course' NOT NULL,
	"venue" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programme_timetables" (
	"id" serial PRIMARY KEY NOT NULL,
	"semester_id" integer NOT NULL,
	"programme" text NOT NULL,
	"dept" text NOT NULL,
	"title" text NOT NULL,
	"days" jsonb NOT NULL,
	"groups" jsonb NOT NULL,
	"periods" jsonb NOT NULL,
	"venue_key" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"calendar" jsonb DEFAULT '[]'::jsonb NOT NULL,
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
ALTER TABLE "programme_courses" ADD CONSTRAINT "programme_courses_timetable_id_programme_timetables_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."programme_timetables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_slots" ADD CONSTRAINT "programme_slots_timetable_id_programme_timetables_id_fk" FOREIGN KEY ("timetable_id") REFERENCES "public"."programme_timetables"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "programme_timetables" ADD CONSTRAINT "programme_timetables_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;