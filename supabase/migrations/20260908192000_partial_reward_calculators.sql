-- This is an estimate, not a statement replica. Only HDFC Millennia retains
-- executable rules; known deterministic gaps keep the other catalogue cards
-- on manual reward tracking.
UPDATE public.instruments
SET reward_coverage = 'manual'
WHERE id IN (
  'card-flipkart-axis',
  'card-amazon-pay-icici'
) AND is_catalog_card = true;--> statement-breakpoint

UPDATE public.instruments
SET
  reward_coverage = 'partial',
  reward_unit = 'CashPoints',
  unit_value_paise = 100,
  reward_kind = 'points',
  excluded_categories = '["fuel","rent","taxes","credit-card-bill","wallet-load","emi"]'
WHERE id = 'card-hdfc-millennia-cc'
  AND is_catalog_card = true;--> statement-breakpoint

DELETE FROM public.reward_rules
WHERE instrument_id IN (
  'card-flipkart-axis',
  'card-hdfc-millennia-cc',
  'card-amazon-pay-icici'
);--> statement-breakpoint

INSERT INTO public.reward_rules (
  id, instrument_id, name, priority, is_base,
  match_merchants, match_categories, match_apps, channel,
  rate_type, rate_bps, min_txn_paise,
  cap_units, cap_period, cap_group,
  exclude_categories, exclude_merchants,
  requires_flag, requires_flag_value, active, notes
)
VALUES
  ('mcc-smartbuy-downgrade', 'card-hdfc-millennia-cc', 'SmartBuy or PayZapp routed', 200, false,
   '[]', '[]', '["smartbuy","payzapp"]', 'any', 'percent', 100, 0,
   1000, 'month', 'mcc-base', '[]', '[]', NULL, true, true,
   'Estimated base-rate routing; settlement date, TID/MID/MCC and issuer exclusions apply.'),
  ('mcc-partners', 'card-hdfc-millennia-cc', 'Ten named online merchants', 0, false,
   '["amazon","bookmyshow","cultfit","flipkart","myntra","sonyliv","swiggy","tatacliq","uber","zomato"]',
   '[]', '[]', 'online', 'percent', 500, 0,
   1000, 'month', 'mcc-accelerated', '["gift-cards"]', '[]', NULL, true, true,
   'Estimated headline rate; settlement date, non-EMI requirement, TID/MID/MCC and issuer exclusions apply.'),
  ('mcc-base', 'card-hdfc-millennia-cc', 'Other eligible spending', 0, true,
   '[]', '[]', '[]', 'any', 'percent', 100, 0,
   1000, 'month', 'mcc-base', '[]', '[]', NULL, true, true,
   'Estimated base CashPoints; settlement date and issuer exclusions apply.')
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
  min_txn_paise = EXCLUDED.min_txn_paise,
  cap_units = EXCLUDED.cap_units,
  cap_period = EXCLUDED.cap_period,
  cap_group = EXCLUDED.cap_group,
  exclude_categories = EXCLUDED.exclude_categories,
  exclude_merchants = EXCLUDED.exclude_merchants,
  requires_flag = EXCLUDED.requires_flag,
  requires_flag_value = EXCLUDED.requires_flag_value,
  active = EXCLUDED.active,
  notes = EXCLUDED.notes;
