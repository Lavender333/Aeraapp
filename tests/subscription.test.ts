import { describe, expect, it } from 'vitest';
import {
  AERA_MONTHLY_SUBSCRIPTION_ID,
  hasOneMonthFreeTrial,
  isActiveSubscriptionTransaction,
  requiresIndividualAppleSubscription,
} from '../services/subscription';

const profile = {
  id: '9bfe7c9d-5301-4acb-9df4-38fbd4b72895',
  role: 'GENERAL_USER' as const,
  email: 'member@example.com',
  communityId: '',
  onboardComplete: true,
};

describe('individual Apple subscription access', () => {
  it('requires a subscription for an individual iOS member', () => {
    expect(requiresIndividualAppleSubscription(profile, true)).toBe(true);
  });

  it('does not charge organization-sponsored members or the review account', () => {
    expect(requiresIndividualAppleSubscription({ ...profile, communityId: 'NG-1001' }, true)).toBe(false);
    expect(requiresIndividualAppleSubscription({ ...profile, email: 'david@example.com' }, true)).toBe(false);
  });

  it('allows account setup to finish before presenting the membership offer', () => {
    expect(requiresIndividualAppleSubscription({ ...profile, onboardComplete: false }, true)).toBe(false);
  });

  it('does not apply the Apple paywall outside the native iOS app', () => {
    expect(requiresIndividualAppleSubscription(profile, false)).toBe(false);
  });
});

describe('App Store subscription metadata', () => {
  it('recognizes the configured one-month free trial', () => {
    expect(hasOneMonthFreeTrial({
      introductoryPrice: {
        price: 0,
        numberOfPeriods: 1,
        subscriptionPeriod: { numberOfUnits: 1, unit: 2, unitString: 'month' },
      },
    } as any)).toBe(true);
  });

  it('accepts active and grace-period StoreKit entitlements but rejects revoked ones', () => {
    expect(isActiveSubscriptionTransaction({
      productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID,
      isActive: true,
    } as any)).toBe(true);
    expect(isActiveSubscriptionTransaction({
      productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID,
      subscriptionState: 'inGracePeriod',
    } as any)).toBe(true);
    expect(isActiveSubscriptionTransaction({
      productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID,
      isActive: true,
      revocationDate: new Date().toISOString(),
    } as any)).toBe(false);
  });
});
