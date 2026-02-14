-- Foundation: Address verification + preparedness aggregate layers
-- Date: 2026-02-14

-- 1) Structured address + verification fields on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS address_line_1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line_2 TEXT,
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS zip TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS google_place_id TEXT,
  ADD COLUMN IF NOT EXISTS address_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS address_verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_google_place_id ON public.profiles(google_place_id);
CREATE INDEX IF NOT EXISTS idx_profiles_address_verified ON public.profiles(address_verified);

-- 2) Extend household member readiness metadata (non-breaking)
ALTER TABLE public.household_members
  ADD COLUMN IF NOT EXISTS dietary_restrictions TEXT[],
  ADD COLUMN IF NOT EXISTS pet_indicator BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS medical_flags JSONB DEFAULT '{}'::jsonb;

-- 3) Add shared flag + surrogate id on memberships (non-breaking)
ALTER TABLE public.household_memberships
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS shared_across_households BOOLEAN DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_memberships_id_unique
  ON public.household_memberships(id);

CREATE INDEX IF NOT EXISTS idx_household_memberships_shared
  ON public.household_memberships(shared_across_households);

-- 4) Household preparedness snapshot
CREATE TABLE IF NOT EXISTS public.household_preparedness (
  household_id UUID PRIMARY KEY REFERENCES public.households(id) ON DELETE CASCADE,
  total_members INTEGER NOT NULL DEFAULT 0,
  readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  water_gap NUMERIC(10,2) NOT NULL DEFAULT 0,
  food_gap NUMERIC(10,2) NOT NULL DEFAULT 0,
  medical_gap NUMERIC(10,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5) Community aggregate snapshot
CREATE TABLE IF NOT EXISTS public.community_preparedness_aggregate (
  community_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  total_households INTEGER NOT NULL DEFAULT 0,
  total_members INTEGER NOT NULL DEFAULT 0,
  avg_readiness_score NUMERIC(5,2) NOT NULL DEFAULT 0,
  water_gap_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  medical_gap_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6) State aggregate snapshot
CREATE TABLE IF NOT EXISTS public.state_preparedness_aggregate (
  state_id TEXT PRIMARY KEY,
  total_communities INTEGER NOT NULL DEFAULT 0,
  vulnerability_index NUMERIC(6,2) NOT NULL DEFAULT 0,
  high_risk_clusters INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7) Keep updated_at in sync
DROP TRIGGER IF EXISTS update_household_preparedness_updated_at ON public.household_preparedness;
CREATE TRIGGER update_household_preparedness_updated_at
  BEFORE UPDATE ON public.household_preparedness
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_community_preparedness_aggregate_updated_at ON public.community_preparedness_aggregate;
CREATE TRIGGER update_community_preparedness_aggregate_updated_at
  BEFORE UPDATE ON public.community_preparedness_aggregate
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_state_preparedness_aggregate_updated_at ON public.state_preparedness_aggregate;
CREATE TRIGGER update_state_preparedness_aggregate_updated_at
  BEFORE UPDATE ON public.state_preparedness_aggregate
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
