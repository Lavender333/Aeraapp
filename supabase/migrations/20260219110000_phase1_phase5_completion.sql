-- Phase completion migration: ownership transfer, leave protections, institution hierarchy,
-- compliance audit logs, regional/state rollups, anomaly snapshot automation, and RLS.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE IF EXISTS public.profiles
  ADD COLUMN IF NOT EXISTS active_household_id uuid REFERENCES public.households(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.organization_hierarchy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  child_org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'affiliate',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (parent_org_id, child_org_id)
);

CREATE TABLE IF NOT EXISTS public.compliance_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  actor_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_org_created
  ON public.compliance_audit_log(organization_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.state_dashboard_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id text,
  county_id text,
  organization_id uuid REFERENCES public.organizations(id) ON DELETE SET NULL,
  metric_name text NOT NULL,
  metric_value numeric NOT NULL DEFAULT 0,
  metric_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  measured_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_state_dashboard_metrics_scope
  ON public.state_dashboard_metrics(state_id, county_id, organization_id, measured_at DESC);

CREATE OR REPLACE FUNCTION public.transfer_household_ownership(
  p_household_id uuid,
  p_new_owner_id uuid,
  p_actor_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_owner uuid;
  v_has_new_owner_membership boolean := false;
BEGIN
  SELECT h.owner_profile_id
  INTO v_current_owner
  FROM public.households h
  WHERE h.id = p_household_id
  FOR UPDATE;

  IF v_current_owner IS NULL THEN
    RAISE EXCEPTION 'Household not found';
  END IF;

  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_current_owner <> p_actor_id THEN
    RAISE EXCEPTION 'Only current owner can transfer ownership';
  END IF;

  IF p_new_owner_id = p_actor_id THEN
    RAISE EXCEPTION 'New owner must be different from current owner';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = p_household_id
      AND hm.profile_id = p_new_owner_id
  )
  INTO v_has_new_owner_membership;

  IF NOT v_has_new_owner_membership THEN
    RAISE EXCEPTION 'New owner must already be a member of the household';
  END IF;

  UPDATE public.households
  SET owner_profile_id = p_new_owner_id,
      updated_at = now()
  WHERE id = p_household_id;

  UPDATE public.household_memberships
  SET role = 'MEMBER',
      updated_at = now()
  WHERE household_id = p_household_id
    AND profile_id = p_actor_id
    AND role = 'OWNER';

  UPDATE public.household_memberships
  SET role = 'OWNER',
      updated_at = now()
  WHERE household_id = p_household_id
    AND profile_id = p_new_owner_id;

  UPDATE public.profiles
  SET active_household_id = p_household_id
  WHERE id IN (p_actor_id, p_new_owner_id)
    AND active_household_id IS NULL;

  IF to_regclass('public.household_audit_log') IS NOT NULL THEN
    INSERT INTO public.household_audit_log (household_id, action, performed_by, target_user, details)
    VALUES (
      p_household_id,
      'ownership_transferred',
      p_actor_id,
      p_new_owner_id,
      jsonb_build_object('from', p_actor_id, 'to', p_new_owner_id)
    );
  END IF;

  INSERT INTO public.compliance_audit_log (organization_id, actor_id, action, entity_type, entity_id, details)
  SELECT p.org_id, p_actor_id, 'transfer_household_ownership', 'household', p_household_id::text,
         jsonb_build_object('new_owner_id', p_new_owner_id)
  FROM public.profiles p
  WHERE p.id = p_actor_id;

  RETURN jsonb_build_object(
    'success', true,
    'household_id', p_household_id,
    'old_owner_id', p_actor_id,
    'new_owner_id', p_new_owner_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.leave_household(
  p_household_id uuid DEFAULT NULL,
  p_profile_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_membership record;
  v_owner_count integer := 0;
  v_other_member_count integer := 0;
  v_household_deleted boolean := false;
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT hm.household_id, hm.profile_id, hm.role
  INTO v_membership
  FROM public.household_memberships hm
  WHERE hm.profile_id = p_profile_id
    AND (p_household_id IS NULL OR hm.household_id = p_household_id)
  LIMIT 1;

  IF v_membership.household_id IS NULL THEN
    RAISE EXCEPTION 'Membership not found';
  END IF;

  IF v_membership.role = 'OWNER' THEN
    SELECT COUNT(*)
    INTO v_owner_count
    FROM public.household_memberships hm
    WHERE hm.household_id = v_membership.household_id
      AND hm.role = 'OWNER'
      AND hm.profile_id <> p_profile_id;

    SELECT COUNT(*)
    INTO v_other_member_count
    FROM public.household_memberships hm
    WHERE hm.household_id = v_membership.household_id
      AND hm.profile_id <> p_profile_id;

    IF v_owner_count = 0 THEN
      IF v_other_member_count = 0 THEN
        DELETE FROM public.households
        WHERE id = v_membership.household_id
          AND owner_profile_id = p_profile_id;

        v_household_deleted := true;
      ELSE
        RAISE EXCEPTION 'Owner must transfer ownership before leaving household';
      END IF;
    END IF;
  END IF;

  IF NOT v_household_deleted THEN
    DELETE FROM public.household_memberships
    WHERE household_id = v_membership.household_id
      AND profile_id = p_profile_id;
  END IF;

  UPDATE public.profiles
  SET active_household_id = NULL
  WHERE id = p_profile_id
    AND active_household_id = v_membership.household_id;

  IF to_regclass('public.household_audit_log') IS NOT NULL THEN
    INSERT INTO public.household_audit_log (household_id, action, performed_by, target_user, details)
    VALUES (
      v_membership.household_id,
      'member_left_household',
      p_profile_id,
      p_profile_id,
      jsonb_build_object('role', v_membership.role)
    );
  END IF;

  INSERT INTO public.compliance_audit_log (organization_id, actor_id, action, entity_type, entity_id, details)
  SELECT p.org_id, p_profile_id, 'leave_household', 'household', v_membership.household_id::text,
         jsonb_build_object('role', v_membership.role)
  FROM public.profiles p
  WHERE p.id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'household_id', v_membership.household_id,
    'profile_id', p_profile_id,
    'role', v_membership.role,
    'household_deleted', v_household_deleted
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.switch_active_household(
  p_household_id uuid,
  p_profile_id uuid DEFAULT auth.uid()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.profile_id = p_profile_id
      AND hm.household_id = p_household_id
  ) THEN
    RAISE EXCEPTION 'Profile is not a member of requested household';
  END IF;

  UPDATE public.profiles
  SET active_household_id = p_household_id
  WHERE id = p_profile_id;

  RETURN jsonb_build_object('success', true, 'active_household_id', p_household_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_region_state_rollups()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.household_preparedness') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.community_preparedness_aggregate') IS NOT NULL THEN
    INSERT INTO public.community_preparedness_aggregate (
      community_id,
      total_households,
      total_members,
      avg_readiness_score,
      water_gap_percent,
      medical_gap_percent,
      last_updated,
      updated_at
    )
    SELECT
      p.org_id AS community_id,
      COUNT(DISTINCT hm.household_id) AS total_households,
      COALESCE(SUM(hp.total_members), 0) AS total_members,
      COALESCE(ROUND(AVG(hp.readiness_score), 2), 0) AS avg_readiness_score,
      COALESCE(ROUND(AVG(hp.water_gap), 2), 0) AS water_gap_percent,
      COALESCE(ROUND(AVG(hp.medical_gap), 2), 0) AS medical_gap_percent,
      now(),
      now()
    FROM public.household_memberships hm
    JOIN public.profiles p ON p.id = hm.profile_id
    JOIN public.household_preparedness hp ON hp.household_id = hm.household_id
    WHERE p.org_id IS NOT NULL
    GROUP BY p.org_id
    ON CONFLICT (community_id)
    DO UPDATE SET
      total_households = EXCLUDED.total_households,
      total_members = EXCLUDED.total_members,
      avg_readiness_score = EXCLUDED.avg_readiness_score,
      water_gap_percent = EXCLUDED.water_gap_percent,
      medical_gap_percent = EXCLUDED.medical_gap_percent,
      last_updated = now(),
      updated_at = now();
  END IF;

  IF to_regclass('public.state_preparedness_aggregate') IS NOT NULL THEN
    INSERT INTO public.state_preparedness_aggregate (
      state_id,
      total_communities,
      vulnerability_index,
      high_risk_clusters,
      last_updated,
      updated_at
    )
    SELECT
      p.state AS state_id,
      COUNT(DISTINCT p.org_id) AS total_communities,
      COALESCE(ROUND(AVG(vp.risk_score), 2), 0) AS vulnerability_index,
      COUNT(*) FILTER (WHERE COALESCE(vp.risk_score, 0) >= 8) AS high_risk_clusters,
      now(),
      now()
    FROM public.profiles p
    LEFT JOIN public.vulnerability_profiles vp ON vp.profile_id = p.id
    WHERE p.state IS NOT NULL
      AND p.state <> ''
    GROUP BY p.state
    ON CONFLICT (state_id)
    DO UPDATE SET
      total_communities = EXCLUDED.total_communities,
      vulnerability_index = EXCLUDED.vulnerability_index,
      high_risk_clusters = EXCLUDED.high_risk_clusters,
      last_updated = now(),
      updated_at = now();
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_household_preparedness_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_region_state_rollups();
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_household_preparedness_rollup ON public.household_preparedness;
CREATE TRIGGER trg_household_preparedness_rollup
AFTER INSERT OR UPDATE OR DELETE ON public.household_preparedness
FOR EACH STATEMENT
EXECUTE FUNCTION public.handle_household_preparedness_change();

CREATE OR REPLACE FUNCTION public.run_anomaly_detection_snapshot()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regprocedure('public.detect_preparedness_anomalies()') IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.state_dashboard_metrics (
    state_id,
    county_id,
    organization_id,
    metric_name,
    metric_value,
    metric_payload,
    measured_at
  )
  SELECT
    p.state,
    p.county_id,
    p.org_id,
    'preparedness_anomaly_count',
    COUNT(*)::numeric,
    jsonb_build_object('source', 'detect_preparedness_anomalies'),
    now()
  FROM public.detect_preparedness_anomalies() a
  JOIN public.household_memberships hm ON hm.household_id = a.household_id
  JOIN public.profiles p ON p.id = hm.profile_id
  GROUP BY p.state, p.county_id, p.org_id;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (
      SELECT 1
      FROM cron.job
      WHERE jobname = 'aera-nightly-anomaly-snapshot'
    ) THEN
      PERFORM cron.schedule(
        'aera-nightly-anomaly-snapshot',
        '15 3 * * *',
        $cron$SELECT public.run_anomaly_detection_snapshot();$cron$
      );
    END IF;
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Skipping pg_cron scheduling due to insufficient privilege';
END
$$;

ALTER TABLE public.organization_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.state_dashboard_metrics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS organization_hierarchy_select_scoped ON public.organization_hierarchy;
DROP POLICY IF EXISTS organization_hierarchy_write_admin ON public.organization_hierarchy;
DROP POLICY IF EXISTS compliance_audit_select_scoped ON public.compliance_audit_log;
DROP POLICY IF EXISTS compliance_audit_insert_service ON public.compliance_audit_log;
DROP POLICY IF EXISTS state_dashboard_metrics_select_scoped ON public.state_dashboard_metrics;
DROP POLICY IF EXISTS state_dashboard_metrics_insert_service ON public.state_dashboard_metrics;

CREATE POLICY organization_hierarchy_select_scoped
ON public.organization_hierarchy
FOR SELECT
TO authenticated
USING (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (p.org_id = organization_hierarchy.parent_org_id OR p.org_id = organization_hierarchy.child_org_id)
  )
);

CREATE POLICY organization_hierarchy_write_admin
ON public.organization_hierarchy
FOR ALL
TO authenticated
USING (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
)
WITH CHECK (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
);

CREATE POLICY compliance_audit_select_scoped
ON public.compliance_audit_log
FOR SELECT
TO authenticated
USING (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.org_id = compliance_audit_log.organization_id
  )
);

CREATE POLICY compliance_audit_insert_service
ON public.compliance_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
);

CREATE POLICY state_dashboard_metrics_select_scoped
ON public.state_dashboard_metrics
FOR SELECT
TO authenticated
USING (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'service_role')
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND (
        (state_dashboard_metrics.organization_id IS NOT NULL AND p.org_id = state_dashboard_metrics.organization_id)
        OR (state_dashboard_metrics.state_id IS NOT NULL AND p.state = state_dashboard_metrics.state_id)
      )
  )
);

CREATE POLICY state_dashboard_metrics_insert_service
ON public.state_dashboard_metrics
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(current_setting('request.jwt.claim.role', true), '') IN ('ADMIN', 'STATE_ADMIN', 'service_role')
);
