CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.households (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_code text UNIQUE NOT NULL,
  home_name text,
  owner_profile_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  profile_id uuid NOT NULL,
  role text NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MEMBER')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (household_id, profile_id)
);

CREATE TABLE IF NOT EXISTS public.household_join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid NOT NULL,
  requesting_user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  type text NOT NULL,
  related_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid,
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.households
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS household_code text,
  ADD COLUMN IF NOT EXISTS home_name text,
  ADD COLUMN IF NOT EXISTS owner_profile_id uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.household_memberships
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS household_id uuid,
  ADD COLUMN IF NOT EXISTS profile_id uuid,
  ADD COLUMN IF NOT EXISTS role text DEFAULT 'MEMBER',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.household_join_requests
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS household_id uuid,
  ADD COLUMN IF NOT EXISTS requesting_user_id uuid,
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolved_by uuid;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS related_id uuid,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS read boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

ALTER TABLE public.activity_log
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS org_id uuid,
  ADD COLUMN IF NOT EXISTS user_id uuid,
  ADD COLUMN IF NOT EXISTS action text,
  ADD COLUMN IF NOT EXISTS entity_type text,
  ADD COLUMN IF NOT EXISTS entity_id text,
  ADD COLUMN IF NOT EXISTS details jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_memberships_role_check'
      AND conrelid = 'public.household_memberships'::regclass
  ) THEN
    ALTER TABLE public.household_memberships
      ADD CONSTRAINT household_memberships_role_check
      CHECK (role IN ('OWNER', 'MEMBER'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'household_join_requests_status_check'
      AND conrelid = 'public.household_join_requests'::regclass
  ) THEN
    ALTER TABLE public.household_join_requests
      ADD CONSTRAINT household_join_requests_status_check
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_households_household_code
  ON public.households(household_code);

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_memberships_unique
  ON public.household_memberships(household_id, profile_id);

CREATE INDEX IF NOT EXISTS idx_household_memberships_household_id
  ON public.household_memberships(household_id);

CREATE INDEX IF NOT EXISTS idx_household_memberships_profile_id
  ON public.household_memberships(profile_id);

CREATE INDEX IF NOT EXISTS idx_household_join_requests_household_id
  ON public.household_join_requests(household_id);

CREATE INDEX IF NOT EXISTS idx_household_join_requests_requesting_user_id
  ON public.household_join_requests(requesting_user_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_household_join_requests_pending_unique
  ON public.household_join_requests(household_id, requesting_user_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread_created
  ON public.notifications(user_id, read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at
  ON public.activity_log(created_at DESC);
