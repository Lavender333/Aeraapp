-- Persist organization outreach radius in organizations table so it syncs across devices.

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS outreach_radius_miles INTEGER DEFAULT 3;

UPDATE public.organizations
SET outreach_radius_miles = 3
WHERE outreach_radius_miles IS NULL;

ALTER TABLE public.organizations
  ALTER COLUMN outreach_radius_miles SET DEFAULT 3;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organizations_outreach_radius_miles_chk'
  ) THEN
    ALTER TABLE public.organizations
      ADD CONSTRAINT organizations_outreach_radius_miles_chk
      CHECK (outreach_radius_miles BETWEEN 1 AND 25);
  END IF;
END
$$;
