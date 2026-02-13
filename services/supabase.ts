import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Fallback Supabase project for demos/previews; override with env vars for production use.
// Managed by AERA team; if rotated, update env or this constant.
const fallbackSupabaseUrl = 'https://zghyxeeietqubodgplgo.supabase.co';
// Note: anon (publishable) key is safe for client use.
// Demo key is intentionally committed to unblock QA; replace/rotate for production.
// This shared fallback relies on Row Level Security (RLS); override/rotate via env for stricter isolation.
const fallbackSupabaseAnonKey = 'sb_publishable_nUDmo_Mi3q8lwmmHaeth2Q_tlerDnHb';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasUserSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseAnonKey);
const supabaseUrl = envSupabaseUrl || fallbackSupabaseUrl;
const supabaseAnonKey = envSupabaseAnonKey || fallbackSupabaseAnonKey;
const usingFallback = !hasUserSupabaseConfig;
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = hasUserSupabaseConfig
  ? 'Using provided Supabase environment variables.'
  : 'Using bundled Supabase project; set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to override.';

if (usingFallback) {
  console.warn('Supabase env not set; using bundled demo credentials—replace for production.');
}

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
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
};

export async function getOrgByCode(orgCode: string): Promise<OrgLookup | null> {
  const normalized = orgCode
    ?.trim()
    .replace(/[–—−]/g, '-')
    .replace(/\s+/g, '')
    .toUpperCase();
  if (!normalized) return null;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, org_code, name')
    .eq('org_code', normalized)
    .single();

  if (error || !data) return null;
  return { orgId: data.id, orgCode: data.org_code, orgName: data.name };
}

export async function getOrgIdByCode(orgCode: string): Promise<string | null> {
  const org = await getOrgByCode(orgCode);
  return org?.orgId || null;
}
