-- Platform administrators need a complete account directory, including auth
-- accounts whose profile row is missing or incomplete.

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
  select
    au.id,
    coalesce(nullif(p.email, ''), au.email, '')::text,
    coalesce(nullif(p.phone, ''), au.phone, '')::text,
    coalesce(nullif(p.full_name, ''), nullif(au.raw_user_meta_data->>'full_name', ''), 'Unnamed User')::text,
    coalesce(p.role::text, 'GENERAL_USER')::text,
    p.org_id,
    coalesce(o.org_code, '')::text,
    coalesce(p.is_active, true),
    coalesce(nullif(p.home_address, ''), nullif(p.address_line_1, ''), '')::text,
    coalesce(p.city, '')::text,
    coalesce(p.state, '')::text,
    coalesce(p.zip, '')::text,
    p.latitude::float8,
    p.longitude::float8,
    coalesce(p.created_at, au.created_at)
  from auth.users au
  left join public.profiles p on p.id = au.id
  left join public.organizations o on o.id = p.org_id
  order by coalesce(p.created_at, au.created_at) desc, au.id;
end;
$$;

revoke all on function public.admin_list_all_users() from public, anon;
grant execute on function public.admin_list_all_users() to authenticated;
