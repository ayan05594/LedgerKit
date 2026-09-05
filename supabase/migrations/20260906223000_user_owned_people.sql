ALTER TABLE "people" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
DELETE FROM "people" WHERE "id" IN ('per-1', 'per-2', 'per-3');
