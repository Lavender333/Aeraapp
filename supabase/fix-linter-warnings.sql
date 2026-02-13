-- =====================================================
-- Fix Supabase Database Linter Warnings
-- Addresses security issues identified by database linter
-- Run: February 13, 2026
-- =====================================================

-- -----------------------------------------------------
-- 1. Enable RLS on spatial_ref_sys (PostGIS system table)
-- -----------------------------------------------------
-- PostGIS creates this table automatically. While it's a reference table
-- with no user data, enabling RLS satisfies the linter requirement.
ALTER TABLE public.spatial_ref_sys ENABLE ROW LEVEL SECURITY;

-- Create a permissive policy since this is a reference table
CREATE POLICY IF NOT EXISTS "spatial_ref_sys_read_all" ON public.spatial_ref_sys
  FOR SELECT
  USING (true);

-- -----------------------------------------------------
-- 2. Fix Function Search Path - Set to 'public' for security
-- -----------------------------------------------------
-- Recreate functions with SET search_path = public to prevent
-- search path hijacking attacks

CREATE OR REPLACE FUNCTION public.calculate_vulnerability_risk(
  p_household_size INTEGER,
  p_medication_dependency BOOLEAN,
  p_insulin_dependency BOOLEAN,
  p_oxygen_powered_device BOOLEAN,
  p_mobility_limitation BOOLEAN,
  p_transportation_access BOOLEAN,
  p_financial_strain BOOLEAN
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  score NUMERIC := 0;
BEGIN
  score := score + LEAST(GREATEST(COALESCE(p_household_size, 1), 1) * 0.4, 3.2);
  IF COALESCE(p_medication_dependency, false) THEN score := score + 1.8; END IF;
  IF COALESCE(p_insulin_dependency, false) THEN score := score + 2.2; END IF;
  IF COALESCE(p_oxygen_powered_device, false) THEN score := score + 2.5; END IF;
  IF COALESCE(p_mobility_limitation, false) THEN score := score + 1.5; END IF;
  IF NOT COALESCE(p_transportation_access, true) THEN score := score + 1.2; END IF;
  IF COALESCE(p_financial_strain, false) THEN score := score + 1.4; END IF;

  RETURN ROUND(score, 4);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_vulnerability_risk_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.risk_score := public.calculate_vulnerability_risk(
    NEW.household_size,
    NEW.medication_dependency,
    NEW.insulin_dependency,
    NEW.oxygen_powered_device,
    NEW.mobility_limitation,
    NEW.transportation_access,
    NEW.financial_strain
  );

  IF NEW.consent_preparedness_planning = true AND NEW.consent_timestamp IS NULL THEN
    NEW.consent_timestamp := NOW();
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_drift(
  current_avg NUMERIC,
  previous_avg NUMERIC
)
RETURNS NUMERIC
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(previous_avg, 0) = 0 THEN 0
    ELSE ROUND((COALESCE(current_avg, 0) - previous_avg) / previous_avg, 4)
  END;
$$;

CREATE OR REPLACE FUNCTION public.drift_status_from_value(drift NUMERIC)
RETURNS TEXT
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(drift, 0) > 0.25 THEN 'ACCELERATING'
    WHEN COALESCE(drift, 0) > 0.15 THEN 'ESCALATING'
    ELSE 'STABLE'
  END;
$$;

CREATE OR REPLACE FUNCTION public.recommended_kit_duration_from_risk(risk NUMERIC)
RETURNS INTEGER
LANGUAGE SQL
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN COALESCE(risk, 0) >= 8 THEN 10
    WHEN COALESCE(risk, 0) >= 5 THEN 7
    ELSE 3
  END;
$$;

-- -----------------------------------------------------
-- 3. PostGIS Extension in Public Schema
-- -----------------------------------------------------
-- NOTE: PostGIS extension remains in public schema by design.
-- Moving PostGIS to another schema would require updating all
-- geometry/geography column references throughout the database.
-- This is acceptable for system extensions like PostGIS.
-- Reference: https://postgis.net/docs/manual-3.3/using_postgis_dbmanagement.html

-- -----------------------------------------------------
-- 4. Auth Leaked Password Protection
-- -----------------------------------------------------
-- This must be enabled through Supabase Dashboard or Management API.
-- Navigate to: Authentication > Policies > Password Settings
-- Enable: "Check for breached passwords (HaveIBeenPwned)"
--
-- OR via Management API:
-- PATCH /v1/projects/{project_ref}/config/auth
-- { "SECURITY_BREACH_PROTECTION_ENABLED": true }
--
-- Documentation:
-- https://supabase.com/docs/guides/auth/password-security

COMMENT ON TABLE public.spatial_ref_sys IS 'PostGIS spatial reference system table with RLS enabled for security compliance';
COMMENT ON FUNCTION public.calculate_vulnerability_risk IS 'Calculates vulnerability risk score with search_path protection';
COMMENT ON FUNCTION public.set_vulnerability_risk_score IS 'Trigger function to auto-calculate risk scores with search_path protection';
COMMENT ON FUNCTION public.compute_drift IS 'Calculates risk score drift percentage with search_path protection';
COMMENT ON FUNCTION public.drift_status_from_value IS 'Categorizes drift values into status levels with search_path protection';
COMMENT ON FUNCTION public.recommended_kit_duration_from_risk IS 'Recommends emergency kit duration based on risk score with search_path protection';
