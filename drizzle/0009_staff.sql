ALTER TABLE "lecturers" ADD COLUMN "category" text DEFAULT 'academic' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "rank" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "position" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "qualifications" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "interests" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "bio" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "photo" text;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "staff_no" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "phone" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "office" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "lecturers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;