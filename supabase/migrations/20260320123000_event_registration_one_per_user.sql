-- One registration per authenticated user per event, with self-edit support.

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_event_registrations_event_profile_unique
  ON public.event_registrations(event_id, profile_id)
  WHERE profile_id IS NOT NULL;

DROP POLICY IF EXISTS "registrations_insert_anon" ON public.event_registrations;
CREATE POLICY "registrations_insert_anon"
  ON public.event_registrations FOR INSERT
  WITH CHECK (
    profile_id IS NULL
    OR profile_id = auth.uid()
  );

DROP POLICY IF EXISTS "registrations_update_self" ON public.event_registrations;
CREATE POLICY "registrations_update_self"
  ON public.event_registrations FOR UPDATE
  USING (profile_id = auth.uid())
  WITH CHECK (profile_id = auth.uid());
