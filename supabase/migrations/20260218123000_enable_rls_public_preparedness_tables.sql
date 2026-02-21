-- Enable RLS on public tables flagged by Supabase linter.
DO $$
BEGIN
  BEGIN
    ALTER TABLE IF EXISTS public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;
  EXCEPTION
    WHEN insufficient_privilege THEN
      RAISE NOTICE 'Skipping RLS enable on spatial_ref_sys: insufficient privilege on extension-owned table.';
  END;
END
$$;
ALTER TABLE IF EXISTS public.household_preparedness ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.community_preparedness_aggregate ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.state_preparedness_aggregate ENABLE ROW LEVEL SECURITY;

-- Keep read access for API clients while enforcing RLS.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spatial_ref_sys'
      AND policyname = 'Allow read access to spatial_ref_sys'
  ) THEN
    BEGIN
      CREATE POLICY "Allow read access to spatial_ref_sys"
        ON public.spatial_ref_sys
        FOR SELECT
        TO anon, authenticated
        USING (true);
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping policy on spatial_ref_sys: insufficient privilege on extension-owned table.';
    END;
  END IF;

END
$$;

DO $$
BEGIN
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
END
$$;
