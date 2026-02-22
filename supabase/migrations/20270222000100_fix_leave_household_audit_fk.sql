-- Fix FK violation when sole owner leaves and household is deleted.
-- In that path, household_audit_log insert must be skipped because household_id no longer exists.

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

  IF NOT v_household_deleted AND to_regclass('public.household_audit_log') IS NOT NULL THEN
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
         jsonb_build_object('role', v_membership.role, 'household_deleted', v_household_deleted)
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
