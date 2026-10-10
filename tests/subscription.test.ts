import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NativePurchases } from '@capgo/native-purchases';
import {
  AERA_MONTHLY_SUBSCRIPTION_ID,
  hasOneMonthFreeTrial,
  isActiveSubscriptionTransaction,
  requiresIndividualAppleSubscription,
  getAppleSubscriptionEntitlement,
  loadMonthlySubscriptionProduct,
  purchaseMonthlySubscription,
  restoreMonthlySubscription,
} from '../services/subscription';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'ios' } }));
vi.mock('@capgo/native-purchases', () => ({
  PURCHASE_TYPE: { SUBS: 'subs' },
  NativePurchases: {
    isBillingSupported: vi.fn(), getProducts: vi.fn(), getPurchases: vi.fn(),
    purchaseProduct: vi.fn(), restorePurchases: vi.fn(),
  },
}));

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
    expect(requiresIndividualAppleSubscription({ ...profile, email: 'appreview.iap@getaeraapp.com' }, true)).toBe(true);
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

describe('native purchase and restoration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('restores a purchase using the uppercase UUID returned by StoreKit', async () => {
    vi.mocked(NativePurchases.getPurchases).mockImplementation(async options => ({
      purchases: options?.appAccountToken === profile.id.toUpperCase()
        ? [{ productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID, isActive: true } as any] : [],
    }));
    vi.mocked(NativePurchases.restorePurchases).mockResolvedValue(undefined);
    expect((await restoreMonthlySubscription(profile)).active).toBe(true);
    expect(NativePurchases.restorePurchases).toHaveBeenCalledOnce();
    expect(NativePurchases.getPurchases).toHaveBeenCalledWith(expect.objectContaining({ onlyCurrentEntitlements: true }));
    expect((await getAppleSubscriptionEntitlement(profile)).active).toBe(true);
  });

  it('associates a successful purchase with the same canonical account identifier', async () => {
    vi.mocked(NativePurchases.purchaseProduct).mockResolvedValue({ productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID, isActive: true } as any);
    expect((await purchaseMonthlySubscription(profile)).active).toBe(true);
    expect(NativePurchases.purchaseProduct).toHaveBeenCalledWith(expect.objectContaining({ appAccountToken: profile.id.toUpperCase() }));
  });

  it('does not unlock access from a pending or expired purchase', async () => {
    for (const transaction of [
      { purchaseState: '1' },
      { isActive: true, expirationDate: '2020-01-01T00:00:00Z' },
      { isActive: true, subscriptionState: 'expired' },
      { isActive: true, expirationDate: 'invalid' },
    ]) {
      vi.mocked(NativePurchases.purchaseProduct).mockResolvedValue({ productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID, ...transaction } as any);
      await expect(purchaseMonthlySubscription(profile)).rejects.toThrow('active subscription');
    }
  });

  it('rejects an unrelated product rather than showing the wrong price', async () => {
    vi.mocked(NativePurchases.isBillingSupported).mockResolvedValue({ isBillingSupported: true });
    vi.mocked(NativePurchases.getProducts).mockResolvedValue({ products: [{ identifier: 'unrelated.product' } as any] });
    await expect(loadMonthlySubscriptionProduct()).rejects.toThrow('not available');
  });

  it('loads the exact monthly product after a temporary store failure', async () => {
    vi.mocked(NativePurchases.isBillingSupported).mockResolvedValue({ isBillingSupported: true });
    const product = { identifier: AERA_MONTHLY_SUBSCRIPTION_ID, priceString: '$2.99' } as any;
    vi.mocked(NativePurchases.getProducts).mockRejectedValueOnce(new Error('Network offline')).mockResolvedValueOnce({ products: [product] });
    await expect(loadMonthlySubscriptionProduct()).rejects.toThrow('offline');
    await expect(loadMonthlySubscriptionProduct()).resolves.toEqual(product);
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
