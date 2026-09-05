ALTER TABLE "adjustments" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "refunds" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "transfers" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "adj_user_idx" ON "adjustments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "exp_user_idx" ON "expenses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "ref_user_idx" ON "refunds" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tr_user_idx" ON "transfers" USING btree ("user_id");