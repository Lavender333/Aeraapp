-- Align verified lead access with the dedicated BUYER role.
-- This follow-up migration updates already-applied environments without rewriting
-- the original monetization migration.

DO $$
BEGIN
  ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'BUYER';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.is_lead_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(COALESCE(p.role::text, '')) = 'ADMIN'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_lead_referrer_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(COALESCE(p.role::text, '')) IN ('ADMIN', 'ORG_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_buyer_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND UPPER(COALESCE(p.role::text, '')) IN ('ADMIN', 'BUYER')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lead_admin_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_lead_referrer_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_buyer_user() TO authenticated;

DROP POLICY IF EXISTS buyer_accounts_select_policy ON buyer_accounts;
CREATE POLICY buyer_accounts_select_policy
  ON buyer_accounts FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (public.is_buyer_user() AND owner_user_id = auth.uid())
  );

DROP POLICY IF EXISTS buyer_accounts_write_policy ON buyer_accounts;
CREATE POLICY buyer_accounts_write_policy
  ON buyer_accounts FOR ALL TO authenticated
  USING (public.is_lead_admin_user())
  WITH CHECK (public.is_lead_admin_user());

DROP POLICY IF EXISTS verified_leads_select_policy ON verified_leads;
CREATE POLICY verified_leads_select_policy
  ON verified_leads FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (public.is_lead_referrer_user() AND submitted_by = auth.uid())
    OR (
      public.is_buyer_user()
      AND assigned_buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS verified_leads_insert_policy ON verified_leads;
CREATE POLICY verified_leads_insert_policy
  ON verified_leads FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lead_admin_user()
    OR (public.is_lead_referrer_user() AND submitted_by = auth.uid())
  );

DROP POLICY IF EXISTS verified_leads_update_policy ON verified_leads;
CREATE POLICY verified_leads_update_policy
  ON verified_leads FOR UPDATE TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND assigned_buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND assigned_buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_disputes_select_policy ON lead_disputes;
CREATE POLICY lead_disputes_select_policy
  ON lead_disputes FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_disputes_insert_policy ON lead_disputes;
CREATE POLICY lead_disputes_insert_policy
  ON lead_disputes FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_disputes_update_policy ON lead_disputes;
CREATE POLICY lead_disputes_update_policy
  ON lead_disputes FOR UPDATE TO authenticated
  USING (public.is_lead_admin_user())
  WITH CHECK (public.is_lead_admin_user());

DROP POLICY IF EXISTS lead_invoices_select_policy ON lead_invoices;
CREATE POLICY lead_invoices_select_policy
  ON lead_invoices FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND buyer_id IN (
        SELECT b.id
        FROM buyer_accounts b
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_invoices_write_policy ON lead_invoices;
CREATE POLICY lead_invoices_write_policy
  ON lead_invoices FOR ALL TO authenticated
  USING (public.is_lead_admin_user())
  WITH CHECK (public.is_lead_admin_user());

DROP POLICY IF EXISTS lead_invoice_lines_select_policy ON lead_invoice_lines;
CREATE POLICY lead_invoice_lines_select_policy
  ON lead_invoice_lines FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR (
      public.is_buyer_user()
      AND invoice_id IN (
        SELECT i.id
        FROM lead_invoices i
        JOIN buyer_accounts b ON b.id = i.buyer_id
        WHERE b.owner_user_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS lead_invoice_lines_write_policy ON lead_invoice_lines;
CREATE POLICY lead_invoice_lines_write_policy
  ON lead_invoice_lines FOR ALL TO authenticated
  USING (public.is_lead_admin_user())
  WITH CHECK (public.is_lead_admin_user());

DROP POLICY IF EXISTS consent_audit_select_policy ON consent_audit_log;
CREATE POLICY consent_audit_select_policy
  ON consent_audit_log FOR SELECT TO authenticated
  USING (public.is_lead_admin_user());

DROP POLICY IF EXISTS consent_audit_insert_policy ON consent_audit_log;
CREATE POLICY consent_audit_insert_policy
  ON consent_audit_log FOR INSERT TO authenticated
  WITH CHECK (
    public.is_lead_admin_user()
    OR (
      user_id = auth.uid()
      AND (
        public.is_lead_referrer_user()
        OR public.is_buyer_user()
      )
    )
  );
