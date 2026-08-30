import { describe, expect, it } from 'vitest';
import {
  getConfirmationErrorMessage,
  getSignupErrorMessage,
  isExistingAccountError,
} from '../services/authErrors';

describe('authentication error messages', () => {
  it('does not expose the provider email-rate-limit message during signup', () => {
    const message = getSignupErrorMessage({
      code: 'over_email_send_rate_limit',
      message: 'email rate limit exceeded',
      status: 429,
    });

    expect(message).toContain('temporarily busy');
    expect(message).toContain('Log In');
    expect(message).not.toContain('email rate limit exceeded');
  });

  it('recognizes duplicate-account responses across provider variants', () => {
    expect(isExistingAccountError({ code: 'user_already_exists' })).toBe(true);
    expect(isExistingAccountError({ message: 'User already registered' })).toBe(true);
    expect(getSignupErrorMessage({ message: 'User already registered' })).toContain('already has an account');
  });

  it('gives confirmation retries a clear cooldown', () => {
    expect(getConfirmationErrorMessage({ status: 429, message: 'Too many requests' }))
      .toBe('A confirmation was already requested. Wait one minute before requesting another email.');
  });

  it('turns network failures into an actionable message', () => {
    expect(getSignupErrorMessage(new Error('Failed to fetch')))
      .toBe('Unable to reach the account service. Check your connection and try again.');
  });
});
