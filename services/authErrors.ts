type AuthFailure = {
  code?: unknown;
  message?: unknown;
  status?: unknown;
};

const readAuthFailure = (error: unknown) => {
  const failure = (error || {}) as AuthFailure;
  return {
    code: String(failure.code || '').toLowerCase(),
    message: String(failure.message || error || '').trim(),
    status: Number(failure.status || 0),
  };
};

export const isExistingAccountError = (error: unknown): boolean => {
  const { code, message } = readAuthFailure(error);
  return (
    code === 'user_already_exists' ||
    /already registered|already been registered|already exists/i.test(message)
  );
};

export const getSignupErrorMessage = (error: unknown): string => {
  const { code, message, status } = readAuthFailure(error);

  if (
    status === 429 ||
    code.includes('rate_limit') ||
    /rate limit|too many requests|request rate/i.test(message)
  ) {
    return 'Account creation is temporarily busy. Wait one minute and try once. If you already created this account, choose Log In.';
  }

  if (isExistingAccountError(error)) {
    return 'That email already has an account. Log in or reset your password.';
  }

  if (/failed to fetch|network|offline|load failed/i.test(message)) {
    return 'Unable to reach the account service. Check your connection and try again.';
  }

  return message || 'Unable to create your account. Please try again.';
};

export const getConfirmationErrorMessage = (error: unknown): string => {
  const { code, message, status } = readAuthFailure(error);

  if (
    status === 429 ||
    code.includes('rate_limit') ||
    /rate limit|too many requests|request rate/i.test(message)
  ) {
    return 'A confirmation was already requested. Wait one minute before requesting another email.';
  }

  if (/failed to fetch|network|offline|load failed/i.test(message)) {
    return 'Unable to reach the account service. Check your connection and try again.';
  }

  return message || 'Unable to resend the confirmation email.';
};
