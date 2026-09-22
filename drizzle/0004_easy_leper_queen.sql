CREATE TABLE "data_subject_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"request_type" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"channel" text DEFAULT 'app' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "legal_acceptances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"document_type" text NOT NULL,
	"document_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" text DEFAULT 'signup' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "terms_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_accepted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "privacy_version" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_id" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_provider" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "payment_status" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "refund_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "refunded_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "refund_status" text DEFAULT 'none';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "data_subject_requests_user_idx" ON "data_subject_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "data_subject_requests_type_idx" ON "data_subject_requests" USING btree ("request_type","created_at");--> statement-breakpoint
CREATE INDEX "legal_acceptances_user_idx" ON "legal_acceptances" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "legal_acceptances_doc_idx" ON "legal_acceptances" USING btree ("document_type","document_version");