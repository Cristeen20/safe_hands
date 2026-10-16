CREATE TYPE "public"."tour_kind" AS ENUM('package', 'stay', 'custom');--> statement-breakpoint
ALTER TYPE "public"."vehicle" ADD VALUE 'own' BEFORE 'small';--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "service_type" SET DATA TYPE text;--> statement-breakpoint
-- "errand" and "other" were replaced by "companion" (help with errands and tasks).
UPDATE "booking" SET "service_type" = 'companion' WHERE "service_type" IN ('errand', 'other');--> statement-breakpoint
DROP TYPE "public"."service_type";--> statement-breakpoint
CREATE TYPE "public"."service_type" AS ENUM('hospital_visit', 'driver', 'companion', 'property', 'gift', 'camera', 'tour');--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "service_type" SET DATA TYPE "public"."service_type" USING "service_type"::"public"."service_type";--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "start_address" SET DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "estimated_hours" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "vehicle" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "accompanying_count" smallint;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "needs_bystander" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "child_seat" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "days" smallint;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "party_size" smallint;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "include_food" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "needs_stay" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "tour_kind" "tour_kind";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "tour_package" text;--> statement-breakpoint
CREATE INDEX "booking_tour_package_index" ON "booking" USING btree ("tour_package");