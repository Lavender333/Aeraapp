/**
 * EventSetupView — Admin creates/manages a distribution event,
 * defines supply inventory, and generates a registration QR link.
 */
import React, { useEffect, useState } from 'react';
import {
  Calendar,
  MapPin,
  Package,
  Plus,
  Trash2,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  AlertTriangle,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import {
  createEvent,
  getSupplyItems,
  updateEventSupplyItems,
  upsertSupplyItem,
  listEvents,
  updateEventDetails,
  updateEventStatus,
  DistributionEvent,
  SupplyType,
  generateQrDataUrl,
  getEventPrimarySession,
  buildEventRegistrationLink,
} from '../services/eventDistribution';
import { getOrgIdByCode } from '../services/supabase';
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
  id?: string;
  supply_type: SupplyType;
  supply_label: string;
  unit_type: string;
  pack_size: string;
  starting_count: string;
  low_stock_threshold: string;
  current_count?: number;
}

const UNIT_TYPES = ['UNIT', 'BOX', 'CASE', 'KIT', 'PACK', 'BAG'];

const defaultSupply = (): SupplyRow => ({
  id: undefined,
  supply_type: 'FOOD_BOX',
  supply_label: '',
  unit_type: 'UNIT',
  pack_size: '1',
  starting_count: '',
  low_stock_threshold: '10',
  current_count: undefined,
});

interface SessionRow {
  id?: string;
  status?: DistributionEvent['status'];
  session_name: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  registration_open_date: string;
  registration_open_time: string;
  registration_close_date: string;
  registration_close_time: string;
  location_name: string;
  max_registrants: string;
}

const defaultSession = (): SessionRow => ({
  id: undefined,
  status: 'ACTIVE',
  session_name: '',
  start_date: '',
  start_time: '',
  end_date: '',
  end_time: '',
  registration_open_date: '',
  registration_open_time: '',
  registration_close_date: '',
  registration_close_time: '',
  location_name: '',
  max_registrants: '',
});

const combineLocalDateTime = (date: string, time: string) => {
  if (!date || !time) return null;
  return new Date(`${date}T${time}`).toISOString();
};

const toLocalDateInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toLocalTimeInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

const formatSessionSummary = (event: DistributionEvent) => {
  const primary = getEventPrimarySession(event);
  if (!primary) return 'No sessions';
  const start = new Date(primary.start_at);
  const label = start.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  if ((event.sessions?.length ?? 0) <= 1) return label;
  return `${label} +${(event.sessions?.length ?? 1) - 1} more`;
};

