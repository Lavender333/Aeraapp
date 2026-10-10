-- FormSubmit validates that AJAX submissions originate from the production website.

create or replace function public.mirror_notification_to_formsubmit()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  perform net.http_post(
    url := 'https://formsubmit.co/ajax/antoinette@infoaera.com',
    headers := '{"Content-Type":"application/json","Accept":"application/json","Origin":"https://getaeraapp.com","Referer":"https://getaeraapp.com/"}'::jsonb,
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
    raise warning 'Unable to queue FormSubmit notification mirror: %', sqlerrm;
    return new;
end;
$$;

revoke all on function public.mirror_notification_to_formsubmit() from public, anon, authenticated;
