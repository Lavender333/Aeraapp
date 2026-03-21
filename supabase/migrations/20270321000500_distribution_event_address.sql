-- Add a first-class event address field for distribution events.

ALTER TABLE public.distribution_events
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Backfill from legacy location_name where available.
UPDATE public.distribution_events
SET address = location_name
WHERE address IS NULL
  AND location_name IS NOT NULL
  AND btrim(location_name) <> '';
