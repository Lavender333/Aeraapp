-- Allow all users in a household to see the household family members
-- (stored in the owner's vitals.household JSONB)

-- Update RLS on household_members to allow co-members to view
DROP POLICY IF EXISTS "Users can view own household members" ON household_members;

CREATE POLICY "Users can view own household members"
  ON household_members FOR SELECT
  USING (
    profile_id = (select auth.uid())
    OR profile_id IN (
      SELECT h.owner_profile_id
      FROM public.households h
      INNER JOIN public.household_memberships hm ON hm.household_id = h.id
      WHERE hm.profile_id = (select auth.uid())
    )
  );

-- RPC function to get household family members for the current user's household
-- Returns the vitals.household JSONB array from the household owner's profile
CREATE OR REPLACE FUNCTION public.get_household_family_members()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_household_id uuid;
  v_owner_profile_id uuid;
  v_household_json jsonb;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get the current user's active household
  SELECT hm.household_id INTO v_household_id
  FROM public.household_memberships hm
  LEFT JOIN public.profiles p ON p.id = v_user_id
  WHERE hm.profile_id = v_user_id
    AND (
      p.active_household_id IS NULL
      OR hm.household_id = p.active_household_id
    )
  ORDER BY CASE WHEN hm.role = 'OWNER' THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_household_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Get the owner's profile_id from the households table
  SELECT h.owner_profile_id INTO v_owner_profile_id
  FROM public.households h
  WHERE h.id = v_household_id;

  IF v_owner_profile_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Return the owner's household JSONB from vitals
  SELECT COALESCE(v.household, '[]'::jsonb) INTO v_household_json
  FROM public.vitals v
  WHERE v.profile_id = v_owner_profile_id;

  RETURN COALESCE(v_household_json, '[]'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_household_family_members() TO authenticated;
