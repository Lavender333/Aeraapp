-- =====================================================
-- AERA Emergency Response Application
-- Row Level Security (RLS) Policies
-- Org-Based Multi-Tenant Security
-- =====================================================

-- =====================================================
-- ENABLE RLS ON ALL TABLES
-- =====================================================

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE replenishment_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE broadcasts ENABLE ROW LEVEL SECURITY;
ALTER TABLE help_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE vitals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ready_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_community_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE damage_assessments ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- HELPER FUNCTIONS FOR RLS
-- =====================================================

-- Get current user's org_id
CREATE OR REPLACE FUNCTION public.user_org_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT org_id FROM profiles WHERE id = (select auth.uid());
$$;

-- Get current user's role
CREATE OR REPLACE FUNCTION public.user_role()
RETURNS user_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT role FROM profiles WHERE id = (select auth.uid());
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = (select auth.uid()) AND role = 'ADMIN'
  );
$$;

-- Check if current user is institution admin for their org
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
    WHERE id = (select auth.uid()) AND role IN ('ADMIN', 'INSTITUTION_ADMIN')
  );
$$;

-- =====================================================
-- DROP LEGACY POLICIES (cleanup for lint)
-- =====================================================

-- organizations
DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Authenticated can view organizations" ON organizations;
DROP POLICY IF EXISTS "Anon can view organizations" ON organizations;
DROP POLICY IF EXISTS "orgs_insert_auth" ON organizations;
DROP POLICY IF EXISTS "Admins can create organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Institution admins can update their organization" ON organizations;

-- profiles
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view org profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Institution admins can update org profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;

-- inventory
DROP POLICY IF EXISTS "Users can view org inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can view all inventory" ON inventory;
DROP POLICY IF EXISTS "Institution admins can update org inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update any inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can insert inventory" ON inventory;

-- replenishment_requests
DROP POLICY IF EXISTS "Users can view org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Contractors can view all requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Users can create org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Admins can create any request" ON replenishment_requests;
DROP POLICY IF EXISTS "Users can update org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Contractors can update requests" ON replenishment_requests;

-- member_statuses
DROP POLICY IF EXISTS "Users can view org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Admins and responders can view all statuses" ON member_statuses;
DROP POLICY IF EXISTS "Users can update org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Users can insert org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Admins can insert any member status" ON member_statuses;

-- broadcasts
DROP POLICY IF EXISTS "Users can view org broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Admins can view all broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Institution admins can update org broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Admins can update any broadcast" ON broadcasts;
DROP POLICY IF EXISTS "Admins can insert broadcasts" ON broadcasts;

-- help_requests
DROP POLICY IF EXISTS "Users can view own help requests" ON help_requests;
DROP POLICY IF EXISTS "Users can view org help requests" ON help_requests;
DROP POLICY IF EXISTS "Responders can view all help requests" ON help_requests;
DROP POLICY IF EXISTS "Users can create own help requests" ON help_requests;
DROP POLICY IF EXISTS "Admins can create any help request" ON help_requests;
DROP POLICY IF EXISTS "Users can update own help requests" ON help_requests;
DROP POLICY IF EXISTS "Responders can update help requests" ON help_requests;
DROP POLICY IF EXISTS "Institution admins can update org help requests" ON help_requests;

-- members
DROP POLICY IF EXISTS "Users can view org members" ON members;
DROP POLICY IF EXISTS "Admins can view all members" ON members;
DROP POLICY IF EXISTS "Institution admins can insert org members" ON members;
DROP POLICY IF EXISTS "Institution admins can update org members" ON members;
DROP POLICY IF EXISTS "Institution admins can delete org members" ON members;
DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins can delete members" ON members;

-- activity_log
DROP POLICY IF EXISTS "Users can view own activity" ON activity_log;
DROP POLICY IF EXISTS "Institution admins can view org activity" ON activity_log;
DROP POLICY IF EXISTS "Admins can view all activity" ON activity_log;
DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_log;

-- vitals
DROP POLICY IF EXISTS "Users can view own vitals" ON vitals;
DROP POLICY IF EXISTS "Users can update own vitals" ON vitals;
DROP POLICY IF EXISTS "Users can insert own vitals" ON vitals;

-- ready_kits
DROP POLICY IF EXISTS "Users can view own ready kits" ON ready_kits;
DROP POLICY IF EXISTS "Users can insert own ready kits" ON ready_kits;
DROP POLICY IF EXISTS "Users can update own ready kits" ON ready_kits;
DROP POLICY IF EXISTS "Users can delete own ready kits" ON ready_kits;

