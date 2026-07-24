-- AERA organization-funded access and unique-person seat tracking.
-- Codes are created only by a trusted backend after an organization purchase is confirmed.

create extension if not exists pgcrypto;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contract_status text not null default 'pending' check (contract_status in ('pending','active','suspended','expired','cancelled')),
  contract_starts_at timestamptz,
  contract_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizations add column if not exists contract_status text default 'pending';
alter table public.organizations add column if not exists contract_starts_at timestamptz;
alter table public.organizations add column if not exists contract_ends_at timestamptz;

create table if not exists public.seat_pools (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null unique references public.organizations(id) on delete cascade,
  seat_limit integer not null check (seat_limit > 0),
  status text not null default 'active' check (status in ('active','suspended','expired','cancelled')),
  purchased_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.organization_admins (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('owner','admin','viewer')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table if not exists public.organization_codes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code_hash text not null unique,
  code_hint text not null,
  status text not null default 'active' check (status in ('active','expired','rotated','revoked')),
  expires_at timestamptz,
  max_redemptions integer,
  redemption_count integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  rotated_at timestamptz
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  seat_pool_id uuid not null references public.seat_pools(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null default 'organization' check (access_type in ('organization')),
  status text not null default 'active' check (status in ('active','suspended','inactive','expired')),
  activated_with_code_id uuid references public.organization_codes(id) on delete set null,
  activated_at timestamptz not null default now(),
  deactivated_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists memberships_one_active_org_seat_per_user
  on public.memberships(user_id)
  where status = 'active';

create unique index if not exists memberships_one_active_seat_per_org_user
  on public.memberships(organization_id, user_id)
  where status = 'active';

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('apple','google','organization')),
  provider_subscription_id text,
  organization_id uuid references public.organizations(id) on delete set null,
  status text not null default 'active' check (status in ('active','grace_period','expired','cancelled','refunded')),
  current_period_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists subscriptions_unique_store_record
  on public.subscriptions(provider, provider_subscription_id)
  where provider_subscription_id is not null;

create table if not exists public.platform_identities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('apple','google','web')),
  platform_account_id text,
  device_id_hash text,
  created_at timestamptz not null default now()
);

create unique index if not exists platform_identity_unique_account
  on public.platform_identities(platform, platform_account_id)
  where platform_account_id is not null;

