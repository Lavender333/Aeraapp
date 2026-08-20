import React, { useCallback, useEffect, useState } from 'react';
import type { Product } from '@capgo/native-purchases';
import { Check, Loader2, RefreshCcw, ShieldCheck } from 'lucide-react';
import { UserProfile } from '../types';
import {
  AERA_PRIVACY_URL,
  AERA_SUPPORT_URL,
  APPLE_STANDARD_EULA_URL,
  getAppleSubscriptionEntitlement,
  hasOneMonthFreeTrial,
  loadMonthlySubscriptionProduct,
  purchaseMonthlySubscription,
  restoreMonthlySubscription,
} from '../services/subscription';

type Props = {
  profile: UserProfile;
  onSubscribed: () => void;
  onOpenAccountSettings: () => void;
};

const friendlyPurchaseError = (error: unknown) => {
  const message = String((error as any)?.message || error || '');
  if (/cancel/i.test(message)) return '';
  if (/network|offline|internet/i.test(message)) return 'Check your internet connection and try again.';
  return message || 'The purchase could not be completed. Please try again.';
};

export function SubscriptionView({ profile, onSubscribed, onOpenAccountSettings }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<'purchase' | 'restore' | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const entitlement = await getAppleSubscriptionEntitlement(profile);
      if (entitlement.active) {
        onSubscribed();
        return;
      }
      setProduct(await loadMonthlySubscriptionProduct());
    } catch (loadError) {
      setError(friendlyPurchaseError(loadError));
    } finally {
      setLoading(false);
    }
  }, [onSubscribed, profile]);

  useEffect(() => {
    void load();
  }, [load]);

  const purchase = async () => {
    setBusyAction('purchase');
    setError('');
    try {
      const entitlement = await purchaseMonthlySubscription(profile);
      if (entitlement.active) onSubscribed();
    } catch (purchaseError) {
      setError(friendlyPurchaseError(purchaseError));
    } finally {
      setBusyAction(null);
    }
  };

  const restore = async () => {
    setBusyAction('restore');
    setError('');
    try {
      const entitlement = await restoreMonthlySubscription(profile);
      if (entitlement.active) onSubscribed();
      else setError('No active AERA subscription was found for this Apple Account.');
    } catch (restoreError) {
      setError(friendlyPurchaseError(restoreError));
    } finally {
      setBusyAction(null);
    }
  };

  const includesTrial = hasOneMonthFreeTrial(product);
  const price = product?.priceString;

  return (
    <main className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-slate-50 px-5 py-8 flex items-center justify-center">
      <section className="w-full max-w-md rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/10">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <ShieldCheck size={30} aria-hidden="true" />
        </div>
        <p className="text-center text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">AERA Membership</p>
        <h1 className="mt-2 text-center text-2xl font-bold text-slate-900">Prepare, connect, and recover</h1>
        <p className="mt-2 text-center text-sm leading-6 text-slate-600">
          Keep your household readiness tools, trusted community updates, reporting, and recovery resources together.
        </p>

        <div className="my-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-center">
          {loading ? (
            <div className="flex min-h-20 items-center justify-center gap-2 text-sm font-semibold text-emerald-800">
              <Loader2 className="animate-spin" size={18} /> Checking the App Store…
            </div>
          ) : product ? (
            <>
              <p className="text-sm font-semibold text-emerald-900">{product.title || 'AERA Monthly'}</p>
              <p className="mt-1 text-3xl font-bold text-slate-900">
                {includesTrial ? '1 month free' : price}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {includesTrial ? `Then ${price} per month` : `${price} per month`}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-600">The App Store plan could not be loaded.</p>
          )}
        </div>

        <ul className="space-y-3 text-sm text-slate-700">
          {['Personalized readiness checklists', 'Trusted community information', 'Incident reporting and recovery resources'].map((benefit) => (
            <li key={benefit} className="flex gap-3">
              <span className="mt-0.5 rounded-full bg-emerald-100 p-0.5 text-emerald-700"><Check size={14} /></span>
              <span>{benefit}</span>
            </li>
          ))}
        </ul>

        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 px-3 py-2 text-center text-xs font-semibold text-red-700">{error}</p>}

        <button
          type="button"
          onClick={() => void purchase()}
          disabled={!product || loading || busyAction !== null}
          className="mt-6 flex min-h-12 w-full items-center justify-center rounded-xl bg-emerald-700 px-4 font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busyAction === 'purchase' && <Loader2 className="mr-2 animate-spin" size={18} />}
          {includesTrial ? 'Start my free month' : price ? `Subscribe for ${price}/month` : 'Continue'}
        </button>

        <button
          type="button"
          onClick={() => void restore()}
          disabled={loading || busyAction !== null}
          className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold text-emerald-800 disabled:opacity-50"
        >
          {busyAction === 'restore' ? <Loader2 className="mr-2 animate-spin" size={16} /> : <RefreshCcw className="mr-2" size={16} />}
          Restore Purchases
        </button>

        <p className="mt-4 text-center text-[11px] leading-5 text-slate-500">
          {includesTrial ? 'Free trial is available to eligible new subscribers. ' : ''}
          Payment is charged to your Apple Account. Subscription automatically renews monthly unless canceled at least 24 hours before the current period ends. Manage or cancel in your Apple Account settings.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] font-medium text-slate-500">
          <a href={APPLE_STANDARD_EULA_URL} target="_blank" rel="noreferrer" className="underline">Terms of Use</a>
          <span aria-hidden="true">•</span>
          <a href={AERA_PRIVACY_URL} target="_blank" rel="noreferrer" className="underline">Privacy Policy</a>
          <span aria-hidden="true">•</span>
          <a href={AERA_SUPPORT_URL} target="_blank" rel="noreferrer" className="underline">Support</a>
        </div>
        <button type="button" onClick={onOpenAccountSettings} className="mt-5 w-full text-center text-xs font-semibold text-slate-500 underline underline-offset-2">
          Account settings or close my account
        </button>
        <p className="mt-5 text-center text-[10px] text-slate-400">AERA is not a substitute for 911.</p>
      </section>
    </main>
  );
}
