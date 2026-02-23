-- Allow institution admins of a parent organization to access child org data.
-- A child org is defined as organizations.parent_org_id = public.user_org_id().

-- Helper: is a target org either the user's org or a child of it?
CREATE OR REPLACE FUNCTION public.org_in_scope(target_org_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT (
    target_org_id = public.user_org_id()
    OR EXISTS (
      SELECT 1
      FROM organizations o
      WHERE o.id = target_org_id
        AND o.parent_org_id = public.user_org_id()
    )
  );
$$;

-- =====================================================
-- MEMBERS
-- =====================================================

DROP POLICY IF EXISTS "Members can view" ON members;
DROP POLICY IF EXISTS "Members can insert" ON members;
DROP POLICY IF EXISTS "Members can update" ON members;
DROP POLICY IF EXISTS "Members can delete" ON members;

CREATE POLICY "Members can view"
  ON members FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
    OR (select auth.role()) = 'dashboard_user'
  );

CREATE POLICY "Members can insert"
  ON members FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Members can update"
  ON members FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Members can delete"
  ON members FOR DELETE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

-- =====================================================
-- INVENTORY
-- =====================================================

DROP POLICY IF EXISTS "Inventory can view" ON inventory;
DROP POLICY IF EXISTS "Inventory can update" ON inventory;

CREATE POLICY "Inventory can view"
  ON inventory FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Inventory can update"
  ON inventory FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

-- =====================================================
-- REPLENISHMENT REQUESTS
-- =====================================================

DROP POLICY IF EXISTS "Replenishment requests can view" ON replenishment_requests;
DROP POLICY IF EXISTS "Replenishment requests can insert" ON replenishment_requests;
DROP POLICY IF EXISTS "Replenishment requests can update" ON replenishment_requests;

CREATE POLICY "Replenishment requests can view"
  ON replenishment_requests FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
    OR public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY')
  );

CREATE POLICY "Replenishment requests can insert"
  ON replenishment_requests FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Replenishment requests can update"
  ON replenishment_requests FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
    OR public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY')
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
    OR public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY')
  );

-- =====================================================
-- MEMBER STATUSES
-- =====================================================

DROP POLICY IF EXISTS "Member statuses can view" ON member_statuses;
DROP POLICY IF EXISTS "Member statuses can update" ON member_statuses;
DROP POLICY IF EXISTS "Member statuses can insert" ON member_statuses;

CREATE POLICY "Member statuses can view"
  ON member_statuses FOR SELECT
  USING (
    public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY')
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Member statuses can update"
  ON member_statuses FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Member statuses can insert"
  ON member_statuses FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

-- =====================================================
-- BROADCASTS
-- =====================================================

DROP POLICY IF EXISTS "Broadcasts can view" ON broadcasts;
DROP POLICY IF EXISTS "Broadcasts can update" ON broadcasts;
DROP POLICY IF EXISTS "Broadcasts can insert" ON broadcasts;

CREATE POLICY "Broadcasts can view"
  ON broadcasts FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Broadcasts can update"
  ON broadcasts FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  )
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );

CREATE POLICY "Broadcasts can insert"
  ON broadcasts FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_institution_admin() AND public.org_in_scope(org_id))
  );