-- household_members
DROP POLICY IF EXISTS "Users can view own household members" ON household_members;
DROP POLICY IF EXISTS "Users can insert own household members" ON household_members;
DROP POLICY IF EXISTS "Users can update own household members" ON household_members;
DROP POLICY IF EXISTS "Users can delete own household members" ON household_members;

-- pets
DROP POLICY IF EXISTS "Users can view own pets" ON pets;
DROP POLICY IF EXISTS "Users can insert own pets" ON pets;
DROP POLICY IF EXISTS "Users can update own pets" ON pets;
DROP POLICY IF EXISTS "Users can delete own pets" ON pets;

-- trusted_community_connections
DROP POLICY IF EXISTS "Users can view own community connections" ON trusted_community_connections;
DROP POLICY IF EXISTS "Users can insert own community connections" ON trusted_community_connections;
DROP POLICY IF EXISTS "Users can update own community connections" ON trusted_community_connections;
DROP POLICY IF EXISTS "Users can delete own community connections" ON trusted_community_connections;

-- storage.objects (avatars)
DROP POLICY IF EXISTS "Users can upload own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own avatar" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload own assessment photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can view own assessment photos" ON storage.objects;

-- damage_assessments
DROP POLICY IF EXISTS "Users can view own damage assessments" ON damage_assessments;
DROP POLICY IF EXISTS "Users can insert own damage assessments" ON damage_assessments;
DROP POLICY IF EXISTS "Institution admins can view org damage assessments" ON damage_assessments;
DROP POLICY IF EXISTS "Admins can view all damage assessments" ON damage_assessments;

-- =====================================================
-- ORGANIZATIONS TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Admins can view all organizations" ON organizations;
DROP POLICY IF EXISTS "Users can view their organization" ON organizations;
DROP POLICY IF EXISTS "Authenticated can view organizations" ON organizations;
DROP POLICY IF EXISTS "Anon can view organizations" ON organizations;
DROP POLICY IF EXISTS "orgs_insert_auth" ON organizations;
DROP POLICY IF EXISTS "Admins can create organizations" ON organizations;
DROP POLICY IF EXISTS "Admins can update organizations" ON organizations;
DROP POLICY IF EXISTS "Institution admins can update their organization" ON organizations;

CREATE POLICY "Organizations can view"
  ON organizations FOR SELECT
  USING ((select auth.role()) IN ('authenticated', 'anon') OR public.is_admin());

CREATE POLICY "Organizations can create"
  ON organizations FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Organizations can update"
  ON organizations FOR UPDATE
  USING (public.is_admin() OR (id = public.user_org_id() AND public.is_institution_admin()));

-- =====================================================
-- PROFILES TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can view org profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Institution admins can update org profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;

CREATE POLICY "Profiles can view"
  ON profiles FOR SELECT
  USING (
    id = (select auth.uid())
    OR org_id = public.user_org_id()
    OR public.is_admin()
    OR (select auth.role()) = 'dashboard_user'
  );

