import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CalendarDays, MapPin, QrCode, RefreshCw, Ticket } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import {
  DistributionEvent,
  DistributionEventSession,
  EventRegistrationWithEvent,
  buildQrPayload,
  generateQrDataUrl,
  getEventPrimarySession,
  listMyEventRegistrations,
  listPublicActiveEvents,
} from '../services/eventDistribution';

interface EventsViewProps {
  setView: (v: ViewState) => void;
}

export const EventsView: React.FC<EventsViewProps> = ({ setView }) => {
  const [tab, setTab] = useState<'available' | 'my'>('my');
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [myRegs, setMyRegs] = useState<EventRegistrationWithEvent[]>([]);
  const [qrByRegId, setQrByRegId] = useState<Record<string, string>>({});

  const formatSession = (session?: DistributionEventSession | null) => {
    if (!session) return 'Session TBD';
    const start = new Date(session.start_at);
    return start.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const refresh = async () => {
    setLoading(true);
    try {
      const [activeEvents, registrations] = await Promise.all([
        listPublicActiveEvents(),
        listMyEventRegistrations(),
      ]);
      setEvents(activeEvents);
      setMyRegs(registrations);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    let active = true;
    const generateCodes = async () => {
      const pending = myRegs.filter((reg) => !qrByRegId[reg.id]);
      if (pending.length === 0) return;

      const nextEntries: Array<[string, string]> = [];
      for (const reg of pending) {
        const payload = buildQrPayload(reg.event_id, reg.participant_code, reg.session_id);
        const dataUrl = await generateQrDataUrl(payload);
        nextEntries.push([reg.id, dataUrl]);
      }

      if (!active || nextEntries.length === 0) return;
      setQrByRegId((prev) => {
        const next = { ...prev };
        for (const [id, dataUrl] of nextEntries) {
          next[id] = dataUrl;
        }
        return next;
      });
    };

    generateCodes();
    return () => {
      active = false;
    };
  }, [myRegs, qrByRegId]);

  const mySessionIds = useMemo(() => new Set(myRegs.map((r) => r.session_id)), [myRegs]);

  const openEventRegistration = (eventId: string, sessionId?: string) => {
    const url = new URL(window.location.href);
    url.searchParams.set('event', eventId);
    if (sessionId) {
      url.searchParams.set('session', sessionId);
    } else {
      url.searchParams.delete('session');
    }
    url.hash = '';
    window.history.replaceState({}, '', url.toString());
    setView('EVENT_REGISTRATION');
  };

  return (
    <div className="min-h-screen bg-[#F6F8F7]">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setView('DASHBOARD')} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1">
          <h1 className="text-[17px] font-bold text-slate-900">Events</h1>
          <p className="text-[12px] text-slate-500">Register once, edit anytime</p>
        </div>
        <button onClick={refresh} className="p-1.5 rounded-lg hover:bg-slate-100" title="Refresh">
          <RefreshCw size={17} className={`text-slate-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex border-b border-slate-200 bg-white">
        <button
          onClick={() => setTab('my')}
          className={`flex-1 py-3 text-[13px] font-semibold ${tab === 'my' ? 'text-[#2F7A64] border-b-2 border-[#2F7A64]' : 'text-slate-500'}`}
        >
          My Tickets
        </button>
        <button
          onClick={() => setTab('available')}
          className={`flex-1 py-3 text-[13px] font-semibold ${tab === 'available' ? 'text-[#2F7A64] border-b-2 border-[#2F7A64]' : 'text-slate-500'}`}
        >
          Available Events
        </button>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-24 space-y-3">
        {tab === 'my' && (
          myRegs.length > 0 ? (
            myRegs.map((reg) => (
              <Card key={reg.id} className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[15px] font-semibold text-slate-900">{reg.event?.name || 'Event'}</p>
                    <p className="text-[12px] text-slate-500">
                      <CalendarDays size={12} className="inline mr-1" />
                      {formatSession(reg.session || getEventPrimarySession(reg.event))}
                    </p>
                    <p className="text-[12px] text-slate-600 mt-1">
                      <MapPin size={12} className="inline mr-1" />
                      Location Address: {reg.session?.location_name || reg.event?.address || getEventPrimarySession(reg.event)?.location_name || 'Not provided yet'}
                    </p>
                  </div>
                  <span className="text-[10px] font-bold uppercase px-2 py-1 rounded bg-emerald-50 text-emerald-700">Saved</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border border-slate-200 p-2 text-center">
                    <p className="text-[10px] uppercase text-slate-500">4-digit code</p>
                    <p className="text-[24px] font-extrabold text-[#2F7A64] tracking-widest">{reg.participant_code}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-2 text-center">
                    <p className="text-[10px] uppercase text-slate-500">Ticket</p>
                    <p className="text-[14px] font-bold text-slate-900">{reg.ticket_id}</p>
                  </div>
                </div>

                {qrByRegId[reg.id] ? (
                  <div className="flex justify-center">
                    <img src={qrByRegId[reg.id]} alt="Saved event ticket QR" className="w-32 h-32 rounded-lg border border-slate-200" />
                  </div>
                ) : (
                  <div className="text-[12px] text-slate-500 flex items-center justify-center gap-1">
                    <QrCode size={14} /> Loading QR...
                  </div>
                )}

                <Button fullWidth size="sm" onClick={() => openEventRegistration(reg.event_id, reg.session_id)}>
                  Edit Response
                </Button>
              </Card>
            ))
          ) : (
            <Card className="p-5 text-center">
              <Ticket size={28} className="mx-auto text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-700">No saved event tickets yet</p>
              <p className="text-xs text-slate-500 mt-1">Register for an event and your QR and code will appear here.</p>
              <Button size="sm" className="mt-3" onClick={() => setTab('available')}>Browse Events</Button>
            </Card>
          )
        )}

        {tab === 'available' && (
          events.length > 0 ? (
            events.map((ev) => (
              <Card key={ev.id} className="p-4">
                <p className="text-[15px] font-semibold text-slate-900">{ev.name}</p>
                <div className="space-y-2 mt-3">
                  {(ev.sessions ?? []).map((session) => (
                    <div key={session.id} className="rounded-xl border border-slate-200 p-3">
                      <p className="text-[13px] font-semibold text-slate-800">{session.session_name}</p>
                      <p className="text-[12px] text-slate-500 mt-1">
                        <CalendarDays size={12} className="inline mr-1" />
                        {formatSession(session)}
                      </p>
                      <p className="text-[12px] text-slate-600 mt-1">
                        <MapPin size={12} className="inline mr-1" />
                        Location Address: {session.location_name || ev.address || 'Not provided yet'}
                      </p>
                      <Button
                        fullWidth
                        size="sm"
                        className="mt-3"
                        onClick={() => openEventRegistration(ev.id, session.id)}
                      >
                        {mySessionIds.has(session.id) ? 'View / Edit My Response' : 'Register'}
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-5 text-center">
              <p className="text-sm font-semibold text-slate-700">No active events right now</p>
              <p className="text-xs text-slate-500 mt-1">Check back soon for upcoming distribution events.</p>
            </Card>
          )
        )}
      </div>
    </div>
  );
};
