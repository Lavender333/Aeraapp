-- Linter remediation: rls_disabled_in_public (0013)
-- Ensures RLS is enabled on public tables exposed through PostgREST.

DO $$
BEGIN
  IF to_regclass('public.household_preparedness') IS NOT NULL THEN
    ALTER TABLE public.household_preparedness ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'household_preparedness'
        AND policyname = 'Allow read access to household_preparedness'
    ) THEN
      CREATE POLICY "Allow read access to household_preparedness"
        ON public.household_preparedness
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
  END IF;

  IF to_regclass('public.community_preparedness_aggregate') IS NOT NULL THEN
    ALTER TABLE public.community_preparedness_aggregate ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'community_preparedness_aggregate'
        AND policyname = 'Allow read access to community_preparedness_aggregate'
    ) THEN
      CREATE POLICY "Allow read access to community_preparedness_aggregate"
        ON public.community_preparedness_aggregate
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
  END IF;

  IF to_regclass('public.state_preparedness_aggregate') IS NOT NULL THEN
    ALTER TABLE public.state_preparedness_aggregate ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'state_preparedness_aggregate'
        AND policyname = 'Allow read access to state_preparedness_aggregate'
    ) THEN
      CREATE POLICY "Allow read access to state_preparedness_aggregate"
        ON public.state_preparedness_aggregate
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
  END IF;
END
$$;

DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NULL THEN
    RETURN;
  END IF;

  BEGIN
    ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = 'spatial_ref_sys'
        AND policyname = 'Allow read access to spatial_ref_sys'
    ) THEN
      CREATE POLICY "Allow read access to spatial_ref_sys"
        ON public.spatial_ref_sys
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping spatial_ref_sys RLS hardening: insufficient privilege on managed PostGIS table.';
  END;
END
$$;
