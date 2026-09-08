-- Tenant boundaries for every user-controlled finance reference. Rows whose
-- owner cannot be proven remain NULL and are quarantined by server filters.
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "user_id" text;--> statement-breakpoint
ALTER TABLE "categories" ADD COLUMN IF NOT EXISTS "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "merchants" ADD COLUMN IF NOT EXISTS "owner_user_id" text;--> statement-breakpoint
ALTER TABLE "payment_apps" ADD COLUMN IF NOT EXISTS "owner_user_id" text;--> statement-breakpoint

-- Catalogue instruments are public product templates; never retain a user's
-- private bank-account link on a globally selectable product.
UPDATE public.instruments
SET account_id = NULL, last4 = '', credit_limit_paise = 0
WHERE is_catalog_card = true
  AND (account_id IS NOT NULL OR last4 <> '' OR credit_limit_paise <> 0);--> statement-breakpoint

-- Pre-catalog instruments were shared rows that could contain one user's
-- private card metadata. They are retained only for foreign-key history, with
-- all personal fields removed and no application read path allowed to expose
-- them.
UPDATE public.instruments
SET account_id = NULL, last4 = '', credit_limit_paise = 0, archived = true
WHERE is_catalog_card = false
  AND (
    account_id IS NOT NULL
    OR last4 <> ''
    OR credit_limit_paise <> 0
    OR archived = false
  );--> statement-breakpoint

DO $$
DECLARE
  auth_user_count integer;
  sole_user_id text;
BEGIN
  SELECT count(*), min(id::text) INTO auth_user_count, sole_user_id
  FROM auth.users;

  -- Child ownership is safely derived from its authenticated parent.
  UPDATE public.adjustments child SET user_id = parent.user_id
  FROM public.expenses parent
  WHERE child.expense_id = parent.id AND parent.user_id IS NOT NULL
    AND child.user_id IS DISTINCT FROM parent.user_id;
  UPDATE public.refunds child SET user_id = parent.user_id
  FROM public.expenses parent
  WHERE child.expense_id = parent.id AND parent.user_id IS NOT NULL
    AND child.user_id IS DISTINCT FROM parent.user_id;
  UPDATE public.standalone_reimbursement_receipts child
  SET user_id = parent.user_id
  FROM public.standalone_reimbursements parent
  WHERE child.reimbursement_id = parent.id
    AND child.user_id IS DISTINCT FROM parent.user_id;

  IF auth_user_count = 1 THEN
    -- There is only one possible owner, so pre-auth personal data is safe.
    UPDATE public.accounts SET user_id = sole_user_id WHERE user_id IS NULL;
    UPDATE public.categories SET owner_user_id = sole_user_id
      WHERE is_system = false AND owner_user_id IS NULL;
    UPDATE public.merchants SET owner_user_id = sole_user_id
      WHERE is_system = false AND owner_user_id IS NULL;
    UPDATE public.payment_apps SET owner_user_id = sole_user_id
      WHERE is_system = false AND owner_user_id IS NULL;
    UPDATE public.people SET user_id = sole_user_id WHERE user_id IS NULL;
  ELSIF auth_user_count > 1 THEN
    -- With multiple users, assign only rows referenced by exactly one user.
    WITH inferred AS (
      SELECT account_id, min(user_id) AS user_id FROM (
        SELECT account_id, user_id FROM public.expenses
          WHERE account_id IS NOT NULL AND user_id IS NOT NULL
        UNION
        SELECT account_id, user_id FROM public.transfers
          WHERE account_id IS NOT NULL AND user_id IS NOT NULL
        UNION
        SELECT to_account_id, user_id FROM public.refunds
          WHERE to_account_id IS NOT NULL AND user_id IS NOT NULL
      ) refs GROUP BY account_id HAVING count(DISTINCT user_id) = 1
    )
    UPDATE public.accounts AS acct SET user_id = inferred.user_id
    FROM inferred
    WHERE acct.id = inferred.account_id AND acct.user_id IS NULL;

    WITH inferred AS (
      SELECT category_slug AS slug, min(user_id) AS user_id
      FROM public.expenses WHERE user_id IS NOT NULL
      GROUP BY category_slug HAVING count(DISTINCT user_id) = 1
    )
    UPDATE public.categories AS category SET owner_user_id = inferred.user_id
    FROM inferred WHERE category.slug = inferred.slug
      AND category.is_system = false AND category.owner_user_id IS NULL;

    WITH inferred AS (
      SELECT merchant_slug AS slug, min(user_id) AS user_id
      FROM public.expenses
      WHERE merchant_slug IS NOT NULL AND user_id IS NOT NULL
      GROUP BY merchant_slug HAVING count(DISTINCT user_id) = 1
    )
    UPDATE public.merchants AS merchant SET owner_user_id = inferred.user_id
    FROM inferred WHERE merchant.slug = inferred.slug
      AND merchant.is_system = false AND merchant.owner_user_id IS NULL;

    WITH inferred AS (
      SELECT slug, min(user_id) AS user_id FROM (
        SELECT payment_app_slug AS slug, user_id FROM public.expenses
          WHERE payment_app_slug IS NOT NULL AND user_id IS NOT NULL
        UNION
        SELECT payment_app_slug AS slug, user_id FROM public.transfers
          WHERE payment_app_slug IS NOT NULL AND user_id IS NOT NULL
      ) refs GROUP BY slug HAVING count(DISTINCT user_id) = 1
    )
    UPDATE public.payment_apps AS app SET owner_user_id = inferred.user_id
    FROM inferred WHERE app.slug = inferred.slug
      AND app.is_system = false AND app.owner_user_id IS NULL;

    WITH inferred AS (
      SELECT person_id, min(user_id) AS user_id
      FROM public.transfers
      WHERE person_id IS NOT NULL AND user_id IS NOT NULL
      GROUP BY person_id HAVING count(DISTINCT user_id) = 1
    )
    UPDATE public.people AS person SET user_id = inferred.user_id
    FROM inferred
    WHERE person.id = inferred.person_id AND person.user_id IS NULL;
  END IF;
