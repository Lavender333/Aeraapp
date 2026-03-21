-- Fix: "structure of query does not match function result type" from get_org_outreach_candidates.
--
-- Root cause: The function RETURNS TABLE declared latitude/longitude as DECIMAL(10,8)/DECIMAL(11,8),
-- but in PostgreSQL RETURN QUERY type-checking, if the actual profiles.latitude column is stored
-- as DOUBLE PRECISION (FLOAT8) — which PostgREST/JavaScript clients write it as — there is
-- no implicit cast from FLOAT8 → NUMERIC(10,8) in the RETURN QUERY context, causing the error.
-- Additionally, ROUND(expr::NUMERIC, 2) returns NUMERIC (unqualified) but RETURNS TABLE
-- declared NUMERIC(8,2), which can also trigger the mismatch.
--
-- Fix: Change RETURNS TABLE lat/lng to FLOAT8, cast them explicitly in the query,
-- and cast distance_miles explicitly to NUMERIC.

DROP FUNCTION IF EXISTS public.get_org_outreach_candidates(UUID, INTEGER);

CREATE FUNCTION public.get_org_outreach_candidates(
  p_org_id UUID DEFAULT NULL,
  p_radius_miles INTEGER DEFAULT 3
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  latitude FLOAT8,
  longitude FLOAT8,
  distance_miles NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_actor_org_id UUID;
  v_actor_lat FLOAT8;
  v_actor_lng FLOAT8;
  v_target_org_id UUID;
  v_org_lat FLOAT8;
  v_org_lng FLOAT8;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role::TEXT, org_id, latitude::FLOAT8, longitude::FLOAT8
  INTO v_actor_role, v_actor_org_id, v_actor_lat, v_actor_lng
  FROM profiles
  WHERE id = auth.uid();

  IF v_actor_role NOT IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_target_org_id := COALESCE(p_org_id, v_actor_org_id);

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  IF v_actor_role <> 'ADMIN' AND v_actor_org_id IS DISTINCT FROM v_target_org_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT organizations.latitude::FLOAT8, organizations.longitude::FLOAT8
  INTO v_org_lat, v_org_lng
  FROM organizations
  WHERE id = v_target_org_id;

  -- Fallback to actor profile coordinates when org coordinates are not configured.
  IF v_org_lat IS NULL OR v_org_lng IS NULL THEN
    v_org_lat := v_actor_lat;
    v_org_lng := v_actor_lng;
  END IF;

  IF v_org_lat IS NULL OR v_org_lng IS NULL THEN
    RAISE EXCEPTION 'Organization location is missing. Add org coordinates or save your profile location to use Nearby Outreach.';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.id,
      COALESCE(p.full_name, '') AS full_name,
      COALESCE(p.mobile_phone, p.phone, '') AS phone,
      COALESCE(p.email, '') AS email,
      p.latitude::FLOAT8 AS latitude,
      p.longitude::FLOAT8 AS longitude,
      ROUND((
        3958.8 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((p.latitude::FLOAT8 - v_org_lat) / 2)), 2)
            + COS(RADIANS(v_org_lat))
            * COS(RADIANS(p.latitude::FLOAT8))
            * POWER(SIN(RADIANS((p.longitude::FLOAT8 - v_org_lng) / 2)), 2)
          )
        )
      )::NUMERIC, 2) AS distance_miles,
      COALESCE(p.geofenced_outreach_radius_miles, 3) AS allowed_radius
    FROM profiles p
    WHERE p.is_active = TRUE
      AND p.id <> auth.uid()
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND COALESCE(p.geofenced_outreach_opt_in, FALSE) = TRUE
      AND p.org_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM trusted_community_connections tcc
        WHERE tcc.profile_id = p.id
      )
  )
  SELECT
    c.id           AS profile_id,
    c.full_name,
    c.phone,
    c.email,
    c.latitude,
    c.longitude,
    c.distance_miles
  FROM candidates c
  WHERE c.distance_miles <= LEAST(COALESCE(NULLIF(p_radius_miles, 0), 3), c.allowed_radius)
  ORDER BY c.distance_miles ASC, c.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_outreach_candidates(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_outreach_candidates(UUID, INTEGER) TO authenticated;
