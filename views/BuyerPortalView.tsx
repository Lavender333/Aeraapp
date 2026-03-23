/**
 * Buyer Portal View — screen for lead buyers to:
 *  - Review and act on verified leads (accept / reject)
 *  - Submit disputes with reason codes
 *  - View billing / pricing tiers / wallet balance
 *  - Browse reporting KPIs
 *  - Manage buyer account settings
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ClipboardList,
  CreditCard,
  Filter,
  LifeBuoy,
  Settings,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StorageService } from '../services/storage';
import { BuyerAccount, ViewState, DEFAULT_LEAD_PRICING, DisputeReason } from '../types';
import {
  SAMPLE_LEADS,
  SAMPLE_BUYERS,
  getLeadPrice,
  isDisputeWindowOpen,
  evaluateDispute,
  weeklyReconciliation,
} from '../services/leadService';
import {
  createLeadDispute,
  createStripePaymentIntentViaSupabase,
  fetchBuyerAccounts,
  fetchVerifiedLeads,
  updateLeadRecord,
} from '../services/leadSupabase';

type BuyerPortalTab = 'LEADS' | 'DISPUTES' | 'BILLING' | 'REPORTING' | 'SETTINGS';

const SEVERITY_BADGE: Record<string, string> = {
  HIGH:   'bg-rose-100 text-rose-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  LOW:    'bg-slate-100 text-slate-600',
};

const STATUS_BADGE: Record<string, string> = {
  NEW:       'bg-blue-100 text-blue-700',
  VERIFIED:  'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-violet-100 text-violet-700',
  ACCEPTED:  'bg-emerald-100 text-emerald-700',
  REJECTED:  'bg-rose-100 text-rose-700',
  REFUNDED:  'bg-slate-200 text-slate-600',
};

const fmt$ = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const fmtPct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';

interface BuyerPortalViewProps {
  setView: (view: ViewState) => void;
}

const demoBuyer = SAMPLE_BUYERS[0];

interface DisputeForm {
  leadId: string;
  reason: DisputeReason;
  notes: string;
}

const DISPUTE_REASONS: Array<{ value: DisputeReason; label: string; credit: string }> = [
  { value: 'DUPLICATE',        label: 'Duplicate Submission',          credit: '100%' },
  { value: 'INVALID_CONTACT',  label: 'Invalid / Disconnected Contact', credit: '100%' },
  { value: 'OUT_OF_SERVICE_AREA', label: 'Out of Service Area',        credit: '100%' },
  { value: 'CONSENT_ISSUE',    label: 'No Valid Consent',              credit: '100%' },
  { value: 'ALREADY_CLIENT',   label: 'Already a Client',             credit: '75%'  },
  { value: 'OTHER',            label: 'Other (Reviewed)',              credit: '50%'  },
];

export const BuyerPortalView: React.FC<BuyerPortalViewProps> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const [activeTab, setActiveTab] = useState<BuyerPortalTab>('LEADS');
  const [leads, setLeads]         = useState(SAMPLE_LEADS);
  const [buyerAccount, setBuyerAccount] = useState<BuyerAccount>(demoBuyer);
  const [disputes, setDisputes]   = useState<Array<DisputeForm & { id: string; submittedAt: string; creditPct: number }>>([]);
  const [disputeForm, setDisputeForm] = useState<DisputeForm>({ leadId: '', reason: 'DUPLICATE', notes: '' });
  const [showDisputeFlow, setShowDisputeFlow] = useState(false);
  const [walletBalance, setWalletBalance] = useState(demoBuyer.walletBalanceCents);
  const [isPaying, setIsPaying] = useState(false);

  const buyerName     = profile?.communityId || profile?.fullName || buyerAccount.orgName;
  const acceptedLeads = useMemo(() => leads.filter((l) => l.status === 'ACCEPTED'),  [leads]);
  const inboxLeads    = useMemo(() => leads.filter((l) => ['DELIVERED','NEW','VERIFIED'].includes(l.status)), [leads]);
  const recon         = useMemo(() => weeklyReconciliation(leads), [leads]);
  const totalOwed     = useMemo(
    () => acceptedLeads.reduce((sum, l) => sum + getLeadPrice(l.tier) * 100, 0),
    [acceptedLeads],
  );

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const [leadRows, buyerRows] = await Promise.all([
        fetchVerifiedLeads(),
        fetchBuyerAccounts(),
      ]);
      if (!mounted) return;

      const preferredBuyer = buyerRows[0] || demoBuyer;
      setBuyerAccount(preferredBuyer);
      setWalletBalance(preferredBuyer.walletBalanceCents);
      setLeads(leadRows);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const acceptLead = (leadId: string) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: 'ACCEPTED' } : l));
    const lead = leads.find((l) => l.id === leadId);
    if (lead) setWalletBalance((b) => Math.max(0, b - getLeadPrice(lead.tier) * 100));
    void updateLeadRecord(leadId, { status: 'ACCEPTED' });
  };

  const rejectLead = (leadId: string) => {
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: 'REJECTED' } : l));
    void updateLeadRecord(leadId, { status: 'REJECTED', rejectionReason: 'Rejected by buyer' });
  };

  const submitDispute = async () => {
    const { leadId, reason, notes } = disputeForm;
    if (!leadId || !notes.trim()) return;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead) return;
    const { valid, creditPercent } = evaluateDispute(reason, lead, isDisputeWindowOpen(lead));
    if (!valid) return;
    const creditPct = creditPercent / 100;
    const creditCents = lead ? Math.round(getLeadPrice(lead.tier) * 100 * creditPct) : 0;
    await createLeadDispute({
      leadId,
      buyerId: buyerAccount.id,
      reason,
      notes,
      creditIssuedCents: creditCents,
    });
    setDisputes((prev) => [
      ...prev,
      { id: `DSP-${Date.now()}`, leadId, reason, notes, submittedAt: new Date().toISOString(), creditPct },
    ]);
    if (creditCents > 0) setWalletBalance((b) => b + creditCents);
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: 'REFUNDED' } : l));
    void updateLeadRecord(leadId, { status: 'REFUNDED', creditIssued: true, resolvedAt: new Date().toISOString() });
    setDisputeForm({ leadId: '', reason: 'DUPLICATE', notes: '' });
    setShowDisputeFlow(false);
  };

  const handleStripePay = async () => {
    if (acceptedLeads.length === 0 || totalOwed <= 0) return;
    setIsPaying(true);
    try {
      const invoiceId = `INV-${Date.now()}`;
      const res = await createStripePaymentIntentViaSupabase(invoiceId, totalOwed, buyerAccount.contactEmail);
      window.alert(`Payment intent created: ${res.paymentIntentId}`);
    } finally {
      setIsPaying(false);
    }
  };

  const tabs: Array<{ id: BuyerPortalTab; label: string; icon: React.ReactNode }> = [
    { id: 'LEADS',     label: 'Lead Inbox', icon: <ClipboardList size={15} /> },
    { id: 'DISPUTES',  label: 'Disputes',   icon: <LifeBuoy size={15} /> },
    { id: 'BILLING',   label: 'Billing',    icon: <CreditCard size={15} /> },
    { id: 'REPORTING', label: 'Reporting',  icon: <BarChart2 size={15} /> },
    { id: 'SETTINGS',  label: 'Settings',   icon: <Settings size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            onClick={() => setView('DASHBOARD')}
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <span className="font-bold text-slate-900">Buyer Portal</span>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-200">
            <ShieldCheck size={13} />
            Verified Leads
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* KPI strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Buyer',      value: buyerName,                        icon: <Building2 size={16} className="text-blue-700" />,    bg: 'bg-blue-50'    },
            { label: 'Inbox',      value: `${inboxLeads.length} leads`,     icon: <ClipboardList size={16} className="text-violet-700" />, bg: 'bg-violet-50' },
            { label: 'Wallet',     value: fmt$(walletBalance),              icon: <Wallet size={16} className="text-emerald-700" />,    bg: 'bg-emerald-50' },
            { label: 'Acceptance', value: fmtPct(recon.acceptanceRate),     icon: <BarChart2 size={16} className="text-amber-700" />,   bg: 'bg-amber-50'   },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-slate-200 bg-white/95">
              <div className={`inline-flex p-1.5 rounded-lg ${kpi.bg} mb-1`}>{kpi.icon}</div>
              <p className="text-xs text-slate-500">{kpi.label}</p>
              <p className="font-bold text-slate-900 truncate">{kpi.value}</p>
            </Card>
          ))}
        </section>

        {/* Tab bar */}
        <section className="bg-white border border-slate-200 rounded-2xl p-2">
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${
                  activeTab === tab.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* LEADS */}
        {activeTab === 'LEADS' && (
          <Card className="border-slate-200 bg-white/95">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Lead Inbox</h2>
                <p className="text-sm text-slate-500">Accept or reject delivered leads. Dispute window closes 72 h after delivery.</p>
              </div>
              <Filter size={14} className="text-slate-400" />
            </div>
            <div className="space-y-2">
              {leads.map((lead) => {
                const price   = getLeadPrice(lead.tier);
                const winOpen = isDisputeWindowOpen(lead);
                const isInbox = ['DELIVERED','NEW','VERIFIED'].includes(lead.status);
                return (
                  <div key={lead.id} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-900">{lead.applicantName}</span>
                          <span className="text-xs text-slate-500">{lead.city}, {lead.state}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[lead.status]}`}>{lead.status}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SEVERITY_BADGE[lead.severity] ?? 'bg-slate-100 text-slate-600'}`}>{lead.severity}</span>
                          <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Tier {lead.tier}</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">Score: {lead.qualityScore} · {lead.caseType} · {formatDate(lead.deliveredAt || lead.createdAt)}</p>
                        {winOpen && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5">Dispute window open · closes {formatDate(lead.disputeWindowClosesAt)}</p>
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="font-bold text-slate-900">${price}</p>
                        {isInbox && (
                          <div className="flex flex-col gap-1 mt-1">
                            <Button size="sm" onClick={() => acceptLead(lead.id)}>Accept</Button>
                            <Button size="sm" variant="outline" onClick={() => rejectLead(lead.id)}>Reject</Button>
                          </div>
                        )}
                        {lead.status === 'ACCEPTED' && winOpen && (
                          <button
                            className="text-[10px] text-amber-600 underline mt-1 block"
                            onClick={() => {
                              setDisputeForm((f) => ({ ...f, leadId: lead.id }));
                              setShowDisputeFlow(true);
                              setActiveTab('DISPUTES');
                            }}
                          >
                            Dispute
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* DISPUTES */}
        {activeTab === 'DISPUTES' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-900">File a Dispute</h2>
                <button
                  className="text-sm text-indigo-600 font-semibold"
                  onClick={() => setShowDisputeFlow((v) => !v)}
                >
                  {showDisputeFlow ? 'Cancel' : '+ New Dispute'}
                </button>
              </div>

              {showDisputeFlow ? (
                <div className="space-y-3 border-t border-slate-100 pt-3">
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Lead</label>
                    <select
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                      value={disputeForm.leadId}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, leadId: e.target.value }))}
                    >
                      <option value="">— select lead —</option>
                      {leads
                        .filter((l) => isDisputeWindowOpen(l) && (l.status === 'ACCEPTED' || l.status === 'DELIVERED'))
                        .map((l) => (
                          <option key={l.id} value={l.id}>{l.id} · {l.applicantName}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Reason</label>
                    <select
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm"
                      value={disputeForm.reason}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, reason: e.target.value as DisputeReason }))}
                    >
                      {DISPUTE_REASONS.map((r) => (
                        <option key={r.value} value={r.value}>{r.label} (credit: {r.credit})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-700 block mb-1">Notes</label>
                    <textarea
                      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm resize-none"
                      rows={3}
                      placeholder="Describe the issue…"
                      value={disputeForm.notes}
                      onChange={(e) => setDisputeForm((f) => ({ ...f, notes: e.target.value }))}
                    />
                  </div>
                  <Button
                    className="w-full"
                    disabled={!disputeForm.leadId || !disputeForm.notes.trim()}
                    onClick={submitDispute}
                  >
                    Submit Dispute
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    Disputes must be filed within <strong>72 hours</strong> of delivery. Credits post to your wallet automatically.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {DISPUTE_REASONS.map((r) => (
                      <div key={r.value} className="border border-slate-100 rounded-lg px-2 py-1.5">
                        <p className="font-semibold text-slate-800">{r.label}</p>
                        <p className="text-slate-500">Credit: {r.credit}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Dispute History</h2>
              {disputes.length === 0 ? (
                <p className="text-sm text-slate-500">No disputes filed yet.</p>
              ) : (
                <div className="space-y-2">
                  {disputes.map((d) => {
                    const lead = leads.find((l) => l.id === d.leadId);
                    const creditAmt = lead ? (getLeadPrice(lead.tier) * d.creditPct).toFixed(0) : '—';
                    return (
                      <div key={d.id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900 text-sm">{d.id} · {d.leadId}</p>
                          <p className="text-xs text-slate-600">{DISPUTE_REASONS.find((r) => r.value === d.reason)?.label}</p>
                          <p className="text-xs text-slate-500">{d.notes}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">Credit Applied</span>
                          <p className="text-sm font-bold text-emerald-700 mt-1">${creditAmt}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* BILLING */}
        {activeTab === 'BILLING' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card className="border-slate-200 bg-white/95 lg:col-span-2">
                <h2 className="text-lg font-bold text-slate-900 mb-3">Current Invoice</h2>
                <div className="space-y-2 text-sm">
                  {acceptedLeads.map((l) => (
                    <div key={l.id} className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                      <span className="text-slate-600">{l.id} · {l.applicantName} (Tier {l.tier})</span>
                      <span className="font-semibold text-slate-900">${getLeadPrice(l.tier)}</span>
                    </div>
                  ))}
                  {acceptedLeads.length === 0 && <p className="text-slate-500">No accepted leads yet.</p>}
                  {acceptedLeads.length > 0 && (
                    <div className="flex items-center justify-between pt-2 text-base font-bold text-slate-900">
                      <span>Total</span><span>{fmt$(totalOwed)}</span>
                    </div>
                  )}
                </div>
                {acceptedLeads.length > 0 && (
                  <Button className="mt-4 w-full" onClick={handleStripePay} disabled={isPaying}>
                    {isPaying ? 'Processing...' : 'Pay via Stripe'}
                  </Button>
                )}
              </Card>

              <Card className="border-slate-200 bg-white/95">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet size={16} className="text-slate-700" />
                  <h3 className="font-semibold text-slate-900">Buyer Wallet</h3>
                </div>
                <p className={`text-2xl font-bold mb-0.5 ${walletBalance < 10000 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {fmt$(walletBalance)}
                </p>
                <p className="text-xs text-slate-500 mb-3">Prepaid balance</p>
                {walletBalance < 10000 && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs text-rose-700 mb-3">
                    <AlertTriangle size={12} />
                    Low balance — lead delivery may pause.
                  </div>
                )}
                <Button className="w-full" variant="outline">Add Funds</Button>
              </Card>
            </div>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Lead Pricing Tiers</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {DEFAULT_LEAD_PRICING.map((tier) => (
                  <div
                    key={tier.tier}
                    className={`rounded-xl border-2 p-4 ${tier.tier === 'A' ? 'border-amber-300 bg-amber-50' : tier.tier === 'B' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}
                  >
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.tier === 'A' ? 'bg-amber-200 text-amber-800' : tier.tier === 'B' ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>
                      Tier {tier.tier}
                    </span>
                    <p className="font-bold text-slate-900 mt-2">{tier.label}</p>
                    <p className="text-xs text-slate-600 mt-0.5">{tier.description}</p>
                    <p className="text-2xl font-black text-slate-900 mt-2">${tier.priceUsd}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-2">Platform fee billed separately. Charges trigger on acceptance or when dispute window closes.</p>
            </Card>
          </div>
        )}

        {/* REPORTING */}
        {activeTab === 'REPORTING' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Weekly Performance</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {[
                  { label: 'Delivered',    value: recon.totalDelivered.toString()  },
                  { label: 'Accepted',     value: recon.totalAccepted.toString()   },
                  { label: 'Rejected',     value: recon.totalRejected.toString()   },
                  { label: 'Disputed',     value: recon.totalDisputed.toString()   },
                  { label: 'Acceptance %', value: fmtPct(recon.acceptanceRate)    },
                  { label: 'Dispute %',    value: fmtPct(recon.disputeRate)       },
                  { label: 'Gross Spend',  value: fmt$(recon.grossRevenueCents)   },
                  { label: 'Net Spend',    value: fmt$(recon.netRevenueCents)     },
                ].map((row) => (
                  <div key={row.label} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs text-slate-500">{row.label}</p>
                    <p className="text-xl font-bold text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Lead Outcome Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Lead</th>
                      <th className="py-2 pr-3 font-semibold">Tier</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Price</th>
                      <th className="py-2 font-semibold">Delivered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((l) => (
                      <tr key={l.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 font-mono text-xs text-slate-700">{l.id}</td>
                        <td className="py-2 pr-3"><span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Tier {l.tier}</span></td>
                        <td className="py-2 pr-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[l.status]}`}>{l.status}</span></td>
                        <td className="py-2 pr-3 text-slate-700">${getLeadPrice(l.tier)}</td>
                        <td className="py-2 text-xs text-slate-500">{formatDate(l.deliveredAt || l.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {recon.disputeRate > 0.3 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-sm text-amber-800">Dispute rate above 30% may trigger an account review and temporary pause of lead delivery.</p>
              </div>
            )}
          </div>
        )}

        {/* SETTINGS */}
        {activeTab === 'SETTINGS' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Buyer Account</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                {[
                  { label: 'Organization',      value: buyerAccount.orgName },
                  { label: 'Contact',           value: `${buyerAccount.contactName} · ${buyerAccount.contactEmail}` },
                  { label: 'Coverage States',   value: buyerAccount.coverageStates.join(', ') },
                  { label: 'Daily Lead Cap',    value: `${buyerAccount.dailyLeadCap} leads/day` },
                  { label: 'Min Quality Score', value: buyerAccount.minQualityScore.toString() },
                  { label: 'Billing Model',     value: buyerAccount.billingModel.replace('_', ' ') },
                ].map((row) => (
                  <div key={row.label} className="border border-slate-100 rounded-xl px-3 py-2.5">
                    <p className="text-[10px] text-slate-500 uppercase tracking-wide">{row.label}</p>
                    <p className="font-semibold text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Verification Status</h2>
              <div className="space-y-2 text-sm">
                {[
                  { label: 'License Verified', ok: buyerAccount.licenseVerified },
                  { label: 'TCPA Verified',    ok: buyerAccount.tcpaVerified    },
                  { label: 'Active Account',   ok: buyerAccount.active          },
                ].map((row) => (
                  <div key={row.label} className={`rounded-xl border p-3 flex items-center gap-3 ${row.ok ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
                    {row.ok
                      ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      : <XCircle     size={16} className="text-rose-600 shrink-0" />
                    }
                    <p className={`font-semibold ${row.ok ? 'text-emerald-800' : 'text-rose-800'}`}>{row.label}</p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
