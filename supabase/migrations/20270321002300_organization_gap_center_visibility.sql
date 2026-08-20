-- Organizations decide whether their members can see the G.A.P. Center.
-- It is intentionally hidden by default.

alter table public.organizations
  add column if not exists show_gap_center_to_members boolean not null default false;

create or replace function public.set_organization_gap_center_visibility(
  p_organization_id uuid,
  p_visible boolean
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  if not (
    public.user_role() = 'ADMIN'
    or public.is_organization_admin(p_organization_id)
    or exists (
      select 1
      from public.profiles actor
      where actor.id = auth.uid()
        and actor.org_id = p_organization_id
        and upper(coalesce(actor.role::text, '')) in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
    )
  ) then
    raise exception 'Only an AERA administrator or organization administrator can change this setting';
  end if;

  update public.organizations
  set show_gap_center_to_members = coalesce(p_visible, false),
      updated_at = now()
  where id = p_organization_id;

  if not found then
    raise exception 'Organization not found';
  end if;

  return coalesce(p_visible, false);
end;
$$;

revoke all on function public.set_organization_gap_center_visibility(uuid, boolean) from public, anon;
grant execute on function public.set_organization_gap_center_visibility(uuid, boolean) to authenticated;

comment on column public.organizations.show_gap_center_to_members is
  'When true, connected general users may see and open the G.A.P. Center. Hidden by default.';

comment on function public.set_organization_gap_center_visibility(uuid, boolean) is
  'Allows AERA admins and administrators of the selected organization to control member access to the G.A.P. Center.';
