-- Turn outreach consent into durable nearby-organization matches, alert each
-- verified organization's administrators once, and add member-facing About data.

alter table public.organizations
  add column if not exists about text,
  add column if not exists website_url text;

create table if not exists public.community_outreach_matches (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  distance_miles numeric(7,2) not null,
  status text not null default 'matched'
    check (status in ('matched', 'contacted', 'dismissed', 'joined')),
  matched_at timestamptz not null default now(),
  last_notified_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (profile_id, organization_id)
);

create index if not exists community_outreach_matches_org_status_idx
  on public.community_outreach_matches(organization_id, status, matched_at desc);

alter table public.community_outreach_matches enable row level security;

drop policy if exists "people read own outreach matches" on public.community_outreach_matches;
create policy "people read own outreach matches"
  on public.community_outreach_matches for select to authenticated
  using (profile_id = auth.uid());

drop policy if exists "organization admins read outreach matches" on public.community_outreach_matches;
create policy "organization admins read outreach matches"
  on public.community_outreach_matches for select to authenticated
  using (
    public.user_role() = 'ADMIN'
    or public.is_organization_admin(organization_id)
    or exists (
      select 1 from public.profiles actor
      where actor.id = auth.uid()
        and actor.org_id = organization_id
        and upper(coalesce(actor.role::text, '')) in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
    )
  );

