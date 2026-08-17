-- Match get_organization_seat_management's declared text return columns.

create or replace function public.get_organization_seat_management(
  p_organization_id uuid default null
)
returns table (
  organization_id uuid,
  organization_code text,
  organization_name text,
  contract_status text,
  contract_starts_at timestamptz,
  contract_ends_at timestamptz,
  purchased_seats integer,
  organization_funded_members integer,
  personally_paid_members integer,
  connected_members integer,
  available_seats integer,
  active_code_count integer,
  latest_code_hint text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_actor_org_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;

  select upper(coalesce(p.role::text, '')), p.org_id
  into v_actor_role, v_actor_org_id
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role = 'ADMIN' then
    null;
  elsif v_actor_role in ('ORG_ADMIN', 'INSTITUTION_ADMIN') then
    if v_actor_org_id is null then
      raise exception 'Your administrator account is not connected to an organization';
    end if;
    if p_organization_id is not null and p_organization_id is distinct from v_actor_org_id then
      raise exception 'Forbidden';
    end if;
  else
    raise exception 'Forbidden';
  end if;

  return query
  select
    o.id,
    coalesce(o.org_code, '')::text,
    coalesce(o.name, '')::text,
    coalesce(o.contract_status, 'pending')::text,
    o.contract_starts_at,
    o.contract_ends_at,
    coalesce(sp.seat_limit, 0)::integer,
    count(distinct m.user_id) filter (
      where m.status = 'active' and m.consumes_organization_seat = true
    )::integer,
    count(distinct m.user_id) filter (
      where m.status = 'active' and m.consumes_organization_seat = false
    )::integer,
    count(distinct m.user_id) filter (where m.status = 'active')::integer,
    greatest(
      coalesce(sp.seat_limit, 0) - count(distinct m.user_id) filter (
        where m.status = 'active' and m.consumes_organization_seat = true
      ),
      0
    )::integer,
    count(distinct oc.id) filter (
      where oc.status = 'active'
        and (oc.expires_at is null or oc.expires_at > now())
        and (oc.max_redemptions is null or oc.redemption_count < oc.max_redemptions)
    )::integer,
    ((array_agg(oc.code_hint order by oc.created_at desc)
      filter (where oc.code_hint is not null))[1])::text
  from public.organizations o
  left join public.seat_pools sp
    on sp.organization_id = o.id and sp.status = 'active'
  left join public.memberships m on m.organization_id = o.id
  left join public.organization_codes oc on oc.organization_id = o.id
  where
    (v_actor_role = 'ADMIN' or o.id = v_actor_org_id)
    and (p_organization_id is null or o.id = p_organization_id)
  group by o.id, o.org_code, o.name, o.contract_status,
    o.contract_starts_at, o.contract_ends_at, sp.seat_limit
  order by o.name;
end;
$$;

revoke all on function public.get_organization_seat_management(uuid) from public, anon;
grant execute on function public.get_organization_seat_management(uuid) to authenticated;

