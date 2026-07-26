-- Assigning purchased seats is the Admin confirmation that organization-funded
-- access has been approved. Activate the contract in the same protected action
-- so newly created codes can be redeemed immediately.

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
    raise exception 'Only an AERA Admin can change organization seat limits';
  end if;
  if p_organization_id is null then
    raise exception 'Organization is required';
  end if;
  if not exists (select 1 from public.organizations o where o.id = p_organization_id) then
    raise exception 'Organization not found';
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

  update public.organizations
  set
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
      'contract_status', 'active'
    )
  );

  return query select
    p_seat_limit,
    coalesce(v_used, 0),
    greatest(p_seat_limit - coalesce(v_used, 0), 0);
end;
$$;

revoke all on function public.head_admin_set_organization_seat_limit(uuid, integer) from public, anon;
grant execute on function public.head_admin_set_organization_seat_limit(uuid, integer) to authenticated;

comment on function public.head_admin_set_organization_seat_limit(uuid, integer) is
  'Admin-only seat assignment. Activates organization-sponsored access and prevents lowering capacity below funded seats currently in use.';
