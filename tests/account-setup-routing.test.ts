import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNewAccountSetupPending,
  markNewAccountSetupPending,
  shouldCompleteNewAccountSetup,
} from '../services/accountSetup';

describe('account setup routing', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    });
  });

  it('does not send an existing account through setup based only on missing profile fields', () => {
    expect(shouldCompleteNewAccountSetup('existing@example.com', false)).toBe(false);
  });

  it('resumes setup for the account that was just created', () => {
    markNewAccountSetupPending('New@Example.com');
    expect(shouldCompleteNewAccountSetup('new@example.com', false)).toBe(true);
    expect(shouldCompleteNewAccountSetup('someone@example.com', false)).toBe(false);
  });

  it('clears the pending marker after setup is complete', () => {
    markNewAccountSetupPending('new@example.com');
    expect(shouldCompleteNewAccountSetup('new@example.com', true)).toBe(false);
    expect(shouldCompleteNewAccountSetup('new@example.com', false)).toBe(false);
  });

  it('can clear a pending setup explicitly', () => {
    markNewAccountSetupPending('new@example.com');
    clearNewAccountSetupPending();
    expect(shouldCompleteNewAccountSetup('new@example.com', false)).toBe(false);
  });
});
