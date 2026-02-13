-- Seed preparedness analytics for NG-1001
-- Purpose: populate Preparedness tab (outreach signals + member preparedness gaps)
-- Run in Supabase SQL Editor.

BEGIN;

WITH org AS (
  SELECT id
  FROM organizations
  WHERE org_code = 'NG-1001'
  LIMIT 1
),
candidates AS (
  SELECT p.id, p.full_name, p.phone, ROW_NUMBER() OVER (ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST) AS rn
  FROM profiles p
  LIMIT 8
),
selected_profiles AS (
  SELECT c.id,
         COALESCE(c.full_name, 'Member ' || c.rn) AS full_name,
         COALESCE(c.phone, '555-77' || LPAD(c.rn::text, 2, '0')) AS phone,
         c.rn
  FROM candidates c
  WHERE c.rn <= 4
)
UPDATE profiles p
SET
  org_id = org.id,
  full_name = COALESCE(p.full_name, sp.full_name),
  phone = COALESCE(p.phone, sp.phone),
  mobile_phone = COALESCE(p.mobile_phone, COALESCE(p.phone, sp.phone)),
  updated_at = NOW()
FROM org, selected_profiles sp
WHERE p.id = sp.id;

-- Add vulnerability rows (idempotent)
WITH org AS (
  SELECT id FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
),
selected_profiles AS (
  SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST) AS rn
  FROM profiles p
  WHERE p.org_id = (SELECT id FROM org)
  LIMIT 4
)
INSERT INTO vulnerability_profiles (
  profile_id,
  organization_id,
  county_id,
  state_id,
  household_size,
  medication_dependency,
  insulin_dependency,
  oxygen_powered_device,
  mobility_limitation,
  transportation_access,
  financial_strain,
  zip_code,
  consent_preparedness_planning,
  consent_timestamp,
  intake_source,
  intake_version,
  updated_by
)
SELECT
  sp.id,
  org.id,
  'sangamon',
  'IL',
  CASE WHEN sp.rn = 1 THEN 2 WHEN sp.rn = 2 THEN 4 WHEN sp.rn = 3 THEN 3 ELSE 5 END,
  (sp.rn IN (2,3)),
  (sp.rn = 2),
  (sp.rn = 3),
  (sp.rn IN (3,4)),
  (sp.rn NOT IN (2,4)),
  (sp.rn IN (2,4)),
  CASE WHEN sp.rn = 1 THEN '62701' WHEN sp.rn = 2 THEN '62703' WHEN sp.rn = 3 THEN '62704' ELSE '62707' END,
  true,
  NOW(),
  'seed-ng1001-preparedness',
  'v1',
  sp.id
FROM org, selected_profiles sp
ON CONFLICT (profile_id)
DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  county_id = EXCLUDED.county_id,
  state_id = EXCLUDED.state_id,
  household_size = EXCLUDED.household_size,
  medication_dependency = EXCLUDED.medication_dependency,
  insulin_dependency = EXCLUDED.insulin_dependency,
  oxygen_powered_device = EXCLUDED.oxygen_powered_device,
  mobility_limitation = EXCLUDED.mobility_limitation,
  transportation_access = EXCLUDED.transportation_access,
  financial_strain = EXCLUDED.financial_strain,
  zip_code = EXCLUDED.zip_code,
  consent_preparedness_planning = true,
  consent_timestamp = NOW(),
  updated_at = NOW();

-- Ready kits (idempotent)
WITH org AS (
  SELECT id FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
),
selected_profiles AS (
  SELECT p.id, ROW_NUMBER() OVER (ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST) AS rn
  FROM profiles p
  WHERE p.org_id = (SELECT id FROM org)
  LIMIT 4
)
INSERT INTO ready_kits (profile_id, checked_ids, total_items, checked_items)
SELECT
  sp.id,
  CASE
    WHEN sp.rn = 1 THEN '["water","food","flashlight","radio","charger","bandages"]'::jsonb
    WHEN sp.rn = 2 THEN '["water","food","flashlight"]'::jsonb
    WHEN sp.rn = 3 THEN '["water","flashlight","radio"]'::jsonb
    ELSE '["water","food"]'::jsonb
  END,
  28,
  CASE WHEN sp.rn = 1 THEN 6 WHEN sp.rn = 2 THEN 3 WHEN sp.rn = 3 THEN 3 ELSE 2 END
FROM selected_profiles sp
ON CONFLICT (profile_id)
DO UPDATE SET
  checked_ids = EXCLUDED.checked_ids,
  total_items = EXCLUDED.total_items,
  checked_items = EXCLUDED.checked_items,
  updated_at = NOW();

