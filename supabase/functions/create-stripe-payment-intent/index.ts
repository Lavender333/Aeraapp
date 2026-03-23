import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PaymentIntentPayload = {
  invoice_id: string;
  amount_cents: number;
  currency?: string;
  buyer_email?: string;
  metadata?: Record<string, string>;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey || !stripeSecretKey) {
      return new Response(JSON.stringify({ error: "Required environment variables are missing" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header is required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await authClient.auth.getUser();

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const payload = (await req.json()) as PaymentIntentPayload;
    const amountCents = Number(payload?.amount_cents || 0);
    const invoiceId = String(payload?.invoice_id || "").trim();
    const currency = String(payload?.currency || "usd").toLowerCase();

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: "invoice_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      return new Response(JSON.stringify({ error: "amount_cents must be a positive integer" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeBody = new URLSearchParams();
    stripeBody.append("amount", String(Math.round(amountCents)));
    stripeBody.append("currency", currency);
    stripeBody.append("automatic_payment_methods[enabled]", "true");
    stripeBody.append("metadata[invoice_id]", invoiceId);
    stripeBody.append("metadata[user_id]", user.id);
    stripeBody.append("description", `AERA lead invoice ${invoiceId}`);

    if (payload?.buyer_email) {
      stripeBody.append("receipt_email", payload.buyer_email);
    }

    if (payload?.metadata) {
      for (const [key, value] of Object.entries(payload.metadata)) {
        stripeBody.append(`metadata[${key}]`, String(value));
      }
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: stripeBody,
    });

    const stripeJson = await stripeRes.json();
    if (!stripeRes.ok) {
      const message = String(stripeJson?.error?.message || "Stripe payment intent creation failed");
      return new Response(JSON.stringify({ error: message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    await serviceClient
      .from("lead_invoices")
      .update({
        stripe_payment_intent_id: stripeJson.id,
        status: "SENT",
      })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({
        payment_intent_id: stripeJson.id,
        client_secret: stripeJson.client_secret,
        amount_cents: amountCents,
        currency,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
