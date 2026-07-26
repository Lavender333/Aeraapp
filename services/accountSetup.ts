const NEW_ACCOUNT_SETUP_KEY = 'aera.newAccountSetupPending';

const normalizeEmail = (email?: string | null) => String(email || '').trim().toLowerCase();

export const markNewAccountSetupPending = (email?: string | null) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return;
  localStorage.setItem(NEW_ACCOUNT_SETUP_KEY, normalizedEmail);
};

export const clearNewAccountSetupPending = () => {
  localStorage.removeItem(NEW_ACCOUNT_SETUP_KEY);
};

export const shouldCompleteNewAccountSetup = (
  email?: string | null,
  onboardComplete = false,
) => {
  if (onboardComplete) {
    clearNewAccountSetupPending();
    return false;
  }

  const normalizedEmail = normalizeEmail(email);
  return Boolean(
    normalizedEmail &&
    localStorage.getItem(NEW_ACCOUNT_SETUP_KEY) === normalizedEmail,
  );
};
