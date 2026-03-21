-- G.A.P. Fund Infrastructure
-- Creates gap_org_bank_info and gap_disbursements tables so CORE admin can
-- collect ACH/wire bank details from each org and track actual bank transfers.
-- Also seeds the gap_revenue_settings key in app_settings.

-- ---------------------------------------------------------------------------
-- 1. gap_org_bank_info – ACH / wire bank profile per organization
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gap_org_bank_info (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_code         TEXT NOT NULL,
  bank_name        TEXT NOT NULL DEFAULT '',
  beneficiary_name TEXT NOT NULL DEFAULT '',   -- Legal name of org as registered
  routing_number   TEXT NOT NULL DEFAULT '',   -- 9-digit ABA routing (public info)
  account_last4    TEXT NOT NULL DEFAULT '',   -- Last 4 of account # for display
  account_type     TEXT NOT NULL DEFAULT 'checking'
                     CHECK (account_type IN ('checking', 'savings')),
  ein              TEXT,          -- EIN / Tax ID (optional, for charitable compliance)
  bank_address     TEXT,          -- Optional branch address for wire transfers
  notes            TEXT,          -- Special ACH instructions
  verified         BOOLEAN NOT NULL DEFAULT false,
  verified_at      TIMESTAMPTZ,
  added_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

CREATE INDEX IF NOT EXISTS idx_gap_org_bank_info_org_code ON public.gap_org_bank_info(org_code);

ALTER TABLE public.gap_org_bank_info ENABLE ROW LEVEL SECURITY;

-- CORE admins can read and write all bank info
DROP POLICY IF EXISTS "gap_bank_admin_all" ON public.gap_org_bank_info;
CREATE POLICY "gap_bank_admin_all"
  ON public.gap_org_bank_info FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Org admins and institution admins can manage their own org's bank info
DROP POLICY IF EXISTS "gap_bank_org_own" ON public.gap_org_bank_info;
CREATE POLICY "gap_bank_org_own"
  ON public.gap_org_bank_info FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
        AND org_id = gap_org_bank_info.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
        AND org_id = gap_org_bank_info.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.set_gap_bank_info_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gap_bank_info_updated_at ON public.gap_org_bank_info;
CREATE TRIGGER trg_gap_bank_info_updated_at
  BEFORE UPDATE ON public.gap_org_bank_info
  FOR EACH ROW EXECUTE FUNCTION public.set_gap_bank_info_updated_at();

-- ---------------------------------------------------------------------------
-- 2. gap_disbursements – actual bank transfer records per org
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.gap_disbursements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  org_code          TEXT NOT NULL,
  amount_cents      BIGINT NOT NULL CHECK (amount_cents > 0),   -- cents ($500 = 50000)
  status            TEXT NOT NULL DEFAULT 'INITIATED'
                      CHECK (status IN ('INITIATED', 'PENDING', 'SENT', 'CONFIRMED', 'FAILED')),
  disbursement_date DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method    TEXT NOT NULL DEFAULT 'ACH'
                      CHECK (payment_method IN ('ACH', 'WIRE', 'CHECK')),
  reference_number  TEXT,   -- Chase ACH trace / confirmation number
  notes             TEXT,
  approved_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gap_disbursements_org    ON public.gap_disbursements(organization_id);
CREATE INDEX IF NOT EXISTS idx_gap_disbursements_code   ON public.gap_disbursements(org_code);
CREATE INDEX IF NOT EXISTS idx_gap_disbursements_date   ON public.gap_disbursements(disbursement_date DESC);
CREATE INDEX IF NOT EXISTS idx_gap_disbursements_status ON public.gap_disbursements(status);

ALTER TABLE public.gap_disbursements ENABLE ROW LEVEL SECURITY;

-- CORE admins can do everything
DROP POLICY IF EXISTS "gap_disbursements_admin_all" ON public.gap_disbursements;
CREATE POLICY "gap_disbursements_admin_all"
  ON public.gap_disbursements FOR ALL
  USING  (public.is_admin())
  WITH CHECK (public.is_admin());

-- Org admins can READ their own org's disbursement history (read-only)
DROP POLICY IF EXISTS "gap_disbursements_org_read" ON public.gap_disbursements;
CREATE POLICY "gap_disbursements_org_read"
  ON public.gap_disbursements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = (SELECT auth.uid())
        AND role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
        AND org_id = gap_disbursements.organization_id
    )
  );

CREATE OR REPLACE FUNCTION public.set_gap_disbursements_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_gap_disbursements_updated_at ON public.gap_disbursements;
CREATE TRIGGER trg_gap_disbursements_updated_at
  BEFORE UPDATE ON public.gap_disbursements
  FOR EACH ROW EXECUTE FUNCTION public.set_gap_disbursements_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Seed gap_revenue_settings key in app_settings
-- ---------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value_text)
VALUES (
  'gap_revenue_settings',
  '{"membershipPriceUsd":9.99,"appStoreFeePercent":30,"gapFundAllocationPercent":30,"billingCycle":"monthly"}'
)
ON CONFLICT (key) DO NOTHING;
