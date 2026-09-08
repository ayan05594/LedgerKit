ALTER TABLE "instruments" ADD COLUMN "owner_user_id" text;--> statement-breakpoint
CREATE INDEX "instrument_owner_idx" ON "instruments" USING btree ("owner_user_id","archived","sort_order");--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_catalog_owner_check"
  CHECK (NOT "is_catalog_card" OR "owner_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "instruments" ADD CONSTRAINT "instruments_owner_nonblank_check"
  CHECK ("owner_user_id" IS NULL OR btrim("owner_user_id") <> '');--> statement-breakpoint

-- Official products remain global. A user-added fallback is selectable only by
-- its owner and always keeps manual reward coverage in application code.
CREATE OR REPLACE FUNCTION "public"."save_user_card_selection"(
  "p_user_id" text,
  "p_instrument_ids" text[],
  "p_no_cards" boolean
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
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id::text = p_user_id
  ) THEN
    RAISE EXCEPTION 'The authenticated user does not exist' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_onboarding (
    user_id,
    cards_completed_at,
    skipped_cards,
    updated_at
  )
  VALUES (p_user_id, NULL, false, completed_at)
  ON CONFLICT (user_id) DO NOTHING;

  PERFORM 1
  FROM public.user_onboarding
  WHERE user_id = p_user_id
  FOR UPDATE;

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
              'active',
              'invite_only',
              'secured',
              'applications_paused'
            )
            AND instruments.archived = false
          )
          OR EXISTS (
            SELECT 1
            FROM public.user_card_selections AS existing_selection
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
  WHERE user_id = p_user_id;

  INSERT INTO public.user_card_selections (user_id, instrument_id)
  SELECT p_user_id, instrument_id
  FROM unnest(valid_ids) AS selected(instrument_id);

  INSERT INTO public.user_onboarding (
    user_id,
    cards_completed_at,
    skipped_cards,
    updated_at
  )
  VALUES (
    p_user_id,
    completed_at,
    COALESCE(p_no_cards, false),
    completed_at
  )
  ON CONFLICT (user_id) DO UPDATE SET
    cards_completed_at = EXCLUDED.cards_completed_at,
    skipped_cards = EXCLUDED.skipped_cards,
    updated_at = EXCLUDED.updated_at;

  RETURN valid_ids;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION "public"."save_user_card_selection"(text, text[], boolean) FROM PUBLIC;--> statement-breakpoint
REVOKE ALL ON FUNCTION "public"."save_user_card_selection"(text, text[], boolean) FROM anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "public"."save_user_card_selection"(text, text[], boolean) TO service_role;
