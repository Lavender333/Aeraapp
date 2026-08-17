-- Include organization directory members that do not have an auth login.
-- Auth accounts remain authoritative when the same UUID exists in both places.

create or replace function public.admin_list_all_users()
returns table (
  user_id uuid,
  email text,
  phone text,
  full_name text,
  user_role text,
  organization_id uuid,
  organization_code text,
  is_active boolean,
  home_address text,
  city text,
  state text,
  zip_code text,
  latitude float8,
  longitude float8,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if not exists (
    select 1 from public.profiles actor
    where actor.id = auth.uid()
      and upper(coalesce(actor.role::text, '')) = 'ADMIN'
  ) then
    raise exception 'Only AERA Admin can view the complete user directory';
  end if;

  return query
  with directory as (
    select
      au.id as user_id,
      coalesce(nullif(p.email, ''), au.email, '')::text as email,
      coalesce(nullif(p.phone, ''), au.phone, '')::text as phone,
      coalesce(nullif(p.full_name, ''), nullif(au.raw_user_meta_data->>'full_name', ''), 'Unnamed User')::text as full_name,
      coalesce(p.role::text, 'GENERAL_USER')::text as user_role,
      p.org_id as organization_id,
      coalesce(o.org_code, '')::text as organization_code,
      coalesce(p.is_active, true) as is_active,
      coalesce(nullif(p.home_address, ''), nullif(p.address_line_1, ''), '')::text as home_address,
      coalesce(p.city, '')::text as city,
      coalesce(p.state, '')::text as state,
      coalesce(p.zip, '')::text as zip_code,
      p.latitude::float8 as latitude,
      p.longitude::float8 as longitude,
      coalesce(p.created_at, au.created_at) as created_at
    from auth.users au
    left join public.profiles p on p.id = au.id
    left join public.organizations o on o.id = p.org_id

    union all

    select
      m.id as user_id,
      ''::text as email,
      coalesce(m.phone, '')::text as phone,
      coalesce(nullif(m.name, ''), 'Unnamed Member')::text as full_name,
      'MEMBER'::text as user_role,
      m.org_id as organization_id,
      coalesce(o.org_code, '')::text as organization_code,
      true as is_active,
      coalesce(m.address, '')::text as home_address,
      ''::text as city,
      ''::text as state,
      ''::text as zip_code,
      null::float8 as latitude,
      null::float8 as longitude,
      m.created_at as created_at
    from public.members m
    left join public.organizations o on o.id = m.org_id
    where not exists (select 1 from auth.users au where au.id = m.id)
  )
  select directory.*
  from directory
  order by directory.created_at desc nulls last, directory.user_id;
end;
$$;

revoke all on function public.admin_list_all_users() from public, anon;
grant execute on function public.admin_list_all_users() to authenticated;
