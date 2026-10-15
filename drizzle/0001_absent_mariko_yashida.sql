ALTER TABLE "booking" ALTER COLUMN "region" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."region";--> statement-breakpoint
CREATE TYPE "public"."region" AS ENUM('US', 'CA', 'GB', 'IN');--> statement-breakpoint
ALTER TABLE "booking" ALTER COLUMN "region" SET DATA TYPE "public"."region" USING "region"::"public"."region";