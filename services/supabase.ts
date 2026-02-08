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
