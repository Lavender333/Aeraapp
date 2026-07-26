ALTER TABLE public.replenishment_requests
  ADD COLUMN IF NOT EXISTS perishable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS expiration_date date;

ALTER TABLE public.replenishment_requests
  DROP CONSTRAINT IF EXISTS replenishment_expiration_required;

ALTER TABLE public.replenishment_requests
  ADD CONSTRAINT replenishment_expiration_required
  CHECK (
    (perishable = false AND expiration_date IS NULL)
    OR
    (perishable = true AND expiration_date IS NOT NULL)
  );

CREATE INDEX IF NOT EXISTS replenishment_requests_expiration_date_idx
  ON public.replenishment_requests (expiration_date)
  WHERE perishable = true;
