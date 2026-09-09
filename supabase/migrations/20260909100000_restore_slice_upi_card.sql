-- Restore the stable Slice card identity that predates the searchable
-- catalogue. ON CONFLICT updates the shared product row in place, so every
-- historical expense keeps the same instrument_id and no user data is copied.
--
-- The legacy model valued one "Monies" unit at INR 1; the current programme
-- represents one money as a point worth one paise at the base redemption tier.
-- Normalize the stored unit count before changing the instrument, but preserve
-- every historical cash value, exclusion decision, refund result, and manual
-- override exactly as it was recorded. The old 100-paise unit value makes this
-- guard idempotent if the migration is replayed.
UPDATE "public"."expenses" AS expense
SET
  "reward_units_milli" = LEAST(
    expense."reward_units_milli"::bigint * 100,
    2147483647
  )::integer,
  "reward_capped_units_milli" = LEAST(
    expense."reward_capped_units_milli"::bigint * 100,
    2147483647
  )::integer
WHERE expense."instrument_id" = 'card-slice-rupay'
  AND expense."user_id" IS NOT NULL
  AND btrim(expense."user_id") <> ''
  AND EXISTS (
    SELECT 1
    FROM "public"."instruments" AS instrument
    WHERE instrument."id" = 'card-slice-rupay'
      AND instrument."unit_value_paise" = 100
  );--> statement-breakpoint

INSERT INTO "public"."instruments" (
  "id", "name", "short_name", "issuer", "network", "kind",
  "color_from", "color_to", "reward_unit", "unit_value_paise", "reward_kind",
  "overall_cap_period", "excluded_categories", "options",
  "annual_fee_paise", "annual_fee_known", "joining_fee_paise",
  "joining_fee_known", "fee_note", "fee_waiver_spend_paise",
  "forex_markup_bps", "perks", "source_note", "catalog_category",
  "catalog_summary", "official_url", "terms_url", "verified_at",
  "availability", "reward_coverage", "is_catalog_card", "owner_user_id",
  "archived", "sort_order"
)
VALUES
  ('card-slice-rupay',
  'slice UPI Credit Card',
  'slice UPI',
  'slice Small Finance Bank',
  'rupay',
  'credit',
  '#6C3EF5',
  '#2B1071',
  'monies',
  1,
  'points',
  'none',
  '["fuel","rent","taxes","credit-card-bill","wallet-load","insurance","investments","bank-charges","education","courses","emi"]',
  '{"catalogId":"slice-upi-credit-card","aliases":["card-slice-rupay"],"sourceUrls":["https://slice.bank.in/cc-mitc","https://slice.bank.in/cc-terms"],"rewardEstimate":"base-redemption-tier","higherRedemptionTiersRequireBalance":true,"sparkOffersTrackedManually":true,"statementDatesUserSpecific":true,"agricultureMccNotAutomated":true,"gamingMccNotAutomated":true}',
  0,
  true,
  0,
  true,
  'The current MITC lists no joining or annual membership fee; taxes and future notified changes may apply.',
  0,
  0,
  '["RuPay card payments and UPI QR scans","Up to 3% cash redemption value under the published tier conditions","No joining fee, annual membership fee or bank forex markup in the current MITC","Eligible INR 2,000+ transactions may be sliced over 2 or 3 months; sliced transactions earn no monies","Weekly slice spark offers are separate, changing promotions"]',
  '["The calculator uses the published 1% base redemption tier; higher tiers depend on the user''s current monies balance and the 3% tier also requires the published savings-account balance condition.","EMI/sliced transactions, wallet loads, fuel, insurance, rent, education, taxes, government services, financial-institution, gaming/gambling, Agriculture MCC 0763, cash-withdrawal and international transactions do not earn monies under the current MITC. Agriculture and the specified gaming/gambling MCCs are not mapped automatically to broad app categories.","Eligibility is limited to customers onboarded to slice''s digital savings account who meet the bank''s KYC and credit criteria; billing-cycle and due dates are cardholder-specific.","Refunds, cancellations, missed minimum payments and programme misuse can reverse or forfeit monies.","slice spark brand offers rotate and must be recorded manually when applicable."]',
  'upi',
  'Earn 1 money per eligible INR 1 spent directly or through UPI. Cash redemption starts at 1% and rises to 1.5%, 2% or 3% based on monies balance and, for 3%, the required slice savings-account quarterly balance.',
  'https://slice.bank.in/credit-card',
  'https://slice.bank.in/cc-mitc',
  '2026-09-09',
  'active',
  'partial',
  true,
  NULL,
  false,
  40)
