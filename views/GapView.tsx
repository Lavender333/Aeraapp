
import React from 'react';
import { ViewState, UserRole } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StorageService } from '../services/storage';
import { AlertCircle, ArrowLeft, Info, ShieldCheck } from 'lucide-react';

export const GapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const role = String(profile.role || 'GENERAL_USER').toUpperCase() as UserRole;

  const isCoreAdmin = role === 'ADMIN';
  const isOrgAdmin = role === 'ORG_ADMIN' || role === 'INSTITUTION_ADMIN';
  const isMemberView = !isCoreAdmin && !isOrgAdmin;

  return (
    <div className="min-h-screen bg-emerald-50/60 flex flex-col pb-safe animate-fade-in">
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

      <div className="p-5 space-y-4">
        <Card className="border-emerald-200 bg-white/95">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide">G.A.P. Center</p>
          <p className="text-sm text-slate-700 mt-1">Grants • Advances • Provision</p>
        </Card>

        {isMemberView && (
          <>
            <Card className="border-slate-200 bg-white/95 space-y-3">
              <h3 className="font-bold text-slate-900">Hardship Assistance (CORE)</h3>
              <Button fullWidth>Apply for Assistance</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm">Status Tracker</Button>
                <Button variant="outline" size="sm">Payment History</Button>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95 space-y-3">
              <h3 className="font-bold text-slate-900">Advances (If Enabled)</h3>
              <p className="text-sm text-slate-600">Short-term assistance pending other funding.</p>
              <Button fullWidth variant="outline">Request Advance</Button>
            </Card>

            <Card className="border-slate-200 bg-white/95 space-y-3">
              <h3 className="font-bold text-slate-900">Grants</h3>
              <p className="text-sm text-slate-600">External resources.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline">View Available Grants</Button>
                <Button>Apply Externally</Button>
              </div>
            </Card>
          </>
        )}

        {isOrgAdmin && (
          <>
            <Card className="border-emerald-200 bg-white/95">
              <h3 className="font-bold text-slate-900 mb-3">G.A.P. Allocation Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Participation Percentage</p><p className="text-lg font-black text-slate-900">—</p></div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Allocation Capacity <Info size={12} className="text-slate-400" title="Allocation capacity represents the maximum potential hardship support available to your organization during the current review period." /></p>
                  <p className="text-lg font-black text-slate-900">—</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Amount Disbursed</p><p className="text-lg font-black text-slate-900">—</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Remaining Balance</p><p className="text-lg font-black text-slate-900">—</p></div>
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
                    <tr className="border-b border-slate-100">
                      <td className="py-3">—</td><td>—</td><td>—</td><td>—</td><td>Pending</td>
                      <td>
                        <div className="flex gap-2">
                          <Button size="sm">Recommend</Button>
                          <Button size="sm" variant="outline">Request Info</Button>
                          <Button size="sm" variant="outline">Decline</Button>
                        </div>
                      </td>
                    </tr>
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
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Total Hardship Fund</p><p className="text-lg font-black text-slate-900">—</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Pending Applications</p><p className="text-lg font-black text-slate-900">—</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Allocation Distribution</p><p className="text-lg font-black text-slate-900">—</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Override Log</p><p className="text-lg font-black text-slate-900">—</p></div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-bold text-slate-900">Application Review Panel</h4>
              <p className="text-sm text-slate-600">Full documentation • Allocation cap check • Approve / Adjust / Deny • Override (logged)</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm">Approve</Button>
                <Button size="sm" variant="outline">Adjust</Button>
                <Button size="sm" variant="outline">Deny</Button>
                <Button size="sm" variant="outline">Override (Logged)</Button>
              </div>
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
