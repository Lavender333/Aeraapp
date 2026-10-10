import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

export const COMMERCIAL_FEATURES = ['LEADS', 'BUYERS', 'FINANCE'] as const;
export type CommercialFeature = (typeof COMMERCIAL_FEATURES)[number];

export type CommercialAccessGrant = {
  userId: string;
  organizationId: string;
  feature: CommercialFeature;
  canManage: boolean;
  grantedAt?: string;
};

const normalizeFeature = (value: unknown): CommercialFeature | null => {
  const normalized = String(value || '').toUpperCase();
  return COMMERCIAL_FEATURES.includes(normalized as CommercialFeature)
    ? (normalized as CommercialFeature)
    : null;
};

export async function getMyCommercialAccess(): Promise<Set<CommercialFeature>> {
  const { data, error } = await supabase.rpc('get_my_commercial_access');
  if (error) {
    // Until the migration is deployed, fail closed for every non-platform user.
    console.warn('Commercial access could not be loaded:', error.message);
    return new Set();
  }

  const features = new Set<CommercialFeature>();
  for (const row of data || []) {
    const feature = normalizeFeature((row as any).feature);
    if (feature) features.add(feature);
  }
  return features;
}

export function useMyCommercialAccess() {
  const [features, setFeatures] = useState<Set<CommercialFeature>>(new Set());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setFeatures(await getMyCommercialAccess());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const { data: listener } = supabase.auth.onAuthStateChange(() => void refresh());
    const handleChanged = () => void refresh();
    window.addEventListener('commercial-access-changed', handleChanged);
    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener('commercial-access-changed', handleChanged);
    };
  }, [refresh]);

  return useMemo(() => ({ features, loading, refresh }), [features, loading, refresh]);
}

export async function listOrganizationCommercialAccess(
  organizationId: string
): Promise<CommercialAccessGrant[]> {
  const { data, error } = await supabase.rpc('list_organization_commercial_access', {
    p_organization_id: organizationId,
  });
  if (error) throw new Error(error.message || 'Unable to load commercial access');

  return (data || []).flatMap((row: any) => {
    const feature = normalizeFeature(row.feature);
    if (!feature) return [];
    return [{
      userId: String(row.user_id || ''),
      organizationId: String(row.organization_id || organizationId),
      feature,
      canManage: Boolean(row.can_manage),
      grantedAt: row.granted_at ? String(row.granted_at) : undefined,
    }];
  });
}

export async function setOrganizationCommercialAccess(input: {
  organizationId: string;
  userId: string;
  feature: CommercialFeature;
  enabled: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('set_organization_commercial_access', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_feature: input.feature,
    p_enabled: input.enabled,
  });
  if (error) throw new Error(error.message || 'Unable to update commercial access');
  window.dispatchEvent(new Event('commercial-access-changed'));
}
