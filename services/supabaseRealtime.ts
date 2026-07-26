import { supabase } from './supabaseClient';

export const subscribeToBroadcasts = async (orgId: string, onMessage: (payload: any) => void) => {
  const channel = supabase
    .channel(`broadcasts:${orgId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'broadcasts', filter: `org_id=eq.${orgId}` },
      (payload) => onMessage(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToInventory = async (orgId: string, onChange: (payload: any) => void) => {
  const channel = supabase
    .channel(`inventory:${orgId}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'inventory', filter: `org_id=eq.${orgId}` },
      (payload) => onChange(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToNotifications = async (onNotification: (payload: any) => void) => {
  const channel = supabase
    .channel('notifications')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'notifications' },
      (payload) => onNotification(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

export const subscribeToOrganizationAccess = async (
  organizationId: string,
  onChange: (payload: any) => void,
) => {
  const channel = supabase
    .channel(`organization-access:${organizationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'organization_codes',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => onChange(payload),
    )
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'memberships',
        filter: `organization_id=eq.${organizationId}`,
      },
      (payload) => onChange(payload),
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
