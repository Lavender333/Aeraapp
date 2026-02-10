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
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE trusted_community_connections ENABLE ROW LEVEL SECURITY;

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
  SELECT org_id FROM profiles WHERE id = auth.uid();
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
  SELECT role FROM profiles WHERE id = auth.uid();
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
    WHERE id = auth.uid() AND role = 'ADMIN'
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
    WHERE id = auth.uid() AND role IN ('ADMIN', 'INSTITUTION_ADMIN')
  );
$$;

-- =====================================================
-- ORGANIZATIONS TABLE RLS
-- =====================================================

-- Admin can see all organizations
CREATE POLICY "Admins can view all organizations"
  ON organizations FOR SELECT
  USING (public.is_admin());

-- Users can view their own organization
CREATE POLICY "Users can view their organization"
  ON organizations FOR SELECT
  USING (id = public.user_org_id());

-- Authenticated users can view organizations for signup/search
CREATE POLICY "Authenticated can view organizations"
  ON organizations FOR SELECT
  USING (auth.role() = 'authenticated');

-- Anonymous users can view organizations for signup/search
CREATE POLICY "Anon can view organizations"
  ON organizations FOR SELECT
  USING (auth.role() = 'anon');

-- Admin can create organizations
DROP POLICY IF EXISTS "orgs_insert_auth" ON organizations;

CREATE POLICY "orgs_insert_auth"
  ON organizations FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can create organizations"
  ON organizations FOR INSERT
  WITH CHECK (public.is_admin());

-- Admin can update all organizations
CREATE POLICY "Admins can update organizations"
  ON organizations FOR UPDATE
  USING (public.is_admin());

-- Institution admins can update their own organization
CREATE POLICY "Institution admins can update their organization"
  ON organizations FOR UPDATE
  USING (id = public.user_org_id() AND public.is_institution_admin());

-- =====================================================
-- PROFILES TABLE RLS
-- =====================================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can view profiles in their organization
CREATE POLICY "Users can view org profiles"
  ON profiles FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON profiles FOR SELECT
  USING (public.is_admin());

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Institution admins can update profiles in their org
CREATE POLICY "Institution admins can update org profiles"
  ON profiles FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_institution_admin());

-- Admins can update any profile
CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  USING (public.is_admin());

-- New users can insert their own profile (on signup)
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Admins can create any profile
CREATE POLICY "Admins can create profiles"
  ON profiles FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- INVENTORY TABLE RLS
-- =====================================================

-- Users can view inventory for their organization
CREATE POLICY "Users can view org inventory"
  ON inventory FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins can view all inventory
CREATE POLICY "Admins can view all inventory"
  ON inventory FOR SELECT
  USING (public.is_admin());

-- Institution admins can update their org's inventory
CREATE POLICY "Institution admins can update org inventory"
  ON inventory FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_institution_admin())
  WITH CHECK (org_id = public.user_org_id());

-- Admins can update any inventory
CREATE POLICY "Admins can update any inventory"
  ON inventory FOR UPDATE
  USING (public.is_admin());

-- Auto-insert is handled by trigger, but allow admins to insert
CREATE POLICY "Admins can insert inventory"
  ON inventory FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- REPLENISHMENT_REQUESTS TABLE RLS
-- =====================================================

-- Users can view requests for their organization
CREATE POLICY "Users can view org requests"
  ON replenishment_requests FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON replenishment_requests FOR SELECT
  USING (public.is_admin());

-- Contractors and local authorities can view all requests
CREATE POLICY "Contractors can view all requests"
  ON replenishment_requests FOR SELECT
  USING (public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY'));

-- Users can create requests for their organization
CREATE POLICY "Users can create org requests"
  ON replenishment_requests FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

-- Admins can create any request
CREATE POLICY "Admins can create any request"
  ON replenishment_requests FOR INSERT
  WITH CHECK (public.is_admin());

-- Users can update requests for their organization
CREATE POLICY "Users can update org requests"
  ON replenishment_requests FOR UPDATE
  USING (org_id = public.user_org_id());

-- Contractors can update any request (for fulfillment)
CREATE POLICY "Contractors can update requests"
  ON replenishment_requests FOR UPDATE
  USING (public.user_role() IN ('CONTRACTOR', 'LOCAL_AUTHORITY', 'ADMIN'));

-- =====================================================
-- MEMBER_STATUSES TABLE RLS
-- =====================================================

-- Users can view member statuses for their organization
CREATE POLICY "Users can view org member statuses"
  ON member_statuses FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins and first responders can view all statuses
CREATE POLICY "Admins and responders can view all statuses"
  ON member_statuses FOR SELECT
  USING (public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'));

-- Users can update member statuses for their organization
CREATE POLICY "Users can update org member statuses"
  ON member_statuses FOR UPDATE
  USING (org_id = public.user_org_id())
  WITH CHECK (org_id = public.user_org_id());

-- Users can insert member statuses for their organization
CREATE POLICY "Users can insert org member statuses"
  ON member_statuses FOR INSERT
  WITH CHECK (org_id = public.user_org_id());

-- Admins can insert any member status
CREATE POLICY "Admins can insert any member status"
  ON member_statuses FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- VITALS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own vitals"
  ON vitals FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can update own vitals"
  ON vitals FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can insert own vitals"
  ON vitals FOR INSERT
  WITH CHECK (profile_id = auth.uid());

-- =====================================================
-- HOUSEHOLD_MEMBERS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own household members"
  ON household_members FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own household members"
  ON household_members FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own household members"
  ON household_members FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own household members"
  ON household_members FOR DELETE
  USING (profile_id = auth.uid());

-- =====================================================
-- PETS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own pets"
  ON pets FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own pets"
  ON pets FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own pets"
  ON pets FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own pets"
  ON pets FOR DELETE
  USING (profile_id = auth.uid());

-- =====================================================
-- TRUSTED_COMMUNITY_CONNECTIONS TABLE RLS
-- =====================================================

CREATE POLICY "Users can view own community connections"
  ON trusted_community_connections FOR SELECT
  USING (profile_id = auth.uid());

CREATE POLICY "Users can insert own community connections"
  ON trusted_community_connections FOR INSERT
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can update own community connections"
  ON trusted_community_connections FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());

CREATE POLICY "Users can delete own community connections"
  ON trusted_community_connections FOR DELETE
  USING (profile_id = auth.uid());

-- =====================================================
-- BROADCASTS TABLE RLS
-- =====================================================

-- Users can view broadcasts for their organization
CREATE POLICY "Users can view org broadcasts"
  ON broadcasts FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins can view all broadcasts
CREATE POLICY "Admins can view all broadcasts"
  ON broadcasts FOR SELECT
  USING (public.is_admin());

-- Institution admins can update their org's broadcasts
CREATE POLICY "Institution admins can update org broadcasts"
  ON broadcasts FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_institution_admin())
  WITH CHECK (org_id = public.user_org_id());

