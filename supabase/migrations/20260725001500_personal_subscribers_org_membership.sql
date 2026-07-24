-- AERA: separate organization affiliation from organization-funded licensing.
-- Personally subscribed Apple/Google users may join an organization even when its seat pool is full.
-- Only organization-funded memberships consume purchased organization seats.

alter table public.memberships
  add column if not exists consumes_organization_seat boolean not null default true;

alter table public.memberships
  add column if not exists funding_source text not null default 'organization';

alter table public.memberships
  drop constraint if exists memberships_access_type_check;

alter table public.memberships
  add constraint memberships_access_type_check
  check (access_type in ('organization', 'personal_affiliate'));

alter table public.memberships
  drop constraint if exists memberships_funding_source_check;

alter table public.memberships
  add constraint memberships_funding_source_check
  check (funding_source in ('organization', 'personal'));

-- Existing active memberships were created as organization-funded seats.
update public.memberships
set consumes_organization_seat = true,
    funding_source = 'organization',
    access_type = 'organization'
where funding_source is null
   or access_type not in ('organization', 'personal_affiliate');

-- A user may be connected to an organization while their paid Apple/Google
-- subscription remains the entitlement that unlocks AERA.
create or replace function public.user_has_active_personal_subscription(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.subscriptions s
    where s.user_id = p_user_id
      and s.provider in ('apple', 'google')
      and s.status in ('active', 'grace_period')
      and (s.current_period_ends_at is null or s.current_period_ends_at > now())
  );
$$;

revoke all on function public.user_has_active_personal_subscription(uuid) from public, anon;
grant execute on function public.user_has_active_personal_subscription(uuid) to authenticated, service_role;

