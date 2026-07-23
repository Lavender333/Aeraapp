-- Emergency least-privilege hardening for Supabase anon role.
--
-- RLS is the primary protection, but broad anon grants increase blast radius
-- and can confuse security reviews. Anonymous public flows should use narrow
-- RPC functions or explicit read-only public views, not direct table access.

DO $$
DECLARE
  target_relation record;
BEGIN
  FOR target_relation IN
    SELECT
      n.nspname AS schema_name,
      c.relname AS relation_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r', 'p', 'v', 'm')
    ORDER BY c.relname
  LOOP
    BEGIN
      EXECUTE format(
        'REVOKE ALL ON TABLE %I.%I FROM anon',
        target_relation.schema_name,
        target_relation.relation_name
      );
      RAISE NOTICE 'Revoked anon direct access on %.%', target_relation.schema_name, target_relation.relation_name;
    EXCEPTION
      WHEN insufficient_privilege THEN
        RAISE NOTICE 'Skipped anon revoke on %.%: insufficient privilege', target_relation.schema_name, target_relation.relation_name;
      WHEN undefined_table THEN
        RAISE NOTICE 'Skipped anon revoke on %.%: relation no longer exists', target_relation.schema_name, target_relation.relation_name;
    END;
  END LOOP;
END
$$;

-- Keep deliberately public read surfaces available. These are aggregate-only.
-- Do not grant anon direct access to household_preparedness; it is keyed to
-- household IDs and should stay behind authenticated RLS policies or RPCs.
DO $$
DECLARE
  public_read_relation text;
BEGIN
  FOREACH public_read_relation IN ARRAY ARRAY[
    'community_preparedness_aggregate',
    'state_preparedness_aggregate'
  ]
  LOOP
    IF to_regclass(format('public.%I', public_read_relation)) IS NOT NULL THEN
      EXECUTE format('GRANT SELECT ON TABLE public.%I TO anon', public_read_relation);
    END IF;
  END LOOP;
END
$$;

-- Keep deliberately public RPC flows available. Grant by discovered signature so
-- this migration survives older/newer versions of the function definitions.
DO $$
DECLARE
  public_rpc regprocedure;
BEGIN
  FOR public_rpc IN
    SELECT p.oid::regprocedure
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'get_people_registered_count',
        'get_intake_link_by_token',
        'submit_public_lead_intake'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO anon', public_rpc);
  END LOOP;
END
$$;

-- Verification: direct anon privileges that remain after this migration.
SELECT
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon'
  AND table_schema = 'public'
ORDER BY table_name, privilege_type;
