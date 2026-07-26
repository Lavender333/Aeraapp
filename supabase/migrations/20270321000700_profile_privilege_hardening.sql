-- Protect the two profile fields that define authorization boundaries.
-- Organization membership changes must go through protected membership RPCs;
-- role changes must be performed by a trusted administrative backend.

create or replace function public.protect_profile_authorization_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if current_user not in ('postgres', 'service_role', 'supabase_admin') then
    if tg_op = 'INSERT' then
      if coalesce(new.role, 'GENERAL_USER') <> 'GENERAL_USER'
         or new.org_id is not null then
        raise exception 'Profile role and organization cannot be assigned directly';
      end if;
      new.role := 'GENERAL_USER';
      new.org_id := null;
    elsif new.role is distinct from old.role
       or new.org_id is distinct from old.org_id then
      raise exception 'Profile role and organization can only be changed through an authorized operation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_authorization_fields on public.profiles;
create trigger protect_profile_authorization_fields
before insert or update on public.profiles
for each row execute function public.protect_profile_authorization_fields();

revoke all on function public.protect_profile_authorization_fields() from public, anon, authenticated;

-- Keep the compatibility profile organization field derived from the active
-- membership record instead of accepting it from browser profile forms.
create or replace function public.sync_profile_organization_from_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := coalesce(new.user_id, old.user_id);
  v_organization_id uuid;
begin
  select m.organization_id
  into v_organization_id
  from public.memberships m
  where m.user_id = v_user_id
    and m.status = 'active'
  order by m.activated_at desc
  limit 1;

  update public.profiles
  set org_id = v_organization_id
  where id = v_user_id
    and org_id is distinct from v_organization_id;

  update public.vulnerability_profiles
  set organization_id = v_organization_id,
      updated_at = now()
  where profile_id = v_user_id
    and organization_id is distinct from v_organization_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists sync_profile_organization_from_membership on public.memberships;
drop trigger if exists sync_profile_organization_after_membership_delete on public.memberships;
create trigger sync_profile_organization_from_membership
after insert or update of organization_id, status on public.memberships
for each row execute function public.sync_profile_organization_from_membership();
create trigger sync_profile_organization_after_membership_delete
after delete on public.memberships
for each row execute function public.sync_profile_organization_from_membership();

revoke all on function public.sync_profile_organization_from_membership() from public, anon, authenticated;

-- Repair compatibility fields for existing active memberships.
update public.profiles p
set org_id = (
  select m.organization_id
  from public.memberships m
  where m.user_id = p.id and m.status = 'active'
  order by m.activated_at desc
  limit 1
)
where exists (
  select 1 from public.memberships m
  where m.user_id = p.id and m.status = 'active'
)
and p.org_id is distinct from (
  select m.organization_id
  from public.memberships m
  where m.user_id = p.id and m.status = 'active'
  order by m.activated_at desc
  limit 1
);

create or replace function public.leave_current_organization()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_organization_id uuid;
  v_released_seat boolean := false;
begin
  if v_user_id is null then
    raise exception 'Sign in before leaving an organization';
  end if;

  select m.organization_id, m.consumes_organization_seat
  into v_organization_id, v_released_seat
  from public.memberships m
  where m.user_id = v_user_id and m.status = 'active'
  order by m.activated_at desc
  limit 1
  for update;

  if v_organization_id is null then
    return jsonb_build_object('ok', true, 'releasedSeat', false);
  end if;

  update public.memberships
  set status = 'inactive', deactivated_at = now()
  where user_id = v_user_id
    and organization_id = v_organization_id
    and status = 'active';

  update public.subscriptions
  set status = 'cancelled', updated_at = now()
  where user_id = v_user_id
    and organization_id = v_organization_id
    and provider = 'organization'
    and status in ('active', 'grace_period');

  insert into public.seat_audit_log (
    organization_id, actor_user_id, subject_user_id, action, metadata
  ) values (
    v_organization_id,
    v_user_id,
    v_user_id,
    'organization_membership_left',
    jsonb_build_object('released_seat', v_released_seat)
  );

  return jsonb_build_object(
    'ok', true,
    'organizationId', v_organization_id,
    'releasedSeat', v_released_seat
  );
end;
$$;

revoke all on function public.leave_current_organization() from public, anon;
grant execute on function public.leave_current_organization() to authenticated;

comment on function public.leave_current_organization() is
  'Deactivates the caller membership, releases any organization-funded seat, and records an audit event.';
