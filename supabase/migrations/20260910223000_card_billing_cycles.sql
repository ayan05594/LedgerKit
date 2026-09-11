-- Per-user card cycles and repayments. Catalogue card rows are shared, so bill
-- dates must live on the user's wallet selection rather than on instruments.
ALTER TABLE public.user_card_selections
  ADD COLUMN IF NOT EXISTS statement_day integer,
  ADD COLUMN IF NOT EXISTS due_offset_days integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS repayment_account_id text,
  ADD COLUMN IF NOT EXISTS opening_outstanding_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS opening_date text,
  ADD COLUMN IF NOT EXISTS autopay_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS autopay_amount_paise integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_configured_at text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_card_selection_repayment_account_fk'
      AND conrelid = 'public.user_card_selections'::regclass
  ) THEN
    ALTER TABLE public.user_card_selections
      ADD CONSTRAINT user_card_selection_repayment_account_fk
      FOREIGN KEY (repayment_account_id) REFERENCES public.accounts(id)
      ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_card_selection_statement_day_check'
      AND conrelid = 'public.user_card_selections'::regclass
  ) THEN
    ALTER TABLE public.user_card_selections
      ADD CONSTRAINT user_card_selection_statement_day_check
      CHECK (statement_day IS NULL OR statement_day BETWEEN 1 AND 31);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_card_selection_due_offset_check'
      AND conrelid = 'public.user_card_selections'::regclass
  ) THEN
    ALTER TABLE public.user_card_selections
      ADD CONSTRAINT user_card_selection_due_offset_check
      CHECK (due_offset_days BETWEEN 1 AND 45);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_card_selection_autopay_mode_check'
      AND conrelid = 'public.user_card_selections'::regclass
  ) THEN
    ALTER TABLE public.user_card_selections
      ADD CONSTRAINT user_card_selection_autopay_mode_check
      CHECK (autopay_mode IN ('none', 'full', 'minimum', 'fixed'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_card_selection_opening_nonnegative'
      AND conrelid = 'public.user_card_selections'::regclass
  ) THEN
    ALTER TABLE public.user_card_selections
      ADD CONSTRAINT user_card_selection_opening_nonnegative
      CHECK (opening_outstanding_paise >= 0 AND autopay_amount_paise >= 0);
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.card_payments (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  instrument_id text NOT NULL REFERENCES public.instruments(id) ON DELETE RESTRICT,
  account_id text REFERENCES public.accounts(id) ON DELETE SET NULL,
  amount_paise integer NOT NULL,
  paid_at text NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at text NOT NULL DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  updated_at text NOT NULL DEFAULT to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
  CONSTRAINT card_payment_amount_positive CHECK (amount_paise > 0)
);

CREATE INDEX IF NOT EXISTS card_payment_user_date_idx
  ON public.card_payments(user_id, paid_at);
CREATE INDEX IF NOT EXISTS card_payment_instrument_date_idx
  ON public.card_payments(instrument_id, paid_at);
CREATE INDEX IF NOT EXISTS card_payment_account_idx
  ON public.card_payments(account_id);
ALTER TABLE public.card_payments ENABLE ROW LEVEL SECURITY;

-- Keep billing configuration when the user opens Settings and saves the same
-- wallet again. Only deselected rows are removed and newly selected rows added.
CREATE OR REPLACE FUNCTION public.save_user_card_selection(
  p_user_id text,
  p_instrument_ids text[],
  p_no_cards boolean
)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  requested_ids text[];
  valid_ids text[];
  completed_at text := to_char(
    timezone('utc', now()),
    'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
  );
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'A user id is required' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id::text = p_user_id) THEN
    RAISE EXCEPTION 'The authenticated user does not exist' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_onboarding (
    user_id, cards_completed_at, skipped_cards, updated_at
  )
  VALUES (p_user_id, NULL, false, completed_at)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1 FROM public.user_onboarding
  WHERE user_id = p_user_id FOR UPDATE;

  SELECT COALESCE(array_agg(normalized.id ORDER BY normalized.id), ARRAY[]::text[])
  INTO requested_ids
  FROM (
    SELECT DISTINCT btrim(value) AS id
    FROM unnest(COALESCE(p_instrument_ids, ARRAY[]::text[])) AS input_values(value)
    WHERE btrim(value) <> ''
  ) AS normalized;

  IF COALESCE(p_no_cards, false) AND cardinality(requested_ids) > 0 THEN
    RAISE EXCEPTION 'Cards and no-cards cannot both be selected' USING ERRCODE = '22023';
  END IF;
  IF NOT COALESCE(p_no_cards, false) AND cardinality(requested_ids) = 0 THEN
    RAISE EXCEPTION 'Select at least one card or explicitly choose no cards' USING ERRCODE = '22023';
  END IF;

  SELECT COALESCE(
    array_agg(instruments.id ORDER BY instruments.sort_order, instruments.name),
    ARRAY[]::text[]
  )
  INTO valid_ids
  FROM public.instruments
  WHERE instruments.id = ANY(requested_ids)
    AND instruments.kind = 'credit'
    AND (
      (
        instruments.is_catalog_card = true
        AND (
          (
            instruments.availability IN (
              'active', 'invite_only', 'secured', 'applications_paused'
            )
            AND instruments.archived = false
          )
          OR EXISTS (
            SELECT 1 FROM public.user_card_selections AS existing_selection
            WHERE existing_selection.user_id = p_user_id
              AND existing_selection.instrument_id = instruments.id
          )
        )
      )
      OR (
        instruments.is_catalog_card = false
        AND instruments.owner_user_id = p_user_id
        AND instruments.reward_coverage = 'manual'
        AND instruments.archived = false
      )
    );

  IF cardinality(valid_ids) <> cardinality(requested_ids) THEN
    RAISE EXCEPTION 'One or more cards are not available to this user' USING ERRCODE = '22023';
  END IF;

  DELETE FROM public.user_card_selections
  WHERE user_id = p_user_id
    AND NOT (instrument_id = ANY(valid_ids));

  INSERT INTO public.user_card_selections (user_id, instrument_id)
  SELECT p_user_id, instrument_id
  FROM unnest(valid_ids) AS selected(instrument_id)
  ON CONFLICT (user_id, instrument_id) DO NOTHING;

  INSERT INTO public.user_onboarding (
    user_id, cards_completed_at, skipped_cards, updated_at
  )
  VALUES (p_user_id, completed_at, COALESCE(p_no_cards, false), completed_at)
  ON CONFLICT (user_id) DO UPDATE SET
    cards_completed_at = EXCLUDED.cards_completed_at,
    skipped_cards = EXCLUDED.skipped_cards,
    updated_at = EXCLUDED.updated_at;

  RETURN valid_ids;
END;
$$;

REVOKE ALL ON FUNCTION public.save_user_card_selection(text, text[], boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_user_card_selection(text, text[], boolean) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_user_card_selection(text, text[], boolean) TO service_role;
