import React, { useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, Copy, ExternalLink, LineChart as LineChartIcon, TrendingUp } from 'lucide-react';
import { Button } from '../components/Button';
import { ViewState } from '../types';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';

type FinanceTierKey = 'tier1' | 'tier2' | 'tier3';
type FinanceScenario = 'low' | 'medium' | 'high';

const financeTierDefaults = {
  tier1: {
    name: 'MVP / Sandbox',
    targetUsers: 300,
    costs: {
      low: [2500, 3000] as [number, number],
      medium: [3600, 5300] as [number, number],
      high: [8500, 9000] as [number, number],
    },
  },
  tier2: {
    name: 'Neighborhood',
    targetUsers: 15000,
    costs: {
      low: [12800, 13400] as [number, number],
      medium: [14800, 23500] as [number, number],
      high: [33500, 44000] as [number, number],
    },
  },
  tier3: {
    name: 'City-Level',
    targetUsers: 250000,
    costs: {
      low: [38500, 40000] as [number, number],
      medium: [44500, 67500] as [number, number],
      high: [86000, 155000] as [number, number],
    },
  },
} as const;

const readQueryDefaults = () => {
  const params = new URLSearchParams(window.location.search || '');
  const tier = params.get('tier') as FinanceTierKey | null;
  const scenario = params.get('scenario') as FinanceScenario | null;
  const users = Number(params.get('users') || '3000');
  const price = Number(params.get('price') || '2');
  const fee = Number(params.get('fee') || '20');

  return {
    tier: tier === 'tier1' || tier === 'tier2' || tier === 'tier3' ? tier : 'tier2',
    scenario: scenario === 'low' || scenario === 'medium' || scenario === 'high' ? scenario : 'high',
    users: Number.isFinite(users) && users >= 0 ? users : 3000,
    price: Number.isFinite(price) && price >= 0 ? price : 2,
    fee: Number.isFinite(fee) && fee >= 0 && fee <= 100 ? fee : 20,
  };
};

