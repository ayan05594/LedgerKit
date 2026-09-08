CREATE OR REPLACE FUNCTION public.ledgerkit_record_standalone_receipt(
  p_user_id text,
  p_reimbursement_id text,
  p_receipt_id text,
  p_amount_paise integer,
  p_received_at text,
  p_note text,
  p_created_at text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  expected_amount integer;
  already_received bigint;
  is_written_off boolean;
BEGIN
  IF p_user_id IS NULL OR btrim(p_user_id) = '' THEN
    RAISE EXCEPTION 'A user is required.' USING ERRCODE = '22023';
  END IF;
  IF p_amount_paise IS NULL OR p_amount_paise <= 0 THEN
    RAISE EXCEPTION 'Receipt amount must be positive.' USING ERRCODE = '22023';
  END IF;

  SELECT expected_paise, written_off
  INTO expected_amount, is_written_off
  FROM public.standalone_reimbursements
  WHERE id = p_reimbursement_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reimbursement not found.' USING ERRCODE = 'P0002';
  END IF;
  IF is_written_off THEN
    RAISE EXCEPTION 'A payment cannot be recorded for a written-off reimbursement.'
      USING ERRCODE = '23514';
  END IF;

  SELECT COALESCE(sum(amount_paise), 0)
  INTO already_received
  FROM public.standalone_reimbursement_receipts
  WHERE reimbursement_id = p_reimbursement_id AND user_id = p_user_id;

  IF already_received + p_amount_paise > expected_amount THEN
    RAISE EXCEPTION 'Payment cannot exceed the outstanding reimbursement amount.'
      USING ERRCODE = '23514';
  END IF;

  INSERT INTO public.standalone_reimbursement_receipts (
    id, user_id, reimbursement_id, amount_paise, received_at, note, created_at
  ) VALUES (
    p_receipt_id,
    p_user_id,
    p_reimbursement_id,
    p_amount_paise,
    p_received_at,
    COALESCE(p_note, ''),
    p_created_at
  );

  RETURN p_receipt_id;
END;
$$;--> statement-breakpoint

REVOKE ALL ON FUNCTION public.ledgerkit_record_standalone_receipt(
  text, text, text, integer, text, text, text
) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ledgerkit_record_standalone_receipt(
  text, text, text, integer, text, text, text
) TO service_role;
