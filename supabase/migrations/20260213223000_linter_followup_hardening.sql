-- Follow-up linter hardening
-- Date: 2026-02-13

-- 1) Ensure org_members is not SECURITY DEFINER
DO $$
BEGIN
  IF to_regclass('public.members') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE OR REPLACE VIEW public.org_members
      WITH (security_invoker = true)
      AS
      SELECT * FROM public.members
    $sql$;

    ALTER VIEW public.org_members SET (security_invoker = true);
  END IF;
END $$;

-- 2) Lock search_path for household helper functions
DO $$
BEGIN
  IF to_regprocedure('public.set_households_code()') IS NOT NULL THEN
    ALTER FUNCTION public.set_households_code() SET search_path = public, pg_temp;
  END IF;

  IF to_regprocedure('public.generate_household_code()') IS NOT NULL THEN
    ALTER FUNCTION public.generate_household_code() SET search_path = public, pg_temp;
  END IF;
END $$;

-- 3) Attempt to enforce RLS for PostGIS table flagged by linter
DO $$
BEGIN
  IF to_regclass('public.spatial_ref_sys') IS NOT NULL THEN
    BEGIN
      EXECUTE 'ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY';
      EXECUTE 'DROP POLICY IF EXISTS spatial_ref_sys_read_all ON public.spatial_ref_sys';
      EXECUTE 'CREATE POLICY spatial_ref_sys_read_all ON public.spatial_ref_sys FOR SELECT USING (true)';
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Unable to alter public.spatial_ref_sys due to ownership restrictions (managed PostGIS object).';
    END;
  END IF;
END $$;
