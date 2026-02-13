-- =====================================================
-- AERA State-Ready Expansion Schema
-- Adds structured vulnerability intake, geospatial regions,
-- Level 3 predictive snapshot tables, and model governance logs.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS postgis;

-- -----------------------------------------------------
-- Extend role model for state/county deployment scopes
-- -----------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'STATE_ADMIN';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'COUNTY_ADMIN';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ORG_ADMIN';
    ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'MEMBER';
  END IF;
END $$;

-- Add geographic scope markers to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS state_id TEXT,
  ADD COLUMN IF NOT EXISTS county_id TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_state_id ON profiles(state_id);
CREATE INDEX IF NOT EXISTS idx_profiles_county_id ON profiles(county_id);

-- -----------------------------------------------------
-- Extend existing vitals table for structured intake
-- -----------------------------------------------------
ALTER TABLE vitals
  ADD COLUMN IF NOT EXISTS household_size INTEGER,
  ADD COLUMN IF NOT EXISTS medication_dependency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS insulin_dependency BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS oxygen_powered_device BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS mobility_limitation BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS transportation_access BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS financial_strain BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS zip_code VARCHAR(20),
  ADD COLUMN IF NOT EXISTS consent_preparedness_planning BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_vitals_zip_code ON vitals(zip_code);

-- -----------------------------------------------------
-- Core table: geography_regions (PostGIS polygons)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS geography_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT NOT NULL,
  state_id TEXT NOT NULL,
  region_name TEXT NOT NULL,
  region_type TEXT NOT NULL DEFAULT 'COUNTY',
  geom geometry(MultiPolygon, 4326) NOT NULL,
  centroid geometry(Point, 4326),
  is_active BOOLEAN DEFAULT true,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(county_id, state_id, region_name)
);

CREATE INDEX IF NOT EXISTS idx_geography_regions_org ON geography_regions(organization_id);
CREATE INDEX IF NOT EXISTS idx_geography_regions_county_state ON geography_regions(county_id, state_id);
CREATE INDEX IF NOT EXISTS idx_geography_regions_geom ON geography_regions USING GIST (geom);

-- -----------------------------------------------------
-- Core table: vulnerability_profiles
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS vulnerability_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT,
  state_id TEXT,
  household_size INTEGER NOT NULL CHECK (household_size >= 1),
  medication_dependency BOOLEAN NOT NULL DEFAULT false,
  insulin_dependency BOOLEAN NOT NULL DEFAULT false,
  oxygen_powered_device BOOLEAN NOT NULL DEFAULT false,
  mobility_limitation BOOLEAN NOT NULL DEFAULT false,
  transportation_access BOOLEAN NOT NULL DEFAULT true,
  financial_strain BOOLEAN NOT NULL DEFAULT false,
  zip_code VARCHAR(20) NOT NULL,
  consent_preparedness_planning BOOLEAN NOT NULL DEFAULT false,
  consent_timestamp TIMESTAMPTZ,
  risk_score NUMERIC(8, 4) DEFAULT 0,
  intake_source TEXT DEFAULT 'settings_vital_intake',
  intake_version TEXT DEFAULT 'v2-state-ready',
  updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vuln_profiles_org ON vulnerability_profiles(organization_id);
CREATE INDEX IF NOT EXISTS idx_vuln_profiles_county_state ON vulnerability_profiles(county_id, state_id);
CREATE INDEX IF NOT EXISTS idx_vuln_profiles_zip ON vulnerability_profiles(zip_code);
CREATE INDEX IF NOT EXISTS idx_vuln_profiles_risk ON vulnerability_profiles(risk_score DESC);

-- -----------------------------------------------------
-- Kit rule engine bridge: intake -> recommendations
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS kit_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trigger_type TEXT NOT NULL DEFAULT 'profile_flag', -- profile_flag | risk_score | alert_context
  trigger_key TEXT NOT NULL,
  operator TEXT NOT NULL DEFAULT 'equals', -- equals | gte | lte | contains
  trigger_value TEXT NOT NULL,
  kit_item_id TEXT NOT NULL,
  kit_item TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'health',
  priority TEXT NOT NULL DEFAULT 'recommended', -- critical | recommended | optional
  outreach_flag TEXT,
  duration_bump_days INTEGER NOT NULL DEFAULT 0,
  readiness_cap INTEGER,
  explanation TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(trigger_type, trigger_key, operator, trigger_value, kit_item_id)
);