-- Connect the signed-in user to an organization.
-- Personal subscribers do not consume a seat and are not blocked by seat capacity.
-- Users without a personal entitlement receive an organization-funded seat.
create or replace function public.redeem_organization_code(p_code text)
returns table (
  membership_id uuid,
  organization_id uuid,
  funding_source text,
  consumes_organization_seat boolean,
  seat_limit integer,
  organization_funded_seats integer,
  personally_paid_members integer,
  connected_members integer,
  available_seats integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_code_hash text;
  v_code public.organization_codes%rowtype;
  v_org public.organizations%rowtype;
  v_pool public.seat_pools%rowtype;
  v_membership_id uuid;
  v_has_personal_subscription boolean;
  v_consumes_seat boolean;
  v_funding_source text;
  v_funded_count integer;
  v_personal_count integer;
  v_connected_count integer;
begin
  if v_user_id is null then
    raise exception 'Sign in before using an organization code';
  end if;

  if nullif(trim(p_code), '') is null then
    raise exception 'Organization code is required';
  end if;

  v_code_hash := encode(
    digest(upper(regexp_replace(trim(p_code), '[^A-Z0-9]', '', 'g')), 'sha256'),
    'hex'
  );

  select * into v_code
  from public.organization_codes
  where code_hash = v_code_hash
  for update;

  if not found or v_code.status <> 'active' then
    raise exception 'Invalid or inactive organization code';
  end if;

  if v_code.expires_at is not null and v_code.expires_at <= now() then
    raise exception 'Organization code has expired';
  end if;

  if v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Organization code has reached its redemption limit';
  end if;

  select * into v_org
  from public.organizations
  where id = v_code.organization_id;

  if not found or v_org.contract_status <> 'active' then
    raise exception 'Organization contract is not active';
  end if;

  if v_org.contract_starts_at is not null and v_org.contract_starts_at > now() then
    raise exception 'Organization access has not started';
  end if;

  if v_org.contract_ends_at is not null and v_org.contract_ends_at <= now() then
    raise exception 'Organization contract has expired';
  end if;

  select * into v_pool
  from public.seat_pools
  where organization_id = v_code.organization_id
  for update;

  if not found or v_pool.status <> 'active' then
    raise exception 'Organization seat pool is not active';
  end if;

  if exists (
    select 1
    from public.memberships m
    where m.organization_id = v_org.id
      and m.user_id = v_user_id
      and m.status = 'active'
  ) then
    raise exception 'This AERA account is already connected to this organization';
  end if;

  v_has_personal_subscription := public.user_has_active_personal_subscription(v_user_id);
  v_consumes_seat := not v_has_personal_subscription;
  v_funding_source := case when v_has_personal_subscription then 'personal' else 'organization' end;

  select count(*)::integer into v_funded_count
  from public.memberships m
  where m.seat_pool_id = v_pool.id
    and m.status = 'active'
    and m.consumes_organization_seat = true;

  -- Capacity applies only when the organization must fund this person's access.
  if v_consumes_seat and v_funded_count >= v_pool.seat_limit then
    raise exception 'This organization has no available funded seats. A personally subscribed user may still connect.';
  end if;

  insert into public.memberships (
    organization_id,
    seat_pool_id,
    user_id,
    access_type,
    funding_source,
    consumes_organization_seat,
    status,
    activated_with_code_id
  ) values (
    v_org.id,
    v_pool.id,
    v_user_id,
    case when v_has_personal_subscription then 'personal_affiliate' else 'organization' end,
    v_funding_source,
    v_consumes_seat,
    'active',
    v_code.id
  ) returning id into v_membership_id;

  update public.organization_codes
  set redemption_count = redemption_count + 1
  where id = v_code.id;

  -- Create an organization subscription entitlement only when an org seat is used.
  if v_consumes_seat then
    insert into public.subscriptions (user_id, provider, organization_id, status)
    values (v_user_id, 'organization', v_org.id, 'active');
  end if;

  insert into public.seat_audit_log (
    organization_id,
    actor_user_id,
    subject_user_id,
    action,
    metadata
  ) values (
    v_org.id,
    v_user_id,
    v_user_id,
    case when v_consumes_seat then 'organization_seat_activated' else 'personal_subscriber_connected' end,
    jsonb_build_object(
      'membership_id', v_membership_id,
      'funding_source', v_funding_source,
      'consumes_organization_seat', v_consumes_seat
    )
  );

  select
    count(*) filter (where m.status = 'active' and m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active' and not m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active')::integer
  into v_funded_count, v_personal_count, v_connected_count
  from public.memberships m
  where m.organization_id = v_org.id;

  return query select
    v_membership_id,
    v_org.id,
    v_funding_source,
    v_consumes_seat,
    v_pool.seat_limit,
    v_funded_count,
    v_personal_count,
    v_connected_count,
    greatest(v_pool.seat_limit - v_funded_count, 0);
end;
$$;

grant execute on function public.redeem_organization_code(text) to authenticated;

-- Dashboard metrics intentionally separate affiliation from licensing.
create or replace view public.organization_seat_metrics as
select
  sp.organization_id,
  sp.seat_limit as purchased_seats,
  count(distinct m.user_id) filter (where m.status = 'active')::integer as connected_members,
  count(distinct m.user_id) filter (
    where m.status = 'active' and m.consumes_organization_seat = true
  )::integer as organization_funded_members,
  count(distinct m.user_id) filter (
    where m.status = 'active' and m.consumes_organization_seat = false
  )::integer as personally_paid_members,
  greatest(
    sp.seat_limit - count(distinct m.user_id) filter (
      where m.status = 'active' and m.consumes_organization_seat = true
    ),
    0
  )::integer as available_seats,
  count(distinct pi.user_id) filter (
    where m.status = 'active' and pi.platform = 'apple'
  )::integer as apple_users,
  count(distinct pi.user_id) filter (
    where m.status = 'active' and pi.platform = 'google'
  )::integer as google_users,
  count(distinct m.user_id) filter (
    where m.status = 'active'
      and exists (select 1 from public.platform_identities a where a.user_id = m.user_id and a.platform = 'apple')
      and exists (select 1 from public.platform_identities g where g.user_id = m.user_id and g.platform = 'google')
  )::integer as users_on_both
from public.seat_pools sp
left join public.memberships m on m.seat_pool_id = sp.id
left join public.platform_identities pi on pi.user_id = m.user_id
where sp.status = 'active'
group by sp.organization_id, sp.seat_limit;

comment on column public.memberships.consumes_organization_seat is
  'True only when this connected member uses one purchased organization seat.';

comment on column public.memberships.funding_source is
  'Who currently funds AERA access: organization or personal Apple/Google subscription.';

comment on function public.redeem_organization_code is
  'Connects a signed-in user to an organization. Personally subscribed Apple/Google users bypass organization seat capacity and do not consume a purchased seat.';
