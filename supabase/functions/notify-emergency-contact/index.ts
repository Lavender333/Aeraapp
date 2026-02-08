import "jsr:@supabase/functions-js/edge-runtime.d.ts";

declare const Deno: {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
  env: { get: (key: string) => string | undefined };
};

Deno.serve(async (req) => {
  try {
    const { contactName, contactPhone, userName, emergencyType, description, location, requestId } = await req.json();

    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromPhone = Deno.env.get('TWILIO_FROM_PHONE');

    if (!accountSid || !authToken || !fromPhone) {
      return new Response(JSON.stringify({ error: 'Twilio credentials missing' }), { status: 500 });
    }

    if (!contactPhone) {
      return new Response(JSON.stringify({ error: 'Missing contact phone' }), { status: 400 });
    }

    const message = [
      `AERA Emergency Alert${userName ? ` for ${userName}` : ''}`,
      emergencyType ? `Type: ${emergencyType}` : null,
      description ? `Details: ${description}` : null,
      location ? `Location: ${location}` : null,
      requestId ? `Request ID: ${requestId}` : null,
    ].filter(Boolean).join('\n');

    const body = new URLSearchParams({
      To: contactPhone,
      From: fromPhone,
      Body: message,
    });

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    const auth = btoa(`${accountSid}:${authToken}`);

    const resp = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(JSON.stringify({ error: errText }), { status: resp.status });
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