CREATE INDEX IF NOT EXISTS idx_kit_rules_active ON kit_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_kit_rules_trigger ON kit_rules(trigger_type, trigger_key);

CREATE TABLE IF NOT EXISTS kit_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT,
  state_id TEXT,
  risk_score NUMERIC(8, 4) DEFAULT 0,
  recommended_duration_days INTEGER NOT NULL DEFAULT 3,
  required_item_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  added_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  critical_missing_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  outreach_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
  base_completion_pct NUMERIC(6, 2) NOT NULL DEFAULT 0,
  readiness_cap NUMERIC(6, 2) NOT NULL DEFAULT 100,
  readiness_score NUMERIC(6, 2) NOT NULL DEFAULT 0,
  risk_tier TEXT DEFAULT 'STANDARD',
  source_version TEXT DEFAULT 'kit-rules-v1',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kit_reco_org ON kit_recommendations(organization_id);
CREATE INDEX IF NOT EXISTS idx_kit_reco_scope ON kit_recommendations(state_id, county_id);
CREATE INDEX IF NOT EXISTS idx_kit_reco_readiness ON kit_recommendations(readiness_score ASC);

-- -----------------------------------------------------
-- Core table: alerts
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_alert_id TEXT,
  source TEXT NOT NULL, -- NOAA, FEMA, State feed
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'INFO',
  headline TEXT NOT NULL,
  description TEXT,
  effective_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT,
  state_id TEXT,
  region_id UUID REFERENCES geography_regions(id) ON DELETE SET NULL,
  affected_area geometry(MultiPolygon, 4326),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_alert_id)
);

