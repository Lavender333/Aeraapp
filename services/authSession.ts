import { supabase } from './supabase';

type SignOutResult = {
  error: { message?: string } | null;
};

type SignOutAction = (options: { scope: 'local' }) => Promise<SignOutResult>;

export const signOutCurrentSession = async (
  signOut: SignOutAction = (options) => supabase.auth.signOut(options),
) => {
  const { error } = await signOut({ scope: 'local' });
  if (error) {
    throw new Error(error.message || 'Unable to log out. Please try again.');
  }
};
