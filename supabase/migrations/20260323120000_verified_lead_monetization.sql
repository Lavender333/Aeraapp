-- =====================================================
-- AERA Verified Lead Monetization Backend
-- Tables, enums, constraints, and RLS policies
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$
BEGIN
  CREATE TYPE lead_status AS ENUM ('NEW', 'VERIFIED', 'DELIVERED', 'ACCEPTED', 'REJECTED', 'REFUNDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_tier AS ENUM ('A', 'B', 'C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_severity AS ENUM ('HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE lead_channel AS ENUM ('WEB', 'CALL', 'REFERRAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE buyer_billing_model AS ENUM ('PREPAID_WALLET', 'NET_7', 'NET_15');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE invoice_status AS ENUM ('DRAFT', 'SENT', 'PAID', 'OVERDUE', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE invoice_line_event AS ENUM ('ACCEPTED', 'PLATFORM_FEE', 'CREDIT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE dispute_status AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED_CREDIT', 'RESOLVED_DENIED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE dispute_reason AS ENUM (
    'DUPLICATE',
    'OUT_OF_SERVICE_AREA',
    'INVALID_CONTACT',
    'CONSENT_ISSUE',
    'ALREADY_CLIENT',
    'OTHER'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS buyer_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  org_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  license_number TEXT,
  coverage_states TEXT[] NOT NULL DEFAULT '{}',
  accepted_case_types TEXT[] NOT NULL DEFAULT '{}',
  daily_lead_cap INTEGER NOT NULL DEFAULT 25 CHECK (daily_lead_cap >= 0),
  min_quality_score INTEGER NOT NULL DEFAULT 70 CHECK (min_quality_score >= 0 AND min_quality_score <= 100),
  accepted_severities lead_severity[] NOT NULL DEFAULT ARRAY['HIGH', 'MEDIUM', 'LOW']::lead_severity[],
  billing_model buyer_billing_model NOT NULL DEFAULT 'NET_15',
  wallet_balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (wallet_balance_cents >= 0),
  monthly_platform_fee_cents INTEGER NOT NULL DEFAULT 29900 CHECK (monthly_platform_fee_cents >= 0),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  tcpa_verified BOOLEAN NOT NULL DEFAULT FALSE,
  license_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verified_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_lead_id TEXT UNIQUE,
  source_tag TEXT NOT NULL DEFAULT 'organic-web',
  channel lead_channel NOT NULL DEFAULT 'WEB',

  applicant_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  zip_code TEXT NOT NULL,

  consent_to_contact BOOLEAN NOT NULL DEFAULT FALSE,
  consent_timestamp TIMESTAMPTZ,
  tcpa_compliance_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_policy_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  consent_ip_address INET,

  phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  identity_score INTEGER NOT NULL DEFAULT 0 CHECK (identity_score >= 0 AND identity_score <= 100),
  duplicate_checked BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_flagged BOOLEAN NOT NULL DEFAULT FALSE,
  service_area_match BOOLEAN NOT NULL DEFAULT FALSE,

  quality_score INTEGER NOT NULL DEFAULT 0 CHECK (quality_score >= 0 AND quality_score <= 100),
  tier lead_tier NOT NULL DEFAULT 'C',
  severity lead_severity NOT NULL DEFAULT 'LOW',
  case_type TEXT NOT NULL,

  status lead_status NOT NULL DEFAULT 'NEW',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  dispute_window_closes_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  notes TEXT,

  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  assigned_buyer_id UUID REFERENCES buyer_accounts(id) ON DELETE SET NULL,
  rejection_reason TEXT,
  credit_issued BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lead_disputes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES verified_leads(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
  reason dispute_reason NOT NULL,
  notes TEXT,
  status dispute_status NOT NULL DEFAULT 'OPEN',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ,
  credit_issued_cents INTEGER NOT NULL DEFAULT 0 CHECK (credit_issued_cents >= 0),
  submitted_by UUID REFERENCES profiles(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS lead_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES buyer_accounts(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  subtotal_cents INTEGER NOT NULL DEFAULT 0 CHECK (subtotal_cents >= 0),
  credits_cents INTEGER NOT NULL DEFAULT 0 CHECK (credits_cents >= 0),
  total_cents INTEGER NOT NULL DEFAULT 0 CHECK (total_cents >= 0),
  status invoice_status NOT NULL DEFAULT 'DRAFT',
  due_date DATE,
  stripe_payment_intent_id TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES lead_invoices(id) ON DELETE CASCADE,
  lead_id UUID REFERENCES verified_leads(id) ON DELETE SET NULL,
  tier lead_tier,
  price_cents INTEGER NOT NULL,
  event invoice_line_event NOT NULL,
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS consent_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES verified_leads(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_verified_leads_status ON verified_leads(status);
CREATE INDEX IF NOT EXISTS idx_verified_leads_created_at ON verified_leads(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_verified_leads_assigned_buyer ON verified_leads(assigned_buyer_id);
CREATE INDEX IF NOT EXISTS idx_verified_leads_location ON verified_leads(state, city);
CREATE INDEX IF NOT EXISTS idx_lead_disputes_lead_id ON lead_disputes(lead_id);
CREATE INDEX IF NOT EXISTS idx_lead_disputes_buyer_id ON lead_disputes(buyer_id);
CREATE INDEX IF NOT EXISTS idx_lead_invoices_buyer_id ON lead_invoices(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_consent_audit_lead_id ON consent_audit_log(lead_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_lead_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_buyer_accounts_updated_at ON buyer_accounts;
CREATE TRIGGER trg_buyer_accounts_updated_at
  BEFORE UPDATE ON buyer_accounts
  FOR EACH ROW EXECUTE FUNCTION set_lead_updated_at();

DROP TRIGGER IF EXISTS trg_lead_invoices_updated_at ON lead_invoices;
CREATE TRIGGER trg_lead_invoices_updated_at
  BEFORE UPDATE ON lead_invoices
  FOR EACH ROW EXECUTE FUNCTION set_lead_updated_at();

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
      AND UPPER(COALESCE(p.role::text, '')) IN (
        'ADMIN',
        'STATE_ADMIN',
        'COUNTY_ADMIN',
        'ORG_ADMIN',
        'INSTITUTION_ADMIN'
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_lead_admin_user() TO authenticated;

ALTER TABLE buyer_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_disputes ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_invoice_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE consent_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS buyer_accounts_select_policy ON buyer_accounts;
CREATE POLICY buyer_accounts_select_policy
  ON buyer_accounts FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR owner_user_id = auth.uid()
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
    OR submitted_by = auth.uid()
    OR assigned_buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS verified_leads_insert_policy ON verified_leads;
CREATE POLICY verified_leads_insert_policy
  ON verified_leads FOR INSERT TO authenticated
  WITH CHECK (
    submitted_by = auth.uid()
    OR public.is_lead_admin_user()
  );

DROP POLICY IF EXISTS verified_leads_update_policy ON verified_leads;
CREATE POLICY verified_leads_update_policy
  ON verified_leads FOR UPDATE TO authenticated
  USING (
    public.is_lead_admin_user()
    OR assigned_buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_lead_admin_user()
    OR assigned_buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_disputes_select_policy ON lead_disputes;
CREATE POLICY lead_disputes_select_policy
  ON lead_disputes FOR SELECT TO authenticated
  USING (
    public.is_lead_admin_user()
    OR buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS lead_disputes_insert_policy ON lead_disputes;
CREATE POLICY lead_disputes_insert_policy
  ON lead_disputes FOR INSERT TO authenticated
  WITH CHECK (
    buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
    )
    OR public.is_lead_admin_user()
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
    OR buyer_id IN (
      SELECT b.id FROM buyer_accounts b WHERE b.owner_user_id = auth.uid()
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
    OR invoice_id IN (
      SELECT i.id
      FROM lead_invoices i
      JOIN buyer_accounts b ON b.id = i.buyer_id
      WHERE b.owner_user_id = auth.uid()
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
    OR user_id = auth.uid()
  );
