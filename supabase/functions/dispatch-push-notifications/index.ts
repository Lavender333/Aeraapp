import { createClient } from 'npm:@supabase/supabase-js@2.95.3';
import { importPKCS8, SignJWT } from 'npm:jose@5.9.6';

type Delivery = {
  delivery_id: string;
  token_id: string;
  token: string;
  notification_id: string;
  notification_type: string;
  related_id: string | null;
  metadata: Record<string, unknown> | null;
  attempt_count: number;
};

const required = (name: string) => {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};

const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'));
const bundleId = Deno.env.get('APNS_BUNDLE_ID')?.trim() || 'com.aera.emergencyresponse';
let cachedJwt: { value: string; expiresAt: number } | null = null;

const providerToken = async () => {
  if (cachedJwt && cachedJwt.expiresAt > Date.now()) return cachedJwt.value;
  const keyId = required('APNS_KEY_ID');
  const teamId = required('APNS_TEAM_ID');
  const pem = required('APNS_PRIVATE_KEY').replace(/\\n/g, '\n');
  const key = await importPKCS8(pem, 'ES256');
  const now = Math.floor(Date.now() / 1000);
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt(now)
    .sign(key);
  cachedJwt = { value, expiresAt: Date.now() + 50 * 60 * 1000 };
  return value;
};

const pushCopy = (delivery: Delivery) => {
  const metadata = delivery.metadata || {};
  const eventName = String(metadata.eventName || 'your community event');
  switch (delivery.notification_type) {
    case 'event_registration_confirmed': return { title: 'Registration confirmed', body: `You are registered for ${eventName}.` };
    case 'event_registration_created': return { title: 'New event registration', body: `A member registered for ${eventName}.` };
    case 'organization_membership_requested': return { title: 'New member request', body: 'A new organization access request needs review.' };
    case 'organization_membership_accepted': return { title: 'Organization access approved', body: 'Your organization access is now active.' };
    case 'organization_membership_rejected': return { title: 'Organization access update', body: 'Your organization access request was reviewed.' };
    case 'incident_report_created': return { title: 'New incident report', body: 'A new community report needs review.' };
    case 'damage_assessment_created': return { title: 'New assessment', body: 'A new damage assessment needs review.' };
    case 'support_ticket_created': return { title: 'New support request', body: 'A support request needs review.' };
    case 'support_ticket_reply': return { title: 'Support replied', body: 'There is a new response to your support request.' };
    case 'support_ticket_escalated': return { title: 'Support request escalated', body: 'An escalated support request needs review.' };
    case 'household_join_request': return { title: 'Household request', body: 'Someone asked to join your household.' };
    case 'household_join_approved': return { title: 'Household request approved', body: 'You are now connected to the household.' };
    case 'household_join_rejected': return { title: 'Household request update', body: 'Your household request was reviewed.' };
    default: return { title: 'AERA alert', body: 'You have a new update to review.' };
  }
};

const pushView = (delivery: Delivery) => {
  const requested = String(delivery.metadata?.view || '').toUpperCase();
  if (requested) return requested;
  if (delivery.notification_type.startsWith('support_ticket_')) return 'SETTINGS';
  if (delivery.notification_type.startsWith('household_')) return 'SETTINGS';
  if (delivery.notification_type.startsWith('organization_membership_')) return 'SETTINGS';
  if (delivery.notification_type.includes('outreach')) return 'SETTINGS';
  if (delivery.notification_type.startsWith('event_registration_')) return 'EVENTS';
  return 'DASHBOARD';
};

const sendToApns = async (delivery: Delivery, host: string) => {
  const copy = pushCopy(delivery);
  return fetch(`https://${host}/3/device/${encodeURIComponent(delivery.token)}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${await providerToken()}`,
      'apns-topic': bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: { alert: copy, sound: 'default' },
      notificationId: delivery.notification_id,
      relatedId: delivery.related_id,
      type: delivery.notification_type,
      view: pushView(delivery),
    }),
  });
};

const deliver = async (delivery: Delivery) => {
  let response = await sendToApns(delivery, 'api.push.apple.com');
  let responseBody = await response.text();
  if (!response.ok && response.status === 400 && responseBody.includes('BadDeviceToken')) {
    response = await sendToApns(delivery, 'api.sandbox.push.apple.com');
    responseBody = await response.text();
  }
  if (response.ok) {
    await supabase.from('push_delivery_queue').update({ status: 'SENT', sent_at: new Date().toISOString(), last_error: null }).eq('id', delivery.delivery_id);
    return true;
  }

  const invalidToken = response.status === 410 || responseBody.includes('Unregistered') || responseBody.includes('BadDeviceToken');
  const terminal = invalidToken || delivery.attempt_count >= 3;
  if (invalidToken) {
    await supabase.from('push_device_tokens').update({ active: false }).eq('id', delivery.token_id);
  }
  await supabase.from('push_delivery_queue').update({
    status: terminal ? 'FAILED' : 'RETRY',
    next_attempt_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    last_error: `${response.status}: ${responseBody}`.slice(0, 1000),
  }).eq('id', delivery.delivery_id);
  return false;
};

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  try {
    const { data, error } = await supabase.rpc('claim_push_deliveries', { p_limit: 100 });
    if (error) throw error;
    const results = await Promise.all((data as Delivery[] || []).map(deliver));
    return Response.json({ claimed: results.length, sent: results.filter(Boolean).length });
  } catch (error) {
    console.error('Push dispatch failed', error);
    return Response.json({ error: 'Push dispatch failed' }, { status: 500 });
  }
});