-- Admins can update any broadcast
CREATE POLICY "Admins can update any broadcast"
  ON broadcasts FOR UPDATE
  USING (public.is_admin());

-- Auto-insert is handled by trigger, but allow admins
CREATE POLICY "Admins can insert broadcasts"
  ON broadcasts FOR INSERT
  WITH CHECK (public.is_admin());

-- =====================================================
-- HELP_REQUESTS TABLE RLS
-- =====================================================

-- Users can view their own help requests
CREATE POLICY "Users can view own help requests"
  ON help_requests FOR SELECT
  USING (user_id = auth.uid());

-- Users can view help requests for their organization
CREATE POLICY "Users can view org help requests"
  ON help_requests FOR SELECT
  USING (org_id = public.user_org_id());

-- First responders and admins can view all help requests
CREATE POLICY "Responders can view all help requests"
  ON help_requests FOR SELECT
  USING (public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'));

-- Users can create their own help requests
CREATE POLICY "Users can create own help requests"
  ON help_requests FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Admins can create any help request
CREATE POLICY "Admins can create any help request"
  ON help_requests FOR INSERT
  WITH CHECK (public.is_admin());

-- Users can update their own help requests
CREATE POLICY "Users can update own help requests"
  ON help_requests FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- First responders can update help requests
CREATE POLICY "Responders can update help requests"
  ON help_requests FOR UPDATE
  USING (public.user_role() IN ('ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'));

-- Institution admins can update help requests for their org
CREATE POLICY "Institution admins can update org help requests"
  ON help_requests FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_institution_admin());

-- =====================================================
-- MEMBERS TABLE RLS
-- =====================================================

-- Users can view members of their organization
CREATE POLICY "Users can view org members"
  ON members FOR SELECT
  USING (org_id = public.user_org_id());

-- Admins can view all members
CREATE POLICY "Admins can view all members"
  ON members FOR SELECT
  USING (public.is_admin());

-- Institution admins can manage their org's members
CREATE POLICY "Institution admins can insert org members"
  ON members FOR INSERT
  WITH CHECK (org_id = public.user_org_id() AND public.is_institution_admin());

CREATE POLICY "Institution admins can update org members"
  ON members FOR UPDATE
  USING (org_id = public.user_org_id() AND public.is_institution_admin())
  WITH CHECK (org_id = public.user_org_id());

CREATE POLICY "Institution admins can delete org members"
  ON members FOR DELETE
  USING (org_id = public.user_org_id() AND public.is_institution_admin());

-- Admins can manage any members
CREATE POLICY "Admins can insert members"
  ON members FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY "Admins can update members"
  ON members FOR UPDATE
  USING (public.is_admin());

CREATE POLICY "Admins can delete members"
  ON members FOR DELETE
  USING (public.is_admin());

-- =====================================================
-- ACTIVITY_LOG TABLE RLS
-- =====================================================

-- Users can view their own activity
CREATE POLICY "Users can view own activity"
  ON activity_log FOR SELECT
  USING (user_id = auth.uid());

-- Institution admins can view activity for their org
CREATE POLICY "Institution admins can view org activity"
  ON activity_log FOR SELECT
  USING (org_id = public.user_org_id() AND public.is_institution_admin());

-- Admins can view all activity
CREATE POLICY "Admins can view all activity"
  ON activity_log FOR SELECT
  USING (public.is_admin());

-- All authenticated users can insert activity logs
CREATE POLICY "Users can insert activity logs"
  ON activity_log FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- =====================================================
-- STORAGE BUCKET POLICIES (for file uploads)
-- =====================================================

-- Create storage bucket for profile avatars
INSERT INTO storage.buckets (id, name, public) 
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars' AND 
    auth.uid()::text = (storage.foldername(name))[1]
  );

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

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
