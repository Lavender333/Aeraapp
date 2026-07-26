import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 10;
const allowedOrigins = new Set([
  'https://getaeraapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
]);

const responseHeaders = (request: Request) => {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://getaeraapp.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
    'Vary': 'Origin',
  };
};

const json = (request: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: responseHeaders(request) });

const sha256 = async (value: string) => {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: responseHeaders(request) });
  if (request.method !== 'POST') return json(request, { error: 'Method not allowed' }, 405);

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return json(request, { error: 'Unauthorized' }, 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json(request, { error: 'Unauthorized' }, 401);

  const body = await request.json().catch(() => ({}));
  const code = String(body?.code || '').trim();
  if (!code || code.length > 128) return json(request, { error: 'Community access code is required' }, 400);

  const forwardedFor = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
  const userAgent = String(request.headers.get('user-agent') || '').slice(0, 256);
  const fingerprint = await sha256(`${forwardedFor}|${userAgent}`);
  const now = new Date();

  const { data: limitRow } = await serviceClient
    .from('organization_code_redemption_limits')
    .select('failed_attempts, window_started_at, blocked_until')
    .eq('user_id', userData.user.id)
    .eq('client_fingerprint', fingerprint)
    .maybeSingle();

  if (limitRow?.blocked_until && new Date(limitRow.blocked_until) > now) {
    return json(request, { error: 'Too many failed attempts. Try again later.' });
  }

  const windowStarted = limitRow?.window_started_at ? new Date(limitRow.window_started_at) : now;
  const withinWindow = now.getTime() - windowStarted.getTime() < WINDOW_MS;
  const previousAttempts = withinWindow ? Number(limitRow?.failed_attempts || 0) : 0;

  const { data, error } = await userClient.rpc('redeem_organization_code', { p_code: code });
  if (error) {
    const failedAttempts = previousAttempts + 1;
    const blockedUntil = failedAttempts >= MAX_FAILED_ATTEMPTS
      ? new Date(now.getTime() + WINDOW_MS).toISOString()
      : null;
    await serviceClient.from('organization_code_redemption_limits').upsert({
      user_id: userData.user.id,
      client_fingerprint: fingerprint,
      failed_attempts: failedAttempts,
      window_started_at: withinWindow ? windowStarted.toISOString() : now.toISOString(),
      blocked_until: blockedUntil,
      updated_at: now.toISOString(),
    });
    return json(request, {
      error: blockedUntil ? 'Too many failed attempts. Try again later.' : error.message,
    });
  }

  await serviceClient
    .from('organization_code_redemption_limits')
    .delete()
    .eq('user_id', userData.user.id)
    .eq('client_fingerprint', fingerprint);

  return json(request, { data });
});
