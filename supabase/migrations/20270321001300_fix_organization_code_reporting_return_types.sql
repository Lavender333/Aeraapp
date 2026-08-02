-- PostgreSQL does not implicitly coerce enum/domain-backed columns to the
-- text columns declared by RETURNS TABLE in a PL/pgSQL RETURN QUERY.

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
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if not public.can_manage_organization_access(p_organization_id) then
    raise exception 'Forbidden';
  end if;

  return query
  select
    oc.id,
    oc.organization_id,
    oc.code_hint::text,
    (case
      when oc.status::text = 'active' and oc.expires_at is not null and oc.expires_at <= now() then 'expired'
      when oc.status::text = 'active' and oc.max_redemptions is not null
        and oc.redemption_count >= oc.max_redemptions then 'used'
      else oc.status::text
    end)::text,
    oc.created_at,
    oc.expires_at,
    oc.max_redemptions,
    oc.redemption_count,
    (case
      when oc.max_redemptions is null then null
      else greatest(oc.max_redemptions - oc.redemption_count, 0)
    end)::integer,
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

  if not public.can_manage_organization_access(v_organization_id) then
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
    m.status::text,
    m.funding_source::text,
    m.consumes_organization_seat
  from public.memberships m
  left join public.profiles p
    on p.id = m.user_id
  where m.activated_with_code_id = p_code_id
  order by m.activated_at desc;
end;
$$;

revoke all on function public.get_organization_access_codes(uuid) from public, anon;
grant execute on function public.get_organization_access_codes(uuid) to authenticated;

revoke all on function public.get_organization_code_registrations(uuid) from public, anon;
grant execute on function public.get_organization_code_registrations(uuid) to authenticated;
