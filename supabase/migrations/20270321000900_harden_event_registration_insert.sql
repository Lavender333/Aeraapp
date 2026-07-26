-- Narrow anonymous event registration to valid, active events and sessions.
-- This complements edge/CDN rate limiting and prevents arbitrary table writes.
drop policy if exists "registrations_insert_anon" on public.event_registrations;

create policy "registrations_insert_valid_active_event"
on public.event_registrations
for insert
to anon, authenticated
with check (
  length(trim(full_name)) between 1 and 120
  and household_size between 1 and 100
  and additional_members between 0 and 99
  and (profile_id is null or profile_id = auth.uid())
  and exists (
    select 1
    from public.distribution_events event
    where event.id = event_id
      and event.status = 'ACTIVE'
  )
  and exists (
    select 1
    from public.distribution_event_sessions session
    where session.id = session_id
      and session.event_id = event_id
      and session.status = 'ACTIVE'
      and (session.registration_open_at is null or session.registration_open_at <= now())
      and (session.registration_close_at is null or session.registration_close_at > now())
  )
);
