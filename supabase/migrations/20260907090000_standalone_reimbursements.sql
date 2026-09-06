CREATE TABLE "standalone_reimbursement_receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"reimbursement_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"received_at" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "standalone_receipt_amount_positive" CHECK ("standalone_reimbursement_receipts"."amount_paise" > 0)
);
--> statement-breakpoint
CREATE TABLE "standalone_reimbursements" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"source" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"expected_paise" integer NOT NULL,
	"claimed_at" text NOT NULL,
	"due_date" text,
	"written_off" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	CONSTRAINT "standalone_reimbursement_expected_positive" CHECK ("standalone_reimbursements"."expected_paise" > 0)
);
--> statement-breakpoint
ALTER TABLE "standalone_reimbursement_receipts" ADD CONSTRAINT "standalone_reimbursement_receipts_reimbursement_id_standalone_reimbursements_id_fk" FOREIGN KEY ("reimbursement_id") REFERENCES "public"."standalone_reimbursements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "standalone_receipt_user_idx" ON "standalone_reimbursement_receipts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standalone_receipt_reimbursement_idx" ON "standalone_reimbursement_receipts" USING btree ("reimbursement_id");--> statement-breakpoint
CREATE INDEX "standalone_reimbursement_user_idx" ON "standalone_reimbursements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "standalone_reimbursement_due_idx" ON "standalone_reimbursements" USING btree ("user_id","due_date");--> statement-breakpoint
-- All access goes through LedgerKit's authenticated server routes.
ALTER TABLE "standalone_reimbursements" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "standalone_reimbursement_receipts" ENABLE ROW LEVEL SECURITY;
