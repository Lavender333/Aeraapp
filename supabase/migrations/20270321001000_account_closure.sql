-- Close an account without erasing the operational and audit history AERA
-- needs for seat accounting, incident records, and compliance.

create extension if not exists pgcrypto;

create table if not exists public.account_closure_records (
  id uuid primary key default gen_random_uuid(),
  subject_user_hash text not null,
  prior_organization_id uuid references public.organizations(id) on delete set null,
  closure_status text not null default 'closed'
    check (closure_status in ('closed', 'reopened')),
  retained_record_categories text[] not null default array[
    'account_closure',
    'membership_history',
    'subscription_history',
    'audit_history'
  ]::text[],
  closed_at timestamptz not null default now(),
  reopened_at timestamptz,
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists account_closure_records_closed_at_idx
  on public.account_closure_records(closed_at desc);

alter table public.account_closure_records enable row level security;
revoke all on table public.account_closure_records from public, anon, authenticated;
grant all on table public.account_closure_records to service_role;

create or replace function public.close_user_account(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prior_organization_id uuid;
  v_household record;
  v_new_owner_id uuid;
begin
  if p_user_id is null then
    raise exception 'A user ID is required';
  end if;

  select p.org_id
  into v_prior_organization_id
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception 'Account profile was not found';
  end if;

  insert into public.account_closure_records (
    subject_user_hash,
    prior_organization_id,
    metadata
  ) values (
    encode(digest(p_user_id::text, 'sha256'), 'hex'),
    v_prior_organization_id,
    jsonb_build_object('source', 'self_service')
  );

  insert into public.seat_audit_log (
    organization_id,
    actor_user_id,
    subject_user_id,
    action,
    metadata
  )
  select distinct
    m.organization_id,
    p_user_id,
    p_user_id,
    'account_closed',
    jsonb_build_object(
      'released_seat', m.consumes_organization_seat,
      'membership_id', m.id
    )
  from public.memberships m
  where m.user_id = p_user_id
    and m.status = 'active';

  update public.memberships
  set status = 'inactive',
      deactivated_at = coalesce(deactivated_at, now())
  where user_id = p_user_id
    and status in ('active', 'suspended');

  update public.subscriptions
  set status = 'cancelled',
      updated_at = now()
  where user_id = p_user_id
    and status in ('active', 'grace_period');

  delete from public.organization_admins
  where user_id = p_user_id;

  update public.shareable_intake_links
  set is_active = false
  where user_id = p_user_id;

  delete from public.platform_identities where user_id = p_user_id;
  delete from public.organization_code_redemption_limits where user_id = p_user_id;

  -- Transfer an owned household when another member exists. If no one else is
  -- connected, remove the empty household while retaining independent audits.
  for v_household in
    select h.id
    from public.households h
    where h.owner_profile_id = p_user_id
    for update
  loop
    select hm.profile_id
    into v_new_owner_id
    from public.household_memberships hm
    where hm.household_id = v_household.id
      and hm.profile_id <> p_user_id
      and not exists (
        select 1
        from public.households owned_household
        where owned_household.owner_profile_id = hm.profile_id
      )
    order by hm.created_at asc
    limit 1;

    if v_new_owner_id is null then
      if exists (
        select 1
        from public.household_memberships remaining_member
        where remaining_member.household_id = v_household.id
          and remaining_member.profile_id <> p_user_id
      ) then
        raise exception 'Household ownership must be transferred before this account can be closed';
      end if;
      delete from public.households where id = v_household.id;
    else
      update public.households
      set owner_profile_id = v_new_owner_id,
          updated_at = now()
      where id = v_household.id;

      update public.household_memberships
      set role = 'OWNER',
          updated_at = now()
      where household_id = v_household.id
        and profile_id = v_new_owner_id;
    end if;
  end loop;

  delete from public.household_memberships where profile_id = p_user_id;
  delete from public.household_invitations
    where inviter_profile_id = p_user_id or accepted_by_profile_id = p_user_id;
  delete from public.household_join_requests where requesting_user_id = p_user_id;
  delete from public.household_expansion_requests where requester_profile_id = p_user_id;
  delete from public.notifications where user_id = p_user_id;

  -- Remove high-risk personal preparedness information while retaining the
  -- minimum closed profile row needed by historical foreign keys.
  delete from public.vitals where profile_id = p_user_id;
  delete from public.household_members where profile_id = p_user_id;
  delete from public.pets where profile_id = p_user_id;
  delete from public.trusted_community_connections where profile_id = p_user_id;
  delete from public.ready_kits where profile_id = p_user_id;

  update public.damage_assessments
  set description = null,
      ai_analysis = null,
      photo_url = null,
      photo_path = null,
      location = null
  where profile_id = p_user_id;

  update public.help_requests
  set data = '{}'::jsonb,
      location = null,
      latitude = null,
      longitude = null,
      updated_at = now()
  where user_id = p_user_id;

  update public.profiles
  set org_id = null,
      email = null,
      phone = null,
      mobile_phone = null,
      full_name = 'Closed Account',
      avatar_url = null,
      home_address = null,
      emergency_contact = null,
      is_active = false,
      updated_at = now()
  where id = p_user_id;

  return jsonb_build_object(
    'ok', true,
    'status', 'closed',
    'priorOrganizationId', v_prior_organization_id
  );
end;
$$;

revoke all on function public.close_user_account(uuid) from public, anon, authenticated;
grant execute on function public.close_user_account(uuid) to service_role;

comment on function public.close_user_account(uuid) is
  'Closes access, releases active seats, minimizes personal profile data, and retains non-personal operational audit history.';
