import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = 'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY';

if (!hasSupabaseConfig) {
  console.warn(supabaseConfigMessage);
}

export const supabase: SupabaseClient = createClient(
  hasSupabaseConfig ? supabaseUrl! : 'https://example.supabase.co',
  hasSupabaseConfig ? supabaseAnonKey! : 'public-anon-key',
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export type OrgLookup = {
  orgId: string;
  orgCode: string;
  orgName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

export async function getOrgByCode(orgCode: string): Promise<OrgLookup | null> {
  const normalized = orgCode
    ?.trim()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!normalized) return null;

  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized);

  let data: any = null;
  let error: any = null;

  if (isUuid) {
    ({ data, error } = await supabase
      .from('organizations')
      .select('id, org_code, name, latitude, longitude')
      .eq('id', normalized)
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from('organizations')
      .select('id, org_code, name, latitude, longitude')
      .eq('org_code', normalized)
      .maybeSingle());
  }

  // Backward-compat fallback for records that were saved with the opposite identifier shape.
  if (!data && !error) {
    if (isUuid) {
      ({ data, error } = await supabase
        .from('organizations')
        .select('id, org_code, name, latitude, longitude')
        .eq('org_code', normalized)
        .maybeSingle());
    } else {
      ({ data, error } = await supabase
        .from('organizations')
        .select('id, org_code, name, latitude, longitude')
        .eq('id', normalized)
        .maybeSingle());
    }
  }

  if (error || !data) return null;
  return {
    orgId: data.id,
    orgCode: data.org_code,
    orgName: data.name,
    latitude: data.latitude == null ? null : Number(data.latitude),
    longitude: data.longitude == null ? null : Number(data.longitude),
  };
}

export async function getOrgIdByCode(orgCode: string): Promise<string | null> {
  const org = await getOrgByCode(orgCode);
  return org?.orgId || null;
}
