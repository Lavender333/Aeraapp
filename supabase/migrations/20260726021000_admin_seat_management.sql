-- Head Admin seat management and organization-scoped seat visibility.

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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

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
    coalesce(o.org_code, ''),
    coalesce(o.name, ''),
    coalesce(o.contract_status, 'pending'),
    o.contract_starts_at,
    o.contract_ends_at,
    coalesce(sp.seat_limit, 0)::integer,
    count(distinct m.user_id) filter (
      where m.status = 'active' and m.consumes_organization_seat = true
    )::integer,
    count(distinct m.user_id) filter (
      where m.status = 'active' and m.consumes_organization_seat = false
    )::integer,
    count(distinct m.user_id) filter (
      where m.status = 'active'
    )::integer,
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
    (
      array_agg(oc.code_hint order by oc.created_at desc)
        filter (where oc.code_hint is not null)
    )[1]
  from public.organizations o
  left join public.seat_pools sp
    on sp.organization_id = o.id and sp.status = 'active'
  left join public.memberships m
    on m.organization_id = o.id
  left join public.organization_codes oc
    on oc.organization_id = o.id
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

create or replace function public.head_admin_set_organization_seat_limit(
  p_organization_id uuid,
  p_seat_limit integer
)
returns table (
  purchased_seats integer,
  organization_funded_members integer,
  available_seats integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_role text;
  v_used integer;
begin
  select upper(coalesce(p.role::text, ''))
  into v_actor_role
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role <> 'ADMIN' then
    raise exception 'Only AERA Head Admin can change organization seat limits';
  end if;
  if p_organization_id is null then
    raise exception 'Organization is required';
  end if;
  if p_seat_limit < 1 then
    raise exception 'Seat limit must be at least 1';
  end if;

  select count(distinct m.user_id)::integer
  into v_used
  from public.memberships m
  where m.organization_id = p_organization_id
    and m.status = 'active'
    and m.consumes_organization_seat = true;

  if p_seat_limit < coalesce(v_used, 0) then
    raise exception 'Seat limit cannot be lower than the number of funded seats currently in use';
  end if;

  insert into public.seat_pools (organization_id, seat_limit, status)
  values (p_organization_id, p_seat_limit, 'active')
  on conflict (organization_id)
  do update set seat_limit = excluded.seat_limit, status = 'active';

  insert into public.seat_audit_log (
    organization_id, actor_user_id, action, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'seat_limit_updated',
    jsonb_build_object('seat_limit', p_seat_limit, 'previously_used', coalesce(v_used, 0))
  );

  return query select
    p_seat_limit,
    coalesce(v_used, 0),
    greatest(p_seat_limit - coalesce(v_used, 0), 0);
end;
$$;

revoke all on function public.head_admin_set_organization_seat_limit(uuid, integer) from public, anon;
grant execute on function public.head_admin_set_organization_seat_limit(uuid, integer) to authenticated;

create or replace function public.head_admin_create_organization_code(
  p_organization_id uuid,
  p_expires_at timestamptz default null,
  p_max_redemptions integer default null
)
returns table (
  activation_code text,
  code_hint text,
  expires_at timestamptz,
  max_redemptions integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_actor_role text;
  v_hex text;
  v_display_code text;
  v_normalized_code text;
begin
  select upper(coalesce(p.role::text, ''))
  into v_actor_role
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role <> 'ADMIN' then
    raise exception 'Only AERA Head Admin can create organization access codes';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organization not found';
  end if;
  if not exists (
    select 1 from public.seat_pools sp
    where sp.organization_id = p_organization_id and sp.status = 'active'
  ) then
    raise exception 'Assign an active seat amount before creating a code';
  end if;
  if p_expires_at is not null and p_expires_at <= now() then
    raise exception 'Expiration must be in the future';
  end if;
  if p_max_redemptions is not null and p_max_redemptions < 1 then
    raise exception 'Maximum redemptions must be at least 1';
  end if;

  v_hex := upper(encode(gen_random_bytes(8), 'hex'));
  v_display_code := 'AERA-' || substr(v_hex, 1, 4) || '-' ||
    substr(v_hex, 5, 4) || '-' || substr(v_hex, 9, 4) || '-' || substr(v_hex, 13, 4);
  v_normalized_code := regexp_replace(v_display_code, '[^A-Z0-9]', '', 'g');

  insert into public.organization_codes (
    organization_id,
    code_hash,
    code_hint,
    status,
    expires_at,
    max_redemptions,
    created_by
  ) values (
    p_organization_id,
    encode(digest(v_normalized_code, 'sha256'), 'hex'),
    right(v_normalized_code, 6),
    'active',
    p_expires_at,
    p_max_redemptions,
    auth.uid()
  );

  insert into public.seat_audit_log (
    organization_id, actor_user_id, action, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'organization_code_created',
    jsonb_build_object(
      'code_hint', right(v_normalized_code, 6),
      'expires_at', p_expires_at,
      'max_redemptions', p_max_redemptions
    )
  );

  return query select
    v_display_code,
    right(v_normalized_code, 6),
    p_expires_at,
    p_max_redemptions;
end;
$$;

revoke all on function public.head_admin_create_organization_code(uuid, timestamptz, integer) from public, anon;
grant execute on function public.head_admin_create_organization_code(uuid, timestamptz, integer) to authenticated;

comment on function public.get_organization_seat_management(uuid) is
  'Head Admin sees every registered organization; organization admins see only their own purchased, used, personal, connected, and available seat totals.';

comment on function public.head_admin_set_organization_seat_limit(uuid, integer) is
  'Head Admin-only seat assignment. Prevents lowering capacity below funded seats currently in use.';

comment on function public.head_admin_create_organization_code(uuid, timestamptz, integer) is
  'Head Admin-only code creation. The code is tied to one organization and returned in plaintext once; only its hash is stored.';