create or replace function public.sync_community_outreach_matches_for_profile(
  p_profile_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile record;
  v_org record;
  v_is_new boolean;
  v_match_count integer := 0;
begin
  select
    p.id,
    p.full_name,
    coalesce(p.mobile_phone, p.phone, '') as phone,
    coalesce(p.email, '') as email,
    p.latitude::float8 as latitude,
    p.longitude::float8 as longitude,
    p.org_id,
    p.is_active,
    p.geofenced_outreach_opt_in,
    greatest(1, least(25, coalesce(p.geofenced_outreach_radius_miles, 3))) as radius_miles
  into v_profile
  from public.profiles p
  where p.id = p_profile_id;

  if not found
     or not coalesce(v_profile.is_active, false)
     or not coalesce(v_profile.geofenced_outreach_opt_in, false)
     or v_profile.latitude is null
     or v_profile.longitude is null then
    delete from public.community_outreach_matches where profile_id = p_profile_id;
    return 0;
  end if;

  -- Remove matches that are no longer eligible after an address, radius,
  -- organization, verification, or activation change.
  delete from public.community_outreach_matches existing
  where existing.profile_id = p_profile_id
    and not exists (
      select 1
      from public.organizations eligible
      where eligible.id = existing.organization_id
        and eligible.is_active = true
        and eligible.verified = true
        and eligible.id is distinct from v_profile.org_id
        and eligible.latitude is not null
        and eligible.longitude is not null
        and (
          3958.8 * 2 * asin(
            sqrt(
              power(sin(radians((eligible.latitude::float8 - v_profile.latitude) / 2)), 2)
              + cos(radians(v_profile.latitude))
              * cos(radians(eligible.latitude::float8))
              * power(sin(radians((eligible.longitude::float8 - v_profile.longitude) / 2)), 2)
            )
          )
        ) <= least(v_profile.radius_miles, greatest(1, least(25, coalesce(eligible.outreach_radius_miles, 3))))
    );

  for v_org in
    select
      nearby.id,
      nearby.org_code,
      nearby.name,
      round((
        3958.8 * 2 * asin(
          sqrt(
            power(sin(radians((nearby.latitude::float8 - v_profile.latitude) / 2)), 2)
            + cos(radians(v_profile.latitude))
            * cos(radians(nearby.latitude::float8))
            * power(sin(radians((nearby.longitude::float8 - v_profile.longitude) / 2)), 2)
          )
        )
      )::numeric, 2) as distance_miles
    from public.organizations nearby
    where nearby.is_active = true
      and nearby.verified = true
      and nearby.id is distinct from v_profile.org_id
      and nearby.latitude is not null
      and nearby.longitude is not null
      and (
        3958.8 * 2 * asin(
          sqrt(
            power(sin(radians((nearby.latitude::float8 - v_profile.latitude) / 2)), 2)
            + cos(radians(v_profile.latitude))
            * cos(radians(nearby.latitude::float8))
            * power(sin(radians((nearby.longitude::float8 - v_profile.longitude) / 2)), 2)
          )
        )
      ) <= least(v_profile.radius_miles, greatest(1, least(25, coalesce(nearby.outreach_radius_miles, 3))))
    order by distance_miles asc
    limit 10
  loop
    select not exists (
      select 1 from public.community_outreach_matches existing
      where existing.profile_id = p_profile_id
        and existing.organization_id = v_org.id
    ) into v_is_new;

    insert into public.community_outreach_matches (
      profile_id, organization_id, distance_miles, status,
      matched_at, last_notified_at, updated_at
    ) values (
      p_profile_id, v_org.id, v_org.distance_miles, 'matched',
      now(), case when v_is_new then now() else null end, now()
    )
    on conflict (profile_id, organization_id) do update
      set distance_miles = excluded.distance_miles,
          updated_at = now();

    if v_is_new then
      insert into public.notifications (user_id, type, related_id, metadata)
      select admin_id, 'community_outreach_new_candidate', p_profile_id,
        jsonb_build_object(
          'candidateName', coalesce(nullif(trim(v_profile.full_name), ''), 'A nearby resident'),
          'candidatePhone', v_profile.phone,
          'candidateEmail', v_profile.email,
          'organizationId', v_org.id,
          'organizationCode', v_org.org_code,
          'organizationName', v_org.name,
          'distanceMiles', v_org.distance_miles
        )
      from (
        select p.id as admin_id
        from public.profiles p
        where p.org_id = v_org.id
          and upper(coalesce(p.role::text, '')) in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
        union
        select oa.user_id as admin_id
        from public.organization_admins oa
        where oa.organization_id = v_org.id
      ) recipients
      where admin_id <> p_profile_id;
    end if;

    v_match_count := v_match_count + 1;
  end loop;

  return v_match_count;
end;
$$;

revoke all on function public.sync_community_outreach_matches_for_profile(uuid)
  from public, anon, authenticated;

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
    o.org_code,
    o.name,
    m.distance_miles
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

create or replace function public.sync_community_outreach_matches_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_community_outreach_matches_for_profile(new.id);
  return new;
end;
$$;

revoke all on function public.sync_community_outreach_matches_trigger()
  from public, anon, authenticated;

drop trigger if exists profiles_sync_community_outreach_matches on public.profiles;
create trigger profiles_sync_community_outreach_matches
after insert or update of
  latitude,
  longitude,
  org_id,
  is_active,
  geofenced_outreach_opt_in,
  geofenced_outreach_radius_miles
on public.profiles
for each row execute function public.sync_community_outreach_matches_trigger();

-- Backfill current consenting people without re-alerting repeatedly.
do $$
declare
  v_profile_id uuid;
begin
  for v_profile_id in
    select p.id
    from public.profiles p
    where p.is_active = true
      and p.geofenced_outreach_opt_in = true
      and p.latitude is not null
      and p.longitude is not null
  loop
    perform public.sync_community_outreach_matches_for_profile(v_profile_id);
  end loop;
end;
$$;

-- A connected member who explicitly opts in may also appear to other verified
-- nearby organizations. Membership itself is never changed by this function.
drop function if exists public.get_org_outreach_candidates(uuid, integer);

create function public.get_org_outreach_candidates(
  p_org_id uuid default null,
  p_radius_miles integer default 3
)
returns table (
  profile_id uuid,
  full_name text,
  phone text,
  email text,
  latitude float8,
  longitude float8,
  distance_miles numeric
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_org_id uuid;
  v_actor_lat float8;
  v_actor_lng float8;
  v_target_org_id uuid;
  v_org_lat float8;
  v_org_lng float8;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select upper(coalesce(p.role::text, '')), p.org_id, p.latitude::float8, p.longitude::float8
  into v_actor_role, v_actor_org_id, v_actor_lat, v_actor_lng
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role not in ('ADMIN', 'INSTITUTION_ADMIN', 'ORG_ADMIN') then
    raise exception 'Forbidden';
  end if;

  v_target_org_id := coalesce(p_org_id, v_actor_org_id);
  if v_target_org_id is null then
    raise exception 'Organization is required';
  end if;
  if v_actor_role <> 'ADMIN' and v_actor_org_id is distinct from v_target_org_id then
    raise exception 'Forbidden';
  end if;

  select o.latitude::float8, o.longitude::float8
  into v_org_lat, v_org_lng
  from public.organizations o
  where o.id = v_target_org_id
    and o.is_active = true
    and o.verified = true;

  if not found then
    raise exception 'Only active, verified organizations can use the Local Outreach Panel.';
  end if;

  if v_org_lat is null or v_org_lng is null then
    v_org_lat := v_actor_lat;
    v_org_lng := v_actor_lng;
  end if;
  if v_org_lat is null or v_org_lng is null then
    raise exception 'Organization location is missing. Add org coordinates to use the Local Outreach Panel.';
  end if;

  return query
  with candidates as (
    select
      p.id,
      coalesce(p.full_name, '')::text as candidate_name,
      coalesce(p.mobile_phone, p.phone, '')::text as candidate_phone,
      coalesce(p.email, '')::text as candidate_email,
      round(p.latitude::numeric, 3)::float8 as candidate_latitude,
      round(p.longitude::numeric, 3)::float8 as candidate_longitude,
      round((
        3958.8 * 2 * asin(
          sqrt(
            power(sin(radians((p.latitude::float8 - v_org_lat) / 2)), 2)
            + cos(radians(v_org_lat))
            * cos(radians(p.latitude::float8))
            * power(sin(radians((p.longitude::float8 - v_org_lng) / 2)), 2)
          )
        )
      )::numeric, 2) as candidate_distance,
      greatest(1, least(25, coalesce(p.geofenced_outreach_radius_miles, 3))) as allowed_radius
    from public.profiles p
    where p.is_active = true
      and p.id <> auth.uid()
      and p.latitude is not null
      and p.longitude is not null
      and (
        p.org_id = v_target_org_id
        or (
          p.org_id is distinct from v_target_org_id
          and coalesce(p.geofenced_outreach_opt_in, false) = true
        )
      )
  )
  select
    c.id,
    c.candidate_name,
    c.candidate_phone,
    c.candidate_email,
    c.candidate_latitude,
    c.candidate_longitude,
    c.candidate_distance
  from candidates c
  where c.candidate_distance <= least(
    greatest(1, least(25, coalesce(nullif(p_radius_miles, 0), 3))),
    c.allowed_radius
  )
  order by c.candidate_distance asc, c.candidate_name asc;
end;
$$;

revoke all on function public.get_org_outreach_candidates(uuid, integer) from public;
grant execute on function public.get_org_outreach_candidates(uuid, integer) to authenticated;
