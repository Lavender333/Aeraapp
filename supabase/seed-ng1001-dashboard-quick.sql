-- Quick seed for NG-1001 Org Dashboard visibility
-- Use this if members/inventory are not showing yet.

BEGIN;

-- Ensure org exists
INSERT INTO organizations (
  org_code,
  name,
  type,
  address,
  city,
  state,
  phone,
  email,
  contact_person,
  is_active
)
VALUES (
  'NG-1001',
  'Red Cross Local Chapter',
  'NGO',
  '456 Oak Ave',
  'Springfield',
  'IL',
  '555-0200',
  'contact@redcross.local',
  'Sarah Connor',
  true
)
ON CONFLICT (org_code)
DO UPDATE SET
  name = EXCLUDED.name,
  type = EXCLUDED.type,
  is_active = true,
  updated_at = NOW();

-- Inventory
INSERT INTO inventory (org_id, water, food, blankets, medical_kits)
SELECT o.id, 42, 35, 28, 18
FROM organizations o
WHERE o.org_code = 'NG-1001'
ON CONFLICT (org_id)
DO UPDATE SET
  water = EXCLUDED.water,
  food = EXCLUDED.food,
  blankets = EXCLUDED.blankets,
  medical_kits = EXCLUDED.medical_kits,
  updated_at = NOW();

-- Members directory (what Org Dashboard list uses)
WITH org AS (
  SELECT id FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
)
INSERT INTO members (
  org_id,
  name,
  status,
  location,
  last_update,
  needs,
  phone,
  address,
  emergency_contact_name,
  emergency_contact_phone,
  emergency_contact_relation
)
SELECT
  org.id,
  v.name,
  v.status::member_status,
  v.location,
  NOW() - (v.hours_ago || ' hours')::interval,
  v.needs,
  v.phone,
  v.address,
  v.emergency_name,
  v.emergency_phone,
  'Family'
FROM org,
(
  VALUES
    ('Noah Grant', 'SAFE', 'Sector 1, Springfield', ARRAY[]::text[], '555-2101', '101 Relief Ave, Springfield, IL', 'N. Grant Sr', '555-3001', 1),
    ('Maya Brooks', 'DANGER', 'Sector 2, Springfield', ARRAY['Medication Backup Container','Insulated Medication Pouch','Evacuation Assistance Contact']::text[], '555-2102', '102 Relief Ave, Springfield, IL', 'M. Brooks Contact', '555-3002', 2),
    ('Darnell Hayes', 'UNKNOWN', 'Sector 3, Springfield', ARRAY['Backup Power Plan']::text[], '555-2103', '103 Relief Ave, Springfield, IL', 'D. Hayes Contact', '555-3003', 4),
    ('Elena Ortiz', 'UNKNOWN', 'Sector 4, Springfield', ARRAY['Evacuation Assistance Contact']::text[], '555-2104', '104 Relief Ave, Springfield, IL', 'E. Ortiz Contact', '555-3004', 6)
) AS v(name, status, location, needs, phone, address, emergency_name, emergency_phone, hours_ago)
ON CONFLICT DO NOTHING;

-- Member status rollup rows
WITH org AS (
  SELECT id FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
)
INSERT INTO member_statuses (org_id, member_id, name, status, last_check_in)
SELECT
  org.id,
  v.member_id,
  v.name,
  v.status::member_status,
  NOW() - (v.hours_ago || ' hours')::interval
FROM org,
(
  VALUES
    ('ng1001-m-1', 'Noah Grant', 'SAFE', 1),
    ('ng1001-m-2', 'Maya Brooks', 'DANGER', 2),
    ('ng1001-m-3', 'Darnell Hayes', 'UNKNOWN', 4),
    ('ng1001-m-4', 'Elena Ortiz', 'UNKNOWN', 6)
) AS v(member_id, name, status, hours_ago)
ON CONFLICT (org_id, member_id)
DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  last_check_in = EXCLUDED.last_check_in,
  updated_at = NOW();

-- Sample replenishment requests for workflow visibility
WITH org AS (
  SELECT id, name FROM organizations WHERE org_code = 'NG-1001' LIMIT 1
)
INSERT INTO replenishment_requests (org_id, org_name, item, quantity, status, provider, delivered_quantity)
SELECT org.id, org.name, v.item, v.quantity, v.status::request_status, 'Central Warehouse', v.delivered_quantity
FROM org,
(
  VALUES
    ('Water Cases', 20, 'PENDING', 0),
    ('Medical Kits', 10, 'APPROVED', 0),
    ('Blankets', 15, 'STOCKED', 15)
) AS v(item, quantity, status, delivered_quantity)
ON CONFLICT DO NOTHING;

COMMIT;

-- Validate
-- SELECT o.org_code, count(*) AS members FROM members m JOIN organizations o ON o.id = m.org_id WHERE o.org_code='NG-1001' GROUP BY o.org_code;
-- SELECT o.org_code, i.water, i.food, i.blankets, i.medical_kits FROM inventory i JOIN organizations o ON o.id=i.org_id WHERE o.org_code='NG-1001';
-- SELECT o.org_code, ms.status, count(*) FROM member_statuses ms JOIN organizations o ON o.id=ms.org_id WHERE o.org_code='NG-1001' GROUP BY o.org_code, ms.status;
