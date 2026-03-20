/**
 * EventDashboardView — Real-time admin dashboard for an active distribution event.
 * Supabase realtime subscriptions update stats live as volunteers scan.
 * Also handles check-in responses (SAFE / NEEDS HELP / NO RESPONSE).
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Users,
  Package,
  Activity,
  Check,
  AlertTriangle,
  Clock,
  RefreshCw,
  ChevronDown,
  Download,
  Radio,
  Heart,
  HelpCircle,
  ShieldAlert,
  Share2,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressBar } from '../components/ProgressBar';
import { ViewState } from '../types';
import {
  listEvents,
  getEventStats,
  generateEventReport,
  updateCheckIn,
  getSupplyItems,
  DistributionEvent,
  EventStats,
  EventRegistration,
  CheckInStatus,
} from '../services/eventDistribution';
import { supabase } from '../services/supabase';

interface EventDashboardViewProps {
  setView: (v: ViewState) => void;
  /** Pre-selected event ID. Falls back to picking the first active event. */
  eventId?: string;
}

export const EventDashboardView: React.FC<EventDashboardViewProps> = ({ setView, eventId: propEventId }) => {
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DistributionEvent | null>(null);
  const [showEventPicker, setShowEventPicker] = useState(false);
  const [stats, setStats] = useState<EventStats | null>(null);
  const [recentRegs, setRecentRegs] = useState<EventRegistration[]>([]);
  const [loadingStats, setLoadingStats] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // Load events on mount
  useEffect(() => {
    listEvents().then((evs) => {
      setEvents(evs);
      const target = propEventId
        ? evs.find((e) => e.id === propEventId)
        : evs.find((e) => e.status === 'ACTIVE') ?? evs[0];
      if (target) setSelectedEvent(target);
    });
  }, [propEventId]);

  // Fetch stats whenever selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) return;
    fetchStats(selectedEvent.id);
    subscribeRealtime(selectedEvent.id);
    return () => {
      channelRef.current?.unsubscribe();
    };
  }, [selectedEvent?.id]);

  const fetchStats = async (eventId: string) => {
    setLoadingStats(true);
    try {
      const [s, { data: regs }] = await Promise.all([
        getEventStats(eventId),
        supabase
          .from('event_registrations')
          .select('*')
          .eq('event_id', eventId)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);
      setStats(s);
      setRecentRegs((regs ?? []) as EventRegistration[]);
      setLastRefresh(new Date());
    } catch {
      // silent — realtime will update
    } finally {
      setLoadingStats(false);
    }
  };

  const subscribeRealtime = (eventId: string) => {
    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`event-dashboard-${eventId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_registrations', filter: `event_id=eq.${eventId}` },
        () => fetchStats(eventId)
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'event_supply_items', filter: `event_id=eq.${eventId}` },
        () => fetchStats(eventId)
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'event_distribution_logs', filter: `event_id=eq.${eventId}` },
        () => fetchStats(eventId)
      )
      .subscribe();
  };

  const handleCheckIn = async (regId: string, status: CheckInStatus) => {
    await updateCheckIn(regId, status);
    if (selectedEvent) fetchStats(selectedEvent.id);
  };

  const handleExport = async () => {
    if (!selectedEvent) return;
    try {
      const report = await generateEventReport(selectedEvent.id);
      const lines = [
        `AERA Event Report: ${report.event.name}`,
        `Date: ${report.event.distribution_date}`,
        `Location: ${report.event.location_name ?? 'N/A'}`,
        '',
        `Households Served: ${report.stats.householdsServed}`,
        `People Served: ${report.stats.peopleServed}`,
        `Supplies Distributed: ${report.stats.suppliesDistributed}`,
        `Total Registrations: ${report.stats.registrations}`,
        '',
        'Check-in Status:',
        `  SAFE: ${report.stats.checkInSafe}`,
        `  NEEDS HELP: ${report.stats.checkInNeedsHelp}`,
        `  NO RESPONSE: ${report.stats.checkInNoResponse}`,
        '',
        'Supply Inventory:',
        ...report.stats.supplyItems.map(
          (s) => `  ${s.supply_label}: ${s.current_count} remaining / ${s.starting_count} starting`
        ),
        '',
        'Registrations:',
        'Name,Ticket,Code,Household,Served,Check-in',
        ...report.registrations.map(
          (r) =>
            `"${r.full_name}",${r.ticket_id},${r.participant_code},${r.household_size},${r.served},${r.check_in_status}`
        ),
      ];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `event-report-${selectedEvent.id}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const getRegistrationLink = () => {
    if (!selectedEvent) return '';
    const url = new URL(window.location.href);
    url.searchParams.set('event', selectedEvent.id);
    url.hash = '';
    return url.toString();
  };

  const handleCopyRegistrationLink = async () => {
    const link = getRegistrationLink();
    if (!link) return;
    await navigator.clipboard.writeText(link);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 1800);
  };

  const handleShareRegistrationLink = async () => {
    if (!selectedEvent) return;
    const link = getRegistrationLink();
    const shareText = `Register for ${selectedEvent.name} on ${selectedEvent.distribution_date}${selectedEvent.location_name ? ` at ${selectedEvent.location_name}` : ''}`;

    if (navigator.share) {
      await navigator.share({
        title: `${selectedEvent.name} Registration`,
        text: shareText,
        url: link,
      });
      return;
    }

    await handleCopyRegistrationLink();
  };

  const checkInColor = (status: CheckInStatus) => {
    if (status === 'SAFE') return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    if (status === 'NEEDS_HELP') return 'text-red-600 bg-red-50 border-red-200';
    return 'text-slate-500 bg-slate-50 border-slate-200';
  };

  const supplyPct = (item: EventStats['supplyItems'][number]) =>
    item.starting_count > 0
      ? Math.round((item.current_count / item.starting_count) * 100)
      : 0;

  // ── RENDER ─────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#F6F8F7]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            {/* Event picker */}
            <button
              onClick={() => setShowEventPicker((v) => !v)}
              className="flex items-center gap-1 max-w-full"
            >
              <span className="text-[16px] font-bold text-slate-900 truncate">
                {selectedEvent?.name ?? 'Select Event'}
              </span>
              <ChevronDown size={16} className="text-slate-400 shrink-0" />
            </button>
            <p className="text-[12px] text-slate-400">
              {lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString()}` : 'Loading…'}
            </p>
          </div>
          <button
            onClick={() => selectedEvent && fetchStats(selectedEvent.id)}
            disabled={loadingStats}
            className="p-1.5 rounded-lg hover:bg-slate-100"
          >
            <RefreshCw size={17} className={`text-slate-600 ${loadingStats ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={handleExport}
            className="p-1.5 rounded-lg hover:bg-slate-100"
            title="Export CSV"
          >
            <Download size={17} className="text-slate-600" />
          </button>
        </div>

        {/* Event picker dropdown */}
        {showEventPicker && (
          <div className="mt-2 bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
            {events.map((ev) => (
              <button
                key={ev.id}
                onClick={() => { setSelectedEvent(ev); setShowEventPicker(false); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] hover:bg-slate-50 ${
                  selectedEvent?.id === ev.id ? 'font-semibold text-[#2F7A64]' : 'text-slate-700'
                }`}
              >
                {ev.name} — {ev.distribution_date}{' '}
                <span className="text-[11px] text-slate-400">({ev.status})</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Volunteer quick-action */}
      <div className="bg-[#2F7A64] px-4 py-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button
            onClick={() => setView('VOLUNTEER_SCAN' as ViewState)}
            className="flex items-center justify-center gap-2 w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 text-white text-[14px] font-semibold"
          >
            <Radio size={17} /> Open Volunteer Scanner
          </button>
          <button
            onClick={async () => {
              try {
                await handleCopyRegistrationLink();
              } catch {
                // no-op
              }
            }}
            className="flex items-center justify-center gap-2 w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 text-white text-[14px] font-semibold"
          >
            {linkCopied ? <Check size={17} /> : <Copy size={17} />}
            {linkCopied ? 'Copied Link' : 'Copy Signup Link'}
          </button>
          <button
            onClick={async () => {
              try {
                await handleShareRegistrationLink();
              } catch {
                // no-op
              }
            }}
            className="flex items-center justify-center gap-2 w-full bg-white/20 hover:bg-white/30 rounded-xl py-2.5 text-white text-[14px] font-semibold"
          >
            <Share2 size={17} /> Share Signup Link
          </button>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 pb-28 space-y-4">
        {!stats ? (
          <div className="text-center py-12">
            <p className="text-slate-400 text-sm">Loading stats…</p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4 text-center">
                <p className="text-[32px] font-extrabold text-[#2F7A64]">{stats.householdsServed}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">Households Served</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-[32px] font-extrabold text-slate-900">{stats.peopleServed}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">People Served</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-[32px] font-extrabold text-slate-900">{stats.suppliesDistributed}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">Items Distributed</p>
              </Card>
              <Card className="p-4 text-center">
                <p className="text-[32px] font-extrabold text-slate-900">{stats.registrations}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">Registered</p>
              </Card>
            </div>

            {/* Check-in status */}
            <Card className="p-4 space-y-3">
              <p className="text-[14px] font-semibold text-slate-800">Check-in Status</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center bg-emerald-50 rounded-xl p-3">
                  <p className="text-[22px] font-bold text-emerald-600">{stats.checkInSafe}</p>
                  <p className="text-[11px] text-emerald-600 font-medium">Safe</p>
                </div>
                <div className="text-center bg-red-50 rounded-xl p-3">
                  <p className="text-[22px] font-bold text-red-600">{stats.checkInNeedsHelp}</p>
                  <p className="text-[11px] text-red-600 font-medium">Needs Help</p>
                </div>
                <div className="text-center bg-slate-50 rounded-xl p-3">
                  <p className="text-[22px] font-bold text-slate-500">{stats.checkInNoResponse}</p>
                  <p className="text-[11px] text-slate-500 font-medium">No Response</p>
                </div>
              </div>
            </Card>

            {/* Supply inventory */}
            {stats.supplyItems.length > 0 && (
              <Card className="p-4 space-y-4">
                <p className="text-[14px] font-semibold text-slate-800">Inventory</p>
                {stats.supplyItems.map((item) => {
                  const pct = supplyPct(item);
                  const isLow = item.current_count <= item.low_stock_threshold;
                  return (
                    <div key={item.id} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-slate-700">{item.supply_label}</p>
                        <div className="flex items-center gap-1.5">
                          {isLow && (
                            <span className="text-[11px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                              Low
                            </span>
                          )}
                          <span className="text-[13px] font-bold text-slate-900">
                            {item.current_count}
                            <span className="text-[11px] text-slate-400 font-normal"> / {item.starting_count}</span>
                          </span>
                        </div>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isLow ? 'bg-amber-400' : 'bg-[#2F7A64]'
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </Card>
            )}

            {/* Recent registrations with check-in controls */}
            {recentRegs.length > 0 && (
              <Card className="p-4 space-y-3">
                <p className="text-[14px] font-semibold text-slate-800">Recent Registrations</p>
                <div className="space-y-2">
                  {recentRegs.map((reg) => (
                    <div
                      key={reg.id}
                      className={`flex items-center gap-3 p-3 rounded-xl border ${checkInColor(reg.check_in_status)}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{reg.full_name}</p>
                        <p className="text-[11px] opacity-70">
                          #{reg.participant_code} · {reg.household_size} people
                          {reg.served && ' · Served ✓'}
                        </p>
                      </div>
                      {/* Check-in buttons */}
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => handleCheckIn(reg.id, 'SAFE')}
                          title="Mark Safe"
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            reg.check_in_status === 'SAFE'
                              ? 'bg-emerald-500 text-white'
                              : 'bg-white border border-emerald-300 text-emerald-600 hover:bg-emerald-50'
                          }`}
                        >
                          <Check size={13} />
                        </button>
                        <button
                          onClick={() => handleCheckIn(reg.id, 'NEEDS_HELP')}
                          title="Needs Help"
                          className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                            reg.check_in_status === 'NEEDS_HELP'
                              ? 'bg-red-500 text-white'
                              : 'bg-white border border-red-300 text-red-500 hover:bg-red-50'
                          }`}
                        >
                          <AlertTriangle size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
};
