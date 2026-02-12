// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type FeedFeature = {
  id?: string;
  properties?: Record<string, any>;
  geometry?: any;
};

const toSeverity = (value?: string) => {
  const v = String(value || "").toUpperCase();
  if (v.includes("EXTREME") || v.includes("SEVERE")) return "CRITICAL";
  if (v.includes("MODERATE") || v.includes("WATCH")) return "WARNING";
  return "INFO";
};

const normalizeFeature = (source: string, feature: FeedFeature) => {
  const p = feature.properties || {};
  return {
    external_alert_id: String(feature.id || p.id || p.identifier || crypto.randomUUID()),
    source,
    event_type: String(p.event || p.event_type || p.category || "GENERAL"),
    severity: toSeverity(p.severity || p.urgency),
    headline: String(p.headline || p.title || p.event || "Emergency Alert"),
    description: String(p.description || p.summary || ""),
    effective_at: p.effective || p.sent || null,
    expires_at: p.expires || null,
    county_id: p.county_id || p.county || null,
    state_id: p.state_id || p.state || null,
    metadata: {
      raw_properties: p,
      geometry_type: feature.geometry?.type || null,
    },
  };
};

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Supabase service credentials missing" }), { status: 500 });
    }

    const noaaUrl = Deno.env.get("NOAA_ALERTS_URL") || "https://api.weather.gov/alerts/active";
    const femaUrl = Deno.env.get("FEMA_ALERTS_URL");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const feeds = [
      { source: "NOAA", url: noaaUrl },
      ...(femaUrl ? [{ source: "FEMA", url: femaUrl }] : []),
    ];

    const allRows: any[] = [];

    for (const feed of feeds) {
      const response = await fetch(feed.url, { headers: { "User-Agent": "aera-state-ready/1.0" } });
      if (!response.ok) {
        console.warn(`Failed to fetch ${feed.source} feed`, await response.text());
        continue;
      }

      const payload = await response.json();
      const features = Array.isArray(payload?.features)
        ? (payload.features as FeedFeature[])
        : Array.isArray(payload)
          ? (payload as FeedFeature[])
          : [];

      for (const feature of features) {
        allRows.push(normalizeFeature(feed.source, feature));
      }
    }

    if (allRows.length === 0) {
      return new Response(JSON.stringify({ ok: true, inserted: 0 }), { status: 200 });
    }

    const { data, error } = await supabase
      .from("alerts")
      .upsert(allRows, { onConflict: "source,external_alert_id" })
      .select("id");

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify({ ok: true, inserted: data?.length || 0 }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