END $$;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "accounts_user_idx"
  ON "accounts" ("user_id", "archived", "sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "categories_owner_idx"
  ON "categories" ("owner_user_id", "archived", "sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "merchants_owner_idx"
  ON "merchants" ("owner_user_id", "name");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "payment_apps_owner_idx"
  ON "payment_apps" ("owner_user_id", "sort_order");--> statement-breakpoint

ALTER TABLE "categories" ADD CONSTRAINT "categories_system_owner_check"
  CHECK (NOT "is_system" OR "owner_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_system_owner_check"
  CHECK (NOT "is_system" OR "owner_user_id" IS NULL);--> statement-breakpoint
ALTER TABLE "payment_apps" ADD CONSTRAINT "payment_apps_system_owner_check"
  CHECK (NOT "is_system" OR "owner_user_id" IS NULL);--> statement-breakpoint

-- Database guards prevent future service-role code from crossing tenants.
CREATE OR REPLACE FUNCTION public.ledgerkit_assert_account_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    RAISE EXCEPTION 'account owner is required' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'account owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "accounts_owner_guard" ON "accounts";--> statement-breakpoint
CREATE TRIGGER "accounts_owner_guard" BEFORE INSERT OR UPDATE ON "accounts"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_account_owner();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_taxonomy_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.is_system = true AND NEW.owner_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'system rows cannot have an owner' USING ERRCODE = '23514';
  END IF;
  IF NEW.is_system = false AND (NEW.owner_user_id IS NULL OR btrim(NEW.owner_user_id) = '') THEN
    RAISE EXCEPTION 'personal row owner is required' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND (
    NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id
    OR NEW.is_system IS DISTINCT FROM OLD.is_system
  ) THEN RAISE EXCEPTION 'taxonomy ownership is immutable' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "categories_owner_guard" ON "categories";--> statement-breakpoint
CREATE TRIGGER "categories_owner_guard" BEFORE INSERT OR UPDATE ON "categories"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_taxonomy_owner();--> statement-breakpoint
DROP TRIGGER IF EXISTS "merchants_owner_guard" ON "merchants";--> statement-breakpoint
CREATE TRIGGER "merchants_owner_guard" BEFORE INSERT OR UPDATE ON "merchants"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_taxonomy_owner();--> statement-breakpoint
DROP TRIGGER IF EXISTS "payment_apps_owner_guard" ON "payment_apps";--> statement-breakpoint
CREATE TRIGGER "payment_apps_owner_guard" BEFORE INSERT OR UPDATE ON "payment_apps"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_taxonomy_owner();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_simple_user_owner()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    RAISE EXCEPTION 'row owner is required' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'row owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "people_owner_guard" ON "people";--> statement-breakpoint
CREATE TRIGGER "people_owner_guard" BEFORE INSERT OR UPDATE ON "people"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_simple_user_owner();--> statement-breakpoint
DROP TRIGGER IF EXISTS "standalone_reimbursements_owner_guard"
  ON "standalone_reimbursements";--> statement-breakpoint
CREATE TRIGGER "standalone_reimbursements_owner_guard"
BEFORE INSERT OR UPDATE ON "standalone_reimbursements"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_simple_user_owner();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_expense_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    RAISE EXCEPTION 'expense owner is required' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'expense owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.account_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id)
    AND NOT EXISTS (
    SELECT 1 FROM public.accounts r
    WHERE r.id = NEW.account_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid account reference' USING ERRCODE = '23514'; END IF;
  IF (TG_OP = 'INSERT' OR NEW.category_slug IS DISTINCT FROM OLD.category_slug)
    AND NOT EXISTS (
    SELECT 1 FROM public.categories r WHERE r.slug = NEW.category_slug
      AND (r.is_system = true OR r.owner_user_id = NEW.user_id)
  ) THEN RAISE EXCEPTION 'invalid category reference' USING ERRCODE = '23514'; END IF;
  IF NEW.merchant_slug IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.merchant_slug IS DISTINCT FROM OLD.merchant_slug)
    AND NOT EXISTS (
    SELECT 1 FROM public.merchants r WHERE r.slug = NEW.merchant_slug
      AND (r.is_system = true OR r.owner_user_id = NEW.user_id)
  ) THEN RAISE EXCEPTION 'invalid merchant reference' USING ERRCODE = '23514'; END IF;
  IF NEW.payment_app_slug IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.payment_app_slug IS DISTINCT FROM OLD.payment_app_slug)
    AND NOT EXISTS (
    SELECT 1 FROM public.payment_apps r WHERE r.slug = NEW.payment_app_slug
      AND (r.is_system = true OR r.owner_user_id = NEW.user_id)
  ) THEN RAISE EXCEPTION 'invalid payment method reference' USING ERRCODE = '23514'; END IF;
  IF NEW.instrument_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.instrument_id IS DISTINCT FROM OLD.instrument_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_card_selections r
      WHERE r.user_id = NEW.user_id AND r.instrument_id = NEW.instrument_id
    )
  THEN RAISE EXCEPTION 'invalid card reference' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "expenses_tenant_guard" ON "expenses";--> statement-breakpoint
CREATE TRIGGER "expenses_tenant_guard" BEFORE INSERT OR UPDATE ON "expenses"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_expense_ownership();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_transfer_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.user_id IS NULL OR btrim(NEW.user_id) = '' THEN
    RAISE EXCEPTION 'transfer owner is required' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'transfer owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.person_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.person_id IS DISTINCT FROM OLD.person_id)
    AND NOT EXISTS (
    SELECT 1 FROM public.people r
    WHERE r.id = NEW.person_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid person reference' USING ERRCODE = '23514'; END IF;
  IF NEW.account_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.account_id IS DISTINCT FROM OLD.account_id)
    AND NOT EXISTS (
    SELECT 1 FROM public.accounts r
    WHERE r.id = NEW.account_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid account reference' USING ERRCODE = '23514'; END IF;
  IF NEW.payment_app_slug IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.payment_app_slug IS DISTINCT FROM OLD.payment_app_slug)
    AND NOT EXISTS (
    SELECT 1 FROM public.payment_apps r WHERE r.slug = NEW.payment_app_slug
      AND (r.is_system = true OR r.owner_user_id = NEW.user_id)
  ) THEN RAISE EXCEPTION 'invalid payment method reference' USING ERRCODE = '23514'; END IF;
  IF NEW.related_expense_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.related_expense_id IS DISTINCT FROM OLD.related_expense_id)
    AND NOT EXISTS (
    SELECT 1 FROM public.expenses r
    WHERE r.id = NEW.related_expense_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid related expense' USING ERRCODE = '23514'; END IF;
  IF NEW.settles_transfer_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.settles_transfer_id IS DISTINCT FROM OLD.settles_transfer_id)
    AND NOT EXISTS (
    SELECT 1 FROM public.transfers r
    WHERE r.id = NEW.settles_transfer_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid settled transfer' USING ERRCODE = '23514'; END IF;
  IF NEW.instrument_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.instrument_id IS DISTINCT FROM OLD.instrument_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_card_selections r
      WHERE r.user_id = NEW.user_id AND r.instrument_id = NEW.instrument_id
    )
  THEN RAISE EXCEPTION 'invalid card reference' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "transfers_tenant_guard" ON "transfers";--> statement-breakpoint
