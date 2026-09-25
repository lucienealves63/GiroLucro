ALTER TABLE "expenses" ADD COLUMN "station" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "liters" numeric(8, 2);--> statement-breakpoint
CREATE INDEX "expenses_user_station_idx" ON "expenses" USING btree ("user_id","station");