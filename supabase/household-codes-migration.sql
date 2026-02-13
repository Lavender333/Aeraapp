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

DROP TRIGGER IF EXISTS update_households_updated_at ON households;
CREATE TRIGGER update_households_updated_at BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_memberships_updated_at ON household_memberships;
CREATE TRIGGER update_household_memberships_updated_at BEFORE UPDATE ON household_memberships
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_household_invitations_updated_at ON household_invitations;
CREATE TRIGGER update_household_invitations_updated_at BEFORE UPDATE ON household_invitations
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
