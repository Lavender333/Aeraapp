-- Qualify membership/seat-pool columns that share names with RETURNS TABLE
-- output columns. Unqualified references are ambiguous inside PL/pgSQL.

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
  if v_user_id is null then raise exception 'Sign in before using an organization code'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'Organization code is required'; end if;

  v_code_hash := encode(digest(upper(regexp_replace(trim(p_code), '[^A-Z0-9]', '', 'g')), 'sha256'), 'hex');
  select oc.*
  into v_code
  from public.organization_codes as oc
  where oc.code_hash = v_code_hash
  for update;

  if not found or v_code.status <> 'active' then raise exception 'Invalid or inactive organization code'; end if;
  if v_code.expires_at is not null and v_code.expires_at <= now() then raise exception 'Organization code has expired'; end if;
  if v_code.max_redemptions is not null and v_code.redemption_count >= v_code.max_redemptions then
    raise exception 'Organization code has reached its redemption limit';
  end if;

  select o.* into v_org
  from public.organizations as o
  where o.id = v_code.organization_id;

  if not found or v_org.contract_status <> 'active' then raise exception 'Organization contract is not active'; end if;
  if v_org.contract_starts_at is not null and v_org.contract_starts_at > now() then raise exception 'Organization access has not started'; end if;
  if v_org.contract_ends_at is not null and v_org.contract_ends_at <= now() then raise exception 'Organization contract has expired'; end if;

  select sp.* into v_pool
  from public.seat_pools as sp
  where sp.organization_id = v_code.organization_id
  for update;

  if not found or v_pool.status <> 'active' then raise exception 'Organization seat pool is not active'; end if;

  if exists (
    select 1 from public.memberships as m
    where m.organization_id = v_org.id
      and m.user_id = v_user_id
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

  update public.organization_codes as oc
  set redemption_count = oc.redemption_count + 1
  where oc.id = v_code.id;

  insert into public.seat_audit_log (organization_id, actor_user_id, subject_user_id, action, metadata)
  values (v_org.id, v_user_id, v_user_id, 'organization_membership_requested',
    jsonb_build_object('membership_id', v_membership_id, 'code_id', v_code.id));

  select
    count(*) filter (where m.status = 'active' and m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active' and not m.consumes_organization_seat)::integer,
    count(*) filter (where m.status = 'active')::integer
  into v_funded_count, v_personal_count, v_connected_count
  from public.memberships as m
  where m.organization_id = v_org.id;

  return query
  select v_membership_id, v_org.id, v_funding_source, v_consumes_seat,
    v_pool.seat_limit, v_funded_count, v_personal_count, v_connected_count,
    greatest(v_pool.seat_limit - v_funded_count, 0);
end;
$$;

revoke all on function public.redeem_organization_code(text) from public, anon;
grant execute on function public.redeem_organization_code(text) to authenticated;
