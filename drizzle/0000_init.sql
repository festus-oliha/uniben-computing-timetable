CREATE TYPE "public"."booking_kind" AS ENUM('course', 'activity', 'pt', 'shared');--> statement-breakpoint
CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"semester_id" integer NOT NULL,
	"venue_code" text NOT NULL,
	"day" integer NOT NULL,
	"start" integer NOT NULL,
	"span" integer DEFAULT 1 NOT NULL,
	"label" text NOT NULL,
	"kind" "booking_kind" DEFAULT 'course' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "course_lecturers" (
	"course_code" text NOT NULL,
	"lecturer_id" uuid NOT NULL,
	CONSTRAINT "course_lecturers_course_code_lecturer_id_pk" PRIMARY KEY("course_code","lecturer_id")
);
--> statement-breakpoint
CREATE TABLE "courses" (
	"code" text PRIMARY KEY NOT NULL,
	"title" text,
	"level" integer NOT NULL,
	"dept" text NOT NULL,
	"units" integer,
	"is_common" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lecturers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"dept" text
);
--> statement-breakpoint
CREATE TABLE "semesters" (
	"id" serial PRIMARY KEY NOT NULL,
	"session" text NOT NULL,
	"name" text NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"seats" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_semester_id_semesters_id_fk" FOREIGN KEY ("semester_id") REFERENCES "public"."semesters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_venue_code_venues_code_fk" FOREIGN KEY ("venue_code") REFERENCES "public"."venues"("code") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_lecturers" ADD CONSTRAINT "course_lecturers_course_code_courses_code_fk" FOREIGN KEY ("course_code") REFERENCES "public"."courses"("code") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "course_lecturers" ADD CONSTRAINT "course_lecturers_lecturer_id_lecturers_id_fk" FOREIGN KEY ("lecturer_id") REFERENCES "public"."lecturers"("id") ON DELETE cascade ON UPDATE no action;