ALTER TABLE "users" ADD COLUMN "is_test" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "users" SET "is_test" = true WHERE lower("email") = 'lucienealves63@gmail.com' AND "is_test" = false;
