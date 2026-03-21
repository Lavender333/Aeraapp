-- Expand event data collection for operations and outreach quality.

ALTER TABLE public.distribution_events
  ADD COLUMN IF NOT EXISTS max_registrants INTEGER,
  ADD COLUMN IF NOT EXISTS pickup_window_start TIME,
  ADD COLUMN IF NOT EXISTS pickup_window_end TIME,
  ADD COLUMN IF NOT EXISTS event_notes TEXT;

ALTER TABLE public.event_supply_items
  ADD COLUMN IF NOT EXISTS unit_type TEXT NOT NULL DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS pack_size INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS contact_preference TEXT NOT NULL DEFAULT 'SMS',
  ADD COLUMN IF NOT EXISTS pickup_after_time TIME,
  ADD COLUMN IF NOT EXISTS proxy_pickup BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS urgency_tier TEXT NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS delivery_barrier TEXT,
  ADD COLUMN IF NOT EXISTS children_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seniors_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disability_present BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS consent_version TEXT,
  ADD COLUMN IF NOT EXISTS consent_channel TEXT NOT NULL DEFAULT 'WEB',
  ADD COLUMN IF NOT EXISTS geocode_confidence NUMERIC(4,3),
  ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

UPDATE public.event_supply_items
SET pack_size = 1
WHERE pack_size IS NULL OR pack_size < 1;

UPDATE public.event_registrations
SET
  contact_preference = COALESCE(contact_preference, 'SMS'),
  urgency_tier = COALESCE(urgency_tier, 'MEDIUM'),
  preferred_language = COALESCE(preferred_language, 'en'),
  consent_channel = COALESCE(consent_channel, 'WEB');
