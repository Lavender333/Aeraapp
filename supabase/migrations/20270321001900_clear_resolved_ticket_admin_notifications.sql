-- Resolved support tickets no longer belong in an administrator's active
-- notification inbox. Ticket history remains in help_requests, and the
-- requester keeps the separate support_ticket_resolved notification.

create or replace function public.clear_resolved_support_ticket_admin_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status::text = 'RESOLVED'
     and old.status::text is distinct from new.status::text
     and coalesce(new.data->>'requestType', '') = 'CONTACT_SUPPORT' then
    delete from public.notifications n
    where n.related_id = new.id
      and n.type in ('support_ticket_created', 'support_ticket_escalated');
  end if;

  return new;
end;
$$;

revoke all on function public.clear_resolved_support_ticket_admin_notifications()
  from public, anon, authenticated;

drop trigger if exists clear_resolved_support_ticket_admin_notifications_trigger
  on public.help_requests;
create trigger clear_resolved_support_ticket_admin_notifications_trigger
after update of status on public.help_requests
for each row
execute function public.clear_resolved_support_ticket_admin_notifications();

-- Clean up alerts left behind by tickets that were resolved before this fix.
delete from public.notifications n
using public.help_requests h
where n.related_id = h.id
  and n.type in ('support_ticket_created', 'support_ticket_escalated')
  and h.status::text = 'RESOLVED'
  and coalesce(h.data->>'requestType', '') = 'CONTACT_SUPPORT';

