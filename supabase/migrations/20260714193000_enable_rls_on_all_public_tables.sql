-- Emergency hardening for Supabase advisor finding:
-- rls_disabled_in_public / "Table publicly accessible"
--
-- This migration defensively enables Row-Level Security on every ordinary
-- table in the public schema. Tables that already have policies keep them.
-- Tables without policies become closed to anon/authenticated API access
-- until explicit policies are added.

DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
      AND NOT c.relrowsecurity
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
        target_table.schema_name,
        target_table.table_name
      );
      RAISE NOTICE 'Enabled RLS on %.%', target_table.schema_name, target_table.table_name;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped %.%: insufficient privilege', target_table.schema_name, target_table.table_name;
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipped %.%: table no longer exists', target_table.schema_name, target_table.table_name;
    END;
  END LOOP;
END
$$;

-- Defense in depth: anonymous users should not be able to write directly to
-- public tables. Public write flows should use narrowly-scoped SECURITY
-- DEFINER RPC functions such as submit_public_lead_intake().
DO $$
DECLARE
  target_table record;
BEGIN
  FOR target_table IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE %I.%I FROM anon',
        target_table.schema_name,
        target_table.table_name
      );
      RAISE NOTICE 'Revoked anon direct writes on %.%', target_table.schema_name, target_table.table_name;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped anon revoke on %.%: insufficient privilege', target_table.schema_name, target_table.table_name;
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipped anon revoke on %.%: table no longer exists', target_table.schema_name, target_table.table_name;
    END;
  END LOOP;
END
$$;

-- Verification query for deploy logs. This should return zero rows after the
-- migration, except for extension-owned tables the database role cannot alter.
SELECT
  n.nspname AS schema_name,
  c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind IN ('r', 'p')
  AND NOT c.relrowsecurity
ORDER BY c.relname;
