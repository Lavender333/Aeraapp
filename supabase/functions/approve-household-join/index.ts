import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { join_request_id, action } = await req.json();
    const normalizedAction = String(action || "approved").toLowerCase();

    if (!join_request_id) {
      return new Response(JSON.stringify({ error: "join_request_id is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!["approved", "rejected"].includes(normalizedAction)) {
      return new Response(JSON.stringify({ error: "action must be approved or rejected" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase environment variables are missing" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization header is required" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAuthClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuthClient.auth.getUser();

    if (authError || !user?.id) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseServiceRoleKey,
      { auth: { persistSession: false } },
    );

    const { data, error } = await supabase.rpc("resolve_household_join_request", {
      p_join_request_id: join_request_id,
      p_action: normalizedAction,
      p_actor_id: user.id,
    });

    if (error) {
      const errorMessage = String(error.message || "");
      const missingResolveRpc =
        String((error as any).code || "") === "PGRST202" ||
        (errorMessage.includes("resolve_household_join_request") && errorMessage.toLowerCase().includes("does not exist"));

      if (!missingResolveRpc) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      if (normalizedAction === "rejected") {
        return new Response(JSON.stringify({ error: "Rejection requires migration 2026218150000_confirmation.sql (or 20260218150000_confirmation_based_household_join.sql)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      const { error: legacyError } = await supabase.rpc("approve_join_transaction", {
        p_join_request_id: join_request_id,
      });

      if (legacyError) {
        return new Response(JSON.stringify({ error: legacyError.message }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({
        success: true,
        data: {
          join_request_id,
          status: "approved",
          mode: "legacy_approve_join_transaction",
        },
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
