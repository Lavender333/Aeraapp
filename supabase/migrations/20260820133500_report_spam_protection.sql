-- Enforce report abuse controls in Postgres so they cannot be bypassed by
-- calling the REST API directly. Support tickets are intentionally excluded
-- from emergency-report limits because they have a separate workflow.

create or replace function public.normalized_report_text(value text)
returns text
language sql
immutable
parallel safe
as $$
  select lower(trim(regexp_replace(coalesce(value, ''), '\s+', ' ', 'g')));
$$;

revoke all on function public.normalized_report_text(text) from public, anon;
grant execute on function public.normalized_report_text(text) to authenticated, service_role;

create or replace function public.enforce_emergency_report_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hourly_count integer;
  recent_location_count integer;
  duplicate_found boolean;
  report_type text := public.normalized_report_text(new.data->>'emergencyType');
  report_description text := public.normalized_report_text(new.data->>'situationDescription');
  report_location text := public.normalized_report_text(new.location);
  report_safe text := public.normalized_report_text(new.data->>'isSafe');
begin
  if coalesce(new.data->>'requestType', '') = 'CONTACT_SUPPORT' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 68421));

  select count(*) into hourly_count
  from public.help_requests h
  where h.user_id = new.user_id
    and h.created_at >= now() - interval '1 hour'
    and coalesce(h.data->>'requestType', '') <> 'CONTACT_SUPPORT';

  if hourly_count >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_REPORT_RATE_LIMIT: You can submit up to 5 emergency reports per hour. Please wait before submitting another report.';
  end if;

  select count(*) into recent_location_count
  from public.help_requests h
  where h.user_id = new.user_id
    and h.created_at >= now() - interval '10 minutes'
    and coalesce(h.data->>'requestType', '') <> 'CONTACT_SUPPORT'
    and public.normalized_report_text(h.data->>'emergencyType') = report_type
    and public.normalized_report_text(h.location) = report_location;

  if recent_location_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_REPORT_RATE_LIMIT: Too many similar reports were submitted from this location. Please wait 10 minutes or update the existing report.';
  end if;

  select exists (
    select 1
    from public.help_requests h
    where h.user_id = new.user_id
      and h.created_at >= now() - interval '5 minutes'
      and coalesce(h.data->>'requestType', '') <> 'CONTACT_SUPPORT'
      and public.normalized_report_text(h.data->>'emergencyType') = report_type
      and public.normalized_report_text(h.data->>'situationDescription') = report_description
      and public.normalized_report_text(h.location) = report_location
      and public.normalized_report_text(h.data->>'isSafe') = report_safe
  ) into duplicate_found;

  if duplicate_found then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_REPORT_DUPLICATE: This appears to be a duplicate of a report submitted in the last 5 minutes.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_emergency_report_limits() from public, anon, authenticated;

drop trigger if exists enforce_emergency_report_limits_trigger on public.help_requests;
create trigger enforce_emergency_report_limits_trigger
before insert on public.help_requests
for each row execute function public.enforce_emergency_report_limits();

create or replace function public.enforce_damage_assessment_limits()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  hourly_count integer;
  recent_location_count integer;
  duplicate_found boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.profile_id::text, 68422));

  select count(*) into hourly_count
  from public.damage_assessments d
  where d.profile_id = new.profile_id
    and d.created_at >= now() - interval '1 hour';

  if hourly_count >= 10 then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_ASSESSMENT_RATE_LIMIT: You can submit up to 10 damage assessments per hour. Please wait before submitting another assessment.';
  end if;

  select count(*) into recent_location_count
  from public.damage_assessments d
  where d.profile_id = new.profile_id
    and d.created_at >= now() - interval '10 minutes'
    and upper(coalesce(d.damage_type, '')) = upper(coalesce(new.damage_type, ''))
    and public.normalized_report_text(d.location) = public.normalized_report_text(new.location);

  if recent_location_count >= 3 then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_ASSESSMENT_RATE_LIMIT: Too many similar assessments were submitted from this location. Please wait 10 minutes.';
  end if;

  select exists (
    select 1
    from public.damage_assessments d
    where d.profile_id = new.profile_id
      and d.created_at >= now() - interval '5 minutes'
      and upper(coalesce(d.damage_type, '')) = upper(coalesce(new.damage_type, ''))
      and coalesce(d.severity, 0) = coalesce(new.severity, 0)
      and public.normalized_report_text(d.description) = public.normalized_report_text(new.description)
      and public.normalized_report_text(d.location) = public.normalized_report_text(new.location)
  ) into duplicate_found;

  if duplicate_found then
    raise exception using
      errcode = 'P0001',
      message = 'AERA_ASSESSMENT_DUPLICATE: This appears to be a duplicate of an assessment submitted in the last 5 minutes.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_damage_assessment_limits() from public, anon, authenticated;

drop trigger if exists enforce_damage_assessment_limits_trigger on public.damage_assessments;
create trigger enforce_damage_assessment_limits_trigger
before insert on public.damage_assessments
for each row execute function public.enforce_damage_assessment_limits();

create table if not exists public.emergency_contact_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.help_requests(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  contact_phone text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0 and attempts <= 3),
  next_attempt_at timestamptz,
  last_error text,
  provider_message_id text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.emergency_contact_notifications enable row level security;

drop policy if exists "Users can view their emergency contact notifications" on public.emergency_contact_notifications;
create policy "Users can view their emergency contact notifications"
on public.emergency_contact_notifications for select to authenticated
using (user_id = auth.uid() or public.user_role() = 'ADMIN');

create index if not exists idx_emergency_contact_notifications_retry
on public.emergency_contact_notifications (status, next_attempt_at)
where status in ('PENDING', 'FAILED');

create index if not exists idx_help_requests_emergency_user_created
on public.help_requests (user_id, created_at desc)
where coalesce(data->>'requestType', '') <> 'CONTACT_SUPPORT';

create index if not exists idx_damage_assessments_profile_created
on public.damage_assessments (profile_id, created_at desc);
