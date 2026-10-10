ALTER TABLE "semesters" ADD COLUMN "is_published" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "semesters" ADD COLUMN "published_at" timestamp with time zone;