ON CONFLICT ("id") DO UPDATE SET
  "name" = EXCLUDED."name",
  "short_name" = EXCLUDED."short_name",
  "issuer" = EXCLUDED."issuer",
  "network" = EXCLUDED."network",
  "kind" = EXCLUDED."kind",
  "color_from" = EXCLUDED."color_from",
  "color_to" = EXCLUDED."color_to",
  "reward_unit" = EXCLUDED."reward_unit",
  "unit_value_paise" = EXCLUDED."unit_value_paise",
  "reward_kind" = EXCLUDED."reward_kind",
  "overall_cap_units" = NULL,
  "overall_cap_period" = EXCLUDED."overall_cap_period",
  "excluded_categories" = EXCLUDED."excluded_categories",
  "options" = EXCLUDED."options",
  "annual_fee_paise" = EXCLUDED."annual_fee_paise",
  "annual_fee_known" = EXCLUDED."annual_fee_known",
  "joining_fee_paise" = EXCLUDED."joining_fee_paise",
  "joining_fee_known" = EXCLUDED."joining_fee_known",
  "fee_note" = EXCLUDED."fee_note",
  "fee_waiver_spend_paise" = EXCLUDED."fee_waiver_spend_paise",
  "forex_markup_bps" = EXCLUDED."forex_markup_bps",
  "perks" = EXCLUDED."perks",
  "source_note" = EXCLUDED."source_note",
  "catalog_category" = EXCLUDED."catalog_category",
  "catalog_summary" = EXCLUDED."catalog_summary",
  "official_url" = EXCLUDED."official_url",
  "terms_url" = EXCLUDED."terms_url",
  "verified_at" = EXCLUDED."verified_at",
  "availability" = EXCLUDED."availability",
  "reward_coverage" = EXCLUDED."reward_coverage",
  "is_catalog_card" = true,
  "owner_user_id" = NULL,
  "archived" = false,
  "sort_order" = EXCLUDED."sort_order";--> statement-breakpoint

-- Keep the existing rule ID so previously calculated expense records remain
-- intelligible. The calculation is deliberately marked partial: it models the
-- current 1% base redemption tier, while balance-based tiers and rotating
-- slice spark offers remain manual.
INSERT INTO "public"."reward_rules" (
  "id", "instrument_id", "name", "priority", "is_base",
  "match_merchants", "match_categories", "match_apps", "channel",
  "rate_type", "rate_bps", "block_size_paise", "points_per_block",
  "min_txn_paise", "max_txn_paise", "cap_units", "cap_period",
  "cap_group", "exclude_categories", "exclude_merchants",
  "requires_flag", "requires_flag_value", "valid_from", "valid_to",
  "active", "notes"
)
VALUES (
  'slice-base',
  'card-slice-rupay',
  'Eligible card and UPI spends',
  0,
  true,
  '[]',
  '[]',
  '[]',
  'any',
  'points_per_block',
  0,
  100,
  1,
  0,
  NULL,
  NULL,
  'none',
  'slice-base',
  '[]',
  '[]',
  NULL,
  true,
  NULL,
  NULL,
  true,
  'Awards 1 money per eligible INR 1 and values it at the published 1% base redemption tier. Higher balance-based tiers and slice spark offers are not automated.'
)
ON CONFLICT ("id") DO UPDATE SET
  "instrument_id" = EXCLUDED."instrument_id",
  "name" = EXCLUDED."name",
  "priority" = EXCLUDED."priority",
  "is_base" = EXCLUDED."is_base",
  "match_merchants" = EXCLUDED."match_merchants",
  "match_categories" = EXCLUDED."match_categories",
  "match_apps" = EXCLUDED."match_apps",
  "channel" = EXCLUDED."channel",
  "rate_type" = EXCLUDED."rate_type",
  "rate_bps" = EXCLUDED."rate_bps",
  "block_size_paise" = EXCLUDED."block_size_paise",
  "points_per_block" = EXCLUDED."points_per_block",
  "min_txn_paise" = EXCLUDED."min_txn_paise",
  "max_txn_paise" = EXCLUDED."max_txn_paise",
  "cap_units" = EXCLUDED."cap_units",
  "cap_period" = EXCLUDED."cap_period",
  "cap_group" = EXCLUDED."cap_group",
  "exclude_categories" = EXCLUDED."exclude_categories",
  "exclude_merchants" = EXCLUDED."exclude_merchants",
  "requires_flag" = EXCLUDED."requires_flag",
  "requires_flag_value" = EXCLUDED."requires_flag_value",
  "valid_from" = EXCLUDED."valid_from",
  "valid_to" = EXCLUDED."valid_to",
  "active" = EXCLUDED."active",
  "notes" = EXCLUDED."notes";--> statement-breakpoint

-- The original catalogue migration could not preselect Slice because this row
-- was not yet public. Restore it only for the same user whose own historical
-- expense already references the stable card ID.
INSERT INTO "public"."user_card_selections" ("user_id", "instrument_id")
SELECT DISTINCT
  expenses."user_id",
  'card-slice-rupay'
FROM "public"."expenses" AS expenses
WHERE expenses."user_id" IS NOT NULL
  AND btrim(expenses."user_id") <> ''
  AND expenses."instrument_id" = 'card-slice-rupay'
ON CONFLICT ("user_id", "instrument_id") DO NOTHING;--> statement-breakpoint

-- A historical Slice owner now has a real wallet selection, so an earlier
-- "I have no cards" choice can no longer remain true. Do not mark unfinished
-- onboarding complete; only repair contradictory completed records.
UPDATE "public"."user_onboarding" AS onboarding
SET
  "skipped_cards" = false,
  "updated_at" = to_char(
    timezone('utc', now()),
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  )
WHERE onboarding."skipped_cards" = true
  AND EXISTS (
    SELECT 1
    FROM "public"."expenses" AS expense
    WHERE expense."user_id" = onboarding."user_id"
      AND expense."instrument_id" = 'card-slice-rupay'
  );--> statement-breakpoint

INSERT INTO "public"."settings" ("key", "value")
VALUES ('credit_card_catalog_version', 'india-2026-09-09-v6')
ON CONFLICT ("key") DO UPDATE SET "value" = EXCLUDED."value";--> statement-breakpoint
