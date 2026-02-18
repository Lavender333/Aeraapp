-- AERA master build: core household schema, RPC transactions, regional rollups,
-- anomaly detection, and RLS updates for public preparedness tables.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  household_code text UNIQUE NOT NULL,
  owner_id uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('active','locked','archived')) DEFAULT 'active',
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS one_owner_per_user ON public.households(owner_id);

CREATE TABLE IF NOT EXISTS public.household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner','member','dependent')) NOT NULL,
  joined_at timestamptz DEFAULT now(),
  UNIQUE (household_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.household_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES public.households(id) ON DELETE CASCADE,
  requesting_user_id uuid REFERENCES auth.users(id),
  status text CHECK (status IN ('pending','approved','rejected')) DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE OR REPLACE FUNCTION public.approve_join_transaction(p_join_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request record;
BEGIN
  SELECT *
    INTO v_request
  FROM public.household_join_requests
  WHERE id = p_join_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Join request not found';
  END IF;

  IF v_request.status <> 'pending' THEN
    RAISE EXCEPTION 'Request already processed';
  END IF;

  UPDATE public.household_join_requests
  SET status = 'approved',
      resolved_at = now()
  WHERE id = p_join_request_id;

  INSERT INTO public.household_members (household_id, user_id, role)
  VALUES (v_request.household_id, v_request.requesting_user_id, 'member')
  ON CONFLICT (household_id, user_id) DO NOTHING;
END;
$$;

CREATE TABLE IF NOT EXISTS public.regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text CHECK (type IN ('county','state','organization')),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_regions (
  household_id uuid REFERENCES public.households(id),
  region_id uuid REFERENCES public.regions(id),
  PRIMARY KEY (household_id, region_id)
);

CREATE TABLE IF NOT EXISTS public.state_analytics (
  state_name text PRIMARY KEY,
  total_households integer,
  avg_preparedness numeric,
  avg_vulnerability numeric,
  risk_index numeric,
  last_updated timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.detect_preparedness_anomalies()
RETURNS TABLE(household_id uuid, z_score numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH stats AS (
    SELECT avg(preparedness_score) AS mean_score,
           stddev(preparedness_score) AS stddev_score
    FROM public.household_preparedness
  )
  SELECT
    hp.household_id,
    (hp.preparedness_score - stats.mean_score) / NULLIF(stats.stddev_score, 0)
  FROM public.household_preparedness hp, stats
  WHERE abs((hp.preparedness_score - stats.mean_score) / NULLIF(stats.stddev_score, 0)) > 2;
END;
$$;

-- Linter fix: RLS Disabled in Public
ALTER TABLE IF EXISTS public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.household_preparedness ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.community_preparedness_aggregate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.state_preparedness_aggregate ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spatial_ref_sys'
      AND policyname = 'Allow read access to spatial_ref_sys'
  ) THEN
    CREATE POLICY "Allow read access to spatial_ref_sys"
      ON public.spatial_ref_sys
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'household_preparedness'
      AND policyname = 'Allow read access to household_preparedness'
  ) THEN
    CREATE POLICY "Allow read access to household_preparedness"
      ON public.household_preparedness
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'community_preparedness_aggregate'
      AND policyname = 'Allow read access to community_preparedness_aggregate'
  ) THEN
    CREATE POLICY "Allow read access to community_preparedness_aggregate"
      ON public.community_preparedness_aggregate
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'state_preparedness_aggregate'
      AND policyname = 'Allow read access to state_preparedness_aggregate'
  ) THEN
    CREATE POLICY "Allow read access to state_preparedness_aggregate"
      ON public.state_preparedness_aggregate
      FOR SELECT TO anon, authenticated
      USING (true);
  END IF;
END
$$;
