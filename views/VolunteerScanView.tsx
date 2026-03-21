/**
 * VolunteerScanView — Volunteer interface for scanning QR codes
 * or entering 4-digit backup codes. Shows participant info,
 * prevents double-distribution, records supply distribution.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  QrCode,
  KeyRound,
  CheckCircle,
  AlertTriangle,
  ArrowLeft,
  Package,
  Users,
  ShieldAlert,
  RefreshCw,
  Camera,
  X,
  Minus,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import {
  listEvents,
  lookupByCode,
  lookupByQr,
  recordDistribution,
  DistributionEvent,
  DistributionEventSession,
  ScanResult,
  EventSupplyItem,
  resolveEventSession,
} from '../services/eventDistribution';
import { StorageService } from '../services/storage';

interface VolunteerScanViewProps {
  setView: (v: ViewState) => void;
}

type Mode = 'select_event' | 'scan' | 'result' | 'confirmed';

interface SupplySelection {
  item: EventSupplyItem;
  quantity: number;
}

export const VolunteerScanView: React.FC<VolunteerScanViewProps> = ({ setView }) => {
  const profile = StorageService.getProfile();

  const [mode, setMode] = useState<Mode>('select_event');
  const [events, setEvents] = useState<DistributionEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<DistributionEvent | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [inputMethod, setInputMethod] = useState<'qr' | 'code'>('code');
  const [codeInput, setCodeInput] = useState('');
  const [qrRawInput, setQrRawInput] = useState(''); // fallback text input for QR string
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ScanResult | null>(null);
  const [supplySelections, setSupplySelections] = useState<SupplySelection[]>([]);
  const [saving, setSaving] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<
    Array<{ eventId: string; registrationId: string; timestamp: string }>
  >([]);
  const selectedSession = resolveEventSession(selectedEvent, selectedSessionId);

  const formatSession = (session?: DistributionEventSession | null) => {
    if (!session) return 'Select a session';
    return new Date(session.start_at).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // Load offline queue from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem('aera.offlineScanQueue');
      if (raw) setOfflineQueue(JSON.parse(raw));
    } catch {}
  }, []);

  useEffect(() => {
    listEvents()
      .then((evs) => {
        const active = evs.filter((e) => e.status === 'ACTIVE');
        setEvents(active);
        if (active.length === 1) {
          setSelectedEvent(active[0]);
          setSelectedSessionId(active[0].sessions?.[0]?.id || '');
          setMode('scan');
        }
      })
      .catch(() => {});
  }, []);

  // ── QR scanner via BarcodeDetector API (Chrome/Android) or fallback textarea
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      // Use BarcodeDetector if available
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
        const tick = async () => {
          if (!videoRef.current || !streamRef.current) return;
          try {
            const barcodes = await detector.detect(videoRef.current);
            if (barcodes?.length > 0) {
              stopCamera();
              await handleQrScan(barcodes[0].rawValue);
              return;
            }
          } catch {}
          requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    } catch {
      setError('Camera access denied. Use manual code entry below.');
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  useEffect(() => () => stopCamera(), []);

  // ── Lookup helpers ──────────────────────────────────────────

  const handleQrScan = async (raw: string) => {
    if (!selectedEvent || !selectedSession) return;
    setScanning(true);
    setError('');
    try {
      const res = await lookupByQr(raw, selectedEvent.id, selectedSession.id);
      if (!res) { setError('QR code not found for the selected event.'); return; }
      processResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Lookup failed.');
    } finally {
      setScanning(false);
    }
  };

  const handleCodeLookup = async () => {
    if (!selectedEvent || !selectedSession) return;
    const clean = codeInput.replace(/\D/g, '').slice(0, 4);
    if (clean.length !== 4) { setError('Enter a 4-digit code.'); return; }
    setScanning(true);
    setError('');
    try {
      const res = await lookupByCode(selectedEvent.id, clean, selectedSession.id);
      if (!res) { setError(`No registration found for code ${clean}.`); return; }
      processResult(res);
    } catch (e: any) {
      setError(e?.message ?? 'Lookup failed.');
    } finally {
      setScanning(false);
    }
  };

  const processResult = (res: ScanResult) => {
    setResult(res);
    // Default: 1 of each supply
    setSupplySelections(res.supplies.map((s) => ({ item: s, quantity: 1 })));
    setAdminOverride(false);
    setMode('result');
  };

  const adjustQty = (supplyId: string, delta: number) => {
    setSupplySelections((prev) =>
      prev.map((s) =>
        s.item.id === supplyId
          ? { ...s, quantity: Math.max(0, Math.min(s.item.current_count, s.quantity + delta)) }
          : s
      )
    );
  };

  // ── Record distribution ─────────────────────────────────────

  const handleConfirm = async () => {
    if (!result || !selectedEvent || !selectedSession) return;
    if (result.alreadyServed && !adminOverride) return;

    setSaving(true);
    setError('');
    try {
      const itemsToRecord = supplySelections.filter((s) => s.quantity > 0);
      await recordDistribution({
        eventId: selectedEvent.id,
        sessionId: selectedSession.id,
        registrationId: result.registration.id,
        supplyItems: itemsToRecord.map((s) => ({
          supplyItemId: s.item.id,
          quantity: s.quantity,
        })),
        distributedBy: profile?.id,
        adminOverride,
        notes: adminOverride ? 'Admin override — duplicate distribution allowed.' : undefined,
      });
      setMode('confirmed');
    } catch (e: any) {
      // Offline fallback: queue the scan
      if (!navigator.onLine) {
        const entry = {
          eventId: selectedEvent.id,
          registrationId: result.registration.id,
          timestamp: new Date().toISOString(),
        };
        const updated = [...offlineQueue, entry];
        setOfflineQueue(updated);
        localStorage.setItem('aera.offlineScanQueue', JSON.stringify(updated));
        setMode('confirmed'); // optimistic
      } else {
        setError(e?.message ?? 'Failed to record distribution.');
      }
    } finally {
      setSaving(false);
    }
  };

  const resetScan = () => {
    setResult(null);
    setCodeInput('');
    setQrRawInput('');
    setError('');
    setAdminOverride(false);
    setMode('scan');
  };

  // ────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────

  // ── Select event ───────────────────────
  if (mode === 'select_event') {
    return (
      <div className="min-h-screen bg-[#F6F8F7]">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <div>
            <h1 className="text-[17px] font-bold text-slate-900">Volunteer Scanner</h1>
            <p className="text-[12px] text-slate-500">Select an active event</p>
          </div>
        </div>
        <div className="max-w-sm mx-auto px-4 py-6 space-y-3">
          {events.length === 0 ? (
            <div className="text-center py-12">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-[15px] font-medium text-slate-500">No active events</p>
              <p className="text-[13px] text-slate-400 mb-4">Ask your admin to activate an event first.</p>
              <Button size="sm" onClick={() => setView('EVENT_SETUP' as ViewState)}>Go to Event Setup</Button>
            </div>
          ) : (
            events.map((ev) => (
              <Card
                key={ev.id}
                className="p-4 cursor-pointer hover:shadow-md"
                onClick={() => {
                  setSelectedEvent(ev);
                  setSelectedSessionId(ev.sessions?.[0]?.id || '');
                  setMode('scan');
                }}
              >
                <p className="text-[15px] font-semibold text-slate-900">{ev.name}</p>
                <p className="text-[12px] text-slate-500 mt-0.5">
                  {formatSession(ev.sessions?.[0])}{ev.sessions?.[0]?.location_name ? ` · ${ev.sessions[0].location_name}` : ''}
                </p>
              </Card>
            ))
          )}
        </div>
      </div>
    );
  }

  // ── Confirmed ──────────────────────────
  if (mode === 'confirmed') {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex flex-col items-center justify-center px-5">
        <CheckCircle size={64} className="text-emerald-500 mb-4" />
        <h2 className="text-[22px] font-bold text-slate-900 mb-2">Supplies Distributed!</h2>
        <p className="text-[14px] text-slate-500 mb-1">{result?.registration.full_name}</p>
        <p className="text-[13px] text-slate-400 mb-8">Household: {result?.registration.household_size}</p>
        {!navigator.onLine && (
          <div className="mb-5 w-full max-w-xs bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800">
            <strong>Offline mode</strong> — distribution queued. Will sync when internet returns.
          </div>
        )}
        <Button
          size="xl"
          fullWidth
          className="max-w-xs bg-[#2F7A64] text-white text-[17px] min-h-[56px]"
          onClick={resetScan}
        >
          Scan Next Person
        </Button>
        <button
          onClick={() => setView('EVENT_DASHBOARD' as ViewState)}
          className="mt-4 text-[13px] text-slate-500 underline"
        >
          View Dashboard
        </button>
      </div>
    );
  }

  // ── Result / distribution confirmation ──
  if (mode === 'result' && result) {
    const { registration, supplies, alreadyServed } = result;
    const blocked = alreadyServed && !adminOverride;

    return (
      <div className="min-h-screen bg-[#F6F8F7]">
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
          <button onClick={resetScan} className="p-1.5 rounded-lg hover:bg-slate-100">
            <ArrowLeft size={20} className="text-slate-600" />
          </button>
          <h1 className="text-[17px] font-bold text-slate-900">Participant Found</h1>
        </div>

        <div className="max-w-sm mx-auto px-4 py-5 space-y-4 pb-28">
          {/* Double distribution warning */}
          {alreadyServed && (
            <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
              <ShieldAlert size={20} className="text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="text-[14px] font-bold text-red-700">Supplies Already Distributed</p>
                <p className="text-[12px] text-red-600 mt-0.5">
                  Served at {registration.served_at ? new Date(registration.served_at).toLocaleString() : 'unknown time'}.
                </p>
                {!adminOverride && (
                  <button
                    onClick={() => setAdminOverride(true)}
                    className="mt-2 text-[12px] font-semibold text-red-700 underline"
                  >
                    Admin override (allow duplicate)
                  </button>
                )}
                {adminOverride && (
                  <p className="mt-2 text-[12px] font-bold text-red-700">
                    ⚠ Override active — proceeding will record a second distribution.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Participant card */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[18px] font-bold text-slate-900">{registration.full_name}</p>
              <span className="text-[11px] font-mono bg-slate-100 px-2 py-0.5 rounded">
                #{registration.participant_code}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-slate-500">
              <Users size={14} />
              <span>Household size: <strong>{registration.household_size}</strong></span>
            </div>
            <div className="text-[12px] text-slate-400">{registration.ticket_id}</div>
          </Card>

          {/* Supply selection */}
          {!blocked && supplies.length > 0 && (
            <Card className="p-4 space-y-3">
              <p className="text-[13px] font-semibold text-slate-800">Supplies to distribute</p>
              {supplySelections.map((sel) => (
                <div key={sel.item.id} className="flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-800 truncate">{sel.item.supply_label}</p>
                    <p className={`text-[11px] ${sel.item.current_count <= sel.item.low_stock_threshold ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                      {sel.item.current_count} remaining
                      {sel.item.current_count <= sel.item.low_stock_threshold && ' ⚠ Low stock'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => adjustQty(sel.item.id, -1)}
                      disabled={sel.quantity === 0}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-6 text-center text-[15px] font-bold text-slate-900">{sel.quantity}</span>
                    <button
                      onClick={() => adjustQty(sel.item.id, 1)}
                      disabled={sel.quantity >= sel.item.current_count}
                      className="w-8 h-8 rounded-full border border-slate-300 flex items-center justify-center text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </Card>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          <Button
            fullWidth
            size="xl"
            className={`min-h-[56px] text-[17px] font-bold ${blocked ? 'bg-slate-300 text-slate-500' : 'bg-[#2F7A64] text-white'}`}
            onClick={handleConfirm}
            disabled={blocked || saving}
          >
            {saving ? 'Recording…' : blocked ? 'Already Served' : 'Confirm & Give Supplies'}
          </Button>

          <button onClick={resetScan} className="w-full text-center text-[13px] text-slate-500">
            Cancel — scan someone else
          </button>
        </div>
      </div>
    );
  }

  // ── Scan mode ──────────────────────────
  return (
    <div className="min-h-screen bg-[#F6F8F7]">
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center gap-3">
        <button onClick={() => setMode('select_event')} className="p-1.5 rounded-lg hover:bg-slate-100">
          <ArrowLeft size={20} className="text-slate-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-[17px] font-bold text-slate-900 truncate">{selectedEvent?.name}</h1>
          <p className="text-[12px] text-slate-500">{formatSession(selectedSession)}</p>
        </div>
        <button onClick={() => setView('EVENT_DASHBOARD' as ViewState)} className="text-[12px] text-[#2F7A64] font-semibold">
          Dashboard
        </button>
      </div>

      {(selectedEvent?.sessions?.length ?? 0) > 1 && (
        <div className="bg-white border-b border-slate-200 px-4 py-3">
          <label className="text-[12px] font-medium text-slate-600 block mb-1">Session</label>
          <select
            value={selectedSessionId}
            onChange={(e) => setSelectedSessionId(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
          >
            {(selectedEvent?.sessions ?? []).map((session) => (
              <option key={session.id} value={session.id}>
                {session.session_name} · {formatSession(session)}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Method toggle */}
      <div className="flex border-b border-slate-200 bg-white">
        {(['code', 'qr'] as const).map((m) => (
          <button
            key={m}
            onClick={() => { setInputMethod(m); setError(''); stopCamera(); }}
            className={`flex-1 py-3 text-[13px] font-semibold transition-colors flex items-center justify-center gap-2 ${
              inputMethod === m
                ? 'text-[#2F7A64] border-b-2 border-[#2F7A64]'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {m === 'code' ? <><KeyRound size={15} /> 4-Digit Code</> : <><QrCode size={15} /> Scan QR</>}
          </button>
        ))}
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {/* ── 4-digit code entry ── */}
        {inputMethod === 'code' && (
          <div className="space-y-4">
            <Card className="p-5 space-y-4">
              <p className="text-[14px] font-semibold text-slate-700 text-center">Enter participant's 4-digit code</p>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={4}
                placeholder="0000"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="w-full text-center text-[48px] font-bold tracking-[0.3em] text-slate-900 border-b-4 border-[#2F7A64] bg-transparent outline-none py-2"
                autoFocus
              />
            </Card>
            <Button
              fullWidth
              size="xl"
              className="min-h-[56px] text-[17px] bg-[#2F7A64] text-white"
              onClick={handleCodeLookup}
              disabled={scanning || codeInput.length !== 4}
            >
              {scanning ? 'Looking up…' : 'Find Participant'}
            </Button>
          </div>
        )}

        {/* ── QR scan ── */}
        {inputMethod === 'qr' && (
          <div className="space-y-4">
            <Card className="p-4 space-y-3">
              {/* Camera viewfinder */}
              <div className="relative bg-slate-900 rounded-xl overflow-hidden aspect-square">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                />
                {!streamRef.current && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Camera size={36} className="text-slate-400 mb-3" />
                    <p className="text-[13px] text-slate-400 text-center px-4">
                      Tap "Start Camera" to scan
                    </p>
                  </div>
                )}
                {/* Scan overlay */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-white rounded-xl opacity-60" />
                </div>
              </div>
              <Button
                fullWidth
                size="lg"
                className="bg-[#2F7A64] text-white"
                onClick={startCamera}
                disabled={!!streamRef.current}
              >
                {streamRef.current ? 'Scanning…' : 'Start Camera'}
              </Button>
              {streamRef.current && (
                <button onClick={stopCamera} className="w-full text-center text-[12px] text-slate-500">
                  Stop camera
                </button>
              )}
            </Card>

            {/* Fallback: paste QR string */}
            <Card className="p-4 space-y-2">
              <p className="text-[12px] text-slate-500 font-medium">If BarcodeDetector unsupported, paste QR string here:</p>
              <input
                type="text"
                placeholder="eventId:participantCode"
                value={qrRawInput}
                onChange={(e) => setQrRawInput(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-[13px] focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
              />
              <Button
                fullWidth
                size="sm"
                onClick={() => handleQrScan(qrRawInput.trim())}
                disabled={!qrRawInput.trim() || scanning}
              >
                Look up
              </Button>
            </Card>
          </div>
        )}

        {/* Offline queue notice */}
        {offlineQueue.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[12px] text-amber-800">
            <strong>{offlineQueue.length}</strong> scan{offlineQueue.length !== 1 ? 's' : ''} queued offline — will sync when online.
          </div>
        )}
      </div>
    </div>
  );
};
