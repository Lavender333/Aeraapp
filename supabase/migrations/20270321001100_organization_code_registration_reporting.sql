-- Secure Administrator reporting for organization access codes and the
-- memberships created by each code. Plaintext activation codes are never
-- returned; only the non-sensitive code hint is exposed.

create index if not exists organization_codes_org_created_idx
  on public.organization_codes (organization_id, created_at desc);

create index if not exists memberships_activated_code_idx
  on public.memberships (activated_with_code_id, activated_at desc)
  where activated_with_code_id is not null;

create or replace function public.can_manage_organization_access(
  p_organization_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and (
          upper(coalesce(p.role::text, '')) = 'ADMIN'
          or (
            upper(coalesce(p.role::text, '')) in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
            and p.org_id = p_organization_id
          )
        )
    )
    or exists (
      select 1
      from public.organization_admins oa
      where oa.user_id = auth.uid()
        and oa.organization_id = p_organization_id
    )
  );
$$;

revoke all on function public.can_manage_organization_access(uuid) from public, anon;
grant execute on function public.can_manage_organization_access(uuid) to authenticated;

drop policy if exists "authorized admins read organization codes" on public.organization_codes;
create policy "authorized admins read organization codes"
  on public.organization_codes
  for select
  to authenticated
  using (public.can_manage_organization_access(organization_id));

drop policy if exists "authorized admins read organization memberships" on public.memberships;
create policy "authorized admins read organization memberships"
  on public.memberships
  for select
  to authenticated
  using (public.can_manage_organization_access(organization_id));

create or replace function public.get_organization_access_codes(
  p_organization_id uuid
)
returns table (
  code_id uuid,
  organization_id uuid,
  code_hint text,
  code_status text,
  created_at timestamptz,
  expires_at timestamptz,
  max_redemptions integer,
  redemption_count integer,
  remaining_redemptions integer,
  linked_registration_count integer,
  created_by_user_id uuid,
  created_by_name text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select upper(coalesce(p.role::text, '')), p.org_id
  into v_actor_role, v_actor_org_id
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role = 'ADMIN' then
    null;
  elsif v_actor_role in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
    and v_actor_org_id = p_organization_id then
    null;
  elsif public.is_organization_admin(p_organization_id) then
    null;
  else
    raise exception 'Forbidden';
  end if;

  return query
  select
    oc.id,
    oc.organization_id,
    oc.code_hint,
    case
      when oc.status = 'active' and oc.expires_at is not null and oc.expires_at <= now() then 'expired'
      when oc.status = 'active' and oc.max_redemptions is not null
        and oc.redemption_count >= oc.max_redemptions then 'used'
      else oc.status
    end,
    oc.created_at,
    oc.expires_at,
    oc.max_redemptions,
    oc.redemption_count,
    case
      when oc.max_redemptions is null then null
      else greatest(oc.max_redemptions - oc.redemption_count, 0)
    end,
    count(distinct m.id)::integer,
    oc.created_by,
    coalesce(nullif(trim(creator.full_name), ''), creator.email, 'AERA Administrator')::text
  from public.organization_codes oc
  left join public.memberships m
    on m.activated_with_code_id = oc.id
  left join public.profiles creator
    on creator.id = oc.created_by
  where oc.organization_id = p_organization_id
  group by
    oc.id,
    oc.organization_id,
    oc.code_hint,
    oc.status,
    oc.created_at,
    oc.expires_at,
    oc.max_redemptions,
    oc.redemption_count,
    oc.created_by,
    creator.full_name,
    creator.email
  order by oc.created_at desc;
end;
$$;

revoke all on function public.get_organization_access_codes(uuid) from public, anon;
grant execute on function public.get_organization_access_codes(uuid) to authenticated;

create or replace function public.get_organization_code_registrations(
  p_code_id uuid
)
returns table (
  membership_id uuid,
  code_id uuid,
  user_id uuid,
  full_name text,
  email text,
  activated_at timestamptz,
  membership_status text,
  funding_source text,
  consumes_organization_seat boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_organization_id uuid;
  v_actor_role text;
  v_actor_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select oc.organization_id
  into v_organization_id
  from public.organization_codes oc
  where oc.id = p_code_id;

  if v_organization_id is null then
    raise exception 'Access code not found';
  end if;

  select upper(coalesce(p.role::text, '')), p.org_id
  into v_actor_role, v_actor_org_id
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role = 'ADMIN' then
    null;
  elsif v_actor_role in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
    and v_actor_org_id = v_organization_id then
    null;
  elsif public.is_organization_admin(v_organization_id) then
    null;
  else
    raise exception 'Forbidden';
  end if;

  return query
  select
    m.id,
    m.activated_with_code_id,
    m.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Unnamed member')::text,
    coalesce(p.email, '')::text,
    m.activated_at,
    m.status,
    m.funding_source,
    m.consumes_organization_seat
  from public.memberships m
  left join public.profiles p
    on p.id = m.user_id
  where m.activated_with_code_id = p_code_id
  order by m.activated_at desc;
end;
$$;

revoke all on function public.get_organization_code_registrations(uuid) from public, anon;
grant execute on function public.get_organization_code_registrations(uuid) to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'organization_codes'
    ) then
    alter publication supabase_realtime add table public.organization_codes;
  end if;

  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'memberships'
    ) then
    alter publication supabase_realtime add table public.memberships;
  end if;
end
$$;

comment on function public.get_organization_access_codes(uuid) is
  'Authorized organization code metadata. Never returns plaintext activation codes or hashes.';

comment on function public.get_organization_code_registrations(uuid) is
  'Authorized membership registrations linked to one organization access code.';

comment on function public.can_manage_organization_access(uuid) is
  'True for AERA Administrators and administrators assigned to the specified organization.';
