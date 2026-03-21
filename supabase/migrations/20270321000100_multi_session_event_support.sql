-- Add first-class multi-session support for distribution events.
--
-- Existing single-session events are backfilled into distribution_event_sessions so
-- current registrations, QR tickets, dashboards, and distribution logs continue to work.

CREATE TABLE IF NOT EXISTS public.distribution_event_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id              UUID NOT NULL REFERENCES public.distribution_events(id) ON DELETE CASCADE,
  session_name          TEXT NOT NULL,
  start_at              TIMESTAMPTZ NOT NULL,
  end_at                TIMESTAMPTZ,
  registration_open_at  TIMESTAMPTZ,
  registration_close_at TIMESTAMPTZ,
  location_name         TEXT,
  latitude              DECIMAL(10, 8),
  longitude             DECIMAL(11, 8),
  max_registrants       INTEGER CHECK (max_registrants IS NULL OR max_registrants > 0),
  status                event_status NOT NULL DEFAULT 'DRAFT',
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT distribution_event_sessions_time_order CHECK (end_at IS NULL OR end_at >= start_at)
);

ALTER TABLE public.distribution_events
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE public.distribution_events
  ADD COLUMN IF NOT EXISTS max_registrants INTEGER,
  ADD COLUMN IF NOT EXISTS pickup_window_start TIME,
  ADD COLUMN IF NOT EXISTS pickup_window_end TIME,
  ADD COLUMN IF NOT EXISTS event_notes TEXT;

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.distribution_event_sessions(id) ON DELETE CASCADE;

ALTER TABLE public.event_distribution_logs
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES public.distribution_event_sessions(id) ON DELETE CASCADE;

INSERT INTO public.distribution_event_sessions (
  event_id,
  session_name,
  start_at,
  end_at,
  registration_open_at,
  registration_close_at,
  location_name,
  latitude,
  longitude,
  max_registrants,
  status,
  sort_order,
  created_at,
  updated_at
)
SELECT
  e.id,
  COALESCE(NULLIF(TRIM(e.name), ''), 'Distribution Session') AS session_name,
  ((e.distribution_date::TEXT || ' ' || COALESCE(e.distribution_time::TEXT, '09:00:00'))::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC')) AS start_at,
  CASE
    WHEN e.pickup_window_end IS NOT NULL THEN ((e.distribution_date::TEXT || ' ' || e.pickup_window_end::TEXT)::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC'))
    WHEN e.pickup_window_start IS NOT NULL THEN ((e.distribution_date::TEXT || ' ' || e.pickup_window_start::TEXT)::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC')) + INTERVAL '2 hours'
    WHEN e.distribution_time IS NOT NULL THEN ((e.distribution_date::TEXT || ' ' || e.distribution_time::TEXT)::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC')) + INTERVAL '2 hours'
    ELSE ((e.distribution_date::TEXT || ' 11:00:00')::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC'))
  END AS end_at,
  CASE
    WHEN e.pickup_window_start IS NOT NULL THEN ((e.distribution_date::TEXT || ' ' || e.pickup_window_start::TEXT)::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC'))
    ELSE ((e.distribution_date::TEXT || ' ' || COALESCE(e.distribution_time::TEXT, '09:00:00'))::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC'))
  END AS registration_open_at,
  CASE
    WHEN e.pickup_window_end IS NOT NULL THEN ((e.distribution_date::TEXT || ' ' || e.pickup_window_end::TEXT)::TIMESTAMP AT TIME ZONE COALESCE(NULLIF(e.timezone, ''), 'UTC'))
    ELSE NULL
  END AS registration_close_at,
  e.location_name,
  e.latitude,
  e.longitude,
  e.max_registrants,
  e.status,
  0,
  e.created_at,
  e.updated_at
FROM public.distribution_events e
WHERE NOT EXISTS (
  SELECT 1
  FROM public.distribution_event_sessions s
  WHERE s.event_id = e.id
);

UPDATE public.event_registrations r
SET session_id = (
  SELECT s.id
  FROM public.distribution_event_sessions s
  WHERE s.event_id = r.event_id
  ORDER BY s.sort_order ASC, s.start_at ASC, s.created_at ASC
  LIMIT 1
)
WHERE r.session_id IS NULL;

UPDATE public.event_distribution_logs l
SET session_id = r.session_id
FROM public.event_registrations r
WHERE l.registration_id = r.id
  AND l.session_id IS NULL;

ALTER TABLE public.event_registrations
  ALTER COLUMN session_id SET NOT NULL;

ALTER TABLE public.event_distribution_logs
  ALTER COLUMN session_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_distribution_event_sessions_event
  ON public.distribution_event_sessions(event_id);

CREATE INDEX IF NOT EXISTS idx_distribution_event_sessions_status_start
  ON public.distribution_event_sessions(status, start_at);

CREATE INDEX IF NOT EXISTS idx_event_registrations_session
  ON public.event_registrations(session_id);

CREATE INDEX IF NOT EXISTS idx_event_distribution_logs_session
  ON public.event_distribution_logs(session_id);

DROP TRIGGER IF EXISTS trg_distribution_event_sessions_updated_at ON public.distribution_event_sessions;
CREATE TRIGGER trg_distribution_event_sessions_updated_at
  BEFORE UPDATE ON public.distribution_event_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'distribution_event_sessions'
  ) THEN
    NULL;
  ELSE
    ALTER PUBLICATION supabase_realtime ADD TABLE public.distribution_event_sessions;
  END IF;
END $$;

ALTER TABLE public.distribution_event_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_sessions_select_authenticated" ON public.distribution_event_sessions;
DROP POLICY IF EXISTS "event_sessions_select_public_active" ON public.distribution_event_sessions;
DROP POLICY IF EXISTS "event_sessions_insert_admin" ON public.distribution_event_sessions;
DROP POLICY IF EXISTS "event_sessions_update_admin" ON public.distribution_event_sessions;

CREATE POLICY "event_sessions_select_authenticated"
  ON public.distribution_event_sessions FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "event_sessions_select_public_active"
  ON public.distribution_event_sessions FOR SELECT
  USING (
    status = 'ACTIVE'
    AND EXISTS (
      SELECT 1
      FROM public.distribution_events e
      WHERE e.id = distribution_event_sessions.event_id
        AND e.status = 'ACTIVE'
    )
  );

CREATE POLICY "event_sessions_insert_admin"
  ON public.distribution_event_sessions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN')
    )
  );

CREATE POLICY "event_sessions_update_admin"
  ON public.distribution_event_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.distribution_events e
      WHERE e.id = distribution_event_sessions.event_id
        AND (
          e.created_by = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
              AND profiles.role IN ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN')
          )
        )
    )
  );