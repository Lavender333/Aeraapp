-- Allow public users to resolve active events from shared registration links.
-- This preserves admin-only management while enabling anonymous read of active events.

DROP POLICY IF EXISTS "events_select_public_active" ON distribution_events;

CREATE POLICY "events_select_public_active"
  ON distribution_events FOR SELECT
  USING (status = 'ACTIVE');
