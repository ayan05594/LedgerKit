CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"bank" text DEFAULT '' NOT NULL,
	"kind" text DEFAULT 'savings' NOT NULL,
	"last4" text DEFAULT '' NOT NULL,
	"balance_paise" integer DEFAULT 0 NOT NULL,
	"opening_balance_paise" integer DEFAULT 0 NOT NULL,
	"opening_date" text DEFAULT '2000-01-01' NOT NULL,
	"color_hex" text DEFAULT '#4B5563' NOT NULL,
	"upi_handle" text DEFAULT '' NOT NULL,
	"include_in_totals" boolean DEFAULT true NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"label" text NOT NULL,
	"kind" text DEFAULT 'instant_discount' NOT NULL,
	"amount_paise" integer DEFAULT 0 NOT NULL,
	"immediate" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"received_at" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"icon" text DEFAULT 'Circle' NOT NULL,
	"color_hex" text DEFAULT '#6B7280' NOT NULL,
	"parent_slug" text,
	"requires_label" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" text PRIMARY KEY NOT NULL,
	"occurred_at" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"instrument_id" text,
	"account_id" text,
	"payment_app_slug" text,
	"category_slug" text NOT NULL,
	"custom_label" text DEFAULT '' NOT NULL,
	"merchant_slug" text,
	"merchant_name" text DEFAULT '' NOT NULL,
	"channel" text DEFAULT 'online' NOT NULL,
	"tags" text DEFAULT '[]' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"flags" text DEFAULT '{}' NOT NULL,
	"reimbursable" boolean DEFAULT false NOT NULL,
	"reimbursement_expected_paise" integer DEFAULT 0 NOT NULL,
	"reimbursement_received_paise" integer DEFAULT 0 NOT NULL,
	"reimbursement_status" text DEFAULT 'none' NOT NULL,
	"reimbursement_from" text DEFAULT '' NOT NULL,
	"reimbursement_due_date" text,
	"reimbursement_note" text DEFAULT '' NOT NULL,
	"reward_rule_id" text,
	"reward_units_milli" integer DEFAULT 0 NOT NULL,
	"reward_value_paise" integer DEFAULT 0 NOT NULL,
	"reward_capped_units_milli" integer DEFAULT 0 NOT NULL,
	"reward_explain" text DEFAULT '' NOT NULL,
	"reward_override_paise" integer,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"updated_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_name" text NOT NULL,
	"issuer" text NOT NULL,
	"network" text DEFAULT 'visa' NOT NULL,
	"kind" text DEFAULT 'credit' NOT NULL,
	"last4" text DEFAULT '' NOT NULL,
	"color_from" text DEFAULT '#1F2937' NOT NULL,
	"color_to" text DEFAULT '#111827' NOT NULL,
	"account_id" text,
	"credit_limit_paise" integer DEFAULT 0 NOT NULL,
	"statement_day" integer DEFAULT 1 NOT NULL,
	"due_day" integer DEFAULT 20 NOT NULL,
	"reward_unit" text DEFAULT 'INR' NOT NULL,
	"unit_value_paise" integer DEFAULT 100 NOT NULL,
	"reward_kind" text DEFAULT 'statement_cashback' NOT NULL,
	"overall_cap_units" integer,
	"overall_cap_period" text DEFAULT 'none' NOT NULL,
	"excluded_categories" text DEFAULT '[]' NOT NULL,
	"options" text DEFAULT '{}' NOT NULL,
	"annual_fee_paise" integer DEFAULT 0 NOT NULL,
	"fee_waiver_spend_paise" integer DEFAULT 0 NOT NULL,
	"forex_markup_bps" integer DEFAULT 350 NOT NULL,
	"perks" text DEFAULT '[]' NOT NULL,
	"source_note" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "merchants" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"category_slug" text,
	"color_hex" text DEFAULT '#6B7280' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	CONSTRAINT "merchants_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "payment_apps" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"kind" text DEFAULT 'upi' NOT NULL,
	"color_hex" text DEFAULT '#6B7280' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "payment_apps_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"relation" text DEFAULT 'friend' NOT NULL,
	"color_hex" text DEFAULT '#6B7280' NOT NULL,
	"upi_handle" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refunds" (
	"id" text PRIMARY KEY NOT NULL,
	"expense_id" text NOT NULL,
	"amount_paise" integer NOT NULL,
	"refunded_at" text NOT NULL,
	"status" text DEFAULT 'received' NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"to_instrument_id" text,
	"to_account_id" text,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reward_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"instrument_id" text NOT NULL,
	"name" text NOT NULL,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_base" boolean DEFAULT false NOT NULL,
	"match_merchants" text DEFAULT '[]' NOT NULL,
	"match_categories" text DEFAULT '[]' NOT NULL,
	"match_apps" text DEFAULT '[]' NOT NULL,
	"channel" text DEFAULT 'any' NOT NULL,
	"rate_type" text DEFAULT 'percent' NOT NULL,
	"rate_bps" integer DEFAULT 0 NOT NULL,
	"block_size_paise" integer DEFAULT 10000 NOT NULL,
	"points_per_block" integer DEFAULT 0 NOT NULL,
	"min_txn_paise" integer DEFAULT 0 NOT NULL,
	"max_txn_paise" integer,
	"cap_units" integer,
	"cap_period" text DEFAULT 'none' NOT NULL,
	"cap_group" text DEFAULT '' NOT NULL,
	"exclude_categories" text DEFAULT '[]' NOT NULL,
	"exclude_merchants" text DEFAULT '[]' NOT NULL,
	"requires_flag" text,
	"requires_flag_value" boolean DEFAULT true NOT NULL,
	"valid_from" text,
	"valid_to" text,
	"active" boolean DEFAULT true NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"direction" text NOT NULL,
	"person_id" text,
	"amount_paise" integer NOT NULL,
	"occurred_at" text NOT NULL,
	"instrument_id" text,
	"account_id" text,
	"payment_app_slug" text,
	"purpose" text DEFAULT 'other' NOT NULL,
	"counts_as_spend" boolean DEFAULT false NOT NULL,
	"settles_transfer_id" text,
	"related_expense_id" text,
	"note" text DEFAULT '' NOT NULL,
	"created_at" text DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "adjustments" ADD CONSTRAINT "adjustments_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refunds" ADD CONSTRAINT "refunds_expense_id_expenses_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."expenses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reward_rules" ADD CONSTRAINT "reward_rules_instrument_id_instruments_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instruments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "adj_expense_idx" ON "adjustments" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "exp_date_idx" ON "expenses" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "exp_instrument_idx" ON "expenses" USING btree ("instrument_id","occurred_at");--> statement-breakpoint
CREATE INDEX "exp_category_idx" ON "expenses" USING btree ("category_slug");--> statement-breakpoint
CREATE INDEX "ref_expense_idx" ON "refunds" USING btree ("expense_id");--> statement-breakpoint
CREATE INDEX "rr_instrument_idx" ON "reward_rules" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "tr_person_idx" ON "transfers" USING btree ("person_id");--> statement-breakpoint
CREATE INDEX "tr_date_idx" ON "transfers" USING btree ("occurred_at");