-- Kit recommendations + outreach flags (drives Preparedness tab)
WITH org AS (
  SELECT id FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
),
selected_profiles AS (
  SELECT p.id,
         COALESCE(p.full_name, 'Unknown Member') AS full_name,
         ROW_NUMBER() OVER (ORDER BY p.updated_at DESC NULLS LAST, p.created_at DESC NULLS LAST) AS rn
  FROM profiles p
  WHERE p.org_id = (SELECT id FROM org)
  LIMIT 4
)
INSERT INTO kit_recommendations (
  profile_id,
  organization_id,
  county_id,
  state_id,
  risk_score,
  recommended_duration_days,
  required_item_ids,
  added_items,
  critical_missing_items,
  outreach_flags,
  base_completion_pct,
  readiness_cap,
  readiness_score,
  risk_tier,
  source_version,
  generated_at,
  updated_at
)
SELECT
  sp.id,
  org.id,
  'sangamon',
  'IL',
  CASE WHEN sp.rn = 1 THEN 4.8 WHEN sp.rn = 2 THEN 8.6 WHEN sp.rn = 3 THEN 7.2 ELSE 6.3 END,
  CASE WHEN sp.rn = 2 THEN 10 WHEN sp.rn >= 3 THEN 7 ELSE 3 END,
  CASE
    WHEN sp.rn = 1 THEN '["seven_day_supply"]'::jsonb
    WHEN sp.rn = 2 THEN '["medication_backup_container","insulated_medication_pouch","evacuation_assistance_contact"]'::jsonb
    WHEN sp.rn = 3 THEN '["backup_power_plan","evacuation_assistance_plan"]'::jsonb
    ELSE '["evacuation_assistance_contact"]'::jsonb
  END,
  CASE
    WHEN sp.rn = 1 THEN '[{"id":"seven_day_supply","item":"7-Day Supply Recommendation","priority":"recommended"}]'::jsonb
    WHEN sp.rn = 2 THEN '[{"id":"medication_backup_container","item":"Medication Backup Container","priority":"critical"},{"id":"insulated_medication_pouch","item":"Insulated Medication Pouch","priority":"critical"},{"id":"evacuation_assistance_contact","item":"Evacuation Assistance Contact","priority":"critical"}]'::jsonb
    WHEN sp.rn = 3 THEN '[{"id":"backup_power_plan","item":"Backup Power Plan","priority":"critical"},{"id":"evacuation_assistance_plan","item":"Evacuation Assistance Plan","priority":"recommended"}]'::jsonb
    ELSE '[{"id":"evacuation_assistance_contact","item":"Evacuation Assistance Contact","priority":"critical"}]'::jsonb
  END,
  CASE
    WHEN sp.rn = 1 THEN '[]'::jsonb
    WHEN sp.rn = 2 THEN '[{"id":"medication_backup_container","item":"Medication Backup Container"},{"id":"insulated_medication_pouch","item":"Insulated Medication Pouch"}]'::jsonb
    WHEN sp.rn = 3 THEN '[{"id":"backup_power_plan","item":"Backup Power Plan"}]'::jsonb
    ELSE '[{"id":"evacuation_assistance_contact","item":"Evacuation Assistance Contact"}]'::jsonb
  END,
  CASE
    WHEN sp.rn = 1 THEN '[]'::jsonb
    WHEN sp.rn = 2 THEN '["medical-medication-continuity","medical-insulin-continuity","transport-evacuation-coordination"]'::jsonb
    WHEN sp.rn = 3 THEN '["medical-power-continuity","mobility-evacuation-assist"]'::jsonb
    ELSE '["financial-support-outreach"]'::jsonb
  END,
  CASE WHEN sp.rn = 1 THEN 62.0 WHEN sp.rn = 2 THEN 38.0 WHEN sp.rn = 3 THEN 44.0 ELSE 31.0 END,
  CASE WHEN sp.rn = 1 THEN 100.0 ELSE 70.0 END,
  CASE WHEN sp.rn = 1 THEN 62.0 WHEN sp.rn = 2 THEN 38.0 WHEN sp.rn = 3 THEN 44.0 ELSE 31.0 END,
  CASE WHEN sp.rn = 1 THEN 'STANDARD' WHEN sp.rn = 2 THEN 'HIGH' ELSE 'ELEVATED' END,
  'seed-ng1001-preparedness-v1',
  NOW(),
  NOW()
FROM org, selected_profiles sp
ON CONFLICT (profile_id)
DO UPDATE SET
  organization_id = EXCLUDED.organization_id,
  county_id = EXCLUDED.county_id,
  state_id = EXCLUDED.state_id,
  risk_score = EXCLUDED.risk_score,
  recommended_duration_days = EXCLUDED.recommended_duration_days,
  required_item_ids = EXCLUDED.required_item_ids,
  added_items = EXCLUDED.added_items,
  critical_missing_items = EXCLUDED.critical_missing_items,
  outreach_flags = EXCLUDED.outreach_flags,
  base_completion_pct = EXCLUDED.base_completion_pct,
  readiness_cap = EXCLUDED.readiness_cap,
  readiness_score = EXCLUDED.readiness_score,
  risk_tier = EXCLUDED.risk_tier,
  source_version = EXCLUDED.source_version,
  generated_at = NOW(),
  updated_at = NOW();

COMMIT;

-- Verify:
-- SELECT COUNT(*) FROM kit_recommendations kr JOIN organizations o ON o.id = kr.organization_id WHERE o.org_code = 'NG-1001';
-- SELECT * FROM organization_outreach_flags_view WHERE organization_id = (SELECT id FROM organizations WHERE org_code='NG-1001');
