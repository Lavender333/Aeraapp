-- Community-code redemption creates an application. Organization access and
-- funded-seat consumption begin only after an authorized admin accepts it.

alter table public.memberships drop constraint if exists memberships_status_check;
alter table public.memberships
  add constraint memberships_status_check
  check (status in ('active', 'suspended', 'inactive', 'expired'));

drop function if exists public.redeem_organization_code(text);
create function public.redeem_organization_code(p_code text)
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
  if v_user_id is null then raise exception 'Sign in before using an organization code'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'Organization code is required'; end if;

  v_code_hash := encode(digest(upper(regexp_replace(trim(p_code), '[^A-Z0-9]', '', 'g')), 'sha256'), 'hex');
  select * into v_code from public.organization_codes where code_hash = v_code_hash for update;
  if not found or v_code.status <> 'active' then raise exception 'Invalid or inactive organization code'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'Organization code has expired'; end if;
  if v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Organization code has reached its redemption limit';
  end if;

  select * into v_org from public.organizations where id = v_code.organization_id;
  if not found or v_org.contract_status <> 'active' then raise exception 'Organization contract is not active'; end if;
  if v_org.contract_starts_at is not null and v_org.contract_starts_at > now() then raise exception 'Organization access has not started'; end if;
  if v_org.contract_ends_at is not null and v_org.contract_ends_at <= now() then raise exception 'Organization contract has expired'; end if;

  select * into v_pool from public.seat_pools where organization_id = v_code.organization_id for update;
  if not found or v_pool.status <> 'active' then raise exception 'Organization seat pool is not active'; end if;

  if exists (
    select 1 from public.memberships m
    where m.organization_id = v_org.id and m.user_id = v_user_id
      and m.status in ('active', 'suspended')
  ) then raise exception 'This account already has access or a pending request for this organization'; end if;

  v_has_personal_subscription := public.user_has_active_personal_subscription(v_user_id);
  v_consumes_seat := not v_has_personal_subscription;
  v_funding_source := case when v_has_personal_subscription then 'personal' else 'organization' end;

  insert into public.memberships (
    organization_id, seat_pool_id, user_id, access_type, funding_source,
    consumes_organization_seat, status, activated_with_code_id
  ) values (
    v_org.id, v_pool.id, v_user_id,
    case when v_has_personal_subscription then 'personal_affiliate' else 'organization' end,
    v_funding_source, v_consumes_seat, 'suspended', v_code.id
  ) returning id into v_membership_id;

  update public.organization_codes set redemption_count = redemption_count + 1 where id = v_code.id;
  insert into public.seat_audit_log (organization_id, actor_user_id, subject_user_id, action, metadata)
  values (v_org.id, v_user_id, v_user_id, 'organization_membership_requested',
    jsonb_build_object('membership_id', v_membership_id, 'code_id', v_code.id));

  select
    count(*) filter (where m.status = 'active' and m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active' and not m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active')::integer
  into v_funded_count, v_personal_count, v_connected_count
  from public.memberships m where m.organization_id = v_org.id;

  return query select v_membership_id, v_org.id, v_funding_source, v_consumes_seat,
    v_pool.seat_limit, v_funded_count, v_personal_count, v_connected_count,
    greatest(v_pool.seat_limit - v_funded_count, 0);
end;
$$;

revoke all on function public.redeem_organization_code(text) from public, anon;
grant execute on function public.redeem_organization_code(text) to authenticated;

create or replace function public.review_organization_code_registration(
  p_membership_id uuid,
  p_decision text
)
returns table (membership_id uuid, membership_status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_membership public.memberships%rowtype;
  v_pool public.seat_pools%rowtype;
  v_active_funded integer;
  v_decision text := lower(trim(p_decision));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if v_decision not in ('accept', 'reject') then raise exception 'Decision must be accept or reject'; end if;

  select * into v_membership from public.memberships where id = p_membership_id for update;
  if not found or v_membership.activated_with_code_id is null then raise exception 'Registration not found'; end if;
  if not public.can_manage_organization_access(v_membership.organization_id) then raise exception 'Forbidden'; end if;
  if v_membership.status <> 'suspended' then raise exception 'This registration has already been reviewed'; end if;

  if v_decision = 'accept' then
    select * into v_pool from public.seat_pools where id = v_membership.seat_pool_id for update;
    select count(*)::integer into v_active_funded from public.memberships m
      where m.seat_pool_id = v_membership.seat_pool_id and m.status = 'active'
        and m.consumes_organization_seat = true;
    if v_membership.consumes_organization_seat and v_active_funded >= v_pool.seat_limit then
      raise exception 'No funded seats are available for this registration';
    end if;

    update public.memberships set status = 'active', activated_at = now(), deactivated_at = null
      where id = p_membership_id;
    if v_membership.consumes_organization_seat then
      insert into public.subscriptions (user_id, provider, organization_id, status)
      values (v_membership.user_id, 'organization', v_membership.organization_id, 'active');
    end if;
    update public.profiles set org_id = v_membership.organization_id where id = v_membership.user_id;
  else
    update public.memberships set status = 'inactive', deactivated_at = now() where id = p_membership_id;
    update public.organization_codes set redemption_count = greatest(redemption_count - 1, 0)
      where id = v_membership.activated_with_code_id;
  end if;

  insert into public.seat_audit_log (organization_id, actor_user_id, subject_user_id, action, metadata)
  values (v_membership.organization_id, auth.uid(), v_membership.user_id,
    case when v_decision = 'accept' then 'organization_membership_accepted' else 'organization_membership_rejected' end,
    jsonb_build_object('membership_id', p_membership_id, 'code_id', v_membership.activated_with_code_id));

  return query select p_membership_id,
    case when v_decision = 'accept' then 'accepted'::text else 'rejected'::text end;
end;
$$;

revoke all on function public.review_organization_code_registration(uuid, text) from public, anon;
grant execute on function public.review_organization_code_registration(uuid, text) to authenticated;

create or replace function public.get_organization_code_registrations(p_code_id uuid)
returns table (
  membership_id uuid, code_id uuid, user_id uuid, full_name text, email text,
  activated_at timestamptz, membership_status text, funding_source text,
  consumes_organization_seat boolean
)
language plpgsql stable security definer set search_path = public
as $$
declare v_organization_id uuid;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  select oc.organization_id into v_organization_id from public.organization_codes oc where oc.id = p_code_id;
  if v_organization_id is null then raise exception 'Access code not found'; end if;
  if not public.can_manage_organization_access(v_organization_id) then raise exception 'Forbidden'; end if;
  return query select m.id, m.activated_with_code_id, m.user_id,
    coalesce(nullif(trim(p.full_name), ''), 'Unnamed member')::text,
    coalesce(p.email, '')::text, m.activated_at,
    case when m.status = 'suspended' then 'pending' when m.status = 'active' then 'accepted'
      when m.status = 'inactive' then 'rejected' else m.status end::text,
    m.funding_source::text, m.consumes_organization_seat
  from public.memberships m left join public.profiles p on p.id = m.user_id
  where m.activated_with_code_id = p_code_id order by m.created_at desc;
end;
$$;

revoke all on function public.get_organization_code_registrations(uuid) from public, anon;
grant execute on function public.get_organization_code_registrations(uuid) to authenticated;
