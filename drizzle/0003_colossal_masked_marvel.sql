CREATE TABLE "contact_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"topic" text DEFAULT 'duvida' NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'novo' NOT NULL,
	"user_id" integer,
	"visitor_id" text,
	"source_path" text,
	"reply_to_email" boolean DEFAULT false NOT NULL,
	"ip_hash" text,
	"user_agent" text,
	"email_sent" boolean DEFAULT false NOT NULL,
	"email_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"answered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "page_views" (
	"id" serial PRIMARY KEY NOT NULL,
	"visitor_id" text NOT NULL,
	"session_id" text NOT NULL,
	"path" text NOT NULL,
	"referrer" text,
	"referrer_domain" text,
	"channel" text DEFAULT 'direto' NOT NULL,
	"source" text,
	"medium" text,
	"campaign" text,
	"device_type" text DEFAULT 'desktop' NOT NULL,
	"browser" text,
	"os" text,
	"country" text,
	"language" text,
	"user_id" integer,
	"dwell_ms" integer DEFAULT 0 NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "platforms_json" text;--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_messages_ip_idx" ON "contact_messages" USING btree ("ip_hash","created_at");--> statement-breakpoint
CREATE INDEX "page_views_day_idx" ON "page_views" USING btree ("day");--> statement-breakpoint
CREATE INDEX "page_views_created_idx" ON "page_views" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "page_views_visitor_day_idx" ON "page_views" USING btree ("visitor_id","day");--> statement-breakpoint
CREATE INDEX "page_views_user_idx" ON "page_views" USING btree ("user_id");