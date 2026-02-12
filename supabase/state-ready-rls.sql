-- =====================================================
-- AERA State-Ready RLS Policies
-- Scope-aware controls for state/county/org/member access.
-- =====================================================

ALTER TABLE geography_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vulnerability_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE region_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE model_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_recommendations ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Scope helper functions
-- -----------------------------------------------------
CREATE OR REPLACE FUNCTION public.user_state_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT state_id FROM profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.user_county_id()
RETURNS TEXT
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT county_id FROM profiles WHERE id = (SELECT auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_state_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('ADMIN', 'STATE_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_county_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_org_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN')
  );
$$;

-- -----------------------------------------------------
-- Cleanup old policies if re-running
-- -----------------------------------------------------
DROP POLICY IF EXISTS "Geography regions can view" ON geography_regions;
DROP POLICY IF EXISTS "Geography regions can modify" ON geography_regions;

DROP POLICY IF EXISTS "Vulnerability profiles can view" ON vulnerability_profiles;
DROP POLICY IF EXISTS "Vulnerability profiles can insert" ON vulnerability_profiles;
DROP POLICY IF EXISTS "Vulnerability profiles can update" ON vulnerability_profiles;

DROP POLICY IF EXISTS "Alerts can view" ON alerts;
DROP POLICY IF EXISTS "Alerts can modify" ON alerts;

DROP POLICY IF EXISTS "Region snapshots can view" ON region_snapshots;
DROP POLICY IF EXISTS "Region snapshots can modify" ON region_snapshots;

DROP POLICY IF EXISTS "Model audit log can view" ON model_audit_log;
DROP POLICY IF EXISTS "Model audit log can insert" ON model_audit_log;

DROP POLICY IF EXISTS "Audit log can view" ON audit_log;
DROP POLICY IF EXISTS "Audit log can insert" ON audit_log;

DROP POLICY IF EXISTS "Kit rules can view" ON kit_rules;
DROP POLICY IF EXISTS "Kit rules can modify" ON kit_rules;

DROP POLICY IF EXISTS "Kit recommendations can view" ON kit_recommendations;
DROP POLICY IF EXISTS "Kit recommendations can insert" ON kit_recommendations;
DROP POLICY IF EXISTS "Kit recommendations can update" ON kit_recommendations;

-- -----------------------------------------------------
-- geography_regions
-- -----------------------------------------------------
CREATE POLICY "Geography regions can view"
  ON geography_regions FOR SELECT
  USING (
    public.is_state_admin()
    OR (state_id = public.user_state_id() AND public.is_county_admin())
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

CREATE POLICY "Geography regions can modify"
  ON geography_regions FOR ALL
  USING (public.is_state_admin())
  WITH CHECK (public.is_state_admin());

-- -----------------------------------------------------
-- vulnerability_profiles (PII-sensitive)
-- -----------------------------------------------------
CREATE POLICY "Vulnerability profiles can view"
  ON vulnerability_profiles FOR SELECT
  USING (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

CREATE POLICY "Vulnerability profiles can insert"
  ON vulnerability_profiles FOR INSERT
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

CREATE POLICY "Vulnerability profiles can update"
  ON vulnerability_profiles FOR UPDATE
  USING (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  )
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

-- -----------------------------------------------------
-- alerts
-- -----------------------------------------------------
CREATE POLICY "Alerts can view"
  ON alerts FOR SELECT
  USING (
    public.is_state_admin()
    OR (state_id = public.user_state_id() AND public.is_county_admin())
    OR (organization_id = public.user_org_id())
    OR (SELECT auth.role()) = 'authenticated'
  );

CREATE POLICY "Alerts can modify"
  ON alerts FOR ALL
  USING (public.is_state_admin())
  WITH CHECK (public.is_state_admin());

-- -----------------------------------------------------
-- region_snapshots (aggregate analytics)
-- -----------------------------------------------------
CREATE POLICY "Region snapshots can view"
  ON region_snapshots FOR SELECT
  USING (
    public.is_state_admin()
    OR (state_id = public.user_state_id() AND public.is_county_admin())
    OR (organization_id = public.user_org_id())
  );

CREATE POLICY "Region snapshots can modify"
  ON region_snapshots FOR ALL
  USING (public.is_state_admin())
  WITH CHECK (public.is_state_admin());

-- -----------------------------------------------------
-- model_audit_log
-- -----------------------------------------------------
CREATE POLICY "Model audit log can view"
  ON model_audit_log FOR SELECT
  USING (public.is_county_admin() OR public.is_state_admin() OR public.is_admin());

CREATE POLICY "Model audit log can insert"
  ON model_audit_log FOR INSERT
  WITH CHECK (public.is_state_admin() OR public.is_admin());

-- -----------------------------------------------------
-- audit_log
-- -----------------------------------------------------
CREATE POLICY "Audit log can view"
  ON audit_log FOR SELECT
  USING (public.is_admin() OR public.is_state_admin());

CREATE POLICY "Audit log can insert"
  ON audit_log FOR INSERT
  WITH CHECK (
    actor_id = (SELECT auth.uid())
    OR public.is_admin()
  );

-- -----------------------------------------------------
-- kit_rules (global explainable rules)
-- -----------------------------------------------------
CREATE POLICY "Kit rules can view"
  ON kit_rules FOR SELECT
  USING ((SELECT auth.role()) = 'authenticated' OR public.is_admin());

CREATE POLICY "Kit rules can modify"
  ON kit_rules FOR ALL
  USING (public.is_state_admin() OR public.is_admin())
  WITH CHECK (public.is_state_admin() OR public.is_admin());

-- -----------------------------------------------------
-- kit_recommendations (member + scoped admin views)
-- -----------------------------------------------------
CREATE POLICY "Kit recommendations can view"
  ON kit_recommendations FOR SELECT
  USING (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR public.is_state_admin()
    OR (state_id = public.user_state_id() AND public.is_county_admin())
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

CREATE POLICY "Kit recommendations can insert"
  ON kit_recommendations FOR INSERT
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

CREATE POLICY "Kit recommendations can update"
  ON kit_recommendations FOR UPDATE
  USING (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  )
  WITH CHECK (
    profile_id = (SELECT auth.uid())
    OR public.is_admin()
    OR (organization_id = public.user_org_id() AND public.is_org_admin())
  );

-- -----------------------------------------------------
-- Realtime publication for state-ready map tables
-- -----------------------------------------------------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;

  CREATE PUBLICATION supabase_realtime FOR TABLE
    help_requests,
    broadcasts,
    inventory,
    member_statuses,
    replenishment_requests,
    alerts,
    region_snapshots,
    geography_regions;
COMMIT;

COMMENT ON FUNCTION public.user_state_id() IS 'Returns state scope for the authenticated user';
COMMENT ON FUNCTION public.user_county_id() IS 'Returns county scope for the authenticated user';
COMMENT ON FUNCTION public.is_state_admin() IS 'Returns true for ADMIN or STATE_ADMIN';
COMMENT ON FUNCTION public.is_county_admin() IS 'Returns true for ADMIN/STATE_ADMIN/COUNTY_ADMIN';
COMMENT ON FUNCTION public.is_org_admin() IS 'Returns true for ADMIN/INSTITUTION_ADMIN/ORG_ADMIN';
