/**
 * Lead Admin View — AERA internal screen for admins to:
 *  - Review and verify incoming leads
 *  - Route leads to buyer accounts
 *  - Monitor compliance controls
 *  - View reporting / reconciliation dashboard
 *  - Manage buyer accounts
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  BadgeCheck,
  BarChart2,
  Building2,
  CheckCircle2,
  Copy,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardList,
  FileWarning,
  Filter,
  RefreshCcw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MessageSquare,
  Users,
  XCircle,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ViewState, VerifiedLead, LeadStatus, DEFAULT_LEAD_PRICING, BuyerAccount } from '../types';
import { ContactSupportTicketRecord, ContactSupportTicketStatus, listContactSupportTicketsForAdmin, respondToContactSupportTicket } from '../services/api';
import {
  SAMPLE_LEADS,
  SAMPLE_BUYERS,
  weeklyReconciliation,
  getLeadPrice,
  matchBuyer,
  isDisputeWindowOpen,
} from '../services/leadService';
import { fetchBuyerAccounts, fetchVerifiedLeads, updateLeadRecord } from '../services/leadSupabase';

type AdminTab = 'LEADS' | 'BUYERS' | 'SUPPORT' | 'REPORTING' | 'COMPLIANCE' | 'PRICING';

const STATUS_COLORS: Record<LeadStatus, string> = {
  NEW: 'bg-blue-100 text-blue-700',
  VERIFIED: 'bg-amber-100 text-amber-700',
  DELIVERED: 'bg-violet-100 text-violet-700',
  ACCEPTED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  REFUNDED: 'bg-slate-200 text-slate-600',
};

const SUPPORT_STATUS_COLORS: Record<ContactSupportTicketStatus, string> = {
  OPEN: 'bg-slate-200 text-slate-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-700',
  RESOLVED: 'bg-emerald-100 text-emerald-700',
};

const fmt$ = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

const fmtPct = (ratio: number) => `${(ratio * 100).toFixed(1)}%`;

const formatDate = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : '—';

interface LeadAdminViewProps {
  setView: (view: ViewState) => void;
}

export const LeadAdminView: React.FC<LeadAdminViewProps> = ({ setView }) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('LEADS');
  const [leads, setLeads] = useState<VerifiedLead[]>(SAMPLE_LEADS);
  const [buyers, setBuyers] = useState<BuyerAccount[]>(SAMPLE_BUYERS);
  const [supportTickets, setSupportTickets] = useState<ContactSupportTicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'ALL'>('ALL');
  const [supportReplyDrafts, setSupportReplyDrafts] = useState<Record<string, string>>({});
  const [supportBusyId, setSupportBusyId] = useState<string | null>(null);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [supportSuccess, setSupportSuccess] = useState<string | null>(null);

  const loadSupportQueue = async () => {
    const rows = await listContactSupportTicketsForAdmin(100);
    setSupportTickets(rows);
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const [leadRows, buyerRows, supportRows] = await Promise.all([
          fetchVerifiedLeads(),
          fetchBuyerAccounts(),
          listContactSupportTicketsForAdmin(100),
        ]);
        if (!mounted) return;
        setLeads(leadRows);
        setBuyers(buyerRows);
        setSupportTickets(supportRows);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  const recon = useMemo(() => weeklyReconciliation(leads), [leads]);

  const visibleLeads = useMemo(
    () => (filterStatus === 'ALL' ? leads : leads.filter((l) => l.status === filterStatus)),
    [leads, filterStatus],
  );

  const supportCounts = useMemo(() => ({
    open: supportTickets.filter((ticket) => ticket.status === 'OPEN').length,
    inProgress: supportTickets.filter((ticket) => ticket.status === 'IN_PROGRESS').length,
    resolved: supportTickets.filter((ticket) => ticket.status === 'RESOLVED').length,
  }), [supportTickets]);

  const advanceStatus = (leadId: string, newStatus: LeadStatus) => {
    const now = new Date().toISOString();
    setLeads((prev) => prev.map((l) => l.id === leadId ? { ...l, status: newStatus, verifiedAt: newStatus === 'VERIFIED' ? now : l.verifiedAt } : l));
    void updateLeadRecord(leadId, {
      status: newStatus,
      verifiedAt: newStatus === 'VERIFIED' ? now : undefined,
      rejectionReason: newStatus === 'REJECTED' ? 'Rejected by admin review' : undefined,
    });
  };

  const routeLead = (leadId: string) => {
    setLeads((prev) =>
      prev.map((l) => {
        if (l.id !== leadId) return l;
        const buyer = matchBuyer(l, buyers);
        if (!buyer) return l;
        const now = new Date().toISOString();
        const closeAt = new Date(Date.now() + 72 * 3_600_000).toISOString();
        void updateLeadRecord(l.id, {
          status: 'DELIVERED',
          deliveredAt: now,
          disputeWindowClosesAt: closeAt,
          assignedBuyerId: buyer.id,
          assignedBuyerName: buyer.orgName,
        });
        return { ...l, status: 'DELIVERED', deliveredAt: now, disputeWindowClosesAt: closeAt, assignedBuyerId: buyer.id, assignedBuyerName: buyer.orgName };
      }),
    );
  };

  const getBuyerInviteLink = () => {

  const handleSupportTicketAction = async (ticketId: string, status: ContactSupportTicketStatus) => {
    setSupportError(null);
    setSupportSuccess(null);
    const message = String(supportReplyDrafts[ticketId] || '').trim();
    if (!message) {
      setSupportError('Add a response before updating the ticket.');
      return;
    }

    setSupportBusyId(ticketId);
    try {
      await respondToContactSupportTicket(ticketId, { message, status });
      const refreshed = await listContactSupportTicketsForAdmin(100);
      setSupportTickets(refreshed);
      setSupportReplyDrafts((prev) => ({ ...prev, [ticketId]: '' }));
      setSupportSuccess(status === 'RESOLVED' ? 'Support ticket resolved and requester notified.' : 'Reply sent and requester notified.');
    } catch (error: any) {
      setSupportError(String(error?.message || 'Failed to update support ticket.'));
    } finally {
      setSupportBusyId(null);
    }
  };
    if (typeof window === 'undefined') return '/buyer-portal';
    return `${window.location.origin}/buyer-portal?invite=buyer`;
  };

  const copyBuyerInviteLink = async (buyer?: BuyerAccount) => {
    const base = getBuyerInviteLink();
    const link = buyer
      ? `${base}&buyerId=${encodeURIComponent(String(buyer.id || '').trim())}`
      : base;
    try {
      await navigator.clipboard.writeText(link);
      window.alert('Buyer invite link copied. Assign BUYER role before login.');
    } catch {
      window.prompt('Copy buyer invite link:', link);
    }
  };

  const tabs: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
    { id: 'LEADS',      label: 'Leads',      icon: <ClipboardList size={15} /> },
    { id: 'BUYERS',     label: 'Buyers',     icon: <Building2 size={15} /> },
    { id: 'SUPPORT',    label: 'Support',    icon: <MessageSquare size={15} /> },
    { id: 'REPORTING',  label: 'Reporting',  icon: <BarChart2 size={15} /> },
    { id: 'COMPLIANCE', label: 'Compliance', icon: <Shield size={15} /> },
    { id: 'PRICING',    label: 'Pricing',    icon: <CircleDollarSign size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            onClick={() => setView('DASHBOARD')}
          >
            <ArrowLeft size={16} />
            Dashboard
          </button>
          <span className="font-bold text-slate-900">Lead Admin</span>
          <div className="inline-flex items-center gap-2 rounded-full bg-violet-50 text-violet-700 px-3 py-1 text-xs font-semibold border border-violet-200">
            <ShieldCheck size={13} />
            Admin Only
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
        {/* KPI Strip */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Leads',       value: leads.length.toString(),               color: 'bg-blue-100 text-blue-700' },
            { label: 'Acceptance Rate',   value: fmtPct(recon.acceptanceRate),          color: 'bg-emerald-100 text-emerald-700' },
            { label: 'Net Revenue',       value: fmt$(recon.netRevenueCents),            color: 'bg-amber-100 text-amber-700' },
            { label: 'Dispute Rate',      value: fmtPct(recon.disputeRate),             color: 'bg-rose-100 text-rose-700' },
          ].map((kpi) => (
            <Card key={kpi.label} className="border-slate-200 bg-white/95">
              <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${kpi.color}`}>{kpi.label}</div>
              <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
            </Card>
          ))}
        </section>

        {/* Tab Bar */}
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

        {/* ── LEADS Tab ──────────────────────────────────────────────────── */}
        {activeTab === 'LEADS' && (
          <Card className="border-slate-200 bg-white/95">
            {loading && <p className="text-sm text-slate-500 mb-3">Loading live lead data...</p>}
            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-slate-900">Lead Pipeline</h2>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-slate-500" />
                <select
                  className="text-sm border border-slate-300 rounded-lg px-2 py-1"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'ALL')}
                >
                  <option value="ALL">All</option>
                  {(['NEW','VERIFIED','DELIVERED','ACCEPTED','REJECTED','REFUNDED'] as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              {visibleLeads.map((lead) => {
                const expanded = expandedLead === lead.id;
                const price = getLeadPrice(lead.tier);
                const windowOpen = isDisputeWindowOpen(lead);
                return (
                  <div key={lead.id} className="border border-slate-200 rounded-xl overflow-hidden">
                    {/* Row */}
                    <div
                      className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                      onClick={() => setExpandedLead(expanded ? null : lead.id)}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-sm font-mono font-semibold text-slate-700 shrink-0">{lead.id}</span>
                        <span className="text-sm text-slate-900 truncate">{lead.applicantName}</span>
                        <span className="text-xs text-slate-500">{lead.city}, {lead.state}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>{lead.status}</span>
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Tier {lead.tier}</span>
                        <span className="text-xs font-semibold text-slate-700">${price}</span>
                        {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {expanded && (
                      <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                          <div><span className="text-slate-500">Case Type</span><p className="font-semibold text-slate-900">{lead.caseType}</p></div>
                          <div><span className="text-slate-500">Quality Score</span><p className="font-semibold text-slate-900">{lead.qualityScore}/100</p></div>
                          <div><span className="text-slate-500">Phone Verified</span><p className="font-semibold text-slate-900">{lead.phoneVerified ? '✓ Yes' : '✗ No'}</p></div>
                          <div><span className="text-slate-500">Email Verified</span><p className="font-semibold text-slate-900">{lead.emailVerified ? '✓ Yes' : '✗ No'}</p></div>
                          <div><span className="text-slate-500">Identity Score</span><p className="font-semibold text-slate-900">{lead.identityScore}</p></div>
                          <div><span className="text-slate-500">Fraud Flagged</span><p className={`font-semibold ${lead.fraudFlagged ? 'text-rose-600' : 'text-emerald-600'}`}>{lead.fraudFlagged ? '⚠ Yes' : '✓ No'}</p></div>
                          <div><span className="text-slate-500">Service Match</span><p className="font-semibold text-slate-900">{lead.serviceAreaMatch ? '✓ Yes' : '✗ No'}</p></div>
                          <div><span className="text-slate-500">Consent</span><p className="font-semibold text-slate-900">{lead.consentToContact ? '✓ Given' : '✗ Missing'}</p></div>
                          <div><span className="text-slate-500">Submitted</span><p className="font-semibold text-slate-900">{formatDate(lead.createdAt)}</p></div>
                          <div><span className="text-slate-500">Dispute Window</span><p className={`font-semibold ${windowOpen ? 'text-amber-600' : 'text-slate-400'}`}>{windowOpen ? 'Open' : 'Closed'} · {formatDate(lead.disputeWindowClosesAt)}</p></div>
                          {lead.assignedBuyerName && (
                            <div className="col-span-2"><span className="text-slate-500">Assigned Buyer</span><p className="font-semibold text-slate-900">{lead.assignedBuyerName}</p></div>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap gap-2 pt-1">
                          {lead.status === 'NEW' && (
                            <Button size="sm" onClick={() => advanceStatus(lead.id, 'VERIFIED')}>
                              <BadgeCheck size={14} className="mr-1" /> Mark Verified
                            </Button>
                          )}
                          {lead.status === 'VERIFIED' && (
                            <Button size="sm" onClick={() => routeLead(lead.id)}>
                              Route to Buyer
                            </Button>
                          )}
                          {(lead.status === 'NEW' || lead.status === 'VERIFIED') && (
                            <Button size="sm" variant="outline" onClick={() => advanceStatus(lead.id, 'REJECTED')}>
                              <XCircle size={14} className="mr-1" /> Reject
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleLeads.length === 0 && (
                <p className="text-sm text-slate-500 py-4 text-center">No leads match selected filter.</p>
              )}
            </div>
          </Card>
        )}

        {/* ── BUYERS Tab ─────────────────────────────────────────────────── */}
        {activeTab === 'BUYERS' && (
          <div className="space-y-3">
            <Card className="border-cyan-200 bg-cyan-50/60">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-cyan-900">Buyer Onboarding Link</h3>
                  <p className="text-xs text-cyan-800 mt-1">
                    Share this link with a buyer to direct them to Buyer Portal. Accounts still require BUYER role assignment.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => copyBuyerInviteLink()}>
                  <Copy size={14} className="mr-1" /> Copy Link
                </Button>
              </div>
            </Card>

            {buyers.map((buyer) => (
              <Card key={buyer.id} className="border-slate-200 bg-white/95">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">{buyer.orgName}</span>
                      {buyer.licenseVerified
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full"><CheckCircle2 size={10} />License ✓</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full"><XCircle size={10} />License Pending</span>
                      }
                      {buyer.tcpaVerified
                        ? <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">TCPA ✓</span>
                        : <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">TCPA Pending</span>
                      }
                    </div>
                    <p className="text-xs text-slate-500">{buyer.contactName} · {buyer.contactEmail}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs">
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">States: {buyer.coverageStates.join(', ')}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">Cap: {buyer.dailyLeadCap}/day</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">Min Score: {buyer.minQualityScore}</span>
                      <span className="bg-slate-100 px-2 py-0.5 rounded-full text-slate-700">Billing: {buyer.billingModel.replace('_', ' ')}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Platform Fee</p>
                    <p className="font-bold text-slate-900">{fmt$(buyer.monthlyPlatformFeeCents)}/mo</p>
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => copyBuyerInviteLink(buyer)}>
                      <Copy size={14} className="mr-1" /> Invite Link
                    </Button>
                    {buyer.billingModel === 'PREPAID_WALLET' && (
                      <>
                        <p className="text-xs text-slate-500 mt-1">Wallet Balance</p>
                        <p className={`font-bold ${buyer.walletBalanceCents < 10000 ? 'text-rose-600' : 'text-emerald-600'}`}>{fmt$(buyer.walletBalanceCents)}</p>
                      </>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* ── SUPPORT Tab ───────────────────────────────────────────────── */}
        {activeTab === 'SUPPORT' && (
          <div className="space-y-4">
            <section className="grid grid-cols-3 gap-3">
              {[
                { label: 'Open', value: supportCounts.open, color: 'bg-slate-100 text-slate-700' },
                { label: 'In Progress', value: supportCounts.inProgress, color: 'bg-amber-100 text-amber-700' },
                { label: 'Resolved', value: supportCounts.resolved, color: 'bg-emerald-100 text-emerald-700' },
              ].map((kpi) => (
                <Card key={kpi.label} className="border-slate-200 bg-white/95">
                  <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold mb-1 ${kpi.color}`}>{kpi.label}</div>
                  <p className="text-2xl font-bold text-slate-900">{kpi.value}</p>
                </Card>
              ))}
            </section>

            <Card className="border-slate-200 bg-white/95">
              <div className="flex items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">AERA Support Queue</h2>
                  <p className="text-xs text-slate-500 mt-1">Org admins and general users can submit tickets from Settings. Replies here notify the requester and persist the admin handling the issue.</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => void loadSupportQueue()}>
                  <RefreshCcw size={14} className="mr-1" /> Refresh
                </Button>
              </div>

              {supportError && <p className="text-xs font-semibold text-rose-700 mb-3">{supportError}</p>}
              {supportSuccess && <p className="text-xs font-semibold text-emerald-700 mb-3">{supportSuccess}</p>}

              {supportTickets.length === 0 ? (
                <p className="text-sm text-slate-500">No support tickets in the queue.</p>
              ) : (
                <div className="space-y-3">
                  {supportTickets.map((ticket) => (
                    <div key={ticket.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <p className="font-bold text-slate-900">{ticket.subject}</p>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${SUPPORT_STATUS_COLORS[ticket.status]}`}>{ticket.status === 'IN_PROGRESS' ? 'In Progress' : ticket.status}</span>
                            <span className="text-[10px] font-bold bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full">{ticket.category}</span>
                          </div>
                          <p className="text-xs text-slate-500">
                            {ticket.requesterName || 'Unknown user'} · {ticket.requesterRole || 'User'}
                            {ticket.requesterEmail ? ` · ${ticket.requesterEmail}` : ''}
                            {ticket.orgName ? ` · ${ticket.orgName}` : ''}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-1">Submitted {formatDate(ticket.createdAt)} · Ticket {ticket.id}</p>
                        </div>
                        <div className="text-right text-xs text-slate-500">
                          <p>{ticket.assignedAdminName ? `Handling: ${ticket.assignedAdminName}` : 'Unassigned'}</p>
                          {ticket.resolvedByAdminName && <p>Resolved by {ticket.resolvedByAdminName}</p>}
                        </div>
                      </div>

                      <div className="space-y-2">
                        {ticket.messages.map((entry, index) => (
                          <div key={`${ticket.id}-${entry.createdAt}-${index}`} className={`rounded-xl border px-3 py-2 ${entry.authorRole === 'ADMIN' ? 'border-sky-200 bg-sky-50' : 'border-slate-200 bg-white'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-xs font-semibold text-slate-800">{entry.authorName}</p>
                              <p className="text-[10px] text-slate-400">{formatDate(entry.createdAt)}</p>
                            </div>
                            <p className="text-xs text-slate-600 mt-1">{entry.message}</p>
                          </div>
                        ))}
                      </div>

                      {ticket.status !== 'RESOLVED' && (
                        <div className="space-y-2 border-t border-slate-200 pt-3">
                          <label className="block text-xs font-semibold text-slate-700">Admin response</label>
                          <textarea
                            className="w-full min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                            placeholder="Tell the requester what you need from them or what you did to help."
                            value={supportReplyDrafts[ticket.id] || ''}
                            onChange={(event) => setSupportReplyDrafts((prev) => ({ ...prev, [ticket.id]: event.target.value }))}
                          />
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => void handleSupportTicketAction(ticket.id, 'IN_PROGRESS')}
                              disabled={supportBusyId === ticket.id}
                            >
                              {supportBusyId === ticket.id ? <RefreshCcw size={14} className="mr-1 animate-spin" /> : null}
                              Send Update
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => void handleSupportTicketAction(ticket.id, 'RESOLVED')}
                              disabled={supportBusyId === ticket.id}
                            >
                              {supportBusyId === ticket.id ? <RefreshCcw size={14} className="mr-1 animate-spin" /> : null}
                              Resolve Ticket
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── REPORTING Tab ──────────────────────────────────────────────── */}
        {activeTab === 'REPORTING' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Weekly Reconciliation</h2>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <RefreshCcw size={12} />
                  {formatDate(recon.weekStart)} → {formatDate(recon.weekEnd)}
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                {[
                  { label: 'Delivered',       value: recon.totalDelivered },
                  { label: 'Accepted',        value: recon.totalAccepted },
                  { label: 'Rejected',        value: recon.totalRejected },
                  { label: 'Disputed',        value: recon.totalDisputed },
                  { label: 'Acceptance Rate', value: fmtPct(recon.acceptanceRate) },
                  { label: 'Dispute Rate',    value: fmtPct(recon.disputeRate) },
                  { label: 'Gross Revenue',   value: fmt$(recon.grossRevenueCents) },
                  { label: 'Net Revenue',     value: fmt$(recon.netRevenueCents) },
                ].map((row) => (
                  <div key={row.label} className="border border-slate-100 rounded-xl p-3">
                    <p className="text-xs text-slate-500">{row.label}</p>
                    <p className="text-xl font-bold text-slate-900">{row.value}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Lead Revenue Breakdown</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-slate-500 border-b border-slate-200">
                    <tr>
                      <th className="py-2 pr-3 font-semibold">Lead</th>
                      <th className="py-2 pr-3 font-semibold">Tier</th>
                      <th className="py-2 pr-3 font-semibold">Status</th>
                      <th className="py-2 pr-3 font-semibold">Buyer</th>
                      <th className="py-2 font-semibold text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leads.map((lead) => {
                      const revenue = lead.status === 'ACCEPTED' ? getLeadPrice(lead.tier) : 0;
                      return (
                        <tr key={lead.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 font-mono text-xs text-slate-700">{lead.id}</td>
                          <td className="py-2 pr-3"><span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">Tier {lead.tier}</span></td>
                          <td className="py-2 pr-3"><span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[lead.status]}`}>{lead.status}</span></td>
                          <td className="py-2 pr-3 text-xs text-slate-600">{lead.assignedBuyerName ?? '—'}</td>
                          <td className={`py-2 text-right font-semibold ${revenue > 0 ? 'text-emerald-600' : 'text-slate-400'}`}>{revenue > 0 ? `$${revenue}` : '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        )}

        {/* ── COMPLIANCE Tab ─────────────────────────────────────────────── */}
        {activeTab === 'COMPLIANCE' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert size={18} className="text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">Compliance Controls</h2>
              </div>
              <div className="space-y-3 text-sm">
                {[
                  { title: 'TCPA / Do-Not-Call', status: 'Active', desc: 'All outbound contact screened against DNC registry. STOP keyword opt-out enforced across all SMS channels.', ok: true },
                  { title: 'Consent Capture', status: 'Active', desc: 'Explicit opt-in with timestamp + IP collected on every lead. Consent language reviewed Q4-2025.', ok: true },
                  { title: 'Data Retention Policy', status: 'Active', desc: '90-day retention enforced. Deletion workflow runs nightly. Users may request deletion via Settings.', ok: true },
                  { title: 'Licensed Buyer Verification', status: 'Partial', desc: '1 of 2 active buyers has provided verified license documentation. BUYER-002 license pending.', ok: false },
                  { title: 'Fraud Detection', status: 'Active', desc: 'IP velocity checks, device fingerprinting, and identity-score threshold of 50 minimum enforced.', ok: true },
                  { title: 'Duplicate Suppression', status: 'Active', desc: '90-day rolling window. Leads matching same phone or email are flagged and held for review.', ok: true },
                  { title: 'Privacy Policy', status: 'Current', desc: 'Last updated 2025-12-01. Covers PII handling, third-party sharing, and data subject rights (CCPA/state).', ok: true },
                ].map((ctrl) => (
                  <div key={ctrl.title} className={`rounded-xl border p-3 flex items-start gap-3 ${ctrl.ok ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                    {ctrl.ok
                      ? <CheckCircle2 size={16} className="text-emerald-600 mt-0.5 shrink-0" />
                      : <FileWarning size={16} className="text-amber-600 mt-0.5 shrink-0" />
                    }
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{ctrl.title}</p>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ctrl.ok ? 'bg-emerald-200 text-emerald-800' : 'bg-amber-200 text-amber-800'}`}>{ctrl.status}</span>
                      </div>
                      <p className="text-xs text-slate-600 mt-0.5">{ctrl.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Dispute & Refund Policy</h2>
              <div className="space-y-2 text-sm text-slate-700">
                <p><strong>Dispute Window:</strong> 72 hours from lead delivery.</p>
                <p><strong>Auto-credit reasons:</strong> Duplicate, Invalid Contact, Out of Service Area, Consent Issue → 100% credit.</p>
                <p><strong>Partial credit reasons:</strong> Already Client → 75% credit. Other (reviewed) → 50% credit.</p>
                <p><strong>Auto-pause rule:</strong> Buyer accounts with &gt;30% dispute rate in any 7-day period are automatically paused for review.</p>
                <p><strong>Billing trigger:</strong> Charge fires on ACCEPTED status or when dispute window closes without rejection.</p>
                <p><strong>Net terms:</strong> NET-7 for enterprise; NET-15 standard. Failed auto-pay pauses lead delivery after 3 retries.</p>
              </div>
            </Card>
          </div>
        )}

        {/* ── PRICING Tab ────────────────────────────────────────────────── */}
        {activeTab === 'PRICING' && (
          <div className="space-y-4">
            <Card className="border-slate-200 bg-white/95">
              <div className="flex items-center gap-2 mb-4">
                <CircleDollarSign size={18} className="text-slate-600" />
                <h2 className="text-lg font-bold text-slate-900">Lead Pricing Tiers</h2>
              </div>
              <div className="space-y-3">
                {DEFAULT_LEAD_PRICING.map((tier) => (
                  <div key={tier.tier} className={`rounded-xl border-2 p-4 flex items-start justify-between gap-4 ${tier.tier === 'A' ? 'border-amber-300 bg-amber-50' : tier.tier === 'B' ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
                    <div>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${tier.tier === 'A' ? 'bg-amber-200 text-amber-800' : tier.tier === 'B' ? 'bg-blue-200 text-blue-800' : 'bg-slate-200 text-slate-700'}`}>Tier {tier.tier}</span>
                      <p className="font-bold text-slate-900 mt-1">{tier.label}</p>
                      <p className="text-xs text-slate-600 mt-0.5">{tier.description}</p>
                    </div>
                    <p className="text-2xl font-black text-slate-900 shrink-0">${tier.priceUsd}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Billing Models</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                {[
                  { model: 'Prepaid Wallet', desc: 'Buyer deposits funds. Each accepted lead deducts balance instantly. Delivery pauses at $0.', badge: 'Low Risk' },
                  { model: 'NET-15',         desc: 'Invoice sent on acceptance event. Payment due 15 days later. Auto-retry 3× on failure.', badge: 'Standard' },
                  { model: 'NET-7 Enterprise', desc: 'Invoice weekly. Credit limit enforced. Auto-pause if 7-day balance exceeds limit.', badge: 'Enterprise' },
                ].map((bm) => (
                  <div key={bm.model} className="border border-slate-200 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-slate-900">{bm.model}</p>
                      <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">{bm.badge}</span>
                    </div>
                    <p className="text-xs text-slate-600">{bm.desc}</p>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95">
              <h2 className="text-lg font-bold text-slate-900 mb-3">Revenue Formula</h2>
              <div className="bg-slate-900 text-emerald-400 rounded-xl px-4 py-3 text-sm font-mono">
                Revenue = (Accepted Leads × Price per Tier) + Monthly Platform Fees − Credits
              </div>
              <div className="mt-3 space-y-1 text-sm text-slate-700">
                <p><strong>Platform Fee:</strong> $299–$499/month per buyer account.</p>
                <p><strong>Per Lead (Tier A):</strong> $275 · <strong>Tier B:</strong> $145 · <strong>Tier C:</strong> $75</p>
                <p><strong>Stripe:</strong> Automated ACH/card charges on acceptance event or invoice due date.</p>
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
};
