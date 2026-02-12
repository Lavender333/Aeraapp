-- AERA Population Tracker demo seed
-- Run this in Supabase SQL Editor after state-ready schema + RLS are applied.

BEGIN;

-- 1) Demo regions (PostGIS polygons)
INSERT INTO geography_regions (
  organization_id,
  county_id,
  state_id,
  region_name,
  region_type,
  geom,
  centroid,
  is_active,
  metadata
)
VALUES
  (
    NULL,
    'fulton',
    'GA',
    'Fulton County Demo',
    'COUNTY',
    ST_GeomFromText('MULTIPOLYGON(((-84.75 33.55,-84.10 33.55,-84.10 34.05,-84.75 34.05,-84.75 33.55)))', 4326),
    ST_Centroid(ST_GeomFromText('MULTIPOLYGON(((-84.75 33.55,-84.10 33.55,-84.10 34.05,-84.75 34.05,-84.75 33.55)))', 4326)),
    TRUE,
    '{"seed":"population-tracker-demo"}'::jsonb
  ),
  (
    NULL,
    'miami-dade',
    'FL',
    'Miami-Dade County Demo',
    'COUNTY',
    ST_GeomFromText('MULTIPOLYGON(((-80.90 25.20,-80.05 25.20,-80.05 25.95,-80.90 25.95,-80.90 25.20)))', 4326),
    ST_Centroid(ST_GeomFromText('MULTIPOLYGON(((-80.90 25.20,-80.05 25.20,-80.05 25.95,-80.90 25.95,-80.90 25.20)))', 4326)),
    TRUE,
    '{"seed":"population-tracker-demo"}'::jsonb
  ),
  (
    NULL,
    'harris',
    'TX',
    'Harris County Demo',
    'COUNTY',
    ST_GeomFromText('MULTIPOLYGON(((-95.95 29.35,-94.95 29.35,-94.95 30.25,-95.95 30.25,-95.95 29.35)))', 4326),
    ST_Centroid(ST_GeomFromText('MULTIPOLYGON(((-95.95 29.35,-94.95 29.35,-94.95 30.25,-95.95 30.25,-95.95 29.35)))', 4326)),
    TRUE,
    '{"seed":"population-tracker-demo"}'::jsonb
  )
ON CONFLICT (county_id, state_id, region_name)
DO UPDATE SET
  geom = EXCLUDED.geom,
  centroid = EXCLUDED.centroid,
  is_active = EXCLUDED.is_active,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

-- 2) Remove previous demo snapshots for today so re-runs are clean
DELETE FROM region_snapshots
WHERE snapshot_date = CURRENT_DATE
  AND model_version = 'demo-seed-v1';

-- 3) Demo risk snapshots (what drives heatmap coloring)
INSERT INTO region_snapshots (
  snapshot_date,
  snapshot_window_days,
  organization_id,
  county_id,
  state_id,
  region_id,
  profile_count,
  avg_risk_score,
  max_risk_score,
  min_risk_score,
  risk_growth_pct,
  drift_value,
  drift_status,
  kmeans_cluster,
  dbscan_cluster,
  anomaly_count,
  projection_14d,
  model_version,
  pipeline_run_id,
  metadata
)
SELECT
  CURRENT_DATE,
  30,
  NULL,
  src.county_id,
  src.state_id,
  gr.id,
  src.profile_count,
  src.avg_risk_score,
  src.max_risk_score,
  src.min_risk_score,
  src.risk_growth_pct,
  src.drift_value,
  src.drift_status,
  src.kmeans_cluster,
  src.dbscan_cluster,
  src.anomaly_count,
  src.projection_14d,
  'demo-seed-v1',
  gen_random_uuid(),
  jsonb_build_object('seed', 'population-tracker-demo')