create table if not exists public.seat_audit_log (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  subject_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_organization_admin(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.organization_admins oa
    where oa.organization_id = p_organization_id
      and oa.user_id = auth.uid()
  );
$$;

-- Called only from AERA's trusted payment webhook/admin backend after payment is confirmed.
-- The plaintext code is returned once. Only its SHA-256 hash is stored.
create or replace function public.complete_organization_purchase(
  p_organization_name text,
  p_seat_limit integer default 2000,
  p_contract_starts_at timestamptz default now(),
  p_contract_ends_at timestamptz default null,
  p_initial_admin_user_id uuid default null,
  p_code_expires_at timestamptz default null
)
returns table (
  organization_id uuid,
  seat_pool_id uuid,
  activation_code text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_org_id uuid;
  v_pool_id uuid;
  v_raw_code text;
  v_normalized_code text;
begin
  if coalesce(auth.jwt() ->> 'role', '') <> 'service_role' then
    raise exception 'Only the trusted AERA backend can complete organization purchases';
  end if;

  if nullif(trim(p_organization_name), '') is null then
    raise exception 'Organization name is required';
  end if;

  if p_seat_limit < 1 then
    raise exception 'Seat limit must be at least 1';
  end if;

  insert into public.organizations (
    name, contract_status, contract_starts_at, contract_ends_at
  ) values (
    trim(p_organization_name), 'active', p_contract_starts_at, p_contract_ends_at
  ) returning id into v_org_id;

  insert into public.seat_pools (organization_id, seat_limit, status)
  values (v_org_id, p_seat_limit, 'active')
  returning id into v_pool_id;

  if p_initial_admin_user_id is not null then
    insert into public.organization_admins (organization_id, user_id, role)
    values (v_org_id, p_initial_admin_user_id, 'owner')
    on conflict (organization_id, user_id) do nothing;
  end if;

  v_raw_code := upper(encode(gen_random_bytes(18), 'hex'));
  v_normalized_code := regexp_replace(v_raw_code, '[^A-Z0-9]', '', 'g');

  insert into public.organization_codes (
    organization_id,
    code_hash,
    code_hint,
    status,
    expires_at,
    created_by
  ) values (
    v_org_id,
    encode(digest(v_normalized_code, 'sha256'), 'hex'),
    right(v_normalized_code, 6),
    'active',
    p_code_expires_at,
    p_initial_admin_user_id
  );

  insert into public.seat_audit_log (
    organization_id, actor_user_id, action, metadata
  ) values (
    v_org_id,
    p_initial_admin_user_id,
    'organization_purchase_completed',
    jsonb_build_object('seat_limit', p_seat_limit, 'code_hint', right(v_normalized_code, 6))
  );

  return query select v_org_id, v_pool_id, v_normalized_code;
end;
$$;

revoke all on function public.complete_organization_purchase(text, integer, timestamptz, timestamptz, uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.complete_organization_purchase(text, integer, timestamptz, timestamptz, uuid, timestamptz) to service_role;

-- Citizen activation. The seat-pool row is locked so simultaneous requests cannot exceed the limit.
create or replace function public.redeem_organization_code(p_code text)
returns table (
  membership_id uuid,
  organization_id uuid,
  seat_limit integer,
  active_seats integer,
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
  v_active_count integer;
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

  -- Critical concurrency safeguard.
  select * into v_pool
  from public.seat_pools
  where organization_id = v_code.organization_id
  for update;

  if not found or v_pool.status <> 'active' then
    raise exception 'Organization seat pool is not active';
  end if;

  if exists (
    select 1 from public.memberships
    where user_id = v_user_id and status = 'active'
  ) then
    raise exception 'This AERA account already has active access';
  end if;

  select count(*)::integer into v_active_count
  from public.memberships
  where seat_pool_id = v_pool.id and status = 'active';

  if v_active_count >= v_pool.seat_limit then
    raise exception 'This organization has no available seats';
  end if;

  insert into public.memberships (
    organization_id, seat_pool_id, user_id, status, activated_with_code_id
  ) values (
    v_org.id, v_pool.id, v_user_id, 'active', v_code.id
  ) returning id into v_membership_id;

  update public.organization_codes
  set redemption_count = redemption_count + 1
  where id = v_code.id;

  insert into public.subscriptions (user_id, provider, organization_id, status)
  values (v_user_id, 'organization', v_org.id, 'active');

  insert into public.seat_audit_log (
    organization_id, actor_user_id, subject_user_id, action, metadata
  ) values (
    v_org.id, v_user_id, v_user_id, 'seat_activated', jsonb_build_object('membership_id', v_membership_id)
  );

  return query select
    v_membership_id,
    v_org.id,
    v_pool.seat_limit,
    v_active_count + 1,
    v_pool.seat_limit - (v_active_count + 1);
end;
$$;

grant execute on function public.redeem_organization_code(text) to authenticated;

create or replace view public.organization_seat_metrics as
select
  sp.organization_id,
  sp.seat_limit as purchased_seats,
  count(m.id) filter (where m.status = 'active')::integer as unique_active_users,
  greatest(sp.seat_limit - count(m.id) filter (where m.status = 'active'), 0)::integer as available_seats,
  count(distinct pi.user_id) filter (where pi.platform = 'apple')::integer as apple_users,
  count(distinct pi.user_id) filter (where pi.platform = 'google')::integer as google_users,
  count(distinct m.user_id) filter (
    where exists (select 1 from public.platform_identities a where a.user_id = m.user_id and a.platform = 'apple')
      and exists (select 1 from public.platform_identities g where g.user_id = m.user_id and g.platform = 'google')
  )::integer as users_on_both
from public.seat_pools sp
left join public.memberships m on m.seat_pool_id = sp.id
left join public.platform_identities pi on pi.user_id = m.user_id
where sp.status = 'active'
group by sp.organization_id, sp.seat_limit;

alter table public.seat_pools enable row level security;
alter table public.organization_admins enable row level security;
alter table public.organization_codes enable row level security;
alter table public.memberships enable row level security;
alter table public.subscriptions enable row level security;
alter table public.platform_identities enable row level security;
alter table public.seat_audit_log enable row level security;

create policy "users read own memberships" on public.memberships
  for select to authenticated
  using (user_id = auth.uid() or public.is_organization_admin(organization_id));

create policy "users read own subscriptions" on public.subscriptions
  for select to authenticated
  using (user_id = auth.uid() or (organization_id is not null and public.is_organization_admin(organization_id)));

create policy "users manage own platform identities" on public.platform_identities
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "admins read their seat pools" on public.seat_pools
  for select to authenticated
  using (public.is_organization_admin(organization_id));

create policy "admins read code metadata" on public.organization_codes
  for select to authenticated
  using (public.is_organization_admin(organization_id));

create policy "admins read their audit log" on public.seat_audit_log
  for select to authenticated
  using (public.is_organization_admin(organization_id));

create policy "admins read organization administrators" on public.organization_admins
  for select to authenticated
  using (user_id = auth.uid() or public.is_organization_admin(organization_id));

comment on function public.complete_organization_purchase is
  'Trusted backend purchase finalization. Creates the organization, seat pool, and a one-time plaintext activation code; stores only the code hash.';

comment on function public.redeem_organization_code is
  'Authenticated citizen activation. Locks the seat pool row, validates the code and contract, prevents duplicate active access, assigns one seat, and writes an audit record.';
