-- Add durable household expansion approvals and explicit event household selections.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS selected_household_members JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE TABLE IF NOT EXISTS public.household_expansion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  requester_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  current_additional_members INTEGER NOT NULL DEFAULT 0 CHECK (current_additional_members >= 0),
  requested_additional_members INTEGER NOT NULL CHECK (requested_additional_members > 3),
  approved_additional_members INTEGER CHECK (approved_additional_members IS NULL OR approved_additional_members > 3),
  reason_category TEXT,
  justification TEXT,
  extra_members JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  review_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_household_expansion_requests_household_status
  ON public.household_expansion_requests(household_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_household_expansion_requests_org_status
  ON public.household_expansion_requests(organization_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_household_expansion_requests_requester_status
  ON public.household_expansion_requests(requester_profile_id, status, created_at DESC);

ALTER TABLE public.household_expansion_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_expansion_requests_select_requester ON public.household_expansion_requests;
CREATE POLICY household_expansion_requests_select_requester
  ON public.household_expansion_requests
  FOR SELECT
  USING (requester_profile_id = auth.uid());

DROP POLICY IF EXISTS household_expansion_requests_insert_requester ON public.household_expansion_requests;
CREATE POLICY household_expansion_requests_insert_requester
  ON public.household_expansion_requests
  FOR INSERT
  WITH CHECK (requester_profile_id = auth.uid());

DROP POLICY IF EXISTS household_expansion_requests_select_admin ON public.household_expansion_requests;
CREATE POLICY household_expansion_requests_select_admin
  ON public.household_expansion_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR (
            p.role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
            AND p.org_id IS NOT NULL
            AND p.org_id = household_expansion_requests.organization_id
          )
        )
    )
  );

DROP POLICY IF EXISTS household_expansion_requests_update_admin ON public.household_expansion_requests;
CREATE POLICY household_expansion_requests_update_admin
  ON public.household_expansion_requests
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR (
            p.role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
            AND p.org_id IS NOT NULL
            AND p.org_id = household_expansion_requests.organization_id
          )
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'ADMIN'
          OR (
            p.role IN ('ORG_ADMIN', 'INSTITUTION_ADMIN')
            AND p.org_id IS NOT NULL
            AND p.org_id = household_expansion_requests.organization_id
          )
        )
    )
  );