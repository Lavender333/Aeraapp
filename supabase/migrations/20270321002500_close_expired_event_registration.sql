-- Do not leave past sessions available indefinitely when an administrator did
-- not provide an explicit registration-close timestamp.
UPDATE public.distribution_event_sessions
SET status = 'COMPLETED',
    updated_at = now()
WHERE status = 'ACTIVE'
  AND coalesce(registration_close_at, end_at, start_at + interval '24 hours') <= now();

UPDATE public.distribution_events event
SET status = 'COMPLETED',
    updated_at = now()
WHERE event.status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1
    FROM public.distribution_event_sessions session
    WHERE session.event_id = event.id
      AND session.status = 'ACTIVE'
      AND (session.registration_open_at IS NULL OR session.registration_open_at <= now())
      AND coalesce(session.registration_close_at, session.end_at, session.start_at + interval '24 hours') > now()
  );

DROP POLICY IF EXISTS "registrations_insert_valid_active_event" ON public.event_registrations;
CREATE POLICY "registrations_insert_valid_active_event"
ON public.event_registrations
FOR INSERT
TO anon, authenticated
WITH CHECK (
  length(trim(full_name)) BETWEEN 1 AND 120
  AND household_size BETWEEN 1 AND 100
  AND additional_members BETWEEN 0 AND 99
  AND (profile_id IS NULL OR profile_id = auth.uid())
  AND EXISTS (
    SELECT 1
    FROM public.distribution_events event
    WHERE event.id = event_id
      AND event.status = 'ACTIVE'
  )
  AND EXISTS (
    SELECT 1
    FROM public.distribution_event_sessions session
    WHERE session.id = session_id
      AND session.event_id = event_id
      AND session.status = 'ACTIVE'
      AND (session.registration_open_at IS NULL OR session.registration_open_at <= now())
      AND coalesce(session.registration_close_at, session.end_at, session.start_at + interval '24 hours') > now()
  )
);
