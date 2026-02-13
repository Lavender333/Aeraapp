-- Household Codes migration
-- Date: 2026-02-13

DO $$
BEGIN
  CREATE TYPE household_member_role AS ENUM ('OWNER', 'MEMBER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE household_invitation_status AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(10);
ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS age_group VARCHAR(20);
ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS mobility_flag BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS medical_flag BOOLEAN DEFAULT false;
ALTER TABLE IF EXISTS household_members ADD COLUMN IF NOT EXISTS login_enabled BOOLEAN DEFAULT false;

CREATE TABLE IF NOT EXISTS households (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  household_code VARCHAR(6) UNIQUE,
  home_name VARCHAR(255) DEFAULT 'Your Home',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION generate_household_code()
RETURNS text AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text := '';
  exists_count int := 0;
BEGIN
  LOOP
    candidate := '';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(chars, floor(random() * length(chars) + 1)::int, 1);
    END LOOP;

    SELECT COUNT(1) INTO exists_count FROM households WHERE household_code = candidate;
    EXIT WHEN exists_count = 0;
  END LOOP;

  RETURN candidate;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_households_code()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.household_code IS NULL OR NEW.household_code = '' THEN
    NEW.household_code := generate_household_code();
  ELSE
    NEW.household_code := UPPER(NEW.household_code);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_households_code_trigger ON households;
CREATE TRIGGER set_households_code_trigger
  BEFORE INSERT OR UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION set_households_code();

CREATE TABLE IF NOT EXISTS household_memberships (
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  profile_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role household_member_role NOT NULL DEFAULT 'MEMBER',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (household_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_households_owner_profile_id ON households(owner_profile_id);
CREATE INDEX IF NOT EXISTS idx_households_household_code ON households(household_code);
CREATE INDEX IF NOT EXISTS idx_household_memberships_household_id ON household_memberships(household_id);
CREATE INDEX IF NOT EXISTS idx_household_memberships_profile_id ON household_memberships(profile_id);

CREATE TABLE IF NOT EXISTS household_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  inviter_profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  invitee_member_ref VARCHAR(100),
  invitee_name VARCHAR(255),
  invitation_code VARCHAR(24) UNIQUE NOT NULL,
  status household_invitation_status NOT NULL DEFAULT 'PENDING',
  accepted_by_profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_invitations_household_id ON household_invitations(household_id);
CREATE INDEX IF NOT EXISTS idx_household_invitations_code ON household_invitations(invitation_code);
CREATE INDEX IF NOT EXISTS idx_household_invitations_status ON household_invitations(status);

CREATE TABLE IF NOT EXISTS household_readiness_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID UNIQUE NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  readiness_score NUMERIC(5,2) DEFAULT 0,
  readiness_tier VARCHAR(20) DEFAULT 'LOW',
  total_items INTEGER DEFAULT 0,
  checked_items INTEGER DEFAULT 0,
  recommended_duration_days INTEGER DEFAULT 3,
  last_assessed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_household_readiness_scores_household_id ON household_readiness_scores(household_id);
CREATE INDEX IF NOT EXISTS idx_household_readiness_scores_score ON household_readiness_scores(readiness_score);

CREATE TABLE IF NOT EXISTS readiness_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  item_id VARCHAR(100) NOT NULL,
  item_name VARCHAR(255),
  category VARCHAR(100),
  quantity_target VARCHAR(100),
  is_completed BOOLEAN DEFAULT false,
  source VARCHAR(50) DEFAULT 'ready_kit',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (household_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_readiness_items_household_id ON readiness_items(household_id);
CREATE INDEX IF NOT EXISTS idx_readiness_items_completed ON readiness_items(is_completed);

DROP TRIGGER IF EXISTS update_households_updated_at ON households;
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_memberships_updated_at ON household_memberships;
CREATE TRIGGER update_household_memberships_updated_at BEFORE UPDATE ON household_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_invitations_updated_at ON household_invitations;
CREATE TRIGGER update_household_invitations_updated_at BEFORE UPDATE ON household_invitations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_readiness_scores_updated_at ON household_readiness_scores;
CREATE TRIGGER update_household_readiness_scores_updated_at BEFORE UPDATE ON household_readiness_scores
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_readiness_items_updated_at ON readiness_items;
CREATE TRIGGER update_readiness_items_updated_at BEFORE UPDATE ON readiness_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Bootstrap a household for every profile that doesn't have one yet
WITH profiles_without_household AS (
  SELECT p.id AS profile_id
  FROM profiles p
  LEFT JOIN household_memberships hm ON hm.profile_id = p.id
  WHERE hm.profile_id IS NULL
),
inserted_households AS (
  INSERT INTO households (owner_profile_id, home_name)
  SELECT profile_id, 'Your Home'
  FROM profiles_without_household
  RETURNING id, owner_profile_id
)
INSERT INTO household_memberships (household_id, profile_id, role)
SELECT id, owner_profile_id, 'OWNER'::household_member_role
FROM inserted_households
ON CONFLICT (household_id, profile_id) DO NOTHING;

-- Bootstrap readiness domain from existing ready_kits when available
INSERT INTO household_readiness_scores (
  household_id,
  readiness_score,
  readiness_tier,
  total_items,
  checked_items,
  recommended_duration_days,
  last_assessed_at
)
SELECT
  hm.household_id,
  CASE WHEN COALESCE(rk.total_items, 0) > 0
    THEN ROUND((COALESCE(rk.checked_items, 0)::numeric / rk.total_items::numeric) * 100, 2)
    ELSE 0 END,
  CASE
    WHEN COALESCE(rk.total_items, 0) = 0 THEN 'LOW'
    WHEN (COALESCE(rk.checked_items, 0)::numeric / NULLIF(rk.total_items, 0)::numeric) >= 0.8 THEN 'HIGH'
    WHEN (COALESCE(rk.checked_items, 0)::numeric / NULLIF(rk.total_items, 0)::numeric) >= 0.4 THEN 'MEDIUM'
    ELSE 'LOW'
  END,
  COALESCE(rk.total_items, 0),
  COALESCE(rk.checked_items, 0),
  3,
  COALESCE(rk.updated_at, NOW())
FROM ready_kits rk
JOIN household_memberships hm ON hm.profile_id = rk.profile_id
ON CONFLICT (household_id) DO UPDATE SET
  readiness_score = EXCLUDED.readiness_score,
  readiness_tier = EXCLUDED.readiness_tier,
  total_items = EXCLUDED.total_items,
  checked_items = EXCLUDED.checked_items,
  last_assessed_at = EXCLUDED.last_assessed_at;

INSERT INTO readiness_items (household_id, item_id, item_name, is_completed, source)
SELECT
  hm.household_id,
  checked_id,
  checked_id,
  true,
  'ready_kit'
FROM ready_kits rk
JOIN household_memberships hm ON hm.profile_id = rk.profile_id
CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(rk.checked_ids, '[]'::jsonb)) AS checked_id
ON CONFLICT (household_id, item_id) DO UPDATE SET
  is_completed = EXCLUDED.is_completed,
  source = EXCLUDED.source,
  updated_at = NOW();

CREATE OR REPLACE VIEW org_members AS
SELECT * FROM members;
