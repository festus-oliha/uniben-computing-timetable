ALTER TABLE "semesters" ADD COLUMN "signed_on" text;--> statement-breakpoint
ALTER TABLE "semesters" ADD COLUMN "signature_image" text;--> statement-breakpoint
ALTER TABLE "semesters" ADD COLUMN "signature_width" integer;--> statement-breakpoint
ALTER TABLE "semesters" ADD COLUMN "signature_height" integer;--> statement-breakpoint
ALTER TABLE "semesters" ADD COLUMN "signature_updated_at" timestamp with time zone;