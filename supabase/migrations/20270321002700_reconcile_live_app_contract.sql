-- Reconcile columns and RPC return types used by the current web and mobile app.
-- This migration is intentionally idempotent because older production projects
-- may have been initialized from schema.sql while newer ones were migration-only.

alter table public.profiles
  add column if not exists geocode_confidence numeric(4,3),
  add column if not exists geocoded_at timestamptz;

alter table public.broadcasts
  add column if not exists history jsonb not null default '[]'::jsonb;

alter table public.replenishment_requests
  add column if not exists stocked boolean not null default false,
  add column if not exists stocked_at timestamptz,
  add column if not exists stocked_quantity integer not null default 0;

alter table public.replenishment_requests
  drop constraint if exists replenishment_requests_stocked_quantity_check;
alter table public.replenishment_requests
  add constraint replenishment_requests_stocked_quantity_check
  check (stocked_quantity >= 0);

alter table public.organizations
  add column if not exists created_by uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'organizations_created_by_fkey'
      and conrelid = 'public.organizations'::regclass
  ) then
    alter table public.organizations
      add constraint organizations_created_by_fkey
      foreign key (created_by) references public.profiles(id) on delete set null;
  end if;
end
$$;

create or replace function public.refresh_my_community_outreach_matches()
returns table (
  organization_id uuid,
  organization_code text,
  organization_name text,
  distance_miles numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  perform public.sync_community_outreach_matches_for_profile(auth.uid());

  return query
  select
    m.organization_id,
    o.org_code::text,
    o.name::text,
    m.distance_miles::numeric
  from public.community_outreach_matches m
  join public.organizations o on o.id = m.organization_id
  where m.profile_id = auth.uid()
    and m.status = 'matched'
  order by m.distance_miles asc, o.name asc;
end;
$$;

revoke all on function public.refresh_my_community_outreach_matches()
  from public, anon;
grant execute on function public.refresh_my_community_outreach_matches()
  to authenticated;