export const FinanceDashboardView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const defaults = readQueryDefaults();
  const [tierKey, setTierKey] = useState<FinanceTierKey>(defaults.tier);
  const [scenario, setScenario] = useState<FinanceScenario>(defaults.scenario);
  const [users, setUsers] = useState<number>(defaults.users);
  const [price, setPrice] = useState<number>(defaults.price);
  const [appleFeePercent, setAppleFeePercent] = useState<number>(defaults.fee);

  const tier = financeTierDefaults[tierKey];
  const monthlyCost = Math.round((tier.costs[scenario][0] + tier.costs[scenario][1]) / 2);
  const gross = users * price;
  const feeRate = Math.max(0, Math.min(1, appleFeePercent / 100));
  const appleFee = gross * feeRate;
  const netRevenue = Math.max(0, gross - appleFee);
  const monthlyProfit = netRevenue - monthlyCost;
  const netPricePerUser = price * (1 - feeRate);
  const breakEvenUsers = netPricePerUser > 0 ? Math.ceil(monthlyCost / netPricePerUser) : null;

  const series = useMemo(() => {
    return Array.from({ length: 12 }).map((_, idx) => {
      const month = idx + 1;
      const projectedUsers = Math.round(users * Math.pow(1.08, idx));
      const projectedGross = projectedUsers * price;
      const projectedFee = projectedGross * feeRate;
      const projectedNet = Math.max(0, projectedGross - projectedFee);
      const projectedProfit = projectedNet - monthlyCost;
      return {
        month,
        users: projectedUsers,
        gross: projectedGross,
        appleFee: projectedFee,
        net: projectedNet,
        cost: monthlyCost,
        profit: projectedProfit,
      };
    });
  }, [users, price, feeRate, monthlyCost]);

  const copyShareLink = async () => {
    const params = new URLSearchParams({
      tier: tierKey,
      scenario,
      users: String(users),
      price: String(price),
      fee: String(appleFeePercent),
    });
    const link = `${window.location.origin}/finance-dashboard?${params.toString()}`;
    try {
      await navigator.clipboard.writeText(link);
      alert('Share link copied. Anyone with the link can open and edit these assumptions.');
    } catch {
      window.prompt('Copy this share link:', link);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-safe">
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800" aria-label="Back to dashboard">
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-lg text-slate-900">Financial Dashboard</h1>
            <p className="text-xs text-slate-500">Public share mode: editable assumptions for collaborators</p>
          </div>
          <Button size="sm" variant="outline" onClick={copyShareLink}>
            <Copy size={14} className="mr-1" /> Copy Share Link
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 md:grid-cols-5 gap-3">
          <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
            Tier
            <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={tierKey} onChange={(e) => setTierKey(e.target.value as FinanceTierKey)}>
              <option value="tier1">Tier 1 (MVP / Sandbox)</option>
              <option value="tier2">Tier 2 (Neighborhood)</option>
              <option value="tier3">Tier 3 (City-Level)</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
            Scenario
            <select className="border border-slate-300 rounded-lg px-3 py-2 text-sm" value={scenario} onChange={(e) => setScenario(e.target.value as FinanceScenario)}>
              <option value="high">High Cost</option>
              <option value="medium">Medium Cost</option>
              <option value="low">Low Cost</option>
            </select>
          </label>

          <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
            Active Users
            <input type="number" min={0} value={users} onChange={(e) => setUsers(Math.max(0, Number(e.target.value) || 0))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
            Price/User (gross)
            <input type="number" min={0} value={price} onChange={(e) => setPrice(Math.max(0, Number(e.target.value) || 0))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>

          <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
            Apple Fee %
            <input type="number" min={0} max={100} value={appleFeePercent} onChange={(e) => setAppleFeePercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))} className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Cost</p>
            <p className="text-lg font-bold text-slate-900">${monthlyCost.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Gross</p>
            <p className="text-lg font-bold text-slate-900">${gross.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Apple Fee</p>
            <p className="text-lg font-bold text-slate-900">-${appleFee.toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Net Revenue</p>
            <p className="text-lg font-bold text-slate-900">${netRevenue.toLocaleString()}</p>
          </div>
          <div className={`border rounded-xl p-3 ${monthlyProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-orange-50 border-orange-200'}`}>
            <p className="text-[11px] font-bold uppercase text-slate-500">Profit</p>
            <p className={`text-lg font-bold ${monthlyProfit >= 0 ? 'text-emerald-700' : 'text-orange-700'}`}>{monthlyProfit >= 0 ? '+' : '-'}${Math.abs(monthlyProfit).toLocaleString()}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-3">
            <p className="text-[11px] font-bold uppercase text-slate-500">Break-even Users</p>
            <p className="text-lg font-bold text-slate-900">{breakEvenUsers?.toLocaleString() ?? 'N/A'}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3"><LineChartIcon size={16} className="text-blue-700" /> Revenue, Cost, Profit (12 months)</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(val: number | string) => `$${Number(val).toLocaleString()}`} />
                <Legend />
                <Line type="monotone" dataKey="net" stroke="#2563eb" strokeWidth={3} name="Net Revenue" dot={false} />
                <Line type="monotone" dataKey="cost" stroke="#f59e0b" strokeWidth={2} name="Cost" dot={false} />
                <Line type="monotone" dataKey="profit" stroke="#10b981" strokeWidth={2} name="Profit" dot={false} />
                <ReferenceLine y={0} stroke="#94a3b8" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2 mb-3"><BarChart3 size={16} className="text-violet-700" /> Revenue Components</h3>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(val: number | string) => `$${Number(val).toLocaleString()}`} />
                <Legend />
                <Bar dataKey="gross" fill="#0ea5e9" name="Gross" />
                <Bar dataKey="appleFee" fill="#f97316" name="Apple Fee" />
                <Bar dataKey="net" fill="#22c55e" name="Net" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-slate-700">
          <p className="font-semibold flex items-center gap-2"><TrendingUp size={16} className="text-indigo-700" /> Shareable workflow</p>
          <p className="mt-1">Use Copy Share Link to send this dashboard to anyone, including non-registered users. The link carries the current assumptions and recipients can change values live.</p>
          <a href="https://www.apple.com/legal/internet-services/itunes/us/terms.html" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 text-indigo-700 font-semibold hover:underline">
            Apple marketplace fee context <ExternalLink size={12} />
          </a>
        </div>
      </div>
    </div>
  );
};
