import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const fallbackSupabaseUrl = 'https://zghyxeeietqubodgplgo.supabase.co';
const fallbackSupabaseAnonKey = 'sb_publishable_nUDmo_Mi3q8lwmmHaeth2Q_tlerDnHb';

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

const supabaseUrl = envSupabaseUrl || fallbackSupabaseUrl;
const supabaseAnonKey = envSupabaseAnonKey || fallbackSupabaseAnonKey;

export const hasUserSupabaseConfig = Boolean(envSupabaseUrl && envSupabaseAnonKey);
export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = hasUserSupabaseConfig
  ? 'Using provided Supabase environment variables.'
  : 'Using bundled Supabase project; set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to override.';

if (!hasUserSupabaseConfig) {
  console.info('Supabase env not set; falling back to bundled project.');
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
