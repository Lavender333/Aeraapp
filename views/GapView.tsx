
import React, { useEffect, useState } from 'react';
import { HelpRequestRecord, ViewState, UserRole } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StorageService } from '../services/storage';
import { AlertCircle, ArrowLeft, Info, ShieldCheck } from 'lucide-react';

export const GapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const db = StorageService.getDB();
  const role = String(profile.role || 'GENERAL_USER').toUpperCase() as UserRole;
  const reviewerScopeKey = `aera_gap_review_actions:${String(profile.id || 'guest')}:${String(profile.communityId || '').trim()}:${role}`;
  const [reviewActions, setReviewActions] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(reviewerScopeKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [memberPanel, setMemberPanel] = useState<'STATUS' | 'PAYMENTS' | 'ADVANCE' | 'GRANTS'>('STATUS');

  useEffect(() => {
    try {
      localStorage.setItem(reviewerScopeKey, JSON.stringify(reviewActions));
    } catch {
      // Ignore storage write failures to keep workflow usable.
    }
  }, [reviewActions, reviewerScopeKey]);

  const isCoreAdmin = role === 'ADMIN';
  const isOrgAdmin = role === 'ORG_ADMIN' || role === 'INSTITUTION_ADMIN';
  const isMemberView = !isCoreAdmin && !isOrgAdmin;

  const users = db.users || [];
  const allRequests = (db.requests || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const allOrganizations = db.organizations || [];

  const resolveOrgForRequest = (request: HelpRequestRecord) => {
    const user = users.find((u) => u.id === request.userId);
    return String(user?.communityId || '').trim();
  };

  const orgScopeId = String(profile.communityId || '').trim();
  const orgMembers = orgScopeId ? StorageService.getOrgMembers(orgScopeId) : [];
  const orgMemberById = new Map(orgMembers.map((member) => [member.id, member.name]));

  const pendingStatuses = new Set(['PENDING', 'RECEIVED']);
  const memberRequests = allRequests.filter((req) => req.userId === profile.id);
  const memberPendingRequests = memberRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const memberResolvedRequests = memberRequests.filter((req) => String(req.status || '').toUpperCase() === 'RESOLVED');
  const orgRequests = isOrgAdmin
    ? allRequests.filter((req) => resolveOrgForRequest(req) === orgScopeId)
    : [];

  const pendingOrgRequests = orgRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const resolvedOrgRequests = orgRequests.filter((req) => String(req.status || '').toUpperCase() === 'RESOLVED');

  const participatingUsers = new Set(orgRequests.map((req) => req.userId));
  const participationBase = Math.max(0, orgMembers.length || users.filter((u) => String(u.communityId || '') === orgScopeId).length);
  const participationPct = participationBase > 0 ? Math.round((participatingUsers.size / participationBase) * 100) : 0;

  const allocationCapacity = participationBase * 250;
  const amountDisbursed = resolvedOrgRequests.length * 250;
  const remainingBalance = Math.max(0, allocationCapacity - amountDisbursed);

  const corePendingApplications = allRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const coreResolvedApplications = allRequests.filter((req) => String(req.status || '').toUpperCase() === 'RESOLVED');
  const orgsWithPending = new Set(corePendingApplications.map((req) => resolveOrgForRequest(req)).filter(Boolean)).size;
  const totalHardshipFund = allOrganizations.reduce((sum, org) => {
    const orgCode = String(org.id || '').trim();
    const memberCount = StorageService.getOrgMembers(orgCode).length || Number(org.registeredPopulation || 0) || 0;
    return sum + memberCount * 250;
  }, 0);

  const reviewTarget = corePendingApplications[0] || null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

  const handleReviewAction = (requestId: string, action: 'Recommend' | 'Request Info' | 'Decline' | 'Approve' | 'Adjust' | 'Deny' | 'Override') => {
    setReviewActions((prev) => ({ ...prev, [requestId]: action }));
  };

  const getRequestAmount = (request: HelpRequestRecord) => Math.max(100, Number(request.peopleCount || 1) * 125);

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 border-b border-emerald-700 p-4 sticky top-0 z-20 text-white">
        <div className="flex items-start gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-emerald-100 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-xl">G.A.P. Center</h1>
            <p className="text-xs text-emerald-100">Community Support Hub</p>
            <p className="text-xs text-emerald-100">Powered by CORE (Community Organized Response &amp; Education)</p>
            <p className="text-[11px] text-emerald-200 mt-2">Charitable hardship assistance is subject to documented need and available funds.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <Card className="border-emerald-300 bg-white">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-[0.08em]">G.A.P. Center</p>
          <p className="text-base font-semibold text-slate-900 mt-1">Grants • Advances • Provision</p>
          <p className="text-xs text-slate-600 mt-1">Support options based on documented need and current eligibility.</p>
        </Card>

        {isMemberView && (
          <>
            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Hardship Assistance (CORE)</h3>
              <Button fullWidth onClick={() => setView('HELP_WIZARD')}>Apply for Assistance</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={memberPanel === 'STATUS' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setMemberPanel('STATUS')}
                >
                  Status Tracker
                </Button>
                <Button
                  variant={memberPanel === 'PAYMENTS' ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setMemberPanel('PAYMENTS')}
                >
                  Payment History
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Logged</p>
                  <p className="text-sm font-bold text-slate-900">{memberRequests.length}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-700">Pending</p>
                  <p className="text-sm font-bold text-amber-800">{memberPendingRequests.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Resolved</p>
                  <p className="text-sm font-bold text-emerald-800">{memberResolvedRequests.length}</p>
                </div>
              </div>

              {memberPanel === 'STATUS' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Recent Applications</p>
                  {memberRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{req.emergencyType || 'General'} • {new Date(req.timestamp).toLocaleDateString()}</span>
                      <span className="font-semibold text-slate-900">{reviewActions[req.id] || req.status}</span>
                    </div>
                  ))}
                  {memberRequests.length === 0 && <p className="text-xs text-slate-500">No applications yet. Start with Apply for Assistance.</p>}
                </div>
              )}

              {memberPanel === 'PAYMENTS' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-700">Resolved Disbursements</p>
                  {memberResolvedRequests.slice(0, 3).map((req) => (
                    <div key={req.id} className="flex items-center justify-between text-xs">
                      <span className="text-slate-700">{new Date(req.timestamp).toLocaleDateString()}</span>
                      <span className="font-semibold text-emerald-700">{formatCurrency(getRequestAmount(req))}</span>
                    </div>
                  ))}
                  {memberResolvedRequests.length === 0 && <p className="text-xs text-slate-500">No payment history available yet.</p>}
                </div>
              )}
            </Card>

            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Advances (If Enabled)</h3>
              <p className="text-sm text-slate-600">Short-term assistance pending other funding.</p>
              <Button fullWidth variant={memberPanel === 'ADVANCE' ? 'primary' : 'outline'} onClick={() => setMemberPanel('ADVANCE')}>Request Advance</Button>
              {memberPanel === 'ADVANCE' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs text-slate-700">Advance requests are reviewed alongside your hardship application to prevent duplicate awards.</p>
                </div>
              )}
            </Card>

            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Grants</h3>
              <p className="text-sm text-slate-600">External resources.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant={memberPanel === 'GRANTS' ? 'primary' : 'outline'} onClick={() => setMemberPanel('GRANTS')}>View Available Grants</Button>
                <Button onClick={() => setMemberPanel('GRANTS')}>Apply Externally</Button>
              </div>
              {memberPanel === 'GRANTS' && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs text-slate-700">
                  <p>• FEMA Individual Assistance</p>
                  <p>• 2-1-1 community aid referrals</p>
                  <p>• Local nonprofit disaster grants</p>
                </div>
              )}
            </Card>
          </>
        )}

        {isOrgAdmin && (
          <>
            <Card className="border-emerald-200 bg-white/95">
              <h3 className="font-bold text-slate-900 mb-3">G.A.P. Allocation Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Participation Percentage</p><p className="text-lg font-black text-slate-900">{participationPct}%</p></div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Allocation Capacity <Info size={12} className="text-slate-400" title="Allocation capacity represents the maximum potential hardship support available to your organization during the current review period." /></p>
                  <p className="text-lg font-black text-slate-900">{formatCurrency(allocationCapacity)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Amount Disbursed</p><p className="text-lg font-black text-slate-900">{formatCurrency(amountDisbursed)}</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Remaining Balance</p><p className="text-lg font-black text-slate-900">{formatCurrency(remainingBalance)}</p></div>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95 space-y-3">
              <h3 className="font-bold text-slate-900">Member Applications Queue</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="py-2">Member</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Requested</th>
                      <th className="py-2">Docs</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Recommend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingOrgRequests.slice(0, 8).map((req) => {
                      const docsReady = Boolean(String(req.situationDescription || '').trim()) && Boolean(req.consentToShare);
                      const memberName = orgMemberById.get(req.userId) || users.find((u) => u.id === req.userId)?.fullName || 'Member';
                      const requestedAmount = Math.max(100, Number(req.peopleCount || 1) * 125);
                      return (
                        <tr key={req.id} className="border-b border-slate-100">
                          <td className="py-3 font-medium text-slate-900">{memberName}</td>
                          <td className="py-3">{req.emergencyType || 'General'}</td>
                          <td className="py-3">{formatCurrency(requestedAmount)}</td>
                          <td className="py-3">{docsReady ? 'Submitted' : 'Needs Info'}</td>
                          <td className="py-3">{reviewActions[req.id] || 'Pending'}</td>
                          <td>
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => handleReviewAction(req.id, 'Recommend')}>Recommend</Button>
                              <Button size="sm" variant="outline" onClick={() => handleReviewAction(req.id, 'Request Info')}>Request Info</Button>
                              <Button size="sm" variant="outline" onClick={() => handleReviewAction(req.id, 'Decline')}>Decline</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {pendingOrgRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">No pending applications.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">All hardship disbursements are reviewed and approved by CORE.</p>
            </Card>
          </>
        )}

        {isCoreAdmin && (
          <Card className="border-emerald-300 bg-white/95 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-700" />
              <h3 className="font-bold text-slate-900">G.A.P. Administration (CORE)</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Total Hardship Fund</p><p className="text-lg font-black text-slate-900">{formatCurrency(totalHardshipFund)}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Pending Applications</p><p className="text-lg font-black text-slate-900">{corePendingApplications.length}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Allocation Distribution</p><p className="text-lg font-black text-slate-900">{orgsWithPending}/{allOrganizations.length || 1}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Override Log</p><p className="text-lg font-black text-slate-900">{Object.values(reviewActions).filter((v) => v === 'Override').length}</p></div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-bold text-slate-900">Application Review Panel</h4>
              <p className="text-sm text-slate-600">Full documentation • Allocation cap check • Approve / Adjust / Deny • Override (logged)</p>
              {reviewTarget ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{users.find((u) => u.id === reviewTarget.userId)?.fullName || reviewTarget.userId}</p>
                  <p className="text-slate-600">Type: {reviewTarget.emergencyType || 'General'} • Priority: {reviewTarget.priority}</p>
                  <p className="text-slate-600">Docs: {reviewTarget.consentToShare ? 'Consented' : 'Missing Consent'}</p>
                </div>
              ) : (
                <p className="text-sm text-slate-500">No pending applications to review.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!reviewTarget} onClick={() => reviewTarget && handleReviewAction(reviewTarget.id, 'Approve')}>Approve</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && handleReviewAction(reviewTarget.id, 'Adjust')}>Adjust</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && handleReviewAction(reviewTarget.id, 'Deny')}>Deny</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && handleReviewAction(reviewTarget.id, 'Override')}>Override (Logged)</Button>
              </div>
              {reviewTarget && reviewActions[reviewTarget.id] && (
                <p className="text-xs text-emerald-700 font-semibold">Review action recorded: {reviewActions[reviewTarget.id]}</p>
              )}
            </div>
          </Card>
        )}

        <Card className="border-slate-200 bg-white/95">
          <p className="text-xs text-slate-700 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 text-slate-500" />
            Allocation capacity reflects participation and remains subject to charitable review.
          </p>
        </Card>
      </div>
    </div>
  );
};
