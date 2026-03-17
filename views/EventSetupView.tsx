/**
 * EventSetupView — Admin creates/manages a distribution event,
 * defines supply inventory, and generates a registration QR link.
 */
import React, { useEffect, useState } from 'react';
import {
  Calendar,
  Clock,
  MapPin,
  Package,
  Plus,
  Trash2,
  QrCode,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import {
  createEvent,
  upsertSupplyItem,
  listEvents,
  updateEventStatus,
  DistributionEvent,
  EventSupplyItem,
  SupplyType,
  generateQrDataUrl,
  buildQrPayload,
} from '../services/eventDistribution';
import { StorageService } from '../services/storage';

interface EventSetupViewProps {
  setView: (v: ViewState) => void;
}

const SUPPLY_TYPES: Array<{ value: SupplyType; label: string }> = [
  { value: 'FOOD_BOX', label: 'Food Box' },
  { value: 'WATER', label: 'Water' },
  { value: 'HYGIENE_KIT', label: 'Hygiene Kit' },
  { value: 'BABY_SUPPLIES', label: 'Baby Supplies' },
  { value: 'OTHER', label: 'Other' },
];

interface SupplyRow {
  supply_type: SupplyType;
  supply_label: string;
  starting_count: string;
  low_stock_threshold: string;
}

const defaultSupply = (): SupplyRow => ({
  supply_type: 'FOOD_BOX',
  supply_label: '',
  starting_count: '',
  low_stock_threshold: '10',
});

export const EventSetupView: React.FC<EventSetupViewProps> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const orgId = (profile as any)?.organizationId ?? null;

  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedEvent, setSavedEvent] = useState<DistributionEvent | null>(null);
  const [qrUrl, setQrUrl] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [locationName, setLocationName] = useState('');
  const [supplies, setSupplies] = useState<SupplyRow[]>([defaultSupply()]);

  useEffect(() => {
    setLoading(true);
    listEvents(orgId ?? undefined)
      .then(setEvents)
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [orgId]);

  const addSupplyRow = () => setSupplies((prev) => [...prev, defaultSupply()]);

  const removeSupplyRow = (i: number) =>
    setSupplies((prev) => prev.filter((_, idx) => idx !== i));

  const updateSupply = (i: number, field: keyof SupplyRow, value: string) => {
    setSupplies((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  };

  const handleCreate = async () => {
    setError('');
    if (!name.trim()) { setError('Event name is required.'); return; }
    if (!date) { setError('Distribution date is required.'); return; }
    const hasBlankLabel = supplies.some((s) => !s.supply_label.trim());
    if (hasBlankLabel) { setError('All supply items need a label.'); return; }
    const hasZeroCount = supplies.some((s) => !s.starting_count || Number(s.starting_count) < 1);
    if (hasZeroCount) { setError('All supply items need a starting count ≥ 1.'); return; }

    setSaving(true);
    try {
      const event = await createEvent({
        organization_id: orgId,
        name: name.trim(),
        distribution_date: date,
        distribution_time: time || null,
        location_name: locationName.trim() || null,
        latitude: null,
        longitude: null,
        status: 'ACTIVE',
        created_by: profile?.id ?? null,
      });

      for (const s of supplies) {
        await upsertSupplyItem({
          event_id: event.id,
          supply_type: s.supply_type,
          supply_label: s.supply_label.trim(),
          starting_count: Number(s.starting_count),
          current_count: Number(s.starting_count),
          low_stock_threshold: Number(s.low_stock_threshold) || 10,
        });
      }

      // Generate registration QR link that encodes the event ID
      const regLink = `${window.location.origin}?event=${event.id}`;
      const url = await generateQrDataUrl(regLink);
      setQrUrl(url);
      setSavedEvent(event);
      setEvents((prev) => [event, ...prev]);
      setTab('list');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to create event.');
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (event: DistributionEvent) => {
    const next = event.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    await updateEventStatus(event.id, next);
    setEvents((prev) => prev.map((e) => (e.id === event.id ? { ...e, status: next } : e)));
  };

  const statusBadge = (status: DistributionEvent['status']) => {
    const map: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-700',
      DRAFT: 'bg-slate-100 text-slate-600',
      COMPLETED: 'bg-blue-100 text-blue-700',
      CANCELLED: 'bg-red-100 text-red-600',
    };
    return (
      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${map[status] ?? 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7]" style={{ backgroundColor: 'var(--bg-app)' }}>
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setView('DASHBOARD')} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div>
          <h1 className="text-[17px] font-bold text-slate-900">Event Distribution</h1>
          <p className="text-[12px] text-slate-500">Setup & manage events</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 bg-white">
        {(['list', 'create'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-[13px] font-semibold transition-colors ${
              tab === t
                ? 'text-[#2F7A64] border-b-2 border-[#2F7A64]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'list' ? 'My Events' : '+ New Event'}
          </button>
        ))}
      </div>

      <div className="max-w-lg mx-auto px-4 py-5 pb-28 space-y-4">
        {/* ── LIST TAB ─────────────────────── */}
        {tab === 'list' && (
          <>
            {/* QR confirmation after save */}
            {savedEvent && qrUrl && (
              <Card className="p-4 border border-emerald-200 bg-emerald-50">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle size={20} className="text-emerald-600 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[14px] font-semibold text-emerald-800">Event created!</p>
                    <p className="text-[12px] text-emerald-700">{savedEvent.name}</p>
                  </div>
                </div>
                <p className="text-[12px] text-slate-600 mb-2">
                  Print this QR code and display it at the registration table. People scan it to register.
                </p>
                <div className="flex justify-center my-3">
                  <img src={qrUrl} alt="Registration QR" className="w-40 h-40 rounded-lg border border-slate-200" />
                </div>
                <a
                  href={qrUrl}
                  download={`event-${savedEvent.id}-qr.png`}
                  className="block w-full text-center bg-[#2F7A64] text-white text-[13px] font-semibold py-2.5 rounded-lg"
                >
                  Download QR PNG
                </a>
                <button
                  onClick={() => { setSavedEvent(null); setQrUrl(''); }}
                  className="mt-2 w-full text-center text-[12px] text-slate-500"
                >
                  Dismiss
                </button>
              </Card>
            )}

            {loading ? (
              <p className="text-center text-sm text-slate-500 py-10">Loading events…</p>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-[15px] font-medium text-slate-500">No events yet</p>
                <p className="text-[13px] text-slate-400 mb-4">Create your first distribution event</p>
                <Button size="sm" onClick={() => setTab('create')}>Create Event</Button>
              </div>
            ) : (
              events.map((ev) => (
                <Card
                  key={ev.id}
                  className="p-4 cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setView('EVENT_DASHBOARD' as ViewState)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold text-slate-900 truncate">{ev.name}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Calendar size={12} className="text-slate-400" />
                        <span className="text-[12px] text-slate-500">{ev.distribution_date}</span>
                        {ev.location_name && (
                          <>
                            <span className="text-slate-300">·</span>
                            <MapPin size={12} className="text-slate-400" />
                            <span className="text-[12px] text-slate-500 truncate">{ev.location_name}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {statusBadge(ev.status)}
                      <ChevronRight size={16} className="text-slate-400" />
                    </div>
                  </div>
                  {/* Quick actions */}
                  <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleStatusToggle(ev); }}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      {ev.status === 'ACTIVE' ? 'Mark Completed' : 'Reopen'}
                    </button>
                  </div>
                </Card>
              ))
            )}
          </>
        )}

        {/* ── CREATE TAB ────────────────────── */}
        {tab === 'create' && (
          <div className="space-y-4">
            {error && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
                <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
                <p className="text-[13px] text-red-700">{error}</p>
              </div>
            )}

            <Card className="p-4 space-y-3">
              <p className="text-[14px] font-semibold text-slate-800">Event Details</p>
              <Input
                label="Event Name"
                placeholder="e.g. April Food Distribution"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[12px] font-medium text-slate-600 mb-1 block">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                  />
                </div>
                <div>
                  <label className="text-[12px] font-medium text-slate-600 mb-1 block">Time</label>
                  <input
                    type="time"
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                  />
                </div>
              </div>
              <Input
                label="Location / Address"
                placeholder="Community center, park, etc."
                value={locationName}
                onChange={(e) => setLocationName(e.target.value)}
              />
            </Card>

            {/* Supply inventory */}
            <Card className="p-4 space-y-3">
              <p className="text-[14px] font-semibold text-slate-800">Supply Inventory</p>
              <p className="text-[12px] text-slate-500">
                Set starting counts. Inventory decreases as supplies are distributed.
              </p>
              {supplies.map((s, i) => (
                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <select
                      value={s.supply_type}
                      onChange={(e) => updateSupply(i, 'supply_type', e.target.value)}
                      className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                    >
                      {SUPPLY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                    {supplies.length > 1 && (
                      <button
                        onClick={() => removeSupplyRow(i)}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Label (e.g. Canned Goods Box)"
                    value={s.supply_label}
                    onChange={(e) => updateSupply(i, 'supply_label', e.target.value)}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Starting Count</label>
                      <input
                        type="number"
                        min="1"
                        placeholder="100"
                        value={s.starting_count}
                        onChange={(e) => updateSupply(i, 'starting_count', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Low Stock Alert</label>
                      <input
                        type="number"
                        min="0"
                        placeholder="10"
                        value={s.low_stock_threshold}
                        onChange={(e) => updateSupply(i, 'low_stock_threshold', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                  </div>
                </div>
              ))}
              <button
                onClick={addSupplyRow}
                className="flex items-center gap-2 text-[#2F7A64] text-[13px] font-medium hover:underline"
              >
                <Plus size={15} /> Add supply item
              </button>
            </Card>

            {/* Household policy notice */}
            <Card className="p-4 bg-amber-50 border border-amber-200">
              <p className="text-[13px] font-semibold text-amber-800 mb-1">Household Policy</p>
              <p className="text-[12px] text-amber-700">
                Primary registrant is free. Up to <strong>2 additional</strong> household members are
                also free (total 3). Larger households require admin approval.
              </p>
            </Card>

            <Button
              fullWidth
              size="lg"
              onClick={handleCreate}
              disabled={saving}
              className="bg-[#2F7A64] hover:bg-[#296A57] text-white"
            >
              {saving ? 'Creating…' : 'Create Event & Generate QR'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
