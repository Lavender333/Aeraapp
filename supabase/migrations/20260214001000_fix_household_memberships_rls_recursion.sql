-- Fix RLS recursion on household_memberships
-- Date: 2026-02-14

-- The previous SELECT policy referenced household_memberships inside itself,
-- which can trigger: "infinite recursion detected in policy for relation household_memberships"

DROP POLICY IF EXISTS household_memberships_select_related ON public.household_memberships;

CREATE POLICY household_memberships_select_related
ON public.household_memberships
FOR SELECT
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
