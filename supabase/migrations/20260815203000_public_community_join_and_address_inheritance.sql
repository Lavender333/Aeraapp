-- Make the public community code used by member QR links a valid, approval-gated
-- organization code. Joining still creates a suspended membership; an authorized
-- organization administrator must approve it before access or a funded seat begins.

create extension if not exists pgcrypto;

create or replace function public.ensure_public_community_join_code()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_normalized_code text;
  v_code_hash text;
begin
  v_normalized_code := upper(regexp_replace(trim(coalesce(new.org_code, '')), '[^A-Z0-9]', '', 'g'));
  if v_normalized_code = '' then
    return new;
  end if;

  v_code_hash := encode(digest(v_normalized_code, 'sha256'), 'hex');

  insert into public.organization_codes (
    organization_id,
    code_hash,
    code_hint,
    status,
    expires_at,
    max_redemptions,
    created_by
  ) values (
    new.id,
    v_code_hash,
    right(v_normalized_code, 6),
    'active',
    null,
    null,
    null
  )
  on conflict (code_hash) do update
    set organization_id = excluded.organization_id,
        status = 'active',
        expires_at = null,
        max_redemptions = null;

  return new;
end;
$$;

revoke all on function public.ensure_public_community_join_code() from public, anon, authenticated;

drop trigger if exists organizations_ensure_public_join_code on public.organizations;
create trigger organizations_ensure_public_join_code
after insert or update of org_code on public.organizations
for each row execute function public.ensure_public_community_join_code();

insert into public.organization_codes (
  organization_id,
  code_hash,
  code_hint,
  status,
  expires_at,
  max_redemptions,
  created_by
)
select
  o.id,
  encode(digest(upper(regexp_replace(trim(o.org_code), '[^A-Z0-9]', '', 'g')), 'sha256'), 'hex'),
  right(upper(regexp_replace(trim(o.org_code), '[^A-Z0-9]', '', 'g')), 6),
  'active',
  null,
  null,
  null
from public.organizations o
where nullif(trim(o.org_code), '') is not null
on conflict (code_hash) do update
  set organization_id = excluded.organization_id,
      status = 'active',
      expires_at = null,
      max_redemptions = null;

-- Once an administrator accepts a member, inherit the organization's location
-- only into empty profile location fields. Never replace a member's home address
-- or coordinates when they already provided them.
create or replace function public.apply_organization_location_to_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and old.status is distinct from 'active' then
    update public.profiles p
    set
      home_address = coalesce(nullif(trim(p.home_address), ''), nullif(trim(o.address), '')),
      address_line_1 = coalesce(nullif(trim(p.address_line_1), ''), nullif(trim(o.address), '')),
      latitude = coalesce(p.latitude, o.latitude),
      longitude = coalesce(p.longitude, o.longitude),
      org_id = new.organization_id
    from public.organizations o
    where p.id = new.user_id
      and o.id = new.organization_id;
  end if;
  return new;
end;
$$;

revoke all on function public.apply_organization_location_to_member() from public, anon, authenticated;

drop trigger if exists memberships_apply_org_location_on_approval on public.memberships;
create trigger memberships_apply_org_location_on_approval
after update of status on public.memberships
for each row execute function public.apply_organization_location_to_member();
