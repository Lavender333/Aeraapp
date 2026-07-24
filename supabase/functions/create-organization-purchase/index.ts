import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PurchaseRequest = {
  organizationName: string;
  seats: number;
  contractStart: string;
  contractEnd?: string | null;
  adminEmail: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) throw new Error('Missing Supabase function configuration');

    const authHeader = request.headers.get('Authorization') || '';
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) throw new Error('You must be signed in');

    const { data: staffProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();
    if (profileError) throw profileError;
    if (String(staffProfile?.role || '').toUpperCase() !== 'ADMIN') {
      return new Response(JSON.stringify({ error: 'AERA staff administrator access is required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await request.json()) as PurchaseRequest;
    const organizationName = String(body.organizationName || '').trim();
    const adminEmail = String(body.adminEmail || '').trim().toLowerCase();
    const seats = Number(body.seats);
    if (!organizationName) throw new Error('Organization name is required');
    if (!adminEmail || !/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error('A valid administrator email is required');
    if (!Number.isInteger(seats) || seats < 1) throw new Error('Seats must be a whole number greater than zero');

    const start = new Date(body.contractStart);
    const end = body.contractEnd ? new Date(body.contractEnd) : null;
    if (Number.isNaN(start.getTime())) throw new Error('A valid contract start date is required');
    if (end && (Number.isNaN(end.getTime()) || end <= start)) throw new Error('Contract end must be after contract start');

    let adminUserId: string | null = null;
    const { data: existingUsers, error: listError } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (listError) throw listError;
    const existing = existingUsers.users.find((user) => user.email?.toLowerCase() === adminEmail);

    if (existing) {
      adminUserId = existing.id;
    } else {
      const redirectTo = Deno.env.get('ORG_ADMIN_INVITE_REDIRECT_URL') || undefined;
      const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(adminEmail, {
        redirectTo,
        data: { role: 'ORG_ADMIN', organization_name: organizationName },
      });
      if (inviteError) throw inviteError;
      adminUserId = invited.user?.id || null;
    }

    const { data: purchaseRows, error: purchaseError } = await adminClient.rpc('complete_organization_purchase', {
      p_organization_name: organizationName,
      p_seat_limit: seats,
      p_contract_starts_at: start.toISOString(),
      p_contract_ends_at: end?.toISOString() || null,
      p_initial_admin_user_id: adminUserId,
      p_code_expires_at: end?.toISOString() || null,
    });
    if (purchaseError) throw purchaseError;

    const purchase = Array.isArray(purchaseRows) ? purchaseRows[0] : purchaseRows;
    if (!purchase?.organization_id || !purchase?.activation_code) throw new Error('Organization creation did not return an activation code');

    await adminClient.from('seat_audit_log').insert({
      organization_id: purchase.organization_id,
      actor_user_id: authData.user.id,
      subject_user_id: adminUserId,
      action: 'organization_purchase_portal_completed',
      metadata: {
        admin_email: adminEmail,
        seats,
        contract_start: start.toISOString(),
        contract_end: end?.toISOString() || null,
      },
    });

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('AERA_ORG_EMAIL_FROM');
    let emailSent = false;
    let emailWarning: string | null = null;

    if (resendKey && fromEmail) {
      const emailResponse = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [adminEmail],
          subject: `Your AERA organization access code`,
          html: `<h2>${organizationName} is ready in AERA</h2><p>Your organization has <strong>${seats.toLocaleString('en-US')}</strong> seats.</p><p>Your activation code is:</p><p style="font-size:22px;font-weight:700;letter-spacing:2px">${purchase.activation_code}</p><p>Members must create and verify their own AERA account before using this code. One person counts as one seat, even when using both Apple and Android devices.</p><p>Keep this code private. AERA stores only its secure hash and cannot display the full code again.</p>`,
        }),
      });
      emailSent = emailResponse.ok;
      if (!emailResponse.ok) emailWarning = `Organization created, but the code email failed (${emailResponse.status})`;
    } else {
      emailWarning = 'Organization created, but email delivery is not configured. Copy the code now and send it securely.';
    }

    return new Response(JSON.stringify({
      organizationId: purchase.organization_id,
      seatPoolId: purchase.seat_pool_id,
      activationCode: purchase.activation_code,
      adminEmail,
      seats,
      emailSent,
      emailWarning,
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
