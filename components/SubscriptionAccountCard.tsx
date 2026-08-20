import React, { useCallback, useEffect, useState } from 'react';
import type { Product } from '@capgo/native-purchases';
import { CreditCard, Loader2, RefreshCcw } from 'lucide-react';
import { UserProfile } from '../types';
import {
  getAppleSubscriptionEntitlement,
  hasOneMonthFreeTrial,
  isAppleSubscriptionDevice,
  loadMonthlySubscriptionProduct,
  manageAppleSubscription,
  requiresIndividualAppleSubscription,
  restoreMonthlySubscription,
  SubscriptionEntitlement,
} from '../services/subscription';

type Props = {
  profile: UserProfile;
  onChoosePlan: () => void;
};

export function SubscriptionAccountCard({ profile, onChoosePlan }: Props) {
  const [product, setProduct] = useState<Product | null>(null);
  const [entitlement, setEntitlement] = useState<SubscriptionEntitlement | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<'restore' | 'manage' | null>(null);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [access, storeProduct] = await Promise.all([
        getAppleSubscriptionEntitlement(profile),
        loadMonthlySubscriptionProduct(),
      ]);
      setEntitlement(access);
      setProduct(storeProduct);
    } catch (error) {
      setMessage(String((error as any)?.message || 'Unable to check the App Store right now.'));
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isAppleSubscriptionDevice() || !requiresIndividualAppleSubscription(profile, true)) return null;

  const restore = async () => {
    setBusy('restore');
    setMessage('');
    try {
      const restored = await restoreMonthlySubscription(profile);
      setEntitlement(restored);
      setMessage(restored.active ? 'Your AERA subscription has been restored.' : 'No active subscription was found for this Apple Account.');
    } catch (error) {
      setMessage(String((error as any)?.message || 'Purchases could not be restored.'));
    } finally {
      setBusy(null);
    }
  };

  const manage = async () => {
    setBusy('manage');
    setMessage('');
    try {
      await manageAppleSubscription();
    } catch (error) {
      setMessage(String((error as any)?.message || 'Subscription settings could not be opened.'));
    } finally {
      setBusy(null);
    }
  };

  const renewalDate = entitlement?.expiresAt
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(entitlement.expiresAt))
    : '';

  return (
    <section className="order-8 rounded-2xl border border-emerald-200 bg-white/95 p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="rounded-xl bg-emerald-100 p-2 text-emerald-700"><CreditCard size={20} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-700">AERA Membership</p>
          {loading ? (
            <p className="mt-1 flex items-center gap-2 text-sm text-slate-600"><Loader2 className="animate-spin" size={14} /> Checking status…</p>
          ) : entitlement?.active ? (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-900">{entitlement.isTrial ? 'Free trial active' : 'Subscription active'}</p>
              {renewalDate && (
                <p className="mt-0.5 text-xs text-slate-500">
                  {entitlement.willCancel ? `Access continues until ${renewalDate}.` : `Renews ${renewalDate}.`}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm font-semibold text-slate-900">Individual membership required</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {hasOneMonthFreeTrial(product) ? `One month free, then ${product?.priceString}/month.` : product ? `${product.priceString}/month.` : 'View the App Store plan.'}
              </p>
            </>
          )}
        </div>
      </div>

      {message && <p role="status" className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">{message}</p>}

      <div className="mt-4 grid grid-cols-2 gap-2">
        {entitlement?.active ? (
          <button type="button" onClick={() => void manage()} disabled={busy !== null} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
            {busy === 'manage' ? 'Opening…' : 'Manage Plan'}
          </button>
        ) : (
          <button type="button" onClick={onChoosePlan} disabled={loading} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-semibold text-white disabled:opacity-50">
            View Plan
          </button>
        )}
        <button type="button" onClick={() => void restore()} disabled={loading || busy !== null} className="flex min-h-11 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-sm font-semibold text-emerald-800 disabled:opacity-50">
          {busy === 'restore' ? <Loader2 className="mr-2 animate-spin" size={15} /> : <RefreshCcw className="mr-2" size={15} />}
          Restore
        </button>
      </div>
    </section>
  );
}
