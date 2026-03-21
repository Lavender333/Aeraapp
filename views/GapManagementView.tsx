import React, { useEffect, useState, useCallback } from 'react';
import {
  GapDisbursement,
  GapRevenueSettings,
  OrgBankInfo,
  ViewState,
} from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input, Textarea } from '../components/Input';
import { StorageService } from '../services/storage';
import {
  getGapRevenueSettingsRemote,
  saveGapRevenueSettingsRemote,
  listAllOrgGapBankInfo,
  saveOrgGapBankInfo,
  listGapDisbursements,
  recordGapDisbursement,
  updateGapDisbursementStatus,
  listOrgMemberCounts,
} from '../services/api';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  DollarSign,
  Settings2,
  Shield,
  Clock,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types local to this view
// ---------------------------------------------------------------------------
type OrgRow = {
  id: string;
  orgCode: string;
  name: string;
  memberCount: number;
  allocationCapacity: number;
  approvedRequestAmount: number; // from resolved help requests (local DB)
  disbursedConfirmed: number;    // ACH/wire confirmed amounts
  disbursedPending: number;      // initiated/pending/sent amounts not yet confirmed
  remainingBalance: number;      // allocationCapacity - disbursedConfirmed
  bankInfo: OrgBankInfo | null;
};

type DisburseForm = {
  orgCode: string;
  orgName: string;
  amountUsd: string;
  disbursementDate: string;
  paymentMethod: GapDisbursement['paymentMethod'];
  referenceNumber: string;
  notes: string;
};

const EMPTY_BANK: Omit<OrgBankInfo, 'orgCode' | 'verified'> = {
  bankName: '',
  beneficiaryName: '',
  routingNumber: '',
  accountLast4: '',
  accountType: 'checking',
  ein: '',
  bankAddress: '',
  notes: '',
};

const formatCurrency = (v: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v || 0);

const STATUS_LABELS: Record<GapDisbursement['status'], string> = {
  INITIATED: 'Initiated',
  PENDING: 'Pending',
  SENT: 'Sent',
  CONFIRMED: 'Confirmed',
  FAILED: 'Failed',
};

