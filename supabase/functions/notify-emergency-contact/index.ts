import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

const retryMinutes = (attempt: number) => attempt <= 1 ? 1 : attempt === 2 ? 5 : 15;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const accountSid = Deno.env.get("TWILIO_ACCOUNT_SID") ?? "";
    const authToken = Deno.env.get("TWILIO_AUTH_TOKEN") ?? "";
    const fromPhone = Deno.env.get("TWILIO_FROM_PHONE") ?? "";
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !accountSid || !authToken || !fromPhone) {
      return json({ error: "Emergency notification service is not configured" }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

    const payload = await req.json().catch(() => ({}));
    const requestId = String(payload?.requestId || "").trim();
    if (!requestId) return json({ error: "Request ID is required" }, 400);

    const { data: request, error: requestError } = await serviceClient
      .from("help_requests")
      .select("id, user_id, data, location")
      .eq("id", requestId)
      .eq("user_id", userData.user.id)
      .maybeSingle();
    if (requestError || !request) return json({ error: "Report not found" }, 404);

    const reportData = (request.data || {}) as Record<string, unknown>;
    const contactPhone = String(reportData.emergencyContactPhone || "").trim();
    if (!contactPhone) return json({ error: "No emergency contact phone is saved for this report" }, 400);

    const { data: existing } = await serviceClient
      .from("emergency_contact_notifications")
      .select("id, status, attempts, next_attempt_at")
      .eq("request_id", requestId)
      .maybeSingle();

    if (existing?.status === "SENT") return json({ ok: true, status: "sent", alreadySent: true });
    if (Number(existing?.attempts || 0) >= 3) {
      return json({ ok: false, status: "failed", terminal: true, error: "SMS retry limit reached" });
    }
    if (existing?.next_attempt_at && new Date(existing.next_attempt_at).getTime() > Date.now()) {
      return json({ ok: false, status: "waiting", retryAt: existing.next_attempt_at }, 429);
    }

    const attempt = Number(existing?.attempts || 0) + 1;
    const claimPayload = {
        request_id: requestId,
        user_id: userData.user.id,
        contact_phone: contactPhone,
        status: "SENDING",
        attempts: attempt,
        next_attempt_at: null,
        last_error: null,
        updated_at: new Date().toISOString(),
      };
    const claim = existing?.id
      ? await serviceClient
          .from("emergency_contact_notifications")
          .update(claimPayload)
          .eq("id", existing.id)
          .eq("attempts", Number(existing.attempts || 0))
          .in("status", ["PENDING", "FAILED"])
          .select("id")
          .maybeSingle()
      : await serviceClient
          .from("emergency_contact_notifications")
          .insert(claimPayload)
          .select("id")
          .maybeSingle();
    if (claim.error?.code === "23505" || (!claim.error && !claim.data)) {
      return json({ ok: false, status: "sending", retryAt: new Date(Date.now() + 60_000).toISOString() }, 429);
    }
    if (claim.error) return json({ error: "Unable to start emergency contact notification" }, 500);

    const message = [
      `AERA Emergency Alert${reportData.fullName ? ` for ${String(reportData.fullName)}` : ""}`,
      reportData.emergencyType ? `Type: ${String(reportData.emergencyType)}` : null,
      reportData.situationDescription ? `Details: ${String(reportData.situationDescription)}` : null,
      request.location ? `Location: ${String(request.location)}` : null,
      `Request ID: ${requestId}`,
      "Please call or text back if you can.",
    ].filter(Boolean).join("\n");

    const twilioResp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${accountSid}:${authToken}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: contactPhone, From: fromPhone, Body: message }),
    });
    const twilioResult = await twilioResp.json().catch(() => ({}));

    if (!twilioResp.ok) {
      const errorMessage = String(twilioResult?.message || twilioResult?.error || "Twilio delivery failed").slice(0, 1000);
      const terminal = attempt >= 3;
      const nextAttemptAt = terminal ? null : new Date(Date.now() + retryMinutes(attempt) * 60_000).toISOString();
      await serviceClient.from("emergency_contact_notifications").update({
        status: "FAILED",
        next_attempt_at: nextAttemptAt,
        last_error: errorMessage,
        updated_at: new Date().toISOString(),
      }).eq("request_id", requestId);
      return terminal
        ? json({ ok: false, status: "failed", terminal: true, error: errorMessage })
        : json({ error: errorMessage, retryAt: nextAttemptAt }, 502);
    }

    await serviceClient.from("emergency_contact_notifications").update({
      status: "SENT",
      provider_message_id: String(twilioResult?.sid || "") || null,
      sent_at: new Date().toISOString(),
      next_attempt_at: null,
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq("request_id", requestId);

    return json({ ok: true, status: "sent" });
  } catch (error) {
    return json({ error: String(error) }, 500);
  }
});
