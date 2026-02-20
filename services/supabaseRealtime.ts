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