CREATE INDEX IF NOT EXISTS idx_alerts_source_created ON alerts(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_county_state ON alerts(county_id, state_id);
CREATE INDEX IF NOT EXISTS idx_alerts_region ON alerts(region_id);
CREATE INDEX IF NOT EXISTS idx_alerts_affected_area ON alerts USING GIST (affected_area);

-- -----------------------------------------------------
-- Core table: region_snapshots
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS region_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL,
  snapshot_window_days INTEGER NOT NULL DEFAULT 30,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT NOT NULL,
  state_id TEXT NOT NULL,
  region_id UUID REFERENCES geography_regions(id) ON DELETE SET NULL,
  profile_count INTEGER NOT NULL DEFAULT 0,
  avg_risk_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  max_risk_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  min_risk_score NUMERIC(8, 4) NOT NULL DEFAULT 0,
  risk_growth_pct NUMERIC(10, 4) DEFAULT 0,
  drift_value NUMERIC(10, 4) DEFAULT 0,
  drift_status TEXT DEFAULT 'STABLE', -- STABLE, ESCALATING, ACCELERATING
  kmeans_cluster INTEGER,
  dbscan_cluster INTEGER,
  anomaly_count INTEGER DEFAULT 0,
  projection_14d NUMERIC(10, 4),
  model_version TEXT NOT NULL,
  pipeline_run_id UUID,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_region_snapshots_date ON region_snapshots(snapshot_date DESC);
CREATE INDEX IF NOT EXISTS idx_region_snapshots_county_state ON region_snapshots(county_id, state_id);
CREATE INDEX IF NOT EXISTS idx_region_snapshots_org ON region_snapshots(organization_id);
CREATE INDEX IF NOT EXISTS idx_region_snapshots_drift ON region_snapshots(drift_status, drift_value DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_region_snapshots_unique_scope
  ON region_snapshots (
    snapshot_date,
    county_id,
    state_id,
    COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

-- -----------------------------------------------------
-- Core table: model_audit_log
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS model_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  run_id UUID NOT NULL,
  model_name TEXT NOT NULL,
  model_version TEXT NOT NULL,
  stage TEXT NOT NULL, -- risk_score, kmeans, dbscan, isolation_forest, drift
  status TEXT NOT NULL DEFAULT 'SUCCESS', -- SUCCESS, FAILED, PARTIAL
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ,
  duration_ms INTEGER,
  processed_records INTEGER DEFAULT 0,
  feature_set JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  initiated_by TEXT DEFAULT 'nightly_pipeline',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_model_audit_run ON model_audit_log(run_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_model_audit_stage ON model_audit_log(stage, status, created_at DESC);

-- -----------------------------------------------------
-- Core table: audit_log (security-grade)
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role user_role,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  county_id TEXT,
  state_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  outcome TEXT NOT NULL DEFAULT 'SUCCESS',
  reason TEXT,
  request_id TEXT,
  ip_address INET,
  user_agent TEXT,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_scope ON audit_log(state_id, county_id, organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action, outcome, created_at DESC);

-- -----------------------------------------------------
-- Shared updated_at triggers
-- -----------------------------------------------------
DROP TRIGGER IF EXISTS update_geography_regions_updated_at ON geography_regions;
CREATE TRIGGER update_geography_regions_updated_at
  BEFORE UPDATE ON geography_regions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vulnerability_profiles_updated_at ON vulnerability_profiles;
CREATE TRIGGER update_vulnerability_profiles_updated_at
  BEFORE UPDATE ON vulnerability_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_alerts_updated_at ON alerts;
CREATE TRIGGER update_alerts_updated_at
  BEFORE UPDATE ON alerts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kit_rules_updated_at ON kit_rules;
CREATE TRIGGER update_kit_rules_updated_at
  BEFORE UPDATE ON kit_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_kit_recommendations_updated_at ON kit_recommendations;
CREATE TRIGGER update_kit_recommendations_updated_at
  BEFORE UPDATE ON kit_recommendations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- -----------------------------------------------------
-- Risk score + drift helpers
-- -----------------------------------------------------
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

DROP TRIGGER IF EXISTS trg_set_vulnerability_risk_score ON vulnerability_profiles;
CREATE TRIGGER trg_set_vulnerability_risk_score
  BEFORE INSERT OR UPDATE ON vulnerability_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_vulnerability_risk_score();

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
-- Aggregate-only dashboard views
-- -----------------------------------------------------
CREATE OR REPLACE VIEW state_vulnerability_index
  WITH (security_invoker = true)
AS
SELECT
  rs.state_id,
  rs.snapshot_date,
  COUNT(*) AS county_rows,
  AVG(rs.avg_risk_score)::NUMERIC(10,4) AS state_vulnerability_index,
  AVG(rs.risk_growth_pct)::NUMERIC(10,4) AS state_risk_growth_pct,
  COUNT(*) FILTER (WHERE rs.drift_status = 'ESCALATING') AS counties_escalating,
  COUNT(*) FILTER (WHERE rs.drift_status = 'ACCELERATING') AS counties_accelerating
FROM region_snapshots rs
GROUP BY rs.state_id, rs.snapshot_date;

CREATE OR REPLACE VIEW county_vulnerability_rankings
  WITH (security_invoker = true)
AS
SELECT
  rs.state_id,
  rs.county_id,
  rs.snapshot_date,
  AVG(rs.avg_risk_score)::NUMERIC(10,4) AS county_avg_risk,
  AVG(rs.risk_growth_pct)::NUMERIC(10,4) AS county_growth_pct,
  MAX(rs.drift_status) AS drift_status,
  SUM(rs.profile_count) AS profile_count
FROM region_snapshots rs
GROUP BY rs.state_id, rs.county_id, rs.snapshot_date;

-- Frontend map regions with GeoJSON payload
CREATE OR REPLACE VIEW geography_regions_map_view
  WITH (security_invoker = true)
AS
SELECT
  gr.id,
  gr.organization_id,
  gr.county_id,
  gr.state_id,
  gr.region_name,
  gr.region_type,
  ST_AsGeoJSON(gr.geom)::jsonb AS geojson,
  ST_AsGeoJSON(gr.centroid)::jsonb AS centroid_geojson,
  gr.updated_at
FROM geography_regions gr
WHERE gr.is_active = true;

-- Latest snapshot per scope for map overlays and status cards
CREATE OR REPLACE VIEW region_snapshot_latest_view
  WITH (security_invoker = true)
AS
SELECT DISTINCT ON (rs.county_id, rs.state_id, COALESCE(rs.organization_id, '00000000-0000-0000-0000-000000000000'::uuid))
  rs.id,
  rs.snapshot_date,
  rs.organization_id,
  rs.county_id,
  rs.state_id,
  rs.region_id,
  rs.profile_count,
  rs.avg_risk_score,
  rs.max_risk_score,
  rs.min_risk_score,
  rs.risk_growth_pct,
  rs.drift_value,
  rs.drift_status,
  rs.kmeans_cluster,
  rs.dbscan_cluster,
  rs.anomaly_count,
  rs.projection_14d,
  rs.model_version,
  rs.pipeline_run_id,
  rs.created_at
FROM region_snapshots rs
ORDER BY rs.county_id, rs.state_id, COALESCE(rs.organization_id, '00000000-0000-0000-0000-000000000000'::uuid), rs.snapshot_date DESC, rs.created_at DESC;

-- Outreach summary derived from rule outputs
CREATE OR REPLACE VIEW organization_outreach_flags_view
  WITH (security_invoker = true)
AS
SELECT
  kr.organization_id,
  kr.state_id,
  kr.county_id,
  flag.flag AS outreach_flag,
  COUNT(*) AS member_count,
  MAX(kr.updated_at) AS last_updated
FROM kit_recommendations kr
CROSS JOIN LATERAL jsonb_array_elements_text(kr.outreach_flags) AS flag(flag)
GROUP BY kr.organization_id, kr.state_id, kr.county_id, flag.flag;

-- Baseline rules (idempotent)
INSERT INTO kit_rules (
  trigger_type,
  trigger_key,
  operator,
  trigger_value,
  kit_item_id,
  kit_item,
  category,
  priority,
  outreach_flag,
  duration_bump_days,
  readiness_cap,
  explanation
)
VALUES
  ('profile_flag', 'medication_dependency', 'equals', 'true', 'medication_backup_container', 'Medication Backup Container', 'health', 'critical', 'medical-medication-continuity', 0, 70, 'Medication dependency requires backup storage for continuity.'),
  ('profile_flag', 'insulin_dependency', 'equals', 'true', 'insulated_medication_pouch', 'Insulated Medication Pouch', 'health', 'critical', 'medical-insulin-continuity', 0, 70, 'Insulin users require temperature-stable medication storage.'),
  ('profile_flag', 'oxygen_powered_device', 'equals', 'true', 'backup_power_plan', 'Backup Power Plan', 'power', 'critical', 'medical-power-continuity', 0, 70, 'Powered medical devices require backup power continuity.'),
  ('profile_flag', 'mobility_limitation', 'equals', 'true', 'evacuation_assistance_plan', 'Evacuation Assistance Plan', 'evacuation', 'recommended', 'mobility-evacuation-assist', 0, NULL, 'Mobility limitation increases evacuation coordination needs.'),
  ('profile_flag', 'transportation_access', 'equals', 'false', 'evacuation_assistance_contact', 'Evacuation Assistance Contact', 'evacuation', 'critical', 'transport-evacuation-coordination', 0, 75, 'No transport access requires pre-arranged evacuation assistance.'),
  ('profile_flag', 'financial_strain', 'equals', 'true', 'extended_low_cost_supply_plan', 'Extended Low-Cost Supply Plan', 'planning', 'recommended', 'financial-support-outreach', 2, NULL, 'Financial strain benefits from longer, cost-aware supply planning.'),
  ('risk_score', 'risk_score', 'gte', '8', 'ten_day_supply', '10-Day Supply Recommendation', 'planning', 'recommended', NULL, 0, NULL, 'High risk tier recommends 10-day supply planning.'),
  ('risk_score', 'risk_score', 'gte', '5', 'seven_day_supply', '7-Day Supply Recommendation', 'planning', 'recommended', NULL, 0, NULL, 'Elevated risk tier recommends 7-day supply planning.')
ON CONFLICT (trigger_type, trigger_key, operator, trigger_value, kit_item_id)
DO NOTHING;

COMMENT ON TABLE vulnerability_profiles IS 'Structured vulnerability intake and scored risk profile for preparedness planning';
COMMENT ON TABLE geography_regions IS 'PostGIS region boundaries used for heat map, overlays, and alert intersections';
COMMENT ON TABLE alerts IS 'Normalized external and internal alerts intersected with geographic regions';
COMMENT ON TABLE region_snapshots IS 'Daily analytics snapshots by organization/county/state with drift and projection fields';
COMMENT ON TABLE model_audit_log IS 'Execution and governance log for Level 3 predictive modeling pipeline';
COMMENT ON TABLE audit_log IS 'Security-grade immutable audit trail for compliance and incident response';
COMMENT ON TABLE kit_rules IS 'Explainable rule definitions that map intake/risk signals to kit requirements and outreach flags';
COMMENT ON TABLE kit_recommendations IS 'Per-member kit guidance output generated from vulnerability flags + kit rules + checklist completion';
COMMENT ON VIEW geography_regions_map_view IS 'GeoJSON-ready active regions for frontend map rendering';
COMMENT ON VIEW region_snapshot_latest_view IS 'Most recent region snapshot per county/state/org scope for overlays and dashboards';
COMMENT ON VIEW organization_outreach_flags_view IS 'Organization outreach counts based on unmet critical preparedness needs';
