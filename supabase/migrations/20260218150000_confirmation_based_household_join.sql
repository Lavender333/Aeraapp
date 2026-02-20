-- Confirmation-based household join architecture
-- Consent workflow: request -> owner decision -> membership update

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.household_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  requesting_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_household_join_requests_household_id
  ON public.household_join_requests(household_id);

CREATE INDEX IF NOT EXISTS idx_household_join_requests_requesting_user_id
  ON public.household_join_requests(requesting_user_id);

CREATE INDEX IF NOT EXISTS idx_household_join_requests_status_created
  ON public.household_join_requests(status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_join_requests_pending_unique
  ON public.household_join_requests(household_id, requesting_user_id)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  related_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, read, created_at DESC);

CREATE TABLE IF NOT EXISTS public.household_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_household_audit_log_household_created
  ON public.household_audit_log(household_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.household_model_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (
    event_type IN (
      'preparedness_recalculated',
      'vulnerability_recalculated',
      'regional_delta_queued',
      'drift_detection_queued'
    )
  ),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_household_model_events_created
  ON public.household_model_events(created_at DESC);

CREATE OR REPLACE FUNCTION public.resolve_household_owner_id(p_household_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'households'
      AND column_name = 'owner_profile_id'
  ) THEN
    EXECUTE 'SELECT owner_profile_id FROM public.households WHERE id = $1'
      INTO v_owner_id
      USING p_household_id;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'households'
      AND column_name = 'owner_id'
  ) THEN
    EXECUTE 'SELECT owner_id FROM public.households WHERE id = $1'
      INTO v_owner_id
      USING p_household_id;
  END IF;

  RETURN v_owner_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.household_is_owner(p_household_id uuid, p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT public.resolve_household_owner_id(p_household_id) = p_profile_id;
$$;

CREATE OR REPLACE FUNCTION public.enqueue_household_model_updates(
  p_household_id uuid,
  p_triggered_by uuid,
  p_requesting_user_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_count integer := 0;
  v_checked_items integer := 0;
  v_total_items integer := 0;
  v_readiness_score numeric := 0;
  v_readiness_tier text := 'LOW';
  v_avg_risk numeric := 0;
  v_state_id text;
  v_county_id text;
BEGIN
  IF to_regclass('public.household_memberships') IS NOT NULL THEN
    SELECT
      COUNT(DISTINCT hm.profile_id),
      COALESCE(SUM(rk.checked_items), 0),
      COALESCE(SUM(rk.total_items), 0)
    INTO v_member_count, v_checked_items, v_total_items
    FROM public.household_memberships hm
    LEFT JOIN public.ready_kits rk ON rk.profile_id = hm.profile_id
    WHERE hm.household_id = p_household_id;
  END IF;

  IF v_total_items > 0 THEN
    v_readiness_score := ROUND((v_checked_items::numeric / v_total_items::numeric) * 100, 2);
  ELSE
    v_readiness_score := 0;
  END IF;

  v_readiness_tier := CASE
    WHEN v_readiness_score >= 80 THEN 'HIGH'
    WHEN v_readiness_score >= 40 THEN 'MEDIUM'
    ELSE 'LOW'
  END;

  IF to_regclass('public.household_readiness_scores') IS NOT NULL THEN
    INSERT INTO public.household_readiness_scores (
      household_id,
      readiness_score,
      readiness_tier,
      total_items,
      checked_items,
      recommended_duration_days,
      last_assessed_at,
      updated_at
    )
    VALUES (
      p_household_id,
      v_readiness_score,
      v_readiness_tier,
      v_total_items,
      v_checked_items,
      3,
      now(),
      now()
    )
    ON CONFLICT (household_id)
    DO UPDATE SET
      readiness_score = EXCLUDED.readiness_score,
      readiness_tier = EXCLUDED.readiness_tier,
      total_items = EXCLUDED.total_items,
      checked_items = EXCLUDED.checked_items,
      last_assessed_at = EXCLUDED.last_assessed_at,
      updated_at = now();
  END IF;

  IF to_regclass('public.vulnerability_profiles') IS NOT NULL
    AND to_regclass('public.household_memberships') IS NOT NULL THEN
    SELECT COALESCE(AVG(vp.risk_score), 0)
    INTO v_avg_risk
    FROM public.household_memberships hm
    JOIN public.vulnerability_profiles vp ON vp.profile_id = hm.profile_id
    WHERE hm.household_id = p_household_id;
  END IF;

  SELECT p.state_id, p.county_id
  INTO v_state_id, v_county_id
  FROM public.profiles p
  WHERE p.id = p_requesting_user_id;

  INSERT INTO public.household_model_events (household_id, event_type, payload)
  VALUES
    (
      p_household_id,
      'preparedness_recalculated',
      jsonb_build_object(
        'triggered_by', p_triggered_by,
        'member_count', v_member_count,
        'readiness_score', v_readiness_score,
        'readiness_tier', v_readiness_tier
      )
    ),
    (
      p_household_id,
      'vulnerability_recalculated',
      jsonb_build_object(
        'triggered_by', p_triggered_by,
        'avg_risk_score', ROUND(COALESCE(v_avg_risk, 0), 4)
      )
    ),
    (
      p_household_id,
      'regional_delta_queued',
      jsonb_build_object(
        'state_id', v_state_id,
        'county_id', v_county_id,
        'delta_kind', 'household_membership_changed'
      )
    ),
    (
      p_household_id,
      'drift_detection_queued',
      jsonb_build_object(
        'state_id', v_state_id,
        'county_id', v_county_id,
        'pipeline', 'nightly-level3'
      )
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.request_household_join_by_code(p_household_code text)
RETURNS TABLE (
  join_request_id uuid,
  status text,
  household_id uuid,
  owner_id uuid,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_household_id uuid;
  v_owner_id uuid;
  v_existing_pending uuid;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT h.id
  INTO v_household_id
  FROM public.households h
  WHERE upper(h.household_code) = upper(trim(p_household_code))
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Household code not found';
  END IF;

  v_owner_id := public.resolve_household_owner_id(v_household_id);

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Household owner is not configured';
  END IF;

  IF v_owner_id = v_user_id THEN
    RAISE EXCEPTION 'Owner cannot request to join their own household';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.profile_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Leave your current household before submitting a join request';
  END IF;

  SELECT jr.id
  INTO v_existing_pending
  FROM public.household_join_requests jr
  WHERE jr.household_id = v_household_id
    AND jr.requesting_user_id = v_user_id
    AND jr.status = 'pending'
  LIMIT 1;

  IF v_existing_pending IS NOT NULL THEN
    RETURN QUERY
    SELECT
      v_existing_pending,
      'pending'::text,
      v_household_id,
      v_owner_id,
      'Request already pending'::text;
    RETURN;
  END IF;

  INSERT INTO public.household_join_requests (household_id, requesting_user_id, status)
  VALUES (v_household_id, v_user_id, 'pending')
  RETURNING id INTO v_existing_pending;

  INSERT INTO public.notifications (user_id, type, related_id, metadata)
  VALUES (
    v_owner_id,
    'household_join_request',
    v_existing_pending,
    jsonb_build_object('household_id', v_household_id, 'requesting_user_id', v_user_id)
  );

  INSERT INTO public.household_audit_log (household_id, action, performed_by, target_user, details)
  VALUES (
    v_household_id,
    'join_request_submitted',
    v_user_id,
    v_owner_id,
    jsonb_build_object('join_request_id', v_existing_pending)
  );

  RETURN QUERY
  SELECT
    v_existing_pending,
    'pending'::text,
    v_household_id,
    v_owner_id,
    'Request submitted'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_household_join_request(
  p_join_request_id uuid,
  p_action text,
  p_actor_id uuid
)
RETURNS TABLE (
  join_request_id uuid,
  household_id uuid,
  requesting_user_id uuid,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
  v_action text := lower(trim(COALESCE(p_action, 'approved')));
BEGIN
  IF p_actor_id IS NULL THEN
    RAISE EXCEPTION 'Actor is required';
  END IF;

  IF v_action NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid action';
  END IF;

  SELECT *
  INTO v_request
  FROM public.household_join_requests
  WHERE id = p_join_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Join request already resolved';
  END IF;

  IF NOT public.household_is_owner(v_request.household_id, p_actor_id) THEN
    RAISE EXCEPTION 'Only the household owner can resolve this request';
  END IF;

  IF p_actor_id = v_request.requesting_user_id THEN
    RAISE EXCEPTION 'Owner cannot approve themselves';
  END IF;

  IF v_action = 'approved' THEN
    IF EXISTS (
      SELECT 1
      FROM public.household_memberships hm
      WHERE hm.profile_id = v_request.requesting_user_id
    ) THEN
      RAISE EXCEPTION 'Requesting user is already in a household';
    END IF;

    INSERT INTO public.household_memberships (household_id, profile_id, role)
    VALUES (v_request.household_id, v_request.requesting_user_id, 'MEMBER')
    ON CONFLICT (household_id, profile_id) DO NOTHING;
  END IF;

  UPDATE public.household_join_requests
  SET
    status = v_action,
    resolved_at = now(),
    resolved_by = p_actor_id
  WHERE id = p_join_request_id;

  INSERT INTO public.notifications (user_id, type, related_id, metadata)
  VALUES (
    v_request.requesting_user_id,
    CASE WHEN v_action = 'approved' THEN 'household_join_approved' ELSE 'household_join_rejected' END,
    p_join_request_id,
    jsonb_build_object('household_id', v_request.household_id, 'resolved_by', p_actor_id)
  );

  INSERT INTO public.household_audit_log (household_id, action, performed_by, target_user, details)
  VALUES (
    v_request.household_id,
    CASE WHEN v_action = 'approved' THEN 'member_added' ELSE 'join_request_rejected' END,
    p_actor_id,
    v_request.requesting_user_id,
    jsonb_build_object('join_request_id', p_join_request_id, 'status', v_action)
  );

  IF v_action = 'approved' THEN
    PERFORM public.enqueue_household_model_updates(
      v_request.household_id,
      p_actor_id,
      v_request.requesting_user_id
    );
  END IF;

  RETURN QUERY
  SELECT p_join_request_id, v_request.household_id, v_request.requesting_user_id, v_action;
END;
$$;

ALTER TABLE public.household_join_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_model_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS household_join_requests_select_requester_or_owner ON public.household_join_requests;
DROP POLICY IF EXISTS household_join_requests_insert_requester ON public.household_join_requests;
DROP POLICY IF EXISTS household_join_requests_block_direct_update ON public.household_join_requests;
DROP POLICY IF EXISTS household_join_requests_block_direct_delete ON public.household_join_requests;

CREATE POLICY household_join_requests_select_requester_or_owner
ON public.household_join_requests
FOR SELECT
TO authenticated
USING (
  requesting_user_id = auth.uid()
  OR public.household_is_owner(household_id, auth.uid())
);

CREATE POLICY household_join_requests_insert_requester
ON public.household_join_requests
FOR INSERT
TO authenticated
WITH CHECK (requesting_user_id = auth.uid());

CREATE POLICY household_join_requests_block_direct_update
ON public.household_join_requests
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY household_join_requests_block_direct_delete
ON public.household_join_requests
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_service_only ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own_read ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;

CREATE POLICY notifications_select_own
ON public.notifications
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY notifications_insert_service_only
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY notifications_update_own_read
ON public.notifications
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY notifications_delete_own
ON public.notifications
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS household_audit_log_select_member_or_owner ON public.household_audit_log;
DROP POLICY IF EXISTS household_audit_log_insert_service_only ON public.household_audit_log;
DROP POLICY IF EXISTS household_audit_log_update_none ON public.household_audit_log;
DROP POLICY IF EXISTS household_audit_log_delete_none ON public.household_audit_log;

CREATE POLICY household_audit_log_select_member_or_owner
ON public.household_audit_log
FOR SELECT
TO authenticated
USING (
  public.household_is_owner(household_id, auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.household_memberships hm
    WHERE hm.household_id = household_audit_log.household_id
      AND hm.profile_id = auth.uid()
  )
);

CREATE POLICY household_audit_log_insert_service_only
ON public.household_audit_log
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY household_audit_log_update_none
ON public.household_audit_log
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY household_audit_log_delete_none
ON public.household_audit_log
FOR DELETE
TO authenticated
USING (false);

DROP POLICY IF EXISTS household_model_events_select_scope ON public.household_model_events;
DROP POLICY IF EXISTS household_model_events_insert_service_only ON public.household_model_events;
DROP POLICY IF EXISTS household_model_events_update_service_only ON public.household_model_events;
DROP POLICY IF EXISTS household_model_events_delete_none ON public.household_model_events;

CREATE POLICY household_model_events_select_scope
ON public.household_model_events
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role IN ('ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN')
  )
  OR public.household_is_owner(household_id, auth.uid())
);

CREATE POLICY household_model_events_insert_service_only
ON public.household_model_events
FOR INSERT
TO authenticated
WITH CHECK (false);

CREATE POLICY household_model_events_update_service_only
ON public.household_model_events
FOR UPDATE
TO authenticated
USING (false)
WITH CHECK (false);

CREATE POLICY household_model_events_delete_none
ON public.household_model_events
FOR DELETE
TO authenticated
USING (false);

CREATE OR REPLACE VIEW public.state_household_join_activity_view
WITH (security_invoker = true)
AS
SELECT
  COALESCE(p.state_id, 'UNKNOWN') AS state_id,
  COALESCE(p.county_id, 'UNKNOWN') AS county_id,
  COUNT(*) FILTER (WHERE jr.status = 'pending') AS pending_requests,
  COUNT(*) FILTER (
    WHERE jr.status = 'approved'
      AND jr.resolved_at >= now() - interval '24 hours'
  ) AS approved_last_24h,
  COUNT(*) FILTER (
    WHERE jr.status = 'rejected'
      AND jr.resolved_at >= now() - interval '24 hours'
  ) AS rejected_last_24h,
  COUNT(*) FILTER (WHERE jr.created_at >= now() - interval '24 hours') AS submitted_last_24h,
  MAX(COALESCE(jr.resolved_at, jr.created_at)) AS last_activity_at
FROM public.household_join_requests jr
LEFT JOIN public.profiles p ON p.id = jr.requesting_user_id
GROUP BY COALESCE(p.state_id, 'UNKNOWN'), COALESCE(p.county_id, 'UNKNOWN');