const STATUS_COLORS: Record<GapDisbursement['status'], string> = {
  INITIATED: 'bg-slate-100 text-slate-700',
  PENDING: 'bg-amber-100 text-amber-800',
  SENT: 'bg-blue-100 text-blue-800',
  CONFIRMED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-red-100 text-red-700',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export const GapManagementView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const db = StorageService.getDB();
  const role = String(profile.role || '').toUpperCase();

  // Guard: this view is only for CORE admin
  if (role !== 'ADMIN') {
    setView('GAP');
    return null;
  }

  // ---------------------------------------------------------------------------
  // State
  // ---------------------------------------------------------------------------
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [orgRows, setOrgRows] = useState<OrgRow[]>([]);
  const [disbursements, setDisbursements] = useState<GapDisbursement[]>([]);
  const [revenueSettings, setRevenueSettings] = useState<GapRevenueSettings>(() =>
    StorageService.getGapRevenueSettings(),
  );
  const [revSettingsSaving, setRevSettingsSaving] = useState(false);
  const [revSettingsMsg, setRevSettingsMsg] = useState('');
  const [revDraft, setRevDraft] = useState<GapRevenueSettings>(() =>
    StorageService.getGapRevenueSettings(),
  );
  const [showRevConfig, setShowRevConfig] = useState(false);

  // Bank info modal
  const [bankDraft, setBankDraft] = useState<(Omit<OrgBankInfo, 'verified'> & { orgCode: string }) | null>(null);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState('');

  // Disburse modal
  const [disburseDraft, setDisburseDraft] = useState<DisburseForm | null>(null);
  const [disburseSaving, setDisburseSaving] = useState(false);
  const [disburseError, setDisburseError] = useState('');

  // Disbursement history modal
  const [historyOrgCode, setHistoryOrgCode] = useState<string | null>(null);
  const [updatingDisbId, setUpdatingDisbId] = useState<string | null>(null);

  // Per-org expand/collapse
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Derived: revenue math
  // ---------------------------------------------------------------------------
  const monthlyGapPerMember = (() => {
    const price = Number(revenueSettings.membershipPriceUsd || 9.99);
    const pfee = Number(revenueSettings.appStoreFeePercent || 30) / 100;
    const gpct = Number(revenueSettings.gapFundAllocationPercent || 30) / 100;
    const div = revenueSettings.billingCycle === 'annual' ? 12 : 1;
    return (price * (1 - pfee) * gpct) / div;
  })();

  // ---------------------------------------------------------------------------
  // Data loading
  // ---------------------------------------------------------------------------
  const loadAll = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      // Load from server in parallel
      const [remoteSettings, allBankInfo, allDisbursements, memberCounts] = await Promise.all([
        getGapRevenueSettingsRemote().catch(() => null),
        listAllOrgGapBankInfo().catch(() => []),
        listGapDisbursements().catch(() => []),
        listOrgMemberCounts().catch(() => []),
      ]);

      // Sync revenue settings
      if (remoteSettings) {
        StorageService.setGapRevenueSettings(remoteSettings);
        setRevenueSettings(remoteSettings);
        setRevDraft(remoteSettings);
      }

      setDisbursements(allDisbursements);

      // Build bankInfo map keyed by orgCode
      const bankByCode = new Map<string, OrgBankInfo>();
      for (const b of allBankInfo) bankByCode.set(b.orgCode.toUpperCase(), b);

      // Build member count map keyed by org UUID
      const membersByOrgId = new Map<string, number>();
      for (const mc of memberCounts) membersByOrgId.set(mc.orgId, mc.memberCount);

      // Build disbursement totals keyed by orgCode
      const disbConfirmedByCode = new Map<string, number>();
      const disbPendingByCode = new Map<string, number>();
      for (const d of allDisbursements) {
        const code = d.orgCode.toUpperCase();
        const usd = d.amountCents / 100;
        if (d.status === 'CONFIRMED') {
          disbConfirmedByCode.set(code, (disbConfirmedByCode.get(code) || 0) + usd);
        } else if (['INITIATED', 'PENDING', 'SENT'].includes(d.status)) {
          disbPendingByCode.set(code, (disbPendingByCode.get(code) || 0) + usd);
        }
      }

      // Compute approved request amounts from local DB (existing behavior)
      const approvedByCode = new Map<string, number>();
      const resolvedStatuses = new Set(['RESOLVED']);
      for (const req of db.requests || []) {
        if (!resolvedStatuses.has(String(req.status || '').toUpperCase())) continue;
        const user = (db.users || []).find((u) => u.id === req.userId);
        const code = String(user?.communityId || '').trim().toUpperCase();
        if (!code) continue;
        const amount = req.gapApplication?.requestedAmount || 0;
        approvedByCode.set(code, (approvedByCode.get(code) || 0) + amount);
      }

      // Build org rows from local DB organizations + Supabase data
      const allOrgs = db.organizations || [];
      const rows: OrgRow[] = allOrgs
        .filter((org) => Boolean(org.id))
        .map((org) => {
          const code = String(org.id || '').toUpperCase().trim();
          const memberCount = membersByOrgId.get(org.id) ?? 0;
          const allocationCapacity = Math.round(monthlyGapPerMember * memberCount * 100) / 100;
          const disbursedConfirmed = disbConfirmedByCode.get(code) || 0;
          const disbursedPending = disbPendingByCode.get(code) || 0;
          const remainingBalance = Math.max(0, allocationCapacity - disbursedConfirmed);
          return {
            id: org.id,
            orgCode: code,
            name: String(org.name || code),
            memberCount,
            allocationCapacity,
            approvedRequestAmount: approvedByCode.get(code) || 0,
            disbursedConfirmed,
            disbursedPending,
            remainingBalance,
            bankInfo: bankByCode.get(code) || null,
          };
        })
        .sort((a, b) => b.memberCount - a.memberCount);

      setOrgRows(rows);
    } catch (err) {
      setLoadError(String((err as Error).message || 'Failed to load G.A.P. management data.'));
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Recompute per-org allocation when revenue settings change
  useEffect(() => {
    setOrgRows((prev) =>
      prev.map((row) => {
        const allocationCapacity = Math.round(monthlyGapPerMember * row.memberCount * 100) / 100;
        return {
          ...row,
          allocationCapacity,
          remainingBalance: Math.max(0, allocationCapacity - row.disbursedConfirmed),
        };
      }),
    );
  }, [monthlyGapPerMember]);

  // ---------------------------------------------------------------------------
  // Totals
  // ---------------------------------------------------------------------------
  const totalPool = orgRows.reduce((s, r) => s + r.allocationCapacity, 0);
  const totalDisbursed = orgRows.reduce((s, r) => s + r.disbursedConfirmed, 0);
  const totalPending = orgRows.reduce((s, r) => s + r.disbursedPending, 0);
  const totalRemaining = orgRows.reduce((s, r) => s + r.remainingBalance, 0);
  const totalMembers = orgRows.reduce((s, r) => s + r.memberCount, 0);

  // ---------------------------------------------------------------------------
  // Revenue settings save
  // ---------------------------------------------------------------------------
  const saveRevSettings = async () => {
    setRevSettingsSaving(true);
    setRevSettingsMsg('');
    try {
      const saved = await saveGapRevenueSettingsRemote(revDraft);
      StorageService.setGapRevenueSettings(saved);
      setRevenueSettings(saved);
      setRevDraft(saved);
      setRevSettingsMsg('Revenue settings saved to server.');
    } catch (err) {
      setRevSettingsMsg(`Error: ${String((err as Error).message || 'Unable to save.')}`);
    } finally {
      setRevSettingsSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Bank info modal
  // ---------------------------------------------------------------------------
  const openBankModal = (row: OrgRow) => {
    setBankError('');
    setBankDraft({
      ...EMPTY_BANK,
      ...(row.bankInfo || {}),
      orgCode: row.orgCode,
      orgName: row.name,
    });
  };

  const saveBankInfo = async () => {
    if (!bankDraft) return;
    if (!bankDraft.bankName.trim() || !bankDraft.beneficiaryName.trim() || !bankDraft.routingNumber.trim()) {
      setBankError('Bank name, beneficiary name, and routing number are required.');
      return;
    }
    if (bankDraft.routingNumber.replace(/\D/g, '').length !== 9) {
      setBankError('Routing number must be exactly 9 digits.');
      return;
    }
    if (bankDraft.accountLast4.replace(/\D/g, '').length !== 4) {
      setBankError('Account last 4 must be exactly 4 digits.');
      return;
    }

    setBankSaving(true);
    setBankError('');
    try {
      const saved = await saveOrgGapBankInfo(bankDraft.orgCode, bankDraft);
      setOrgRows((prev) =>
        prev.map((r) =>
          r.orgCode === bankDraft.orgCode ? { ...r, bankInfo: saved } : r,
        ),
      );
      setBankDraft(null);
    } catch (err) {
      setBankError(String((err as Error).message || 'Unable to save bank info.'));
    } finally {
      setBankSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Disbursement modal
  // ---------------------------------------------------------------------------
  const openDisburseModal = (row: OrgRow) => {
    setDisburseError('');
    setDisburseDraft({
      orgCode: row.orgCode,
      orgName: row.name,
      amountUsd: '',
      disbursementDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'ACH',
      referenceNumber: '',
      notes: '',
    });
  };

  const saveDisbursement = async () => {
    if (!disburseDraft) return;
    const amount = Number(disburseDraft.amountUsd || 0);
    if (!amount || amount <= 0) {
      setDisburseError('Enter a valid disbursement amount.');
      return;
    }
    if (!disburseDraft.disbursementDate) {
      setDisburseError('Select a disbursement date.');
      return;
    }

    setDisburseSaving(true);
    setDisburseError('');
    try {
      const newDisb = await recordGapDisbursement({
        orgCode: disburseDraft.orgCode,
        amountUsd: amount,
        disbursementDate: disburseDraft.disbursementDate,
        paymentMethod: disburseDraft.paymentMethod,
        referenceNumber: disburseDraft.referenceNumber.trim() || undefined,
        notes: disburseDraft.notes.trim() || undefined,
      });
      setDisbursements((prev) => [newDisb, ...prev]);
      const usd = newDisb.amountCents / 100;
      setOrgRows((prev) =>
        prev.map((r) => {
          if (r.orgCode !== disburseDraft.orgCode) return r;
          const disbursedPending = r.disbursedPending + usd;
          return { ...r, disbursedPending };
        }),
      );
      setDisburseDraft(null);
    } catch (err) {
      setDisburseError(String((err as Error).message || 'Unable to record disbursement.'));
    } finally {
      setDisburseSaving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Update disbursement status
  // ---------------------------------------------------------------------------
  const updateStatus = async (
    disburse: GapDisbursement,
    newStatus: GapDisbursement['status'],
    refNum?: string,
  ) => {
    setUpdatingDisbId(disburse.id);
    try {
      const updated = await updateGapDisbursementStatus(disburse.id, newStatus, refNum);
      setDisbursements((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      // Recalculate totals for this org
      setOrgRows((prev) =>
        prev.map((r) => {
          if (r.orgCode !== disburse.orgCode) return r;
          const orgDisbs = disbursements.map((d) =>
            d.id === updated.id ? updated : d,
          ).filter((d) => d.orgCode === r.orgCode);
          const confirmed = orgDisbs
            .filter((d) => d.status === 'CONFIRMED')
            .reduce((s, d) => s + d.amountCents / 100, 0);
          const pending = orgDisbs
            .filter((d) => ['INITIATED', 'PENDING', 'SENT'].includes(d.status))
            .reduce((s, d) => s + d.amountCents / 100, 0);
          return {
            ...r,
            disbursedConfirmed: confirmed,
            disbursedPending: pending,
            remainingBalance: Math.max(0, r.allocationCapacity - confirmed),
          };
        }),
      );
    } catch (err) {
      alert(String((err as Error).message || 'Update failed.'));
    } finally {
      setUpdatingDisbId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // History for a given org
  // ---------------------------------------------------------------------------
  const historyDisbs = historyOrgCode
    ? disbursements.filter((d) => d.orgCode === historyOrgCode)
    : [];

  const toggleExpand = (code: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-start gap-3">
          <button onClick={() => setView('GAP')} className="p-2 -ml-2 text-slate-700 hover:text-slate-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-xl text-slate-900">G.A.P. Fund Management</h1>
            <p className="text-xs text-slate-600">CORE Admin · All Organizations</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-5 max-w-5xl mx-auto w-full">
        {/* Loading / Error */}
        {loading && <p className="text-sm text-slate-500">Loading G.A.P. data…</p>}
        {loadError && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={16} className="mt-0.5" />
            <p>{loadError}</p>
          </div>
        )}

        {/* Summary Cards */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-emerald-200 bg-emerald-50">
              <p className="text-[10px] font-bold text-emerald-700 uppercase">Total G.A.P. Pool</p>
              <p className="text-xl font-black text-emerald-900 mt-1">{formatCurrency(totalPool)}</p>
              <p className="text-[10px] text-emerald-700">{totalMembers} members / {orgRows.length} orgs</p>
            </Card>
            <Card className="border-amber-200 bg-amber-50">
              <p className="text-[10px] font-bold text-amber-700 uppercase">In Transit</p>
              <p className="text-xl font-black text-amber-900 mt-1">{formatCurrency(totalPending)}</p>
              <p className="text-[10px] text-amber-700">Initiated / Pending / Sent</p>
            </Card>
            <Card className="border-blue-200 bg-blue-50">
              <p className="text-[10px] font-bold text-blue-700 uppercase">Confirmed Disbursed</p>
              <p className="text-xl font-black text-blue-900 mt-1">{formatCurrency(totalDisbursed)}</p>
              <p className="text-[10px] text-blue-700">Bank-confirmed transfers</p>
            </Card>
            <Card className="border-slate-200 bg-white">
              <p className="text-[10px] font-bold text-slate-600 uppercase">Remaining Balance</p>
              <p className="text-xl font-black text-slate-900 mt-1">{formatCurrency(totalRemaining)}</p>
              <p className="text-[10px] text-slate-500">Pool − confirmed disbursed</p>
            </Card>
          </div>
        )}

        {/* Revenue Settings */}
        {!loading && (
          <Card className="border-slate-200 bg-white space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Settings2 size={16} className="text-emerald-700" />
                <h3 className="font-bold text-slate-900">Revenue Settings</h3>
              </div>
              <button
                onClick={() => { setShowRevConfig((v) => !v); setRevSettingsMsg(''); }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                {showRevConfig ? 'Collapse' : 'Configure'}
              </button>
            </div>

            {/* Always-visible math summary */}
            {(() => {
              const price = Number(revenueSettings.membershipPriceUsd || 9.99);
              const pfee = Number(revenueSettings.appStoreFeePercent || 30) / 100;
              const gpct = Number(revenueSettings.gapFundAllocationPercent || 30) / 100;
              const div = revenueSettings.billingCycle === 'annual' ? 12 : 1;
              const monthly = (price * (1 - pfee) * gpct) / div;
              return (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-xs text-slate-700 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div><p className="font-semibold text-slate-500 uppercase text-[10px]">Price</p><p className="font-bold text-slate-900">{formatCurrency(price)}/{revenueSettings.billingCycle}</p></div>
                  <div><p className="font-semibold text-slate-500 uppercase text-[10px]">Platform Fee</p><p className="font-bold text-slate-900">{revenueSettings.appStoreFeePercent}%</p></div>
                  <div><p className="font-semibold text-slate-500 uppercase text-[10px]">G.A.P. Allocation</p><p className="font-bold text-slate-900">{revenueSettings.gapFundAllocationPercent}% of net</p></div>
                  <div><p className="font-semibold text-slate-500 uppercase text-[10px]">Per Member / Mo</p><p className="font-bold text-emerald-800">{formatCurrency(monthly)}</p></div>
                </div>
              );
            })()}

            {showRevConfig && (
              <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number" min={0.99} step={0.01}
                    label="Membership price (USD)"
                    value={revDraft.membershipPriceUsd}
                    onChange={(e) => setRevDraft((p) => ({ ...p, membershipPriceUsd: Number(e.target.value) }))}
                  />
                  <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                    Billing cycle
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      value={revDraft.billingCycle}
                      onChange={(e) => setRevDraft((p) => ({ ...p, billingCycle: e.target.value as 'monthly' | 'annual' }))}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      App Store fee % <span className="text-[11px] text-slate-400">(Apple 30% std / 15% small dev)</span>
                    </label>
                    <input type="range" min={0} max={50} step={1} className="w-full"
                      value={revDraft.appStoreFeePercent}
                      onChange={(e) => setRevDraft((p) => ({ ...p, appStoreFeePercent: Number(e.target.value) }))} />
                    <p className="text-xs text-slate-600">{revDraft.appStoreFeePercent}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      G.A.P. allocation % <span className="text-[11px] text-slate-400">(of net proceeds)</span>
                    </label>
                    <input type="range" min={1} max={100} step={1} className="w-full"
                      value={revDraft.gapFundAllocationPercent}
                      onChange={(e) => setRevDraft((p) => ({ ...p, gapFundAllocationPercent: Number(e.target.value) }))} />
                    <p className="text-xs text-slate-600">{revDraft.gapFundAllocationPercent}%</p>
                  </div>
                </div>
                {revSettingsMsg && (
                  <p className={`text-xs font-semibold ${revSettingsMsg.startsWith('Error') ? 'text-red-600' : 'text-emerald-700'}`}>
                    {revSettingsMsg}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => { setRevDraft({ ...revenueSettings }); setRevSettingsMsg(''); }}>Reset</Button>
                  <Button onClick={saveRevSettings} disabled={revSettingsSaving}>
                    {revSettingsSaving ? 'Saving…' : 'Save to Server'}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {/* Chase ACH Instructions */}
        {!loading && (
          <Card className="border-blue-200 bg-blue-50 space-y-2">
            <div className="flex items-center gap-2">
              <DollarSign size={16} className="text-blue-700" />
              <h3 className="font-bold text-slate-900">How to Send Money via Chase Business</h3>
            </div>
            <ol className="text-xs text-slate-700 space-y-1 list-decimal list-inside">
              <li>Log in to <strong>Chase Business Online</strong> (business.chase.com)</li>
              <li>Navigate to <strong>Pay &amp; Transfer → ACH Payments</strong> (or Wire Transfers for same-day)</li>
              <li>Add a new beneficiary using the org's <strong>Routing Number</strong>, <strong>Account Number</strong>, and <strong>Beneficiary Name</strong> from the bank info form below</li>
              <li>Enter the disbursement amount, select effective date, and submit</li>
              <li>Copy the <strong>ACH Trace Number</strong> (or wire confirmation) from Chase</li>
              <li>Return here → click <strong>Record Disbursement</strong> for that org → paste the reference number</li>
              <li>Once the transfer posts, click <strong>Mark Confirmed</strong> to finalize the balance</li>
            </ol>
            <p className="text-[11px] text-blue-700 font-medium">
              ACH transfers typically settle within 1–3 business days. Wire transfers settle same or next day.
              Always verify routing and account numbers before sending.
            </p>
          </Card>
        )}

        {/* Org Rows */}
        {!loading && orgRows.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-bold text-slate-900 text-base">Organization Fund Status</h2>
            {orgRows.map((row) => {
              const expanded = expandedOrgs.has(row.orgCode);
              const hasBankInfo = Boolean(row.bankInfo?.routingNumber);
              const needsBankInfo = !hasBankInfo;

              return (
                <Card key={row.orgCode} className="border-slate-200 bg-white space-y-0 p-0 overflow-hidden">
                  {/* Row header */}
                  <button
                    className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50"
                    onClick={() => toggleExpand(row.orgCode)}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Building2 size={18} className="text-slate-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{row.name}</p>
                        <p className="text-xs text-slate-500">{row.orgCode} · {row.memberCount} members</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 text-right">
                      <div className="hidden sm:block">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Allocation</p>
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(row.allocationCapacity)}</p>
                      </div>
                      <div className="hidden sm:block">
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Disbursed</p>
                        <p className="text-sm font-bold text-blue-700">{formatCurrency(row.disbursedConfirmed)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Remaining</p>
                        <p className="text-sm font-bold text-emerald-700">{formatCurrency(row.remainingBalance)}</p>
                      </div>
                      {needsBankInfo ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">No Bank Info</span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">Bank ✓</span>
                      )}
                      {expanded ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
                    </div>
                  </button>

                  {expanded && (
                    <div className="border-t border-slate-100 p-4 space-y-4">
                      {/* Fund summary (mobile) */}
                      <div className="grid grid-cols-3 gap-2 sm:hidden">
                        <div className="rounded-lg border border-slate-200 p-2 text-center">
                          <p className="text-[10px] font-bold text-slate-500 uppercase">Allocation</p>
                          <p className="text-sm font-bold text-slate-900">{formatCurrency(row.allocationCapacity)}</p>
                        </div>
                        <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                          <p className="text-[10px] font-bold text-blue-600 uppercase">Disbursed</p>
                          <p className="text-sm font-bold text-blue-800">{formatCurrency(row.disbursedConfirmed)}</p>
                        </div>
                        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                          <p className="text-[10px] font-bold text-emerald-600 uppercase">Remaining</p>
                          <p className="text-sm font-bold text-emerald-800">{formatCurrency(row.remainingBalance)}</p>
                        </div>
                      </div>

                      {/* In-transit notice */}
                      {row.disbursedPending > 0 && (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 flex items-center gap-2 text-xs text-amber-800">
                          <Clock size={13} />
                          <p><span className="font-semibold">{formatCurrency(row.disbursedPending)}</span> in transit (initiated/pending/sent — not yet confirmed)</p>
                        </div>
                      )}

                      {/* Approved requests vs. confirmed disbursed */}
                      {row.approvedRequestAmount > 0 && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
                          <span className="font-semibold">Approved requests:</span> {formatCurrency(row.approvedRequestAmount)}
                          {row.approvedRequestAmount > row.disbursedConfirmed && (
                            <span className="text-amber-700 ml-2 font-semibold">
                              ({formatCurrency(row.approvedRequestAmount - row.disbursedConfirmed)} approved but not yet bank-transferred)
                            </span>
                          )}
                        </div>
                      )}

                      {/* Bank info section */}
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <Shield size={14} className="text-slate-500" />
                            <p className="text-xs font-semibold text-slate-800">Bank / ACH Info</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => openBankModal(row)}>
                            {hasBankInfo ? 'Edit' : 'Add Bank Info'}
                          </Button>
                        </div>
                        {hasBankInfo && row.bankInfo ? (
                          <div className="text-xs text-slate-700 space-y-0.5">
                            <p><span className="font-semibold">Bank:</span> {row.bankInfo.bankName}</p>
                            <p><span className="font-semibold">Beneficiary:</span> {row.bankInfo.beneficiaryName}</p>
                            <p><span className="font-semibold">Routing:</span> {row.bankInfo.routingNumber}</p>
                            <p><span className="font-semibold">Account:</span> ****{row.bankInfo.accountLast4} ({row.bankInfo.accountType})</p>
                            {row.bankInfo.ein && <p><span className="font-semibold">EIN:</span> {row.bankInfo.ein}</p>}
                            {row.bankInfo.notes && <p className="text-slate-500 italic">{row.bankInfo.notes}</p>}
                            {row.bankInfo.verified && (
                              <p className="flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle2 size={12} /> Verified</p>
                            )}
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700">Bank info not yet submitted for this organization.</p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          onClick={() => openDisburseModal(row)}
                          disabled={!hasBankInfo}
                          title={!hasBankInfo ? 'Add bank info first' : undefined}
                        >
                          Record Disbursement
                        </Button>
                        <Button variant="outline" onClick={() => setHistoryOrgCode(row.orgCode)}>
                          View History ({disbursements.filter((d) => d.orgCode === row.orgCode).length})
                        </Button>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {!loading && orgRows.length === 0 && !loadError && (
          <Card className="border-slate-200 bg-white text-center py-8">
            <p className="text-sm text-slate-500">No organizations found in the local database.</p>
          </Card>
        )}

        {/* Disclaimer */}
        <Card className="border-slate-200 bg-white/95">
          <p className="text-xs text-slate-600 flex items-start gap-2">
            <AlertCircle size={13} className="mt-0.5 text-slate-400" />
            G.A.P. fund disbursements are subject to documented hardship approval and available charitable resources.
            Allocation Capacity reflects the estimated monthly G.A.P. contribution from that org's members — it is not a guarantee of payment.
            Confirmed Disbursed reflects actual bank transfers recorded by CORE admin.
          </p>
        </Card>
      </div>

      {/* ====================== BANK INFO MODAL ====================== */}
      {bankDraft && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl p-5 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Bank / ACH Info</h3>
                <p className="text-xs text-slate-500">{bankDraft.orgName || bankDraft.orgCode}</p>
              </div>
              <button onClick={() => setBankDraft(null)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 space-y-1">
              <p className="font-semibold">What info is needed for ACH (Chase or any bank):</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li><strong>Bank Name</strong> — e.g. Chase Bank, Bank of America</li>
                <li><strong>Beneficiary Name</strong> — exact legal name on the bank account</li>
                <li><strong>Routing Number</strong> — 9-digit ABA number (bottom-left of checks)</li>
                <li><strong>Account Last 4</strong> — for display/verification only</li>
                <li><strong>EIN</strong> — required for charitable disbursement tax compliance</li>
              </ul>
              <p className="text-blue-700">For security, only the last 4 digits of the account number are stored here. Provide the full account number directly to your bank when initiating the transfer.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Bank Name *"
                value={bankDraft.bankName}
                onChange={(e) => setBankDraft((p) => p ? { ...p, bankName: e.target.value } : p)}
                placeholder="e.g. Chase Bank"
              />
              <Input
                label="Beneficiary Name (Legal) *"
                value={bankDraft.beneficiaryName}
                onChange={(e) => setBankDraft((p) => p ? { ...p, beneficiaryName: e.target.value } : p)}
                placeholder="Legal name on bank account"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Routing Number (9 digits) *"
                value={bankDraft.routingNumber}
                onChange={(e) => setBankDraft((p) => p ? { ...p, routingNumber: e.target.value.replace(/\D/g, '').slice(0, 9) } : p)}
                placeholder="021000021"
                maxLength={9}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Account Last 4 *"
                  value={bankDraft.accountLast4}
                  onChange={(e) => setBankDraft((p) => p ? { ...p, accountLast4: e.target.value.replace(/\D/g, '').slice(-4) } : p)}
                  placeholder="1234"
                  maxLength={4}
                />
                <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                  Type
                  <select
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    value={bankDraft.accountType}
                    onChange={(e) => setBankDraft((p) => p ? { ...p, accountType: e.target.value as 'checking' | 'savings' } : p)}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="EIN / Tax ID (optional)"
                value={bankDraft.ein || ''}
                onChange={(e) => setBankDraft((p) => p ? { ...p, ein: e.target.value } : p)}
                placeholder="12-3456789"
              />
              <Input
                label="Bank Address (optional)"
                value={bankDraft.bankAddress || ''}
                onChange={(e) => setBankDraft((p) => p ? { ...p, bankAddress: e.target.value } : p)}
                placeholder="For wire transfers"
              />
            </div>
            <Textarea
              label="Notes (optional)"
              value={bankDraft.notes || ''}
              onChange={(e) => setBankDraft((p) => p ? { ...p, notes: e.target.value } : p)}
              placeholder="Special ACH instructions, secondary contact, etc."
            />

            {bankError && <p className="text-sm text-red-600">{bankError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setBankDraft(null)}>Cancel</Button>
              <Button fullWidth onClick={saveBankInfo} disabled={bankSaving}>
                {bankSaving ? 'Saving…' : 'Save Bank Info'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================== DISBURSE MODAL ====================== */}
      {disburseDraft && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl p-5 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Record Disbursement</h3>
                <p className="text-xs text-slate-500">{disburseDraft.orgName}</p>
              </div>
              <button onClick={() => setDisburseDraft(null)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
              <p className="font-semibold mb-1">Instructions</p>
              <p>1. Complete the ACH transfer in Chase Business Online first.</p>
              <p>2. Enter the amount and paste the Chase ACH Trace / Confirmation number.</p>
              <p>3. Save — this creates an <em>INITIATED</em> record. Update status to <em>CONFIRMED</em> once the transfer posts.</p>
            </div>

            <Input
              type="number" min={1} step={0.01}
              label="Amount (USD) *"
              value={disburseDraft.amountUsd}
              onChange={(e) => setDisburseDraft((p) => p ? { ...p, amountUsd: e.target.value } : p)}
              placeholder="500.00"
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="date"
                label="Disbursement Date *"
                value={disburseDraft.disbursementDate}
                onChange={(e) => setDisburseDraft((p) => p ? { ...p, disbursementDate: e.target.value } : p)}
              />
              <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                Payment Method
                <select
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  value={disburseDraft.paymentMethod}
                  onChange={(e) => setDisburseDraft((p) => p ? { ...p, paymentMethod: e.target.value as GapDisbursement['paymentMethod'] } : p)}
                >
                  <option value="ACH">ACH (1–3 business days)</option>
                  <option value="WIRE">Wire Transfer (same/next day)</option>
                  <option value="CHECK">Check</option>
                </select>
              </label>
            </div>
            <Input
              label="Reference / Trace Number"
              value={disburseDraft.referenceNumber}
              onChange={(e) => setDisburseDraft((p) => p ? { ...p, referenceNumber: e.target.value } : p)}
              placeholder="Chase ACH trace or wire confirmation"
            />
            <Textarea
              label="Notes (optional)"
              value={disburseDraft.notes}
              onChange={(e) => setDisburseDraft((p) => p ? { ...p, notes: e.target.value } : p)}
              placeholder="Optional internal notes"
            />

            {disburseError && <p className="text-sm text-red-600">{disburseError}</p>}
            <div className="flex gap-2">
              <Button variant="outline" fullWidth onClick={() => setDisburseDraft(null)}>Cancel</Button>
              <Button fullWidth onClick={saveDisbursement} disabled={disburseSaving}>
                {disburseSaving ? 'Saving…' : 'Record Disbursement'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ====================== HISTORY MODAL ====================== */}
      {historyOrgCode && (
        <div className="fixed inset-0 z-40 bg-black/50 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-5 max-h-[92vh] overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Disbursement History</h3>
                <p className="text-xs text-slate-500">{orgRows.find((r) => r.orgCode === historyOrgCode)?.name || historyOrgCode}</p>
              </div>
              <button onClick={() => setHistoryOrgCode(null)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>

            {historyDisbs.length === 0 ? (
              <p className="text-sm text-slate-500">No disbursements recorded for this organization yet.</p>
            ) : (
              <div className="space-y-2">
                {historyDisbs.map((d) => (
                  <div key={d.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div>
                        <p className="text-sm font-bold text-slate-900">{formatCurrency(d.amountCents / 100)}</p>
                        <p className="text-xs text-slate-500">{d.paymentMethod} · {d.disbursementDate}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[d.status]}`}>
                        {STATUS_LABELS[d.status]}
                      </span>
                    </div>
                    {d.referenceNumber && (
                      <p className="text-xs text-slate-600">Ref: <span className="font-mono">{d.referenceNumber}</span></p>
                    )}
                    {d.notes && <p className="text-xs text-slate-600 italic">{d.notes}</p>}

                    {/* Status actions */}
                    {d.status !== 'CONFIRMED' && d.status !== 'FAILED' && (
                      <div className="flex flex-wrap gap-2">
                        {d.status === 'INITIATED' && (
                          <Button size="sm" variant="outline" disabled={updatingDisbId === d.id}
                            onClick={() => updateStatus(d, 'PENDING')}>Mark Pending</Button>
                        )}
                        {(d.status === 'INITIATED' || d.status === 'PENDING') && (
                          <Button size="sm" variant="outline" disabled={updatingDisbId === d.id}
                            onClick={() => updateStatus(d, 'SENT')}>Mark Sent</Button>
                        )}
                        <Button size="sm" disabled={updatingDisbId === d.id}
                          onClick={() => {
                            const ref = window.prompt('Enter confirmation / trace number (optional):', d.referenceNumber || '');
                            if (ref === null) return;
                            updateStatus(d, 'CONFIRMED', ref);
                          }}>
                          <CheckCircle2 size={13} className="mr-1" />Mark Confirmed
                        </Button>
                        <Button size="sm" variant="outline" disabled={updatingDisbId === d.id}
                          onClick={() => updateStatus(d, 'FAILED')}>
                          <XCircle size={13} className="mr-1" />Mark Failed
                        </Button>
                      </div>
                    )}
                    {updatingDisbId === d.id && <p className="text-xs text-slate-500">Updating…</p>}
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" fullWidth onClick={() => setHistoryOrgCode(null)}>Close</Button>
          </div>
        </div>
      )}
    </div>
  );
};
