import { supabase } from './supabase';
import { deactivatePushNotificationsForCurrentUser } from './pushNotifications';

type SignOutResult = {
  error: { message?: string } | null;
};

type SignOutAction = (options: { scope: 'local' }) => Promise<SignOutResult>;

export const signOutCurrentSession = async (
  signOut: SignOutAction = (options) => supabase.auth.signOut(options),
) => {
  await deactivatePushNotificationsForCurrentUser().catch((error) => {
    console.warn('Unable to deactivate this device push token during logout', error);
  });
  const { error } = await signOut({ scope: 'local' });
  if (error) {
    throw new Error(error.message || 'Unable to log out. Please try again.');
  }
};
