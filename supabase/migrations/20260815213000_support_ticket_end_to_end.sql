-- Make support ticket routing, oversight, replies, and in-app alerts reliable.
-- Notifications are generated in the database because authenticated clients
-- are intentionally forbidden from inserting arbitrary notifications.

alter table public.help_requests enable row level security;

drop policy if exists "Help requests can view" on public.help_requests;
create policy "Help requests can view"
on public.help_requests for select to authenticated
using (
  user_id = auth.uid()
  or public.user_role() = 'ADMIN'
  or (
    org_id = public.user_org_id()
    and public.user_role() in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
  )
  or public.user_role() in ('FIRST_RESPONDER', 'LOCAL_AUTHORITY')
);

drop policy if exists "Help requests can insert" on public.help_requests;
create policy "Help requests can insert"
on public.help_requests for insert to authenticated
with check (user_id = auth.uid() or public.user_role() = 'ADMIN');

drop policy if exists "Help requests can update" on public.help_requests;
create policy "Help requests can update"
on public.help_requests for update to authenticated
using (
  public.user_role() = 'ADMIN'
  or (
    org_id = public.user_org_id()
    and public.user_role() in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
  )
)
with check (
  public.user_role() = 'ADMIN'
  or (
    org_id = public.user_org_id()
    and public.user_role() in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
  )
);

create or replace function public.notify_support_ticket_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_type text := coalesce(new.data->>'requestType', '');
  v_subject text := coalesce(new.data->>'subject', 'Support request');
  v_requester_name text := coalesce(new.data->>'requesterName', 'A user');
  v_routed_to text := coalesce(new.data->>'routedTo', 'AERA_ADMIN');
  v_old_message_count integer := 0;
  v_new_message_count integer := 0;
  v_last_message jsonb;
  v_alert_type text;
  v_admin_name text;
begin
  if v_request_type <> 'CONTACT_SUPPORT' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- The organization's admins receive and own their member tickets.
    if new.org_id is not null and v_routed_to = 'ORG_ADMIN' then
      insert into public.notifications (user_id, type, related_id, metadata)
      select p.id, 'support_ticket_created', new.id,
        jsonb_build_object('subject', v_subject, 'requesterName', v_requester_name,
          'category', coalesce(new.data->>'category', 'GENERAL'))
      from public.profiles p
      where p.org_id = new.org_id
        and upper(coalesce(p.role::text, '')) in ('ORG_ADMIN', 'INSTITUTION_ADMIN')
        and p.id <> new.user_id;
    end if;

    -- Top administrators always receive an oversight alert and can see every
    -- ticket, including tickets that have not been escalated.
    insert into public.notifications (user_id, type, related_id, metadata)
    select p.id, 'support_ticket_created', new.id,
      jsonb_build_object('subject', v_subject, 'requesterName', v_requester_name,
        'category', coalesce(new.data->>'category', 'GENERAL'),
        'oversightOnly', v_routed_to = 'ORG_ADMIN')
    from public.profiles p
    where upper(coalesce(p.role::text, '')) = 'ADMIN'
      and p.id <> new.user_id;

    return new;
  end if;

  v_old_message_count := coalesce(jsonb_array_length(coalesce(old.data->'messages', '[]'::jsonb)), 0);
  v_new_message_count := coalesce(jsonb_array_length(coalesce(new.data->'messages', '[]'::jsonb)), 0);

  if v_new_message_count > v_old_message_count then
    v_last_message := new.data->'messages'->(v_new_message_count - 1);

    -- Do not alert someone about their own message. Any admin reply or
    -- escalation note generates a visible notification for the requester.
    if coalesce(v_last_message->>'authorId', '') <> new.user_id::text then
      v_alert_type := case when new.status::text = 'RESOLVED'
        then 'support_ticket_resolved' else 'support_ticket_response' end;
      v_admin_name := coalesce(v_last_message->>'authorName', 'Support');
      insert into public.notifications (user_id, type, related_id, metadata)
      values (new.user_id, v_alert_type, new.id,
        jsonb_build_object('subject', v_subject, 'adminName', v_admin_name,
          'category', coalesce(new.data->>'category', 'GENERAL')));
    end if;
  end if;

  -- Alert every AERA admin when an organization escalates a ticket.
  if coalesce((old.data->>'escalatedToAdmin')::boolean, false) = false
     and coalesce((new.data->>'escalatedToAdmin')::boolean, false) = true then
    insert into public.notifications (user_id, type, related_id, metadata)
    select p.id, 'support_ticket_escalated', new.id,
      jsonb_build_object('subject', v_subject,
        'orgName', coalesce(new.data->>'requesterOrgName', ''),
        'escalatedBy', coalesce(v_last_message->>'authorName', 'Organization admin'))
    from public.profiles p
    where upper(coalesce(p.role::text, '')) = 'ADMIN';
  end if;

  return new;
end;
$$;

revoke all on function public.notify_support_ticket_activity() from public, anon, authenticated;

drop trigger if exists notify_support_ticket_activity_trigger on public.help_requests;
create trigger notify_support_ticket_activity_trigger
after insert or update on public.help_requests
for each row execute function public.notify_support_ticket_activity();

create index if not exists idx_help_requests_contact_support_created
on public.help_requests (created_at desc)
where data->>'requestType' = 'CONTACT_SUPPORT';