export const EventSetupView: React.FC<EventSetupViewProps> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const normalizedRole = String((profile as any)?.role || '').toUpperCase();
  const isOrgScopedAdmin = normalizedRole === 'ORG_ADMIN' || normalizedRole === 'INSTITUTION_ADMIN';
  const rawOrgScope = String((profile as any)?.organizationId || profile.communityId || '').trim();

  const [orgId, setOrgId] = useState<string | null>(() => {
    if (!rawOrgScope) return null;
    const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawOrgScope);
    return looksLikeUuid ? rawOrgScope : null;
  });

  const [tab, setTab] = useState<'list' | 'create'>('list');
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedEvent, setSavedEvent] = useState<DistributionEvent | null>(null);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [copiedEventId, setCopiedEventId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [eventAddress, setEventAddress] = useState('');
  const [eventNotes, setEventNotes] = useState('');
  const [sessions, setSessions] = useState<SessionRow[]>([defaultSession()]);
  const [supplies, setSupplies] = useState<SupplyRow[]>([defaultSupply()]);

  const isEditing = Boolean(editingEventId);

  useEffect(() => {
    let active = true;
    const resolveOrgScope = async () => {
      if (!rawOrgScope) {
        if (active) setOrgId(null);
        return;
      }
      const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawOrgScope);
      if (looksLikeUuid) {
        if (active) setOrgId(rawOrgScope);
        return;
      }
      const resolved = await getOrgIdByCode(rawOrgScope);
      if (active) setOrgId(resolved || null);
    };

    void resolveOrgScope();
    return () => {
      active = false;
    };
  }, [rawOrgScope]);

  useEffect(() => {
    if (isOrgScopedAdmin && !orgId) {
      setEvents([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    listEvents(orgId ?? undefined)
      .then((loadedEvents) => {
        setEvents(loadedEvents);
        
        // Check if there's an event ID to edit stored from navigation
        const storedEventId = sessionStorage.getItem('eventIdToEdit');
        if (storedEventId) {
          const eventToEdit = loadedEvents.find((e) => e.id === storedEventId);
          if (eventToEdit) {
            setEditingEventId(storedEventId);
            setTab('create');
          }
          sessionStorage.removeItem('eventIdToEdit');
        }
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [isOrgScopedAdmin, orgId]);

  const copyRegistrationLink = async (eventId: string) => {
    const link = buildEventRegistrationLink(eventId);
    await navigator.clipboard.writeText(link);
    setCopiedEventId(eventId);
    window.setTimeout(() => {
      setCopiedEventId((current) => (current === eventId ? null : current));
    }, 1800);
  };

  const shareRegistrationLink = async (event: DistributionEvent) => {
    const link = buildEventRegistrationLink(event.id);
    const primarySession = getEventPrimarySession(event);
    const shareText = `Register for ${event.name}${primarySession ? ` on ${new Date(primarySession.start_at).toLocaleString()}` : ''}${primarySession?.location_name ? ` at ${primarySession.location_name}` : ''}`;

    if (navigator.share) {
      await navigator.share({
        title: `${event.name} Registration`,
        text: shareText,
        url: link,
      });
      return;
    }

    await copyRegistrationLink(event.id);
  };

  const addSupplyRow = () => setSupplies((prev) => [...prev, defaultSupply()]);

  const addSessionRow = () => setSessions((prev) => [...prev, defaultSession()]);

  const resetForm = () => {
    setEditingEventId(null);
    setName('');
    setEventAddress('');
    setEventNotes('');
    setSessions([defaultSession()]);
    setSupplies([defaultSupply()]);
    setError('');
  };

  const startEditingEvent = (event: DistributionEvent) => {
    void (async () => {
      setLoading(true);
      try {
    setEditingEventId(event.id);
    setName(event.name || '');
    setEventAddress(event.address || getEventPrimarySession(event)?.location_name || '');
    setEventNotes(event.event_notes || '');
    setSavedEvent(null);
    setQrUrl('');
    setError('');
    const mappedSessions = (event.sessions ?? []).map((session) => ({
      id: session.id,
      status: session.status,
      session_name: session.session_name || '',
      start_date: toLocalDateInput(session.start_at),
      start_time: toLocalTimeInput(session.start_at),
      end_date: toLocalDateInput(session.end_at || session.start_at),
      end_time: toLocalTimeInput(session.end_at),
      registration_open_date: toLocalDateInput(session.registration_open_at),
      registration_open_time: toLocalTimeInput(session.registration_open_at),
      registration_close_date: toLocalDateInput(session.registration_close_at),
      registration_close_time: toLocalTimeInput(session.registration_close_at),
      location_name: session.location_name || '',
      max_registrants: session.max_registrants ? String(session.max_registrants) : '',
    }));
    setSessions(mappedSessions.length > 0 ? mappedSessions : [defaultSession()]);
        const supplyItems = await getSupplyItems(event.id);
        setSupplies(
          supplyItems.length > 0
            ? supplyItems.map((item) => ({
                id: item.id,
                supply_type: item.supply_type,
                supply_label: item.supply_label,
                unit_type: item.unit_type,
                pack_size: String(item.pack_size),
                starting_count: String(item.starting_count),
                low_stock_threshold: String(item.low_stock_threshold),
                current_count: item.current_count,
              }))
            : [defaultSupply()]
        );
    setTab('create');
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load event details.');
      } finally {
        setLoading(false);
      }
    })();
  };

  const removeSessionRow = (index: number) => {
    setSessions((prev) => {
      if (prev.length <= 1) return prev;
      if (prev[index]?.id) return prev;
      return prev.filter((_, idx) => idx !== index);
    });
  };

  const updateSession = (index: number, field: keyof SessionRow, value: string) => {
    setSessions((prev) => prev.map((session, idx) => (idx === index ? { ...session, [field]: value } : session)));
  };

  const toggleSessionStatus = (index: number) => {
    setSessions((prev) => prev.map((session, idx) => {
      if (idx !== index) return session;
      const nextStatus = session.status === 'CANCELLED' ? 'ACTIVE' : 'CANCELLED';
      return { ...session, status: nextStatus };
    }));
  };

  const removeSupplyRow = (i: number) =>
    setSupplies((prev) => prev.filter((_, idx) => idx !== i));

  const updateSupply = (i: number, field: keyof SupplyRow, value: string) => {
    setSupplies((prev) =>
      prev.map((s, idx) => (idx === i ? { ...s, [field]: value } : s))
    );
  };

  const handleCreate = async () => {
    setError('');
    if (isOrgScopedAdmin && !orgId) {
      setError('Your account is not linked to an organization. Add your Organization ID in Settings and try again.');
      return;
    }
    if (!name.trim()) { setError('Event name is required.'); return; }
    if (!eventAddress.trim()) { setError('Event address is required.'); return; }
    const invalidSession = sessions.find((session) => {
      const startAt = combineLocalDateTime(session.start_date, session.start_time);
      const endAt = combineLocalDateTime(session.end_date || session.start_date, session.end_time);
      return !session.location_name.trim() || !session.session_name.trim() || !startAt || !endAt || new Date(endAt) < new Date(startAt);
    });
    if (invalidSession) {
      setError('Each session needs a name, start time, end time, and location.');
      return;
    }
    const hasBlankLabel = supplies.some((s) => !s.supply_label.trim());
    if (hasBlankLabel) { setError('All supply items need a label.'); return; }
    const hasInvalidStartingCount = supplies.some((s) => !s.starting_count || Number(s.starting_count) < 1);
    if (hasInvalidStartingCount) { setError('All supply items need a starting count ≥ 1.'); return; }
    const invalidPackSize = supplies.some((s) => Number(s.pack_size) < 1 || !Number.isFinite(Number(s.pack_size)));
    if (invalidPackSize) { setError('All supply items need a pack size ≥ 1.'); return; }

    setSaving(true);
    try {
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
      const normalizedSessions = sessions.map((session, index) => {
        const startAt = combineLocalDateTime(session.start_date, session.start_time) as string;
        const endAt = combineLocalDateTime(session.end_date || session.start_date, session.end_time) as string;
        const regOpenAt = combineLocalDateTime(
          session.registration_open_date || session.start_date,
          session.registration_open_time || session.start_time
        );
        const regCloseAt = combineLocalDateTime(
          session.registration_close_date || session.end_date || session.start_date,
          session.registration_close_time || session.end_time
        );

        return {
          id: session.id,
          status: session.status === 'CANCELLED' ? 'CANCELLED' : 'ACTIVE',
          session_name: session.session_name.trim(),
          start_at: startAt,
          end_at: endAt,
          registration_open_at: regOpenAt,
          registration_close_at: regCloseAt,
          location_name: session.location_name.trim() || null,
          max_registrants: session.max_registrants ? Math.max(1, Math.round(Number(session.max_registrants))) : null,
          sort_order: index,
        };
      });

      const event = isEditing && editingEventId
        ? await updateEventDetails({
            eventId: editingEventId,
            name: name.trim(),
            address: eventAddress.trim() || null,
            event_notes: eventNotes.trim() || null,
            timezone,
            sessions: normalizedSessions,
          })
        : await createEvent({
            organization_id: orgId,
            name: name.trim(),
            address: eventAddress.trim() || null,
            event_notes: eventNotes.trim() || null,
            timezone,
            status: 'ACTIVE',
            created_by: profile?.id ?? null,
            sessions: normalizedSessions,
          });

      if (!isEditing) {
        for (const s of supplies) {
          await upsertSupplyItem({
            event_id: event.id,
            supply_type: s.supply_type,
            supply_label: s.supply_label.trim(),
            unit_type: s.unit_type,
            pack_size: Math.max(1, Math.round(Number(s.pack_size) || 1)),
            starting_count: Number(s.starting_count),
            current_count: Number(s.starting_count),
            low_stock_threshold: Number(s.low_stock_threshold) || 10,
          });
        }
      } else {
        await updateEventSupplyItems(
          event.id,
          supplies.map((s) => ({
            id: s.id,
            supply_type: s.supply_type,
            supply_label: s.supply_label.trim(),
            unit_type: s.unit_type,
            pack_size: Math.max(1, Math.round(Number(s.pack_size) || 1)),
            starting_count: Math.max(0, Math.round(Number(s.starting_count) || 0)),
            low_stock_threshold: Math.max(0, Math.round(Number(s.low_stock_threshold) || 0)),
          }))
        );
      }

      // Generate registration QR link that encodes the event ID
      const regLink = buildEventRegistrationLink(event.id);
      const url = await generateQrDataUrl(regLink);
      setQrUrl(url);
      setSavedEvent(event);
      setEvents((prev) => {
        if (isEditing) {
          return prev.map((existing) => (existing.id === event.id ? event : existing));
        }
        return [event, ...prev];
      });
      if (isEditing) {
        setEditingEventId(null);
      }
      setTab('list');
    } catch (e: any) {
      setError(e?.message ?? `Failed to ${isEditing ? 'update' : 'create'} event.`);
    } finally {
      setSaving(false);
    }
  };

  const handleStatusToggle = async (event: DistributionEvent) => {
    const next = event.status === 'ACTIVE' ? 'COMPLETED' : 'ACTIVE';
    await updateEventStatus(event.id, next);
    setEvents((prev) => prev.map((e) => (
      e.id === event.id
        ? {
            ...e,
            status: next,
            sessions: (e.sessions ?? []).map((session) => ({ ...session, status: next })),
          }
        : e
    )));
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
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    onClick={() => copyRegistrationLink(savedEvent.id)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-700 text-[12px] font-semibold py-2"
                  >
                    {copiedEventId === savedEvent.id ? <Check size={14} /> : <Copy size={14} />} Copy Link
                  </button>
                  <button
                    onClick={() => shareRegistrationLink(savedEvent)}
                    className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-700 text-white text-[12px] font-semibold py-2"
                  >
                    <Share2 size={14} /> Share
                  </button>
                </div>
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
                        <span className="text-[12px] text-slate-500">{formatSessionSummary(ev)}</span>
                        {(ev.address || getEventPrimarySession(ev)?.location_name) && (
                          <>
                            <span className="text-slate-300">·</span>
                            <MapPin size={12} className="text-slate-400" />
                            <span className="text-[12px] text-slate-500 truncate">{ev.address || getEventPrimarySession(ev)?.location_name}</span>
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
                      {ev.status === 'ACTIVE' ? 'End Event' : 'Reopen'}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEditingEvent(ev);
                      }}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600"
                    >
                      Edit
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await copyRegistrationLink(ev.id);
                        } catch {
                          setError('Could not copy registration link.');
                        }
                      }}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 inline-flex items-center gap-1"
                    >
                      {copiedEventId === ev.id ? <Check size={12} /> : <Copy size={12} />} Link
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await shareRegistrationLink(ev);
                        } catch {
                          setError('Could not open share options.');
                        }
                      }}
                      className="text-[12px] font-medium px-3 py-1.5 rounded-lg bg-[#2F7A64] hover:bg-[#296A57] text-white inline-flex items-center gap-1"
                    >
                      <Share2 size={12} /> Share
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-[14px] font-semibold text-slate-800">{isEditing ? 'Edit Event Details' : 'Event Details'}</p>
                {isEditing && (
                  <button
                    onClick={resetForm}
                    className="text-[12px] font-medium text-slate-500 hover:text-slate-700"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>
              <Input
                label="Event Name"
                placeholder="e.g. April Food Distribution"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                label="Event Address *"
                placeholder="e.g. 123 Main St, City, State ZIP"
                value={eventAddress}
                onChange={(e) => setEventAddress(e.target.value)}
              />
              <div>
                <label className="text-[12px] font-medium text-slate-600 mb-1 block">Event Notes (optional)</label>
                <textarea
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Parking guidance, pickup policy, special instructions..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64] min-h-[84px]"
                />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-slate-800">Sessions</p>
                  <p className="text-[12px] text-slate-500">Add one or more distribution time slots under this event.</p>
                </div>
                <button
                  onClick={addSessionRow}
                  className="flex items-center gap-2 text-[#2F7A64] text-[13px] font-medium hover:underline"
                >
                  <Plus size={15} /> Add session
                </button>
              </div>

              {sessions.map((session, index) => (
                <div key={index} className="border border-slate-200 rounded-xl p-3 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <Input
                      label={`Session ${index + 1} Name`}
                      placeholder="e.g. Saturday Morning Pickup"
                      value={session.session_name}
                      onChange={(e) => updateSession(index, 'session_name', e.target.value)}
                    />
                    {sessions.length > 1 && (
                      <button
                        onClick={() => removeSessionRow(index)}
                        disabled={Boolean(session.id)}
                        className="mt-7 p-1.5 hover:bg-red-50 rounded-lg text-red-400 shrink-0"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-slate-500">
                      {session.id
                        ? session.status === 'CANCELLED'
                          ? 'Session is cancelled. It will stay hidden from active registration until restored.'
                          : 'Existing session. You can update or cancel it here.'
                        : 'New session. Remove it before saving if you do not want to keep it.'}
                    </p>
                    {session.id && (
                      <button
                        type="button"
                        onClick={() => toggleSessionStatus(index)}
                        className={`text-[11px] font-semibold px-2 py-1 rounded ${session.status === 'CANCELLED' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}
                      >
                        {session.status === 'CANCELLED' ? 'Restore Session' : 'Cancel Session'}
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">Start Date</label>
                      <input
                        type="date"
                        value={session.start_date}
                        onChange={(e) => updateSession(index, 'start_date', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">Start Time</label>
                      <input
                        type="time"
                        value={session.start_time}
                        onChange={(e) => updateSession(index, 'start_time', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">End Date</label>
                      <input
                        type="date"
                        value={session.end_date}
                        onChange={(e) => updateSession(index, 'end_date', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">End Time</label>
                      <input
                        type="time"
                        value={session.end_time}
                        onChange={(e) => updateSession(index, 'end_time', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
                  </div>

                  <Input
                    label="Session Location Address"
                    placeholder="123 Main St, City, State ZIP"
                    value={session.location_name}
                    onChange={(e) => updateSession(index, 'location_name', e.target.value)}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">Registration Opens</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={session.registration_open_date}
                          onChange={(e) => updateSession(index, 'registration_open_date', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                        />
                        <input
                          type="time"
                          value={session.registration_open_time}
                          onChange={(e) => updateSession(index, 'registration_open_time', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[12px] font-medium text-slate-600 mb-1 block">Registration Closes</label>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          value={session.registration_close_date}
                          onChange={(e) => updateSession(index, 'registration_close_date', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                        />
                        <input
                          type="time"
                          value={session.registration_close_time}
                          onChange={(e) => updateSession(index, 'registration_close_time', e.target.value)}
                          className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[13px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                        />
                      </div>
                    </div>
                  </div>

                  <Input
                    label="Session Capacity (optional)"
                    type="number"
                    min={1}
                    placeholder="e.g. 150"
                    value={session.max_registrants}
                    onChange={(e) => updateSession(index, 'max_registrants', e.target.value)}
                  />
                </div>
              ))}
            </Card>

            <Card className="p-4 space-y-3">
              <p className="text-[14px] font-semibold text-slate-800">Supply Inventory</p>
              <p className="text-[12px] text-slate-500">
                {isEditing
                  ? 'Update inventory, add new items, or remove items. Changing starting count preserves already-distributed quantities by adjusting current stock by the delta.'
                  : 'Set starting counts. Inventory decreases as supplies are distributed.'}
              </p>
              {supplies.map((s, i) => (
                <div key={s.id || i} className="border border-slate-200 rounded-xl p-3 space-y-2">
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
                  {isEditing && typeof s.current_count === 'number' && (
                    <p className="text-[11px] text-slate-500">Current remaining stock: {s.current_count}</p>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Unit Type</label>
                      <select
                        value={s.unit_type}
                        onChange={(e) => updateSupply(i, 'unit_type', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      >
                        {UNIT_TYPES.map((u) => (
                          <option key={u} value={u}>{u}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[11px] text-slate-500 block mb-1">Pack Size</label>
                      <input
                        type="number"
                        min="1"
                        value={s.pack_size}
                        onChange={(e) => updateSupply(i, 'pack_size', e.target.value)}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
                      />
                    </div>
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
                        min={isEditing ? '0' : '1'}
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
              {saving ? (isEditing ? 'Saving…' : 'Creating…') : (isEditing ? 'Save Event Changes' : 'Create Event & Generate QR')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
