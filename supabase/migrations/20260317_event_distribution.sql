-- =====================================================
-- AERA Event Distribution & Outreach System
-- Migration: Event distribution tables, RLS, and policies
-- =====================================================

-- Enable UUID extension if not already present
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------
-- ENUMS
-- ----------------------

DO $$
BEGIN
  CREATE TYPE event_status AS ENUM ('DRAFT','ACTIVE','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE supply_type AS ENUM ('FOOD_BOX','WATER','HYGIENE_KIT','BABY_SUPPLIES','OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE check_in_status AS ENUM ('NO_RESPONSE','SAFE','NEEDS_HELP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE outreach_contact_method AS ENUM ('PHONE_CALL','EMAIL','MANUAL_OUTREACH');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profile-level outreach consent for app users.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS geofenced_outreach_opt_in BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS geofenced_outreach_radius_miles INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS geofenced_outreach_consent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_geofenced_outreach_opt_in
  ON profiles(geofenced_outreach_opt_in);

-- ----------------------
-- EVENTS
-- ----------------------

CREATE TABLE IF NOT EXISTS distribution_events (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  name             VARCHAR(255) NOT NULL,
  distribution_date DATE NOT NULL,
  distribution_time TIME,
  location_name    TEXT,
  latitude         DECIMAL(10, 8),
  longitude        DECIMAL(11, 8),
  status           event_status NOT NULL DEFAULT 'DRAFT',
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------
-- SUPPLY INVENTORY
-- ----------------------

CREATE TABLE IF NOT EXISTS event_supply_items (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id             UUID NOT NULL REFERENCES distribution_events(id) ON DELETE CASCADE,
  supply_type          supply_type NOT NULL DEFAULT 'OTHER',
  supply_label         VARCHAR(255) NOT NULL,
  starting_count       INTEGER NOT NULL DEFAULT 0 CHECK (starting_count >= 0),
  current_count        INTEGER NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  low_stock_threshold  INTEGER NOT NULL DEFAULT 10 CHECK (low_stock_threshold >= 0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------
-- REGISTRATIONS
-- ----------------------
-- Household rule: primary registrant + up to 2 additional members = free (total 3).
-- additional_members > 2 requires admin approval or payment.
-- participant_code is a 4-digit code unique per event for manual lookup.
-- QR payload = event_id + ":" + participant_code

CREATE TABLE IF NOT EXISTS event_registrations (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id             UUID NOT NULL REFERENCES distribution_events(id) ON DELETE CASCADE,
  ticket_id            VARCHAR(50) UNIQUE NOT NULL,  -- e.g., FOOD0424-4827
  participant_code     VARCHAR(4) NOT NULL,           -- 4-digit, unique per event
  full_name            VARCHAR(255) NOT NULL,
  household_size       INTEGER NOT NULL DEFAULT 1 CHECK (household_size >= 1),
  additional_members   INTEGER NOT NULL DEFAULT 0 CHECK (additional_members >= 0),
  free_member_limit    INTEGER NOT NULL DEFAULT 2,
  zip_code             VARCHAR(20),
  phone                VARCHAR(50),
  email                VARCHAR(255),
  served               BOOLEAN NOT NULL DEFAULT FALSE,
  served_at            TIMESTAMPTZ,
  served_by            UUID REFERENCES profiles(id) ON DELETE SET NULL,
  admin_override       BOOLEAN NOT NULL DEFAULT FALSE,
  check_in_status      check_in_status NOT NULL DEFAULT 'NO_RESPONSE',
  check_in_at          TIMESTAMPTZ,
  outreach_opt_in      BOOLEAN NOT NULL DEFAULT FALSE,
  outreach_radius_miles INTEGER NOT NULL DEFAULT 3 CHECK (outreach_radius_miles > 0),
  latitude             DECIMAL(10, 8),
  longitude            DECIMAL(11, 8),
  consent_timestamp    TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (event_id, participant_code)
);

-- ----------------------
-- DISTRIBUTION LOGS
-- Tracks exactly which supplies were handed to whom
-- ----------------------

CREATE TABLE IF NOT EXISTS event_distribution_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id         UUID NOT NULL REFERENCES distribution_events(id) ON DELETE CASCADE,
  registration_id  UUID NOT NULL REFERENCES event_registrations(id) ON DELETE CASCADE,
  supply_item_id   UUID REFERENCES event_supply_items(id) ON DELETE SET NULL,
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  distributed_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  distributed_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  notes            TEXT
);

CREATE TABLE IF NOT EXISTS org_outreach_audit_logs (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  leader_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  target_name       VARCHAR(255) NOT NULL,
  target_phone      VARCHAR(50),
  target_email      VARCHAR(255),
  contact_method    outreach_contact_method NOT NULL,
  distance_miles    NUMERIC(8, 2),
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------
-- INDEXES
-- ----------------------

CREATE INDEX IF NOT EXISTS idx_distribution_events_org      ON distribution_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_distribution_events_date     ON distribution_events(distribution_date);
CREATE INDEX IF NOT EXISTS idx_event_supply_event           ON event_supply_items(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_event    ON event_registrations(event_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_code     ON event_registrations(event_id, participant_code);
CREATE INDEX IF NOT EXISTS idx_event_registrations_ticket   ON event_registrations(ticket_id);
CREATE INDEX IF NOT EXISTS idx_event_dist_logs_event        ON event_distribution_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_event_dist_logs_reg          ON event_distribution_logs(registration_id);
CREATE INDEX IF NOT EXISTS idx_org_outreach_logs_org        ON org_outreach_audit_logs(organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_outreach_logs_target     ON org_outreach_audit_logs(target_profile_id, created_at DESC);

-- ----------------------
-- UPDATED_AT TRIGGER
-- ----------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_distribution_events_updated_at ON distribution_events;
CREATE TRIGGER trg_distribution_events_updated_at
  BEFORE UPDATE ON distribution_events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ----------------------
-- REALTIME
-- ----------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'distribution_events'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE distribution_events;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_supply_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_supply_items;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_registrations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_registrations;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'event_distribution_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE event_distribution_logs;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_publication p
    WHERE p.pubname = 'supabase_realtime'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'org_outreach_audit_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE org_outreach_audit_logs;
  END IF;
END $$;

-- ----------------------
-- ORG LEADER GEO-FENCED OUTREACH RPC
-- Returns app users who:
--   1) opted into outreach,
--   2) are within 3 miles (or requested radius),
--   3) are not already connected to a trusted network,
--   4) have the app profile + saved coordinates.
-- ----------------------

CREATE OR REPLACE FUNCTION public.get_org_outreach_candidates(
  p_org_id UUID DEFAULT NULL,
  p_radius_miles INTEGER DEFAULT 3
)
RETURNS TABLE (
  profile_id UUID,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  distance_miles NUMERIC(8, 2)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor_role TEXT;
  v_actor_org_id UUID;
  v_target_org_id UUID;
  v_org_lat DECIMAL(10, 8);
  v_org_lng DECIMAL(11, 8);
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT role::TEXT, org_id
  INTO v_actor_role, v_actor_org_id
  FROM profiles
  WHERE id = auth.uid();

  IF v_actor_role NOT IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN') THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  v_target_org_id := COALESCE(p_org_id, v_actor_org_id);

  IF v_target_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization is required';
  END IF;

  IF v_actor_role <> 'ADMIN' AND v_actor_org_id IS DISTINCT FROM v_target_org_id THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT latitude, longitude
  INTO v_org_lat, v_org_lng
  FROM organizations
  WHERE id = v_target_org_id;

  IF v_org_lat IS NULL OR v_org_lng IS NULL THEN
    RAISE EXCEPTION 'Organization location is missing';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT
      p.id,
      COALESCE(p.full_name, '') AS full_name,
      COALESCE(p.mobile_phone, p.phone, '') AS phone,
      COALESCE(p.email, '') AS email,
      p.latitude,
      p.longitude,
      ROUND((
        3958.8 * 2 * ASIN(
          SQRT(
            POWER(SIN(RADIANS((p.latitude - v_org_lat) / 2)), 2)
            + COS(RADIANS(v_org_lat))
            * COS(RADIANS(p.latitude))
            * POWER(SIN(RADIANS((p.longitude - v_org_lng) / 2)), 2)
          )
        )
      )::NUMERIC, 2) AS distance_miles,
      COALESCE(p.geofenced_outreach_radius_miles, 3) AS allowed_radius
    FROM profiles p
    WHERE p.is_active = TRUE
      AND p.id <> auth.uid()
      AND p.latitude IS NOT NULL
      AND p.longitude IS NOT NULL
      AND COALESCE(p.geofenced_outreach_opt_in, FALSE) = TRUE
      AND p.org_id IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM trusted_community_connections tcc
        WHERE tcc.profile_id = p.id
      )
  )
  SELECT
    c.id,
    c.full_name,
    c.phone,
    c.email,
    c.latitude,
    c.longitude,
    c.distance_miles
  FROM candidates c
  WHERE c.distance_miles <= LEAST(COALESCE(NULLIF(p_radius_miles, 0), 3), c.allowed_radius)
  ORDER BY c.distance_miles ASC, c.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_org_outreach_candidates(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_org_outreach_candidates(UUID, INTEGER) TO authenticated;

-- ----------------------
-- ROW LEVEL SECURITY
-- ----------------------

ALTER TABLE distribution_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_supply_items        ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_registrations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_distribution_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_outreach_audit_logs   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "events_select_authenticated" ON distribution_events;
DROP POLICY IF EXISTS "events_insert_admin" ON distribution_events;
DROP POLICY IF EXISTS "events_update_admin" ON distribution_events;
DROP POLICY IF EXISTS "supply_items_select_authenticated" ON event_supply_items;
DROP POLICY IF EXISTS "supply_items_manage_admin" ON event_supply_items;
DROP POLICY IF EXISTS "registrations_insert_anon" ON event_registrations;
DROP POLICY IF EXISTS "registrations_select_authenticated" ON event_registrations;
DROP POLICY IF EXISTS "registrations_update_volunteer" ON event_registrations;
DROP POLICY IF EXISTS "dist_logs_insert_volunteer" ON event_distribution_logs;
DROP POLICY IF EXISTS "dist_logs_select_authenticated" ON event_distribution_logs;
DROP POLICY IF EXISTS "org_outreach_logs_select_leader" ON org_outreach_audit_logs;
DROP POLICY IF EXISTS "org_outreach_logs_insert_leader" ON org_outreach_audit_logs;

-- distribution_events: admins/org-admins can manage; anyone authenticated can read active events
CREATE POLICY "events_select_authenticated"
  ON distribution_events FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "events_insert_admin"
  ON distribution_events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN','INSTITUTION_ADMIN','ORG_ADMIN')
    )
  );

CREATE POLICY "events_update_admin"
  ON distribution_events FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN','INSTITUTION_ADMIN','ORG_ADMIN')
    )
  );

