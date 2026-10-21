ALTER TABLE "quote" ALTER COLUMN "issued_by" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "start_point" jsonb;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "start_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "service_point" jsonb;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "service_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "price_estimate" jsonb;--> statement-breakpoint
ALTER TABLE "quote" ADD COLUMN "breakdown" jsonb;