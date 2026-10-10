import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getAuthRedirectUrl } from '../services/authRedirect';

const mocks = vi.hoisted(() => ({ signUp: vi.fn(), upsert: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock('../services/supabase', () => ({
  supabase: { auth: { signUp: mocks.signUp }, from: mocks.from, rpc: mocks.rpc },
  getOrgByCode: vi.fn(), getOrgIdByCode: vi.fn(),
}));
import { registerAuth } from '../services/api';

describe('signup account preservation', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.from.mockReturnValue({ upsert: mocks.upsert });
    mocks.upsert.mockResolvedValue({ error: null });
    mocks.rpc.mockResolvedValue({ data: 1, error: null });
  });

  it('does not overwrite an existing member when signup is retried', async () => {
    mocks.signUp.mockResolvedValue({ data: {}, error: { code: 'user_already_exists' } });
    await expect(registerAuth({ email: 'existing@example.com', password: 'test-only' })).rejects.toThrow('Log in');
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('creates a missing profile without replacing a profile initialized by the server', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: 'new-user', email: 'new@example.com' }, session: { access_token: 'test-token' } }, error: null });
    const result = await registerAuth({ email: ' NEW@example.com ', password: 'test-only' });
    expect(result.needsEmailConfirm).toBe(false);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-user' }), { onConflict: 'id', ignoreDuplicates: true });
  });

  it('waits for confirmation without attempting unauthenticated profile writes', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: { id: 'pending-user' }, session: null }, error: null });
    expect((await registerAuth({ email: 'new@example.com', password: 'test-only' })).needsEmailConfirm).toBe(true);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});

describe('native email redirects', () => {
  it('uses the public website for native confirmation and password recovery links', () => {
    expect(getAuthRedirectUrl('/', 'capacitor://localhost')).toBe('https://getaeraapp.com/');
    expect(getAuthRedirectUrl('/reset-password', 'capacitor://localhost')).toBe('https://getaeraapp.com/reset-password');
  });
  it('preserves a normal web origin', () => {
    expect(getAuthRedirectUrl('/reset-password', 'https://getaeraapp.com')).toBe('https://getaeraapp.com/reset-password');
  });
});