-- supply items: same pattern
CREATE POLICY "supply_items_select_authenticated"
  ON event_supply_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "supply_items_manage_admin"
  ON event_supply_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN','INSTITUTION_ADMIN','ORG_ADMIN')
    )
  );

-- registrations: public insert (no auth required for self-registration);
--   volunteers/admins can read & update served status
CREATE POLICY "registrations_insert_anon"
  ON event_registrations FOR INSERT
  WITH CHECK (true);  -- public self-registration

CREATE POLICY "registrations_select_authenticated"
  ON event_registrations FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "registrations_update_volunteer"
  ON event_registrations FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN','INSTITUTION_ADMIN','ORG_ADMIN','FIRST_RESPONDER','LOCAL_AUTHORITY')
    )
  );

-- distribution logs: volunteers can insert; admins/volunteers can read
CREATE POLICY "dist_logs_insert_volunteer"
  ON event_distribution_logs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('ADMIN','INSTITUTION_ADMIN','ORG_ADMIN','FIRST_RESPONDER','LOCAL_AUTHORITY')
    )
  );

CREATE POLICY "dist_logs_select_authenticated"
  ON event_distribution_logs FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "org_outreach_logs_select_leader"
  ON org_outreach_audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'ADMIN'
        OR (profiles.role IN ('INSTITUTION_ADMIN','ORG_ADMIN') AND profiles.org_id = org_outreach_audit_logs.organization_id)
      )
    )
  );

CREATE POLICY "org_outreach_logs_insert_leader"
  ON org_outreach_audit_logs FOR INSERT
  WITH CHECK (
    leader_profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND (
        profiles.role = 'ADMIN'
        OR (profiles.role IN ('INSTITUTION_ADMIN','ORG_ADMIN') AND profiles.org_id = org_outreach_audit_logs.organization_id)
      )
    )
  );

-- =====================================================
-- END OF MIGRATION
-- =====================================================
