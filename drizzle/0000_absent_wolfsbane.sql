CREATE TABLE "expenses" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"date" text NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"odometer" numeric(10, 1),
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "maintenances" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"type" text NOT NULL,
	"date" text NOT NULL,
	"km_done" numeric(10, 1) NOT NULL,
	"cost" numeric(10, 2) DEFAULT 0 NOT NULL,
	"interval_km" numeric(10, 1) DEFAULT 0 NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"opened" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"auth" text NOT NULL,
	"p256dh" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_sent_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"vehicle_type" text DEFAULT 'moto' NOT NULL,
	"vehicle_name" text DEFAULT '' NOT NULL,
	"km_per_liter" numeric(8, 2) DEFAULT 35 NOT NULL,
	"fuel_price" numeric(8, 2) DEFAULT 5.79 NOT NULL,
	"maintenance_per_km" numeric(8, 3) DEFAULT 0.15 NOT NULL,
	"fuel_mode" text DEFAULT 'estimate' NOT NULL,
	"monthly_rent" numeric(10, 2) DEFAULT 0 NOT NULL,
	"monthly_phone" numeric(10, 2) DEFAULT 59.9 NOT NULL,
	"monthly_insurance" numeric(10, 2) DEFAULT 0 NOT NULL,
	"monthly_goal" numeric(10, 2) DEFAULT 3500 NOT NULL,
	"work_days_per_week" integer DEFAULT 6 NOT NULL,
	"reserve_percent" numeric(5, 2) DEFAULT 10 NOT NULL,
	"initial_odometer" numeric(10, 1) DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"plan_status" text DEFAULT 'trialing' NOT NULL,
	"plan_cycle" text,
	"trial_ends_at" timestamp with time zone,
	"current_period_end" timestamp with time zone,
	"billing_customer_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"date" text NOT NULL,
	"platform" text NOT NULL,
	"gross" numeric(10, 2) NOT NULL,
	"hours" numeric(6, 2) DEFAULT 0 NOT NULL,
	"km" numeric(8, 1) DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"wait_minutes" numeric(6, 1) DEFAULT 0 NOT NULL,
	"settled" boolean DEFAULT false NOT NULL,
	"period" text DEFAULT 'tarde' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "settings_user_idx" ON "settings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");