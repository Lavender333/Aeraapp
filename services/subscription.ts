import { Capacitor } from '@capacitor/core';
import {
  NativePurchases,
  Product,
  PURCHASE_TYPE,
  Transaction,
} from '@capgo/native-purchases';
import { UserProfile } from '../types';

export const AERA_MONTHLY_SUBSCRIPTION_ID = 'com.aera.emergencyresponse.monthly';
export const AERA_PRIVACY_URL = 'https://getaeraapp.com/privacy/';
export const AERA_SUPPORT_URL = 'https://getaeraapp.com/support/';
export const APPLE_STANDARD_EULA_URL = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

const REVIEW_DEMO_EMAILS = new Set(['david@example.com']);
const INDIVIDUAL_ROLES = new Set(['GENERAL_USER', 'MEMBER']);

export type SubscriptionEntitlement = {
  active: boolean;
  isTrial: boolean;
  expiresAt?: string;
  willCancel: boolean;
  transaction?: Transaction;
};

export const isAppleSubscriptionDevice = () =>
  Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios';

/**
 * Organization-funded members, administrators, and the permanent App Review
 * demo account do not need an individual App Store subscription.
 */
export function requiresIndividualAppleSubscription(
  profile: Partial<UserProfile> | null | undefined,
  isAppleDevice = isAppleSubscriptionDevice(),
): boolean {
  if (!isAppleDevice || !profile?.id || profile.id === 'guest') return false;
  if (profile.onboardComplete === false) return false;

  const role = String(profile.role || 'GENERAL_USER').toUpperCase();
  const email = String(profile.email || '').trim().toLowerCase();
  if (!INDIVIDUAL_ROLES.has(role)) return false;
  if (REVIEW_DEMO_EMAILS.has(email)) return false;
  if (String(profile.communityId || '').trim()) return false;
  return true;
}

export function hasOneMonthFreeTrial(product: Product | null | undefined): boolean {
  const intro = product?.introductoryPrice;
  if (!intro || Number(intro.price) !== 0) return false;
  const period = intro.subscriptionPeriod;
  return Number(intro.numberOfPeriods || 0) === 1
    && Number(period?.numberOfUnits || 0) === 1
    && period?.unitString === 'month';
}

export function isActiveSubscriptionTransaction(transaction: Transaction): boolean {
  if (transaction.productIdentifier !== AERA_MONTHLY_SUBSCRIPTION_ID) return false;
  if (transaction.revocationDate || transaction.subscriptionState === 'revoked') return false;
  if (transaction.isInGracePeriod || transaction.subscriptionState === 'inGracePeriod') return true;
  if (transaction.isActive === true || transaction.subscriptionState === 'subscribed') return true;
  if (transaction.expirationDate) {
    return new Date(transaction.expirationDate).getTime() > Date.now();
  }
  return transaction.purchaseState === '1';
}

function appAccountToken(profile: Partial<UserProfile>): string | undefined {
  const id = String(profile.id || '').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)
    ? id
    : undefined;
}

export async function loadMonthlySubscriptionProduct(): Promise<Product> {
  const { isBillingSupported } = await NativePurchases.isBillingSupported();
  if (!isBillingSupported) throw new Error('App Store purchases are not available on this device.');

  const { products } = await NativePurchases.getProducts({
    productIdentifiers: [AERA_MONTHLY_SUBSCRIPTION_ID],
    productType: PURCHASE_TYPE.SUBS,
  });
  const product = products.find((item) => item.identifier === AERA_MONTHLY_SUBSCRIPTION_ID) || products[0];
  if (!product) {
    throw new Error('The AERA monthly plan is not available from the App Store yet. Please try again later.');
  }
  return product;
}

export async function getAppleSubscriptionEntitlement(
  profile: Partial<UserProfile>,
): Promise<SubscriptionEntitlement> {
  if (!isAppleSubscriptionDevice()) {
    return { active: true, isTrial: false, willCancel: false };
  }

  const { purchases } = await NativePurchases.getPurchases({
    productType: PURCHASE_TYPE.SUBS,
    appAccountToken: appAccountToken(profile),
    onlyCurrentEntitlements: true,
  });
  const transaction = purchases
    .filter(isActiveSubscriptionTransaction)
    .sort((a, b) => String(b.expirationDate || '').localeCompare(String(a.expirationDate || '')))[0];

  return {
    active: Boolean(transaction),
    isTrial: Boolean(transaction?.isTrialPeriod),
    expiresAt: transaction?.expirationDate,
    willCancel: Boolean(transaction?.willCancel),
    transaction,
  };
}

export async function purchaseMonthlySubscription(
  profile: Partial<UserProfile>,
): Promise<SubscriptionEntitlement> {
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: AERA_MONTHLY_SUBSCRIPTION_ID,
    productType: PURCHASE_TYPE.SUBS,
    quantity: 1,
    appAccountToken: appAccountToken(profile),
  });
  if (!isActiveSubscriptionTransaction(transaction)) {
    throw new Error('The App Store did not return an active subscription.');
  }
  return {
    active: true,
    isTrial: Boolean(transaction.isTrialPeriod),
    expiresAt: transaction.expirationDate,
    willCancel: Boolean(transaction.willCancel),
    transaction,
  };
}

export async function restoreMonthlySubscription(
  profile: Partial<UserProfile>,
): Promise<SubscriptionEntitlement> {
  await NativePurchases.restorePurchases();
  return getAppleSubscriptionEntitlement(profile);
}

export const manageAppleSubscription = () => NativePurchases.manageSubscriptions();