CREATE TRIGGER "transfers_tenant_guard" BEFORE INSERT OR UPDATE ON "transfers"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_transfer_ownership();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_expense_child_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'child owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.expenses r
    WHERE r.id = NEW.expense_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid expense owner' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "adjustments_tenant_guard" ON "adjustments";--> statement-breakpoint
CREATE TRIGGER "adjustments_tenant_guard" BEFORE INSERT OR UPDATE ON "adjustments"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_expense_child_ownership();--> statement-breakpoint
DROP TRIGGER IF EXISTS "refunds_tenant_guard" ON "refunds";--> statement-breakpoint
CREATE TRIGGER "refunds_tenant_guard" BEFORE INSERT OR UPDATE ON "refunds"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_expense_child_ownership();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_refund_destination()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF NEW.to_account_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.to_account_id IS DISTINCT FROM OLD.to_account_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.accounts r
      WHERE r.id = NEW.to_account_id AND r.user_id = NEW.user_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses r
      WHERE r.id = NEW.expense_id AND r.user_id = NEW.user_id
        AND r.account_id = NEW.to_account_id
    )
  THEN RAISE EXCEPTION 'invalid refund account' USING ERRCODE = '23514'; END IF;
  IF NEW.to_instrument_id IS NOT NULL
    AND (TG_OP = 'INSERT' OR NEW.to_instrument_id IS DISTINCT FROM OLD.to_instrument_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.user_card_selections r
      WHERE r.user_id = NEW.user_id AND r.instrument_id = NEW.to_instrument_id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.expenses r
      WHERE r.id = NEW.expense_id AND r.user_id = NEW.user_id
        AND r.instrument_id = NEW.to_instrument_id
    )
  THEN RAISE EXCEPTION 'invalid refund card' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "refunds_destination_guard" ON "refunds";--> statement-breakpoint
