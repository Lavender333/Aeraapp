-- Security hardening migration for household/readiness domain
-- Date: 2026-02-13

-- 1) Ensure org_members view is security invoker (not security definer)
CREATE OR REPLACE VIEW public.org_members AS
SELECT * FROM public.members;

ALTER VIEW public.org_members SET (security_invoker = true);

-- 2) Enable RLS on PostGIS reference table flagged by linter
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'spatial_ref_sys'
  ) THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
      EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_read_all ON public.spatial_ref_sys';
      EXECUTE 'CREATE POLICY spatial_ref_sys_read_all ON public.spatial_ref_sys FOR SELECT USING (true)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping spatial_ref_sys RLS hardening: current role is not owner of public.spatial_ref_sys';
    END;
  END IF;
END $$;

-- 3) Enable RLS on newly exposed household/readiness tables
ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_readiness_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.readiness_items ENABLE ROW LEVEL SECURITY;

-- 4) Household helper functions: lock search_path
DO $$
BEGIN
  IF to_regprocedure('public.generate_household_code()') IS NOT NULL THEN
    ALTER FUNCTION public.generate_household_code() SET search_path = public;
  END IF;

  IF to_regprocedure('public.set_households_code()') IS NOT NULL THEN
    ALTER FUNCTION public.set_households_code() SET search_path = public;
  END IF;
END $$;

-- Existing linter-warned functions: lock search_path
DO $$
BEGIN
  IF to_regprocedure('public.calculate_vulnerability_risk(integer,boolean,boolean,boolean,boolean,boolean,boolean)') IS NOT NULL THEN
    ALTER FUNCTION public.calculate_vulnerability_risk(integer, boolean, boolean, boolean, boolean, boolean, boolean) SET search_path = public;
  END IF;

  IF to_regprocedure('public.compute_drift(numeric,numeric)') IS NOT NULL THEN
    ALTER FUNCTION public.compute_drift(numeric, numeric) SET search_path = public;
  END IF;

  IF to_regprocedure('public.set_vulnerability_risk_score()') IS NOT NULL THEN
    ALTER FUNCTION public.set_vulnerability_risk_score() SET search_path = public;
  END IF;

  IF to_regprocedure('public.drift_status_from_value(numeric)') IS NOT NULL THEN
    ALTER FUNCTION public.drift_status_from_value(numeric) SET search_path = public;
  END IF;

  IF to_regprocedure('public.recommended_kit_duration_from_risk(numeric)') IS NOT NULL THEN
    ALTER FUNCTION public.recommended_kit_duration_from_risk(numeric) SET search_path = public;
  END IF;
END $$;

-- 5) Replace any pre-existing policies for these tables
DROP POLICY IF EXISTS households_select_auth ON public.households;
DROP POLICY IF EXISTS households_insert_owner ON public.households;
DROP POLICY IF EXISTS households_update_owner ON public.households;
DROP POLICY IF EXISTS households_delete_owner ON public.households;

DROP POLICY IF EXISTS household_memberships_select_related ON public.household_memberships;
DROP POLICY IF EXISTS household_memberships_insert_self ON public.household_memberships;
DROP POLICY IF EXISTS household_memberships_update_owner ON public.household_memberships;
DROP POLICY IF EXISTS household_memberships_delete_self_or_owner ON public.household_memberships;

DROP POLICY IF EXISTS household_invitations_select_member_or_pending ON public.household_invitations;
DROP POLICY IF EXISTS household_invitations_insert_owner ON public.household_invitations;
DROP POLICY IF EXISTS household_invitations_update_owner ON public.household_invitations;
DROP POLICY IF EXISTS household_invitations_update_accept_self ON public.household_invitations;
DROP POLICY IF EXISTS household_invitations_delete_owner ON public.household_invitations;

DROP POLICY IF EXISTS household_readiness_scores_select_member ON public.household_readiness_scores;
DROP POLICY IF EXISTS household_readiness_scores_insert_member ON public.household_readiness_scores;
DROP POLICY IF EXISTS household_readiness_scores_update_member ON public.household_readiness_scores;
DROP POLICY IF EXISTS household_readiness_scores_delete_owner ON public.household_readiness_scores;