FROM (
  VALUES
    ('fulton', 'GA', 480, 6.30::numeric, 9.50::numeric, 2.10::numeric, 0.2100::numeric, 0.2100::numeric, 'ESCALATING', 1, 1, 11, 6.95::numeric),
    ('miami-dade', 'FL', 620, 8.15::numeric, 10.20::numeric, 3.00::numeric, 0.3100::numeric, 0.3100::numeric, 'ACCELERATING', 2, -1, 24, 9.41::numeric),
    ('harris', 'TX', 510, 4.10::numeric, 7.70::numeric, 1.40::numeric, 0.0600::numeric, 0.0600::numeric, 'STABLE', 0, 0, 4, 4.22::numeric)
) AS src(
  county_id,
  state_id,
  profile_count,
  avg_risk_score,
  max_risk_score,
  min_risk_score,
  risk_growth_pct,
  drift_value,
  drift_status,
  kmeans_cluster,
  dbscan_cluster,
  anomaly_count,
  projection_14d
)
JOIN geography_regions gr
  ON gr.county_id = src.county_id
 AND gr.state_id = src.state_id
 AND gr.is_active = TRUE;

-- 4) Demo active alerts
INSERT INTO alerts (
  external_alert_id,
  source,
  event_type,
  severity,
  headline,
  description,
  effective_at,
  expires_at,
  organization_id,
  county_id,
  state_id,
  region_id,
  metadata
)
SELECT
  src.external_alert_id,
  src.source,
  src.event_type,
  src.severity,
  src.headline,
  src.description,
  NOW() - INTERVAL '30 minutes',
  NOW() + INTERVAL '8 hours',
  NULL,
  src.county_id,
  src.state_id,
  gr.id,
  jsonb_build_object('seed', 'population-tracker-demo')
FROM (
  VALUES
    ('demo-noaa-ga-fulton-001', 'NOAA', 'FLOOD WATCH', 'WARNING', 'Flood Watch for Fulton County', 'Heavy rainfall may cause flash flooding in low-lying areas.', 'fulton', 'GA'),
    ('demo-noaa-fl-md-001', 'NOAA', 'HURRICANE WARNING', 'CRITICAL', 'Hurricane Warning for Miami-Dade County', 'Strong winds and storm surge expected; shelter readiness advised.', 'miami-dade', 'FL'),
    ('demo-fema-tx-harris-001', 'FEMA', 'HEAT ADVISORY', 'INFO', 'Heat Advisory for Harris County', 'Dangerous heat index through this evening.', 'harris', 'TX')
) AS src(
  external_alert_id,
  source,
  event_type,
  severity,
  headline,
  description,
  county_id,
  state_id
)
JOIN geography_regions gr
  ON gr.county_id = src.county_id
 AND gr.state_id = src.state_id
 AND gr.is_active = TRUE
ON CONFLICT (source, external_alert_id)
DO UPDATE SET
  event_type = EXCLUDED.event_type,
  severity = EXCLUDED.severity,
  headline = EXCLUDED.headline,
  description = EXCLUDED.description,
  effective_at = EXCLUDED.effective_at,
  expires_at = EXCLUDED.expires_at,
  county_id = EXCLUDED.county_id,
  state_id = EXCLUDED.state_id,
  region_id = EXCLUDED.region_id,
  metadata = EXCLUDED.metadata,
  updated_at = NOW();

COMMIT;

-- 5) Optional: make your signed-in profile state-level so tracker shows aggregate overlays
-- Replace <YOUR_PROFILE_UUID> with the id from profiles.id that matches auth.users.id for your account.
-- UPDATE profiles
-- SET role = 'STATE_ADMIN', state_id = 'GA', county_id = NULL
-- WHERE id = '<YOUR_PROFILE_UUID>';

-- 6) Validate rows
-- SELECT state_id, county_id, region_name FROM geography_regions ORDER BY state_id, county_id;
-- SELECT state_id, county_id, avg_risk_score, drift_status, snapshot_date FROM region_snapshot_latest_view ORDER BY avg_risk_score DESC;
-- SELECT severity, source, headline, state_id, county_id FROM alerts WHERE expires_at > NOW() ORDER BY created_at DESC;