CREATE POLICY "Profiles can update"
  ON profiles FOR UPDATE
  USING (
    id = (select auth.uid())
    OR public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  )
  WITH CHECK (
    id = (select auth.uid())
    OR public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

CREATE POLICY "Profiles can insert"
  ON profiles FOR INSERT
  WITH CHECK (id = (select auth.uid()) OR public.is_admin());

-- =====================================================
-- INVENTORY TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view org inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can view all inventory" ON inventory;

DROP POLICY IF EXISTS "Institution admins can update org inventory" ON inventory;
DROP POLICY IF EXISTS "Admins can update any inventory" ON inventory;

CREATE POLICY "Inventory can view"
  ON inventory FOR SELECT
  USING (org_id = public.user_org_id() OR public.is_admin());

CREATE POLICY "Inventory can update"
  ON inventory FOR UPDATE
  USING (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  )
  WITH CHECK (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

-- Auto-insert is handled by trigger, but allow admins to insert
CREATE POLICY "Admins can insert inventory"
  ON inventory FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- REPLENISHMENT_REQUESTS TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Admins can view all requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Contractors can view all requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Users can create org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Admins can create any request" ON replenishment_requests;
DROP POLICY IF EXISTS "Users can update org requests" ON replenishment_requests;
DROP POLICY IF EXISTS "Contractors can update requests" ON replenishment_requests;

CREATE POLICY "Replenishment requests can view"
  ON replenishment_requests FOR SELECT
  USING (
    org_id = public.user_org_id()
    OR public.is_admin()
    OR public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY')
  );

CREATE POLICY "Replenishment requests can insert"
  ON replenishment_requests FOR INSERT
  WITH CHECK (org_id = public.user_org_id() OR public.is_admin());

CREATE POLICY "Replenishment requests can update"
  ON replenishment_requests FOR UPDATE
  USING (
    org_id = public.user_org_id()
    OR public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY', 'ADMIN')
  );

-- =====================================================
-- MEMBER_STATUSES TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Admins and responders can view all statuses" ON member_statuses;
DROP POLICY IF EXISTS "Users can update org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Users can insert org member statuses" ON member_statuses;
DROP POLICY IF EXISTS "Admins can insert any member status" ON member_statuses;

CREATE POLICY "Member statuses can view"
  ON member_statuses FOR SELECT
  USING (
    org_id = public.user_org_id()
    OR public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY')
  );

CREATE POLICY "Member statuses can update"
  ON member_statuses FOR UPDATE
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Member statuses can insert"
  ON member_statuses FOR INSERT
  WITH CHECK (org_id = public.user_org_id() OR public.is_admin());

-- =====================================================
-- VITALS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own vitals"
  ON vitals FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Users can update own vitals"
  ON vitals FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can insert own vitals"
  ON vitals FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

-- =====================================================
-- READY_KITS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own ready kits"
  ON ready_kits FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Users can insert own ready kits"
  ON ready_kits FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can update own ready kits"
  ON ready_kits FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can delete own ready kits"
  ON ready_kits FOR DELETE
  USING (profile_id = (select auth.uid()));

-- =====================================================
-- HOUSEHOLD_MEMBERS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own household members"
  ON household_members FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Users can insert own household members"
  ON household_members FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can update own household members"
  ON household_members FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can delete own household members"
  ON household_members FOR DELETE
  USING (profile_id = (select auth.uid()));

-- =====================================================
-- PETS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own pets"
  ON pets FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Users can insert own pets"
  ON pets FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can update own pets"
  ON pets FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can delete own pets"
  ON pets FOR DELETE
  USING (profile_id = (select auth.uid()));

-- =====================================================
-- TRUSTED_COMMUNITY_CONNECTIONS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own community connections"
  ON trusted_community_connections FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Users can insert own community connections"
  ON trusted_community_connections FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can update own community connections"
  ON trusted_community_connections FOR UPDATE
  USING (profile_id = (select auth.uid()))
  WITH CHECK (profile_id = (select auth.uid()));

CREATE POLICY "Users can delete own community connections"
  ON trusted_community_connections FOR DELETE
  USING (profile_id = (select auth.uid()));

-- =====================================================
-- BROADCASTS TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view org broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Admins can view all broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Institution admins can update org broadcasts" ON broadcasts;
DROP POLICY IF EXISTS "Admins can update any broadcast" ON broadcasts;
DROP POLICY IF EXISTS "Admins can insert broadcasts" ON broadcasts;

CREATE POLICY "Broadcasts can view"
  ON broadcasts FOR SELECT
  USING (org_id = public.user_org_id() OR public.is_admin());

CREATE POLICY "Broadcasts can update"
  ON broadcasts FOR UPDATE
  USING (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  )
  WITH CHECK (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

CREATE POLICY "Broadcasts can insert"
  ON broadcasts FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- HELP_REQUESTS TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own help requests" ON help_requests;
DROP POLICY IF EXISTS "Users can view org help requests" ON help_requests;
DROP POLICY IF EXISTS "Responders can view all help requests" ON help_requests;

DROP POLICY IF EXISTS "Users can create own help requests" ON help_requests;
DROP POLICY IF EXISTS "Admins can create any help request" ON help_requests;
DROP POLICY IF EXISTS "Users can update own help requests" ON help_requests;
DROP POLICY IF EXISTS "Responders can update help requests" ON help_requests;
DROP POLICY IF EXISTS "Institution admins can update org help requests" ON help_requests;

CREATE POLICY "Help requests can view"
  ON help_requests FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR org_id = public.user_org_id()
    OR public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY')
  );

CREATE POLICY "Help requests can insert"
  ON help_requests FOR INSERT
  WITH CHECK (user_id = (select auth.uid()) OR public.is_admin());

CREATE POLICY "Help requests can update"
  ON help_requests FOR UPDATE
  USING (
    user_id = (select auth.uid())
    OR public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY')
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  )
  WITH CHECK (
    user_id = (select auth.uid())
    OR public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY')
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

-- =====================================================
-- MEMBERS TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view org members" ON members;
DROP POLICY IF EXISTS "Admins can view all members" ON members;

DROP POLICY IF EXISTS "Institution admins can insert org members" ON members;
DROP POLICY IF EXISTS "Institution admins can update org members" ON members;
DROP POLICY IF EXISTS "Institution admins can delete org members" ON members;
DROP POLICY IF EXISTS "Admins can insert members" ON members;
DROP POLICY IF EXISTS "Admins can update members" ON members;
DROP POLICY IF EXISTS "Admins can delete members" ON members;

CREATE POLICY "Members can view"
  ON members FOR SELECT
  USING (
    org_id = public.user_org_id()
    OR public.is_admin()
    OR (select auth.role()) = 'dashboard_user'
  );

CREATE POLICY "Members can insert"
  ON members FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

CREATE POLICY "Members can update"
  ON members FOR UPDATE
  USING (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  )
  WITH CHECK (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

CREATE POLICY "Members can delete"
  ON members FOR DELETE
  USING (
    public.is_admin()
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
  );

-- =====================================================
-- DAMAGE_ASSESSMENTS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own damage assessments"
  ON damage_assessments FOR SELECT
  USING (profile_id = (select auth.uid()));

CREATE POLICY "Institution admins can view org damage assessments"
  ON damage_assessments FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_institution_admin());

CREATE POLICY "Admins can view all damage assessments"
  ON damage_assessments FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Users can insert own damage assessments"
  ON damage_assessments FOR INSERT
  WITH CHECK (profile_id = (select auth.uid()));

-- =====================================================
-- ACTIVITY_LOG TABLE RLS
-- =====================================================

DROP POLICY IF EXISTS "Users can view own activity" ON activity_log;
DROP POLICY IF EXISTS "Institution admins can view org activity" ON activity_log;
DROP POLICY IF EXISTS "Admins can view all activity" ON activity_log;
DROP POLICY IF EXISTS "Users can insert activity logs" ON activity_log;

CREATE POLICY "Activity log can view"
  ON activity_log FOR SELECT
  USING (
    user_id = (select auth.uid())
    OR (org_id = public.user_org_id() AND public.is_institution_admin())
    OR public.is_admin()
  );

CREATE POLICY "Activity log can insert"
  ON activity_log FOR INSERT
  WITH CHECK (user_id = (select auth.uid()) OR public.is_admin());

-- =====================================================
-- STORAGE BUCKET POLICIES (for file uploads)
-- =====================================================

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for damage assessment photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('assessment_photos', 'assessment_photos', false)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND 
    (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND 
    (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Users can upload their own assessment photos
CREATE POLICY "Users can upload own assessment photos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'assessment_photos' AND 
    (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- Users can view their own assessment photos
CREATE POLICY "Users can view own assessment photos"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'assessment_photos' AND 
    (select auth.uid())::text = (storage.foldername(name))[1]
  );

-- =====================================================
-- REALTIME PUBLICATION
-- =====================================================

-- Enable realtime for critical tables
-- This allows frontend to subscribe to changes
BEGIN;
  -- Remove existing publication if it exists
  DROP PUBLICATION IF EXISTS supabase_realtime;
  
  -- Create publication for realtime tables
  CREATE PUBLICATION supabase_realtime FOR TABLE 
    help_requests,
    broadcasts,
    inventory,
    member_statuses,
    replenishment_requests;
COMMIT;

-- =====================================================
-- TESTING & VALIDATION
-- =====================================================

-- Test helper function to verify RLS policies
CREATE OR REPLACE FUNCTION test_rls_policies()
RETURNS TABLE (
  table_name TEXT,
  policy_count BIGINT,
  rls_enabled BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || tablename AS table_name,
    COUNT(policyname) AS policy_count,
    bool_or(relrowsecurity) AS rls_enabled
  FROM pg_policies p
  JOIN pg_class c ON c.relname = p.tablename
  WHERE schemaname = 'public'
  GROUP BY schemaname, tablename, relrowsecurity
  ORDER BY table_name;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

-- Run: SELECT * FROM test_rls_policies();

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON FUNCTION public.user_org_id() IS 'Returns the organization ID of the currently authenticated user';
COMMENT ON FUNCTION public.user_role() IS 'Returns the role of the currently authenticated user';
COMMENT ON FUNCTION public.is_admin() IS 'Returns true if the current user has ADMIN role';
COMMENT ON FUNCTION public.is_institution_admin() IS 'Returns true if the current user has ADMIN or INSTITUTION_ADMIN role';
