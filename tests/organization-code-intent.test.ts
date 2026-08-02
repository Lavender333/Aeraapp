import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearPendingOrganizationCode,
  getPendingOrganizationCode,
  hasPendingOrganizationCode,
  savePendingOrganizationCode,
} from '../services/organizationCodeIntent';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

describe('pending organization code registration', () => {
  beforeEach(() => {
    vi.stubGlobal('window', {
      sessionStorage: new MemoryStorage(),
      localStorage: new MemoryStorage(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('restores the code when email confirmation opens a new tab', () => {
    savePendingOrganizationCode(' ab–123 ');
    window.sessionStorage.clear();

    expect(getPendingOrganizationCode()).toBe('AB-123');
    expect(window.sessionStorage.getItem('aera.pendingOrganizationCode')).toBe('AB-123');
    expect(hasPendingOrganizationCode()).toBe(true);
  });

  it('removes the code after successful redemption', () => {
    savePendingOrganizationCode('AB-123');
    clearPendingOrganizationCode();

    expect(getPendingOrganizationCode()).toBe('');
    expect(hasPendingOrganizationCode()).toBe(false);
  });
});
