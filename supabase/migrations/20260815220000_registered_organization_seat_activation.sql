-- Ensure the Registered Organizations & Seats action activates the complete
-- organization access path in one transaction.

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
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select upper(coalesce(p.role::text, ''))
  into v_actor_role
  from public.profiles p
  where p.id = auth.uid();

  if v_actor_role <> 'ADMIN' then
    raise exception 'Only an AERA Admin can change organization seat limits';
  end if;
  if p_organization_id is null then
    raise exception 'Organization is required';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organization not found';
  end if;
  if p_seat_limit is null or p_seat_limit < 1 then
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

  -- Contract activation, organization activation, and seat-pool activation are
  -- atomic: either all three save or none of them do.
  update public.organizations
  set
    is_active = true,
    contract_status = 'active',
    contract_starts_at = coalesce(contract_starts_at, now()),
    contract_ends_at = case
      when contract_ends_at is not null and contract_ends_at <= now() then null
      else contract_ends_at
    end,
    updated_at = now()
  where id = p_organization_id;

  insert into public.seat_pools (organization_id, seat_limit, status)
  values (p_organization_id, p_seat_limit, 'active')
  on conflict (organization_id)
  do update set
    seat_limit = excluded.seat_limit,
    status = 'active',
    updated_at = now();

  insert into public.seat_audit_log (
    organization_id, actor_user_id, action, metadata
  ) values (
    p_organization_id,
    auth.uid(),
    'seat_limit_updated',
    jsonb_build_object(
      'seat_limit', p_seat_limit,
      'previously_used', coalesce(v_used, 0),
      'organization_active', true,
      'contract_status', 'active'
    )
  );

  return query select
    p_seat_limit,
    coalesce(v_used, 0),
    greatest(p_seat_limit - coalesce(v_used, 0), 0);
end;
$$;

revoke all on function public.head_admin_set_organization_seat_limit(uuid, integer)
  from public, anon;
grant execute on function public.head_admin_set_organization_seat_limit(uuid, integer)
  to authenticated;

comment on function public.head_admin_set_organization_seat_limit(uuid, integer) is
  'AERA Admin-only atomic activation of an organization, sponsored contract, and purchased-seat pool.';

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
    raise exception 'Only an AERA Admin can create organization access codes';
  end if;
  if not exists (
    select 1
    from public.organizations o
    where o.id = p_organization_id
      and o.is_active = true
      and o.contract_status = 'active'
      and (o.contract_starts_at is null or o.contract_starts_at <= now())
      and (o.contract_ends_at is null or o.contract_ends_at > now())
  ) then
    raise exception 'Save seats and activate the organization before creating a code';
  end if;
  if not exists (
    select 1 from public.seat_pools sp
    where sp.organization_id = p_organization_id
      and sp.status = 'active'
      and sp.seat_limit > 0
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
    organization_id, code_hash, code_hint, status, expires_at,
    max_redemptions, created_by
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

revoke all on function public.head_admin_create_organization_code(uuid, timestamptz, integer)
  from public, anon;
grant execute on function public.head_admin_create_organization_code(uuid, timestamptz, integer)
  to authenticated;