CREATE TRIGGER "refunds_destination_guard" BEFORE INSERT OR UPDATE ON "refunds"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_refund_destination();--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.ledgerkit_assert_receipt_ownership()
RETURNS trigger LANGUAGE plpgsql SET search_path = public, pg_temp AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'receipt owner is immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW.user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.standalone_reimbursements r
    WHERE r.id = NEW.reimbursement_id AND r.user_id = NEW.user_id
  ) THEN RAISE EXCEPTION 'invalid reimbursement owner' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END $$;--> statement-breakpoint
DROP TRIGGER IF EXISTS "standalone_receipts_tenant_guard"
  ON "standalone_reimbursement_receipts";--> statement-breakpoint
CREATE TRIGGER "standalone_receipts_tenant_guard"
BEFORE INSERT OR UPDATE ON "standalone_reimbursement_receipts"
FOR EACH ROW EXECUTE FUNCTION public.ledgerkit_assert_receipt_ownership();--> statement-breakpoint

CREATE OR REPLACE VIEW public.ledgerkit_tenant_isolation_audit AS SELECT
  (SELECT count(*) FROM public.accounts WHERE user_id IS NULL) AS quarantined_accounts,
  (SELECT count(*) FROM public.categories WHERE is_system = false AND owner_user_id IS NULL) AS quarantined_categories,
  (SELECT count(*) FROM public.merchants WHERE is_system = false AND owner_user_id IS NULL) AS quarantined_merchants,
  (SELECT count(*) FROM public.payment_apps WHERE is_system = false AND owner_user_id IS NULL) AS quarantined_payment_apps,
  (SELECT count(*) FROM public.people WHERE user_id IS NULL) AS quarantined_people;--> statement-breakpoint
REVOKE ALL ON public.ledgerkit_tenant_isolation_audit FROM anon, authenticated;
