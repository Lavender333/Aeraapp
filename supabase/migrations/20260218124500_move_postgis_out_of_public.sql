-- Supabase linter 0014: extension_in_public
-- Move PostGIS extension objects out of `public` and into a dedicated schema.
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
    WHERE e.extname = 'postgis'
      AND n.nspname = 'public'
  ) THEN
    BEGIN
      ALTER EXTENSION postgis SET SCHEMA extensions;
    EXCEPTION
      WHEN feature_not_supported THEN
        RAISE NOTICE 'Skipping PostGIS schema move: extension does not support SET SCHEMA in this environment.';
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipping PostGIS schema move: insufficient privilege to alter managed extension.';
    END;
  END IF;
END
$$;
