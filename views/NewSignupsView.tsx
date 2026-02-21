import React, { useMemo, useState } from 'react';
import { ArrowLeft, RefreshCcw, Search, UserPlus } from 'lucide-react';
import { ViewState, UserProfile } from '../types';
import { StorageService } from '../services/storage';
import { Input } from '../components/Input';
import { Button } from '../components/Button';

const toTime = (value?: string) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatCreatedAt = (value?: string) => {
  if (!value) return 'Unknown';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown';
  return parsed.toLocaleString();
};

const withinLastHours = (value: string | undefined, hours: number) => {
  const stamp = toTime(value);
  if (!stamp) return false;
  return Date.now() - stamp <= hours * 60 * 60 * 1000;
};

export const NewSignupsView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const role = String(StorageService.getProfile()?.role || '').toUpperCase();
  const isAdmin = role === 'ADMIN';

  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>(() => {
    const db = StorageService.getDB();
    return Array.isArray(db.users) ? db.users : [];
  });

  const refresh = () => {
    const db = StorageService.getDB();
    setUsers(Array.isArray(db.users) ? db.users : []);
  };

  const sortedSignups = useMemo(() => {
    return [...users].sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt));
  }, [users]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return sortedSignups;
    return sortedSignups.filter((user) => {
      const name = String(user.fullName || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      const phone = String(user.phone || '').toLowerCase();
      const roleLabel = String(user.role || '').toLowerCase();
      return name.includes(normalized) || email.includes(normalized) || phone.includes(normalized) || roleLabel.includes(normalized);
    });
  }, [query, sortedSignups]);

  const stats = useMemo(() => {
    const total = sortedSignups.length;
    const last24h = sortedSignups.filter((u) => withinLastHours(u.createdAt, 24)).length;
    const last7d = sortedSignups.filter((u) => withinLastHours(u.createdAt, 24 * 7)).length;
    return { total, last24h, last7d };
  }, [sortedSignups]);

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center max-w-sm w-full">
          <h1 className="text-lg font-bold text-slate-900 mb-2">Access restricted</h1>
          <p className="text-sm text-slate-500 mb-4">Only administrators can view signup tracking.</p>
          <Button fullWidth onClick={() => setView('SETTINGS')}>Back to Settings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6 pb-28 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between border-b border-slate-200 pb-4 sticky top-0 bg-slate-50 z-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('SETTINGS')} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-xl font-bold text-slate-900">New Signups</h1>
            <p className="text-xs text-slate-500">Track newly registered users</p>
          </div>
        </div>
        <Button size="sm" variant="outline" className="border-slate-300 text-slate-900 hover:bg-slate-100 h-9" onClick={refresh}>
          <RefreshCcw size={16} className="mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-500 font-semibold uppercase">Total</p>
          <p className="text-xl font-bold text-slate-900">{stats.total}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-500 font-semibold uppercase">Last 24h</p>
          <p className="text-xl font-bold text-slate-900">{stats.last24h}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <p className="text-[11px] text-slate-500 font-semibold uppercase">Last 7d</p>
          <p className="text-xl font-bold text-slate-900">{stats.last7d}</p>
        </div>
      </div>

      <div className="relative">
        <Search size={18} className="absolute left-3 top-3.5 text-slate-400" />
        <Input
          className="pl-10 h-10"
          placeholder="Search by name, email, phone, role"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {filtered.map((user) => (
          <div key={user.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">{user.fullName || 'Unnamed User'}</h3>
                <p className="text-xs text-slate-500">{user.email || user.phone || 'No contact info'}</p>
                <p className="text-[11px] text-slate-400 mt-1">Created: {formatCreatedAt(user.createdAt)}</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full bg-brand-50 text-brand-700">
                <UserPlus size={12} />
                {(user.role || 'GENERAL_USER').replace('_', ' ')}
              </span>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center">
            <p className="text-slate-500 text-sm">No signups match your search.</p>
          </div>
        )}
      </div>
    </div>
  );
};
