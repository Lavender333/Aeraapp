-- Platform-controlled access for Leads, Buyers, and Finance.
-- Organization owners and organization admins receive no access implicitly.

create table if not exists public.organization_commercial_entitlements (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  feature text not null check (feature in ('LEADS', 'BUYERS', 'FINANCE')),
  enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete set null,
  enabled_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature)
);

create table if not exists public.commercial_access_grants (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('LEADS', 'BUYERS', 'FINANCE')),
  can_manage boolean not null default false,
  active boolean not null default true,
  granted_by uuid not null references public.profiles(id) on delete restrict,
  granted_at timestamptz not null default now(),
  revoked_by uuid references public.profiles(id) on delete set null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id, feature)
);

create table if not exists public.commercial_access_audit_log (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  feature text not null check (feature in ('LEADS', 'BUYERS', 'FINANCE')),
  action text not null check (action in ('GRANTED', 'REVOKED')),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index if not exists commercial_access_grants_user_idx
  on public.commercial_access_grants (user_id, active, feature);
create index if not exists commercial_access_audit_org_idx
  on public.commercial_access_audit_log (organization_id, created_at desc);

alter table public.organization_commercial_entitlements enable row level security;
alter table public.commercial_access_grants enable row level security;
alter table public.commercial_access_audit_log enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and upper(coalesce(p.role::text, '')) = 'ADMIN'
  );
$$;

create or replace function public.has_commercial_access(
  p_feature text,
  p_organization_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.commercial_access_grants g
    join public.organization_commercial_entitlements e
      on e.organization_id = g.organization_id
     and e.feature = g.feature
     and e.enabled = true
    where g.user_id = auth.uid()
      and g.active = true
      and g.feature = upper(p_feature)
      and (p_organization_id is null or g.organization_id = p_organization_id)
  );
$$;

revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.has_commercial_access(text, uuid) from public, anon;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.has_commercial_access(text, uuid) to authenticated;

drop policy if exists "users read their commercial grants" on public.commercial_access_grants;
create policy "users read their commercial grants"
  on public.commercial_access_grants for select to authenticated
  using (user_id = auth.uid() or public.is_platform_admin());

drop policy if exists "platform admins manage commercial grants" on public.commercial_access_grants;
create policy "platform admins manage commercial grants"
  on public.commercial_access_grants for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "authorized users read commercial entitlements" on public.organization_commercial_entitlements;
create policy "authorized users read commercial entitlements"
  on public.organization_commercial_entitlements for select to authenticated
  using (public.is_platform_admin() or exists (
    select 1 from public.commercial_access_grants g
    where g.organization_id = organization_commercial_entitlements.organization_id
      and g.user_id = auth.uid() and g.active = true
  ));

drop policy if exists "platform admins manage commercial entitlements" on public.organization_commercial_entitlements;
create policy "platform admins manage commercial entitlements"
  on public.organization_commercial_entitlements for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists "platform admins read commercial audit" on public.commercial_access_audit_log;
create policy "platform admins read commercial audit"
  on public.commercial_access_audit_log for select to authenticated
  using (public.is_platform_admin());

create or replace function public.get_my_commercial_access()
returns table (organization_id uuid, feature text, can_manage boolean)
language sql
stable
security definer
set search_path = public
as $$
  select g.organization_id, g.feature, g.can_manage
  from public.commercial_access_grants g
  join public.organization_commercial_entitlements e
    on e.organization_id = g.organization_id and e.feature = g.feature and e.enabled = true
  where g.user_id = auth.uid() and g.active = true;
$$;

create or replace function public.list_organization_commercial_access(p_organization_id uuid)
returns table (
  organization_id uuid,
  user_id uuid,
  feature text,
  can_manage boolean,
  granted_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Only an AERA platform administrator can view commercial access.';
  end if;
  return query
    select g.organization_id, g.user_id, g.feature, g.can_manage, g.granted_at
    from public.commercial_access_grants g
    where g.organization_id = p_organization_id and g.active = true;
end;
$$;

create or replace function public.set_organization_commercial_access(
  p_organization_id uuid,
  p_user_id uuid,
  p_feature text,
  p_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_feature text := upper(trim(coalesce(p_feature, '')));
begin
  if not public.is_platform_admin() then
    raise exception 'Only an AERA platform administrator can assign commercial access.';
  end if;
  if v_feature not in ('LEADS', 'BUYERS', 'FINANCE') then
    raise exception 'Unsupported commercial feature.';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_user_id and p.org_id = p_organization_id
  ) then
    raise exception 'The selected user is not a member of this organization.';
  end if;

  if p_enabled then
    insert into public.organization_commercial_entitlements (
      organization_id, feature, enabled, enabled_by, enabled_at, updated_at
    ) values (p_organization_id, v_feature, true, auth.uid(), now(), now())
    on conflict (organization_id, feature) do update set
      enabled = true, enabled_by = auth.uid(), enabled_at = now(), updated_at = now();

    insert into public.commercial_access_grants (
      organization_id, user_id, feature, active, granted_by, granted_at, revoked_by, revoked_at, updated_at
    ) values (p_organization_id, p_user_id, v_feature, true, auth.uid(), now(), null, null, now())
    on conflict (organization_id, user_id, feature) do update set
      active = true, granted_by = auth.uid(), granted_at = now(), revoked_by = null, revoked_at = null, updated_at = now();
  else
    update public.commercial_access_grants set
      active = false, revoked_by = auth.uid(), revoked_at = now(), updated_at = now()
    where organization_id = p_organization_id and user_id = p_user_id and feature = v_feature;
  end if;

  insert into public.commercial_access_audit_log (
    organization_id, user_id, feature, action, actor_id
  ) values (
    p_organization_id, p_user_id, v_feature,
    case when p_enabled then 'GRANTED' else 'REVOKED' end,
    auth.uid()
  );
end;
$$;

revoke all on function public.get_my_commercial_access() from public, anon;
revoke all on function public.list_organization_commercial_access(uuid) from public, anon;
revoke all on function public.set_organization_commercial_access(uuid, uuid, text, boolean) from public, anon;
grant execute on function public.get_my_commercial_access() to authenticated;
grant execute on function public.list_organization_commercial_access(uuid) to authenticated;
grant execute on function public.set_organization_commercial_access(uuid, uuid, text, boolean) to authenticated;

-- Preserve access for existing dedicated buyer accounts without granting it to
-- every organization owner or organization administrator.
insert into public.organization_commercial_entitlements (
  organization_id, feature, enabled, enabled_by, enabled_at
)
select distinct p.org_id, 'BUYERS', true, admin_profile.id, now()
from public.profiles p
cross join lateral (
  select id from public.profiles where upper(coalesce(role::text, '')) = 'ADMIN' order by created_at nulls last limit 1
) admin_profile
where upper(coalesce(p.role::text, '')) = 'BUYER' and p.org_id is not null
on conflict (organization_id, feature) do nothing;

insert into public.commercial_access_grants (
  organization_id, user_id, feature, active, granted_by
)
select p.org_id, p.id, 'BUYERS', true, admin_profile.id
from public.profiles p
cross join lateral (
  select id from public.profiles where upper(coalesce(role::text, '')) = 'ADMIN' order by created_at nulls last limit 1
) admin_profile
where upper(coalesce(p.role::text, '')) = 'BUYER' and p.org_id is not null
on conflict (organization_id, user_id, feature) do nothing;

create or replace function public.is_lead_admin_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_commercial_access('LEADS');
$$;

create or replace function public.is_lead_referrer_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_commercial_access('LEADS');
$$;

create or replace function public.is_buyer_user()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_commercial_access('BUYERS');
$$;

