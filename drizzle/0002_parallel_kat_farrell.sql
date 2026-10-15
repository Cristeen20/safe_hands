CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'razorpay', 'dev');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'succeeded', 'failed', 'expired');--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"booking_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"provider_ref" text,
	"provider_payment_id" text,
	"amount_minor" integer NOT NULL,
	"currency" text NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"late" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_providerRef_unique" UNIQUE("provider_ref"),
	CONSTRAINT "payment_providerPaymentId_unique" UNIQUE("provider_payment_id")
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"provider_event_id" text PRIMARY KEY NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "quote_booking_id_index";--> statement-breakpoint
ALTER TABLE "booking" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_booking_id_booking_id_fk" FOREIGN KEY ("booking_id") REFERENCES "public"."booking"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_quote_id_quote_id_fk" FOREIGN KEY ("quote_id") REFERENCES "public"."quote"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_booking_id_index" ON "payment" USING btree ("booking_id");--> statement-breakpoint
ALTER TABLE "quote" ADD CONSTRAINT "quote_bookingId_unique" UNIQUE("booking_id");