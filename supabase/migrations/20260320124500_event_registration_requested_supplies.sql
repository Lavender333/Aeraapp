-- Allow participants to submit requested supplies tied to event inventory labels/items.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS requested_supplies JSONB NOT NULL DEFAULT '[]'::jsonb;