DROP POLICY IF EXISTS readiness_items_select_member ON public.readiness_items;
DROP POLICY IF EXISTS readiness_items_insert_member ON public.readiness_items;
DROP POLICY IF EXISTS readiness_items_update_member ON public.readiness_items;
DROP POLICY IF EXISTS readiness_items_delete_owner ON public.readiness_items;

-- 6) households policies
CREATE POLICY households_select_auth
ON public.households
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY households_insert_owner
ON public.households
FOR INSERT
TO authenticated
WITH CHECK (owner_profile_id = auth.uid());

CREATE POLICY households_update_owner
ON public.households
FOR UPDATE
TO authenticated
USING (owner_profile_id = auth.uid())
WITH CHECK (owner_profile_id = auth.uid());

CREATE POLICY households_delete_owner
ON public.households
FOR DELETE
TO authenticated
USING (owner_profile_id = auth.uid());

-- 7) household_memberships policies
CREATE POLICY household_memberships_select_related
ON public.household_memberships
FOR SELECT
TO authenticated
USING (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.household_memberships me
    WHERE me.household_id = household_memberships.household_id
      AND me.profile_id = auth.uid()
  )
);

CREATE POLICY household_memberships_insert_self
ON public.household_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  profile_id = auth.uid()
  AND (
    role = 'MEMBER'
    OR (
      role = 'OWNER'
      AND EXISTS (
        SELECT 1
        FROM public.households h
        WHERE h.id = household_id
          AND h.owner_profile_id = auth.uid()
      )
    )
  )
);

CREATE POLICY household_memberships_update_owner
ON public.household_memberships
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_memberships.household_id
      AND h.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_memberships.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

CREATE POLICY household_memberships_delete_self_or_owner
ON public.household_memberships
FOR DELETE
TO authenticated
USING (
  profile_id = auth.uid()
  OR EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_memberships.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

-- 8) household_invitations policies
CREATE POLICY household_invitations_select_member_or_pending
ON public.household_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_invitations.household_id
      AND hm.profile_id = auth.uid()
  )
  OR status = 'PENDING'
);

CREATE POLICY household_invitations_insert_owner
ON public.household_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  inviter_profile_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_invitations.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

CREATE POLICY household_invitations_update_owner
ON public.household_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_invitations.household_id
      AND h.owner_profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_invitations.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

CREATE POLICY household_invitations_update_accept_self
ON public.household_invitations
FOR UPDATE
TO authenticated
USING (status = 'PENDING')
WITH CHECK (
  accepted_by_profile_id = auth.uid()
  AND status IN ('ACCEPTED', 'EXPIRED')
);

CREATE POLICY household_invitations_delete_owner
ON public.household_invitations
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_invitations.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

-- 9) household_readiness_scores policies
CREATE POLICY household_readiness_scores_select_member
ON public.household_readiness_scores
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_readiness_scores.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY household_readiness_scores_insert_member
ON public.household_readiness_scores
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_readiness_scores.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY household_readiness_scores_update_member
ON public.household_readiness_scores
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_readiness_scores.household_id
      AND hm.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_readiness_scores.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY household_readiness_scores_delete_owner
ON public.household_readiness_scores
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = household_readiness_scores.household_id
      AND h.owner_profile_id = auth.uid()
  )
);

-- 10) readiness_items policies
CREATE POLICY readiness_items_select_member
ON public.readiness_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = readiness_items.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY readiness_items_insert_member
ON public.readiness_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = readiness_items.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY readiness_items_update_member
ON public.readiness_items
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = readiness_items.household_id
      AND hm.profile_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = readiness_items.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY readiness_items_delete_owner
ON public.readiness_items
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.households h
    WHERE h.id = readiness_items.household_id
      AND h.owner_profile_id = auth.uid()
  )
);
