-- Restore a maintained Flipkart Axis cashback estimate from the issuer's
-- current cashback terms. Coverage remains partial because Axis awards by MID
-- and caps by each customer's statement quarter, while the shared catalogue
-- has only a default statement day.
UPDATE public.instruments
SET
  reward_coverage = 'partial',
  reward_unit = 'INR',
  unit_value_paise = 100,
  reward_kind = 'statement_cashback',
  excluded_categories = '["fuel","rent","taxes","credit-card-bill","gift-cards","wallet-load","electricity","water-gas","mobile-recharge","broadband","dth-cable","insurance","investments","education","courses","books","emi"]',
  options = (
    COALESCE(NULLIF(options, ''), '{}')::jsonb ||
    '{"floorRewardToWholeUnit":true,"statementQuarterUsesDefaultStatementDay":true,"merchantIdClassificationMayDiffer":true,"excludedTollsNeedManualReview":true}'::jsonb
  )::text
WHERE id = 'card-flipkart-axis'
  AND is_catalog_card = true;--> statement-breakpoint

DELETE FROM public.reward_rules
WHERE instrument_id = 'card-flipkart-axis';--> statement-breakpoint

INSERT INTO public.reward_rules (
  id, instrument_id, name, priority, is_base,
  match_merchants, match_categories, match_apps, channel,
  rate_type, rate_bps, block_size_paise, points_per_block,
  min_txn_paise, max_txn_paise, cap_units, cap_period, cap_group,
  exclude_categories, exclude_merchants,
  requires_flag, requires_flag_value, valid_from, valid_to, active, notes
)
VALUES
  ('fka-myntra', 'card-flipkart-axis', 'Myntra', 0, false,
   '["myntra"]', '[]', '[]', 'any',
   'percent', 750, 10000, 0,
   10000, NULL, 4000, 'quarter', 'fka-myntra',
   '[]', '[]', NULL, true, NULL, NULL, true,
   'Partial estimate: Axis applies the INR 4,000 cap per customer statement quarter and classifies eligibility by merchant ID.'),
  ('fka-flipkart', 'card-flipkart-axis', 'Flipkart', 0, false,
   '["flipkart"]', '[]', '[]', 'any',
   'percent', 500, 10000, 0,
   10000, NULL, 4000, 'quarter', 'fka-flipkart',
   '["gift-cards"]', '[]', NULL, true, NULL, NULL, true,
   'Partial estimate: separate INR 4,000 statement-quarter cap; Flipkart Health and excluded purchases do not qualify.'),
  ('fka-cleartrip', 'card-flipkart-axis', 'Cleartrip', 0, false,
   '["cleartrip"]', '[]', '[]', 'any',
   'percent', 500, 10000, 0,
   10000, NULL, 4000, 'quarter', 'fka-cleartrip',
   '[]', '[]', NULL, true, NULL, NULL, true,
   'Partial estimate: separate INR 4,000 statement-quarter cap and merchant-ID eligibility apply.'),
  ('fka-partners', 'card-flipkart-axis', 'Preferred partners', 0, false,
   '["swiggy","uber","pvr","cultfit"]', '[]', '[]', 'any',
   'percent', 400, 10000, 0,
   10001, NULL, NULL, 'none', 'fka-partners',
   '[]', '[]', NULL, true, NULL, NULL, true,
   'Current preferred-partner estimate. Swiggy acceleration applies only to eligible food-delivery transactions; Axis may change partners without notice.'),
  ('fka-base', 'card-flipkart-axis', 'Other eligible spending', 0, true,
   '[]', '[]', '[]', 'any',
   'percent', 100, 10000, 0,
   10000, NULL, NULL, 'none', 'fka-base',
   '[]', '[]', NULL, true, NULL, NULL, true,
   '1% base cashback estimate. Axis rounds cashback down to the nearest whole rupee per transaction.')
ON CONFLICT (id) DO UPDATE SET
  instrument_id = EXCLUDED.instrument_id,
  name = EXCLUDED.name,
  priority = EXCLUDED.priority,
  is_base = EXCLUDED.is_base,
  match_merchants = EXCLUDED.match_merchants,
  match_categories = EXCLUDED.match_categories,
  match_apps = EXCLUDED.match_apps,
  channel = EXCLUDED.channel,
  rate_type = EXCLUDED.rate_type,
  rate_bps = EXCLUDED.rate_bps,
  block_size_paise = EXCLUDED.block_size_paise,
  points_per_block = EXCLUDED.points_per_block,
  min_txn_paise = EXCLUDED.min_txn_paise,
  max_txn_paise = EXCLUDED.max_txn_paise,
  cap_units = EXCLUDED.cap_units,
  cap_period = EXCLUDED.cap_period,
  cap_group = EXCLUDED.cap_group,
  exclude_categories = EXCLUDED.exclude_categories,
  exclude_merchants = EXCLUDED.exclude_merchants,
  requires_flag = EXCLUDED.requires_flag,
  requires_flag_value = EXCLUDED.requires_flag_value,
  valid_from = EXCLUDED.valid_from,
  valid_to = EXCLUDED.valid_to,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes;--> statement-breakpoint

INSERT INTO public.settings (key, value)
VALUES ('credit_card_catalog_version', 'india-2026-09-10-v8')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;--> statement-breakpoint
