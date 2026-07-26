import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const allowedOrigins = new Set([
  'https://getaeraapp.com',
  'http://localhost:3000',
  'http://localhost:5173',
]);

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || '';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://getaeraapp.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };
}

Deno.serve(async (request) => {
  const headers = corsHeaders(request);
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new Error('Missing authorization');
    }

    const body = await request.json().catch(() => ({}));
    if (body?.confirmation !== 'CLOSE') {
      return new Response(JSON.stringify({ error: 'Account closure confirmation is required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: closureResult, error: closureError } = await adminClient.rpc(
      'close_user_account',
      { p_user_id: userData.user.id },
    );
    if (closureError) throw closureError;

    const { error: disableError } = await adminClient.auth.admin.updateUserById(
      userData.user.id,
      {
        ban_duration: '876000h',
        user_metadata: {
          ...userData.user.user_metadata,
          account_status: 'closed',
          account_closed_at: new Date().toISOString(),
        },
        app_metadata: {
          ...userData.user.app_metadata,
          account_status: 'closed',
        },
      },
    );
    if (disableError) throw disableError;

    return new Response(JSON.stringify({ ok: true, status: 'closed', data: closureResult }), {
      status: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Account closure failed', error);
    return new Response(JSON.stringify({ error: 'Account closure failed' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});
