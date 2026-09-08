CREATE TABLE "billing_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" text DEFAULT 'mercado_pago' NOT NULL,
	"event_key" text NOT NULL,
	"event_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"user_id" integer,
	"status" text DEFAULT 'processed' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "billing_events_provider_key_idx" ON "billing_events" USING btree ("provider","event_key");