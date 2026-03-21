-- Fix: ORG_ADMIN role was excluded from is_institution_admin() helper function,
-- which caused the "Organizations can update" RLS policy (and other policies that
-- use this function) to silently block ORG_ADMIN users from updating their own
-- organization's address/location. The frontend treats ORG_ADMIN and
-- INSTITUTION_ADMIN as equivalent for org-scoped operations (isOrgScopedAdmin),
-- so the backend function must match.

CREATE OR REPLACE FUNCTION public.is_institution_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN')
  );
$$;
