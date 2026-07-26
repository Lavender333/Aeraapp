import { describe, expect, it, vi } from 'vitest';
import { signOutCurrentSession } from '../services/authSession';

describe('auth session logout', () => {
  it('ends the local Supabase session', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    await signOutCurrentSession(signOut);

    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('does not report logout success when Supabase rejects it', async () => {
    const signOut = vi.fn().mockResolvedValue({
      error: { message: 'Session could not be ended.' },
    });

    await expect(signOutCurrentSession(signOut)).rejects.toThrow(
      'Session could not be ended.',
    );
  });
});
