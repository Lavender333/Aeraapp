-- iPhone push notification registration, delivery queue, and core activity alerts.

create extension if not exists pg_net with schema extensions;

do $$
begin
  create extension if not exists pg_cron;
exception
  when insufficient_privilege then
    raise notice 'Push retry scheduling skipped because pg_cron cannot be enabled by this migration';
end;
$$;

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios')),
  active boolean not null default true,
  last_registered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists push_device_tokens_user_active_idx
  on public.push_device_tokens(user_id, active);

alter table public.push_device_tokens enable row level security;

drop policy if exists "Users can view their push devices" on public.push_device_tokens;
create policy "Users can view their push devices"
  on public.push_device_tokens for select to authenticated
  using (user_id = auth.uid());

create or replace function public.register_push_device_token(p_token text, p_platform text default 'ios')
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if nullif(trim(p_token), '') is null then raise exception 'Push token is required'; end if;
  if lower(trim(p_platform)) <> 'ios' then raise exception 'Unsupported push platform'; end if;

  insert into public.push_device_tokens (user_id, token, platform, active, last_registered_at)
  values (v_user_id, trim(p_token), 'ios', true, now())
  on conflict (token) do update set
    user_id = excluded.user_id,
    platform = excluded.platform,
    active = true,
    last_registered_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.deactivate_push_device_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.push_device_tokens
  set active = false
  where user_id = auth.uid() and token = trim(p_token);
$$;

revoke all on function public.register_push_device_token(text, text) from public;
revoke all on function public.deactivate_push_device_token(text) from public;
grant execute on function public.register_push_device_token(text, text) to authenticated;
grant execute on function public.deactivate_push_device_token(text) to authenticated;

create table if not exists public.push_delivery_queue (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references public.notifications(id) on delete cascade,
  token_id uuid not null references public.push_device_tokens(id) on delete cascade,
  status text not null default 'PENDING' check (status in ('PENDING', 'PROCESSING', 'RETRY', 'SENT', 'FAILED')),
  attempt_count integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (notification_id, token_id)
);

create index if not exists push_delivery_queue_pending_idx
  on public.push_delivery_queue(status, next_attempt_at, created_at);

alter table public.push_delivery_queue enable row level security;

