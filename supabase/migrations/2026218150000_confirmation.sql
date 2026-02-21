-- Compatibility migration for confirmation-based household approvals.
-- Keeps legacy environments working when the canonical migration was missed.

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

ALTER TABLE public.household_join_requests
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'household_join_requests_resolved_by_fkey'
      AND conrelid = 'public.household_join_requests'::regclass
  ) THEN
    ALTER TABLE public.household_join_requests
      ADD CONSTRAINT household_join_requests_resolved_by_fkey
      FOREIGN KEY (resolved_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

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

CREATE TABLE IF NOT EXISTS public.household_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  action text NOT NULL,
  performed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  target_user uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

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

CREATE OR REPLACE FUNCTION public.approve_join_transaction(p_join_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request public.household_join_requests%ROWTYPE;
  v_actor_id uuid := auth.uid();
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT jr.*
  INTO v_request
  FROM public.household_join_requests AS jr
  WHERE jr.id = p_join_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF lower(COALESCE(v_request.status, 'pending')) <> 'pending' THEN
    RAISE EXCEPTION 'Join request already resolved';
  END IF;

  IF NOT public.household_is_owner(v_request.household_id, v_actor_id) THEN
    RAISE EXCEPTION 'Only the household owner can approve this request';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.household_memberships AS hm
    WHERE hm.profile_id = v_request.requesting_user_id
  ) THEN
    RAISE EXCEPTION 'Requesting user is already in a household';
  END IF;

  INSERT INTO public.household_memberships AS hm (household_id, profile_id, role)
  VALUES (v_request.household_id, v_request.requesting_user_id, 'MEMBER')
  ON CONFLICT (household_id, profile_id) DO NOTHING;

  UPDATE public.household_join_requests AS jr
  SET
    status = 'approved',
    resolved_at = now(),
    resolved_by = v_actor_id
  WHERE jr.id = p_join_request_id;

  INSERT INTO public.notifications (user_id, type, related_id, metadata)
  VALUES (
    v_request.requesting_user_id,
    'household_join_approved',
    p_join_request_id,
    jsonb_build_object('household_id', v_request.household_id, 'resolved_by', v_actor_id)
  );

  INSERT INTO public.household_audit_log (household_id, action, performed_by, target_user, details)
  VALUES (
    v_request.household_id,
    'member_added',
    v_actor_id,
    v_request.requesting_user_id,
    jsonb_build_object('join_request_id', p_join_request_id, 'status', 'approved')
  );

  IF to_regprocedure('public.enqueue_household_model_updates(uuid,uuid,uuid)') IS NOT NULL THEN
    PERFORM public.enqueue_household_model_updates(
      v_request.household_id,
      v_actor_id,
      v_request.requesting_user_id
    );
  END IF;
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

  IF v_action = 'approved' AND to_regprocedure('public.enqueue_household_model_updates(uuid,uuid,uuid)') IS NOT NULL THEN
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
