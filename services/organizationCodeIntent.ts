const INTENT_KEY = 'aera.organizationCodeIntent';
const SESSION_CODE_KEY = 'aera.pendingOrganizationCode';
const DURABLE_CODE_KEY = 'aera.pendingOrganizationCode.v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

type StoredOrganizationCode = { code: string; createdAt: number };

const normalizeCode = (value: unknown) => String(value || '')
  .trim()
  .toUpperCase()
  .replace(/[–—−]/g, '-')
  .replace(/[^A-Z0-9-]/g, '')
  .replace(/-+/g, '-');

export const savePendingOrganizationCode = (code: string): string => {
  const normalized = normalizeCode(code);
  if (!normalized || typeof window === 'undefined') return normalized;

  window.sessionStorage.setItem(INTENT_KEY, '1');
  window.sessionStorage.setItem(SESSION_CODE_KEY, normalized);
  window.localStorage.setItem(DURABLE_CODE_KEY, JSON.stringify({
    code: normalized,
    createdAt: Date.now(),
  } satisfies StoredOrganizationCode));
  return normalized;
};

export const clearPendingOrganizationCode = (): void => {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(INTENT_KEY);
  window.sessionStorage.removeItem(SESSION_CODE_KEY);
  window.localStorage.removeItem(DURABLE_CODE_KEY);
};

export const getPendingOrganizationCode = (): string => {
  if (typeof window === 'undefined') return '';

  const sessionCode = normalizeCode(window.sessionStorage.getItem(SESSION_CODE_KEY));
  if (sessionCode) return sessionCode;

  try {
    const stored = JSON.parse(window.localStorage.getItem(DURABLE_CODE_KEY) || '') as Partial<StoredOrganizationCode>;
    const code = normalizeCode(stored.code);
    const createdAt = Number(stored.createdAt || 0);
    if (!code || !createdAt || Date.now() - createdAt > MAX_AGE_MS) {
      clearPendingOrganizationCode();
      return '';
    }

    window.sessionStorage.setItem(INTENT_KEY, '1');
    window.sessionStorage.setItem(SESSION_CODE_KEY, code);
    return code;
  } catch {
    clearPendingOrganizationCode();
    return '';
  }
};

export const hasPendingOrganizationCode = (): boolean => Boolean(getPendingOrganizationCode());