create or replace function public.claim_push_deliveries(p_limit integer default 100)
returns table (
  delivery_id uuid,
  token_id uuid,
  token text,
  notification_id uuid,
  notification_type text,
  related_id uuid,
  metadata jsonb,
  attempt_count integer
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimable as (
    select q.id
    from public.push_delivery_queue q
    join public.push_device_tokens d on d.id = q.token_id and d.active
    where q.status in ('PENDING', 'RETRY', 'PROCESSING') and q.next_attempt_at <= now()
    order by q.created_at
    for update of q skip locked
    limit greatest(1, least(coalesce(p_limit, 100), 250))
  ), claimed as (
    update public.push_delivery_queue q
    set status = 'PROCESSING', attempt_count = q.attempt_count + 1,
      next_attempt_at = now() + interval '10 minutes'
    from claimable c
    where q.id = c.id
    returning q.*
  )
  select c.id, d.id, d.token, n.id, n.type, n.related_id, n.metadata, c.attempt_count
  from claimed c
  join public.push_device_tokens d on d.id = c.token_id
  join public.notifications n on n.id = c.notification_id;
end;
$$;

revoke all on function public.claim_push_deliveries(integer) from public, anon, authenticated;
grant execute on function public.claim_push_deliveries(integer) to service_role;

create or replace function public.queue_notification_for_push()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_rows integer := 0;
begin
  insert into public.push_delivery_queue (notification_id, token_id)
  select new.id, d.id
  from public.push_device_tokens d
  where d.user_id = new.user_id and d.active
  on conflict do nothing;

  get diagnostics v_rows = row_count;
  if v_rows > 0 then
    perform net.http_post(
      url := 'https://zghyxeieetqubodgplgo.supabase.co/functions/v1/dispatch-push-notifications',
      headers := '{"Content-Type":"application/json"}'::jsonb,
      body := '{}'::jsonb,
      timeout_milliseconds := 5000
    );
  end if;
  return new;
end;
$$;

drop trigger if exists queue_notification_for_push_trigger on public.notifications;
create trigger queue_notification_for_push_trigger
after insert on public.notifications
for each row execute function public.queue_notification_for_push();

do $$
declare
  v_job_id bigint;
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select jobid into v_job_id from cron.job where jobname = 'dispatch-aera-push-notifications';
    if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
    perform cron.schedule(
      'dispatch-aera-push-notifications',
      '*/5 * * * *',
      $job$select net.http_post(
        url := 'https://zghyxeieetqubodgplgo.supabase.co/functions/v1/dispatch-push-notifications',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 5000
      );$job$
    );
  end if;
exception
  when insufficient_privilege then
    raise notice 'Push retry scheduling skipped due to insufficient privilege';
end;
$$;

create or replace function public.notify_event_registration_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_event_name text;
begin
  select e.organization_id, e.name into v_org_id, v_event_name
  from public.distribution_events e where e.id = new.event_id;

  if new.profile_id is not null then
    insert into public.notifications (user_id, type, related_id, metadata)
    values (new.profile_id, 'event_registration_confirmed', new.id,
      jsonb_build_object('eventName', coalesce(v_event_name, 'Community event'), 'view', 'EVENTS'));
  end if;

  insert into public.notifications (user_id, type, related_id, metadata)
  select p.id, 'event_registration_created', new.id,
    jsonb_build_object('eventName', coalesce(v_event_name, 'Community event'), 'view', 'EVENT_DASHBOARD')
  from public.profiles p
  where p.is_active = true
    and ((v_org_id is not null and p.org_id = v_org_id and p.role::text in ('ORG_ADMIN', 'INSTITUTION_ADMIN'))
      or p.role::text = 'ADMIN');
  return new;
end;
$$;

drop trigger if exists notify_event_registration_activity_trigger on public.event_registrations;
create trigger notify_event_registration_activity_trigger
after insert on public.event_registrations
for each row execute function public.notify_event_registration_activity();

create or replace function public.notify_organization_membership_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' and new.activated_with_code_id is not null and new.status::text = 'suspended' then
    insert into public.notifications (user_id, type, related_id, metadata)
    select recipient_id, 'organization_membership_requested', new.id,
      jsonb_build_object('organizationId', new.organization_id, 'view', 'ORG_DASHBOARD')
    from (
      select p.id as recipient_id from public.profiles p
      where p.is_active = true and p.org_id = new.organization_id
        and p.role::text in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
      union
      select p.id as recipient_id from public.profiles p
      where p.is_active = true and p.role::text = 'ADMIN'
    ) recipients;
  elsif tg_op = 'UPDATE' and old.status is distinct from new.status
    and new.activated_with_code_id is not null and new.status::text in ('active', 'inactive') then
    insert into public.notifications (user_id, type, related_id, metadata)
    values (new.user_id,
      case when new.status::text = 'active' then 'organization_membership_accepted'
        else 'organization_membership_rejected' end,
      new.id,
      jsonb_build_object('organizationId', new.organization_id, 'view', 'SETTINGS'));
  end if;
  return new;
end;
$$;

drop trigger if exists notify_organization_membership_activity_trigger on public.memberships;
create trigger notify_organization_membership_activity_trigger
after insert or update of status on public.memberships
for each row execute function public.notify_organization_membership_activity();

create or replace function public.notify_incident_report_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.data->>'requestType', '') = 'CONTACT_SUPPORT' then return new; end if;
  insert into public.notifications (user_id, type, related_id, metadata)
  select p.id, 'incident_report_created', new.id,
    jsonb_build_object('priority', new.priority::text, 'view', 'ORG_DASHBOARD')
  from public.profiles p
  where p.is_active = true
    and ((new.org_id is not null and p.org_id = new.org_id and p.role::text in ('ORG_ADMIN', 'INSTITUTION_ADMIN'))
      or p.role::text = 'ADMIN');
  return new;
end;
$$;

drop trigger if exists notify_incident_report_activity_trigger on public.help_requests;
create trigger notify_incident_report_activity_trigger
after insert on public.help_requests
for each row execute function public.notify_incident_report_activity();

create or replace function public.notify_damage_assessment_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, type, related_id, metadata)
  select p.id, 'damage_assessment_created', new.id,
    jsonb_build_object('severity', new.severity, 'view', 'ORG_DASHBOARD')
  from public.profiles p
  where p.is_active = true
    and ((new.org_id is not null and p.org_id = new.org_id and p.role::text in ('ORG_ADMIN', 'INSTITUTION_ADMIN'))
      or (coalesce(new.severity, 1) >= 3 and p.role::text = 'ADMIN'));
  return new;
end;
$$;

drop trigger if exists notify_damage_assessment_activity_trigger on public.damage_assessments;
create trigger notify_damage_assessment_activity_trigger
after insert on public.damage_assessments
for each row execute function public.notify_damage_assessment_activity();
