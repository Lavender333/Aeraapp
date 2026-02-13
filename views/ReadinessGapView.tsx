import React, { useEffect, useState } from 'react';
import { ArrowLeft, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';
import { ViewState } from '../types';
import { fetchKitGuidanceForCurrentUser } from '../services/api';

type KitGuidance = {
  recommended_duration_days: number;
  readiness_score: number;
  readiness_cap: number;
  risk_tier: string;
  added_items: Array<{ id: string; item: string; category: string; priority: string; explanation?: string | null }>;
  critical_missing_items: Array<{ id: string; item: string; explanation?: string | null }>;
};

export const ReadinessGapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const [guidance, setGuidance] = useState<KitGuidance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await fetchKitGuidanceForCurrentUser();
        if (active) setGuidance(data as KitGuidance);
      } catch {
        if (active) setGuidance(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const missing = guidance?.critical_missing_items || [];
  const additions = guidance?.added_items || [];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('READINESS')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-lg text-slate-900">Readiness Gaps</h1>
            <p className="text-xs text-slate-500">What to prioritize next for your household.</p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {loading ? (
          <p className="text-sm text-slate-500">Loading readiness guidance…</p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                <p className="text-[10px] uppercase font-bold text-emerald-700">Readiness</p>
                <p className="text-lg font-black text-emerald-900">{Math.round(Number(guidance?.readiness_score || 0))}%</p>
              </div>
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                <p className="text-[10px] uppercase font-bold text-amber-700">Risk Tier</p>
                <p className="text-lg font-black text-amber-900">{guidance?.risk_tier || 'N/A'}</p>
              </div>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-2 text-center">
                <p className="text-[10px] uppercase font-bold text-blue-700">Target Days</p>
                <p className="text-lg font-black text-blue-900">{Number(guidance?.recommended_duration_days || 0)}d</p>
              </div>
            </div>

            <div className="bg-white border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle size={16} className="text-red-600" />
                <h2 className="text-sm font-bold text-red-700 uppercase">Critical Missing Items</h2>
              </div>
              {missing.length === 0 ? (
                <p className="text-sm text-emerald-700 flex items-center gap-2"><CheckCircle2 size={16} /> No critical gaps found.</p>
              ) : (
                <ul className="space-y-2">
                  {missing.map((item) => (
                    <li key={item.id} className="text-sm text-slate-800">
                      • <span className="font-semibold">{item.item}</span>
                      {item.explanation ? <span className="text-slate-500"> — {item.explanation}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck size={16} className="text-slate-700" />
                <h2 className="text-sm font-bold text-slate-700 uppercase">Recommended Additions</h2>
              </div>
              {additions.length === 0 ? (
                <p className="text-sm text-slate-500">No additional items recommended right now.</p>
              ) : (
                <ul className="space-y-2">
                  {additions.slice(0, 12).map((item) => (
                    <li key={item.id} className="text-sm text-slate-800">
                      • <span className="font-semibold">{item.item}</span> <span className="text-[11px] uppercase text-slate-500">({item.priority})</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <button
              onClick={() => setView('READINESS')}
              className="w-full rounded-xl bg-slate-900 text-white py-3 text-sm font-semibold"
            >
              Open Readiness Checklist
            </button>
          </>
        )}
      </div>
    </div>
  );
};
