-- Close remaining privacy exposures identified after the production security deployment.

-- ============================================================
-- HOUSEHOLD PREPAREDNESS: REMOVE ANONYMOUS ROW ENUMERATION
-- ============================================================

alter table public.household_preparedness enable row level security;

drop policy if exists "Allow read access to household_preparedness"
  on public.household_preparedness;
drop policy if exists "household_preparedness_member_select"
  on public.household_preparedness;
drop policy if exists "household_preparedness_head_admin_select"
  on public.household_preparedness;

revoke all on table public.household_preparedness from anon;
revoke all on table public.household_preparedness from authenticated;
grant select on table public.household_preparedness to authenticated;

create policy "household_preparedness_member_select"
on public.household_preparedness
for select
to authenticated
using (
  exists (
    select 1
    from public.household_memberships membership
    where membership.household_id = household_preparedness.household_id
      and membership.profile_id = (select auth.uid())
  )
);

create policy "household_preparedness_head_admin_select"
on public.household_preparedness
for select
to authenticated
using (
  exists (
    select 1
    from public.profiles actor
    where actor.id = (select auth.uid())
      and actor.role::text in ('ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN')
  )
);

-- Community and state preparedness tables intentionally remain aggregate-only
-- public reporting surfaces. Household-level rows no longer do.

-- ============================================================
-- AVATARS: PRIVATE BUCKET + ROLE-SCOPED SIGNED ACCESS
-- ============================================================

update storage.buckets
set
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
where id = 'avatars';

create or replace function public.can_read_profile_avatar(target_profile_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_actor_role text;
  v_actor_org_id uuid;
  v_target_org_id uuid;
begin
  if v_actor_id is null or target_profile_id is null then
    return false;
  end if;

  if v_actor_id::text = target_profile_id then
    return true;
  end if;

  select role::text, org_id
  into v_actor_role, v_actor_org_id
  from public.profiles
  where id = v_actor_id;

  if v_actor_role in ('ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN') then
    return true;
  end if;

  if v_actor_role not in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
     or v_actor_org_id is null then
    return false;
  end if;

  select org_id
  into v_target_org_id
  from public.profiles
  where id::text = target_profile_id;

  return v_target_org_id is not null
    and v_target_org_id = v_actor_org_id;
end;
$$;

revoke all on function public.can_read_profile_avatar(text)
  from public, anon;
grant execute on function public.can_read_profile_avatar(text)
  to authenticated;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
drop policy if exists "Anyone can view avatars" on storage.objects;
drop policy if exists "Authenticated users can read permitted avatars" on storage.objects;

create policy "Authenticated users can read permitted avatars"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.can_read_profile_avatar((storage.foldername(name))[1])
);

-- Store a durable private object reference instead of a public or expiring URL.
update public.profiles
set avatar_url = 'avatar:' || id::text || '/avatar'
where avatar_url is not null
  and (
    avatar_url like '%/storage/v1/object/public/avatars/%'
    or avatar_url like '%/storage/v1/object/sign/avatars/%'
  );

-- Historical fallback behavior could store the entire image in the profile row.
-- Remove those raw data URLs instead of retaining a second ungoverned copy.
update public.profiles
set avatar_url = null
where avatar_url like 'data:image/%';
