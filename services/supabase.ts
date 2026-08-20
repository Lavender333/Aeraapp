import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseConfig = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigMessage = 'Missing Supabase environment variables: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY';

if (!hasSupabaseConfig) {
  console.warn(supabaseConfigMessage);
}

const getSecureBrowserAuthStorage = (): Storage | undefined => {
  if (typeof window === 'undefined') return undefined;

  try {
    // Older builds persisted Supabase sessions in localStorage. Remove those
    // legacy copies before switching to tab-scoped session storage.
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key && /^sb-.*-auth-token$/i.test(key)) {
        window.localStorage.removeItem(key);
      }
    }

    const probeKey = '__aera_session_storage_probe__';
    window.sessionStorage.setItem(probeKey, '1');
    window.sessionStorage.removeItem(probeKey);
    return window.sessionStorage;
  } catch {
    // Supabase can operate without persistent browser storage in locked-down
    // browser contexts. Never fall back to long-lived localStorage.
    return undefined;
  }
};

export const supabase: SupabaseClient = createClient(
  hasSupabaseConfig ? supabaseUrl! : 'https://example.supabase.co',
  hasSupabaseConfig ? supabaseAnonKey! : 'public-anon-key',
  {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    storage: getSecureBrowserAuthStorage(),
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
  showGapCenterToMembers: boolean;
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

  const extendedColumns = 'id, org_code, name, latitude, longitude, show_gap_center_to_members';
  const legacyColumns = 'id, org_code, name, latitude, longitude';

  if (isUuid) {
    ({ data, error } = await supabase
      .from('organizations')
      .select(extendedColumns)
      .eq('id', normalized)
      .maybeSingle());
  } else {
    ({ data, error } = await supabase
      .from('organizations')
      .select(extendedColumns)
      .eq('org_code', normalized)
      .maybeSingle());
  }

  // Keep older environments usable until the visibility migration is applied.
  if (error && /show_gap_center_to_members|column .* does not exist|schema cache/i.test(String(error.message || ''))) {
    if (isUuid) {
      ({ data, error } = await supabase
        .from('organizations')
        .select(legacyColumns)
        .eq('id', normalized)
        .maybeSingle());
    } else {
      ({ data, error } = await supabase
        .from('organizations')
        .select(legacyColumns)
        .eq('org_code', normalized)
        .maybeSingle());
    }
  }

  // Backward-compat fallback for records that were saved with the opposite identifier shape.
  if (!data && !error) {
    if (isUuid) {
      ({ data, error } = await supabase
        .from('organizations')
        .select(extendedColumns)
        .eq('org_code', normalized)
        .maybeSingle());
    } else {
      ({ data, error } = await supabase
        .from('organizations')
        .select(extendedColumns)
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
    showGapCenterToMembers: Boolean(data.show_gap_center_to_members),
  };
}

export async function getOrgIdByCode(orgCode: string): Promise<string | null> {
  const org = await getOrgByCode(orgCode);
  return org?.orgId || null;
}
