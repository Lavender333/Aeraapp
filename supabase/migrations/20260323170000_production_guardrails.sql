-- Production guardrails hardening
-- Safe, non-breaking changes:
-- 1) prevent anonymous inflation of people_registered metric
-- 2) speed up public intake rate-limit query
-- 3) enforce org hierarchy self-reference sanity

-- ------------------------------------------------------------
-- 1) People registered metric: authenticated-only increments
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_people_registered()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next bigint;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.app_metrics (key, value, updated_at)
  VALUES ('people_registered', 1, now())
  ON CONFLICT (key)
  DO UPDATE SET
    value = app_metrics.value + 1,
    updated_at = now()
  RETURNING value INTO v_next;

  RETURN v_next;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_people_registered() FROM anon;
GRANT EXECUTE ON FUNCTION public.increment_people_registered() TO authenticated;

-- Keep read access public for dashboard counters.
GRANT EXECUTE ON FUNCTION public.get_people_registered_count() TO anon, authenticated;

-- ------------------------------------------------------------
-- 2) Lead intake rate-limit performance
-- ------------------------------------------------------------
-- submit_public_lead_intake rate limits by:
--   submitted_by + created_at > now() - interval '1 hour'
-- This index avoids full scans under higher lead volume.

CREATE INDEX IF NOT EXISTS idx_verified_leads_submitted_by_created_at
  ON public.verified_leads(submitted_by, created_at DESC);

-- ------------------------------------------------------------
-- 3) Organizations hierarchy guardrail
-- ------------------------------------------------------------
-- Prevent accidental self-parenting rows.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name = 'parent_org_id'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'organizations_parent_not_self_chk'
        AND conrelid = 'public.organizations'::regclass
    ) THEN
      ALTER TABLE public.organizations
        ADD CONSTRAINT organizations_parent_not_self_chk
        CHECK (parent_org_id IS NULL OR parent_org_id <> id) NOT VALID;
    END IF;

    -- Validate now to enforce clean production data.
    BEGIN
      ALTER TABLE public.organizations
        VALIDATE CONSTRAINT organizations_parent_not_self_chk;
    EXCEPTION
      WHEN OTHERS THEN
        RAISE EXCEPTION 'organizations_parent_not_self_chk validation failed; fix self-parent rows before deploy';
    END;
  END IF;
END
$$;
