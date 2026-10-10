-- Mirror every in-app notification to the AERA administrative inboxes.
-- This is database-side so notification email routing can change without an app release.

create extension if not exists pg_net with schema extensions;

create or replace function public.mirror_notification_to_formsubmit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://formsubmit.co/ajax/antoinette@infoaera.com',
    headers := '{"Content-Type":"application/json","Accept":"application/json"}'::jsonb,
    body := jsonb_build_object(
      '_subject', 'AERA notification: ' || coalesce(new.type, 'unknown'),
      '_cc', 'ken.brewer@infoaera.com',
      '_template', 'table',
      'notification_id', new.id::text,
      'notification_type', coalesce(new.type, ''),
      'recipient_user_id', new.user_id::text,
      'related_id', coalesce(new.related_id::text, ''),
      'metadata', coalesce(new.metadata, '{}'::jsonb)::text,
      'created_at', new.created_at::text
    ),
    timeout_milliseconds := 5000
  );

  return new;
exception
  when others then
    -- Email mirroring must never prevent the original in-app/push notification.
    raise warning 'Unable to queue FormSubmit notification mirror: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.mirror_notification_to_formsubmit() from public, anon, authenticated;

drop trigger if exists mirror_notification_to_formsubmit_trigger on public.notifications;
create trigger mirror_notification_to_formsubmit_trigger
after insert on public.notifications
for each row execute function public.mirror_notification_to_formsubmit();
