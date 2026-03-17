/**
 * EventRegistrationView — Public-facing self-registration kiosk.
 * Reads ?event=<id> from the URL (or accepts an eventId prop).
 * Collects name, household info, outreach consent, then generates
 * a QR + 4-digit ticket for the participant to show at the table.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  User,
  Users,
  MapPin,
  Phone,
  Mail,
  CheckCircle,
  QrCode,
  AlertTriangle,
  Download,
  ArrowLeft,
  Bell,
  Info,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import { fetchProfileForUser } from '../services/api';
import { supabase } from '../services/supabase';
import {
  getEvent,
  registerParticipant,
  validateHouseholdSize,
  generateQrDataUrl,
  buildQrPayload,
  FREE_HOUSEHOLD_LIMIT,
  DistributionEvent,
  EventRegistration,
} from '../services/eventDistribution';

interface EventRegistrationViewProps {
  setView: (v: ViewState) => void;
  /** Override event ID (e.g. from App routing). Falls back to URL query param. */
  eventId?: string;
}

type Step = 'loading' | 'event_not_found' | 'form' | 'consent' | 'done';

export const EventRegistrationView: React.FC<EventRegistrationViewProps> = ({
  setView,
  eventId: propEventId,
}) => {
  const resolvedEventId =
    propEventId ??
    new URLSearchParams(window.location.search).get('event') ??
    '';

  const [step, setStep] = useState<Step>('loading');
  const [event, setEvent] = useState<DistributionEvent | null>(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isConnectedUser, setIsConnectedUser] = useState(false);
  const [useProfileInfo, setUseProfileInfo] = useState(true);

  // Form fields
  const [fullName, setFullName] = useState('');
  const [householdSize, setHouseholdSize] = useState(1);
  const [additionalMembers, setAdditionalMembers] = useState(0);
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  // Consent
  const [outreachOptIn, setOutreachOptIn] = useState(false);
  const [locationGranted, setLocationGranted] = useState(false);
  const [locationLatLng, setLocationLatLng] = useState<{ lat: number; lng: number } | null>(null);
  const [profileDefaults, setProfileDefaults] = useState<{
    fullName: string;
    zipCode: string;
    phone: string;
    email: string;
    outreachOptIn: boolean;
    location: { lat: number; lng: number } | null;
  } | null>(null);

  // Result
  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [qrUrl, setQrUrl] = useState('');

  // Household validation
  const householdValidation = validateHouseholdSize(additionalMembers);
  const totalHousehold = 1 + additionalMembers;

  useEffect(() => {
    if (!resolvedEventId) { setStep('event_not_found'); return; }
    getEvent(resolvedEventId)
      .then((ev) => {
        if (!ev || ev.status === 'CANCELLED') setStep('event_not_found');
        else { setEvent(ev); setStep('form'); }
      })
      .catch(() => setStep('event_not_found'));
  }, [resolvedEventId]);

  useEffect(() => {
    let active = true;

    const loadConnectedUserDefaults = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || !data?.session?.user) return;

        const profile = await fetchProfileForUser();
        if (!active || !profile) return;

        const defaults = {
          fullName: String(profile.fullName || '').trim(),
          zipCode: String(profile.zipCode || '').trim(),
          phone: String(profile.phone || '').trim(),
          email: String(profile.email || '').trim(),
          outreachOptIn: Boolean(profile.geofencedOutreachOptIn),
          location:
            typeof profile.latitude === 'number' && typeof profile.longitude === 'number'
              ? { lat: profile.latitude, lng: profile.longitude }
              : null,
        };

        setIsConnectedUser(true);
        setProfileDefaults(defaults);
        if (defaults.fullName) setFullName(defaults.fullName);
        if (defaults.zipCode) setZipCode(defaults.zipCode);
        if (defaults.phone) setPhone(defaults.phone);
        if (defaults.email) setEmail(defaults.email);
        if (defaults.outreachOptIn) setOutreachOptIn(true);
        if (defaults.location) {
          setLocationLatLng(defaults.location);
          setLocationGranted(true);
        }
      } catch {
        // Event registration also supports anonymous/public users.
      }
    };

    loadConnectedUserDefaults();
    return () => {
      active = false;
    };
  }, []);

  const applyProfileDefaults = () => {
    if (!profileDefaults) return;
    setFullName(profileDefaults.fullName || '');
    setZipCode(profileDefaults.zipCode || '');
    setPhone(profileDefaults.phone || '');
    setEmail(profileDefaults.email || '');
    setOutreachOptIn(profileDefaults.outreachOptIn);
    setLocationLatLng(profileDefaults.location);
    setLocationGranted(Boolean(profileDefaults.location));
  };

  const effectiveFields = () => {
    const useSaved = isConnectedUser && useProfileInfo && profileDefaults;
    return {
      fullName: useSaved ? profileDefaults.fullName : fullName,
      zipCode: useSaved ? profileDefaults.zipCode : zipCode,
      phone: useSaved ? profileDefaults.phone : phone,
      email: useSaved ? profileDefaults.email : email,
    };
  };

  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationLatLng({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocationGranted(true);
      },
      () => setLocationGranted(false)
    );
  };

  const handleOutreachToggle = (val: boolean) => {
    setOutreachOptIn(val);
    if (val) requestLocation();
  };

  const handleFormNext = () => {
    setError('');
    const fields = effectiveFields();
    if (!fields.fullName.trim()) {
      if (isConnectedUser && useProfileInfo) {
        setUseProfileInfo(false);
        setError('Your saved profile is missing a name. Please complete your details below.');
      } else {
        setError('Please enter your name.');
      }
      return;
    }
    if (additionalMembers < 0) { setError('Additional members cannot be negative.'); return; }
    if (fields.zipCode && !/^\d{5}(-\d{4})?$/.test(fields.zipCode.trim())) {
      setError('Please enter a valid ZIP code.'); return;
    }
    setStep('consent');
  };

  const handleSubmit = async () => {
    if (!event) return;
    setSubmitting(true);
    setError('');
    try {
      const fields = effectiveFields();
      const reg = await registerParticipant({
        eventId: event.id,
        eventName: event.name,
        fullName: fields.fullName,
        householdSize: totalHousehold,
        additionalMembers,
        zipCode: fields.zipCode || undefined,
        phone: fields.phone || undefined,
        email: fields.email || undefined,
        outreachOptIn,
        latitude: locationLatLng?.lat,
        longitude: locationLatLng?.lng,
      });
      setRegistration(reg);
      const qrPayload = buildQrPayload(event.id, reg.participant_code);
      const url = await generateQrDataUrl(qrPayload);
      setQrUrl(url);
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // ─── LOADING ───────────────────────────
  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8F7]">
        <p className="text-slate-500 text-sm">Loading event…</p>
      </div>
    );
  }

  // ─── NOT FOUND ─────────────────────────
  if (step === 'event_not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F8F7] p-6 text-center">
        <AlertTriangle size={40} className="text-amber-400 mb-3" />
        <h2 className="text-[18px] font-bold text-slate-800 mb-2">Event not found</h2>
        <p className="text-[14px] text-slate-500 mb-6">
          This registration link may be invalid or the event has ended.
        </p>
        <Button onClick={() => setView('DASHBOARD')} size="sm">
          Return Home
        </Button>
      </div>
    );
  }

  // ─── DONE CONFIRMATION ─────────────────
  if (step === 'done' && registration) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-[22px] font-bold text-slate-900">You're registered!</h2>
            <p className="text-[14px] text-slate-500 mt-1">{event?.name}</p>
          </div>

          <Card className="p-5 text-center">
            <p className="text-[12px] uppercase tracking-wider text-slate-500 mb-1">Your ticket ID</p>
            <p className="text-[28px] font-bold text-slate-900 tracking-widest mb-4">{registration.ticket_id}</p>

            <p className="text-[12px] uppercase tracking-wider text-slate-500 mb-1">Backup 4-digit code</p>
            <p className="text-[40px] font-extrabold text-[#2F7A64] tracking-[0.15em] mb-4">
              {registration.participant_code}
            </p>

            {qrUrl && (
              <>
                <p className="text-[12px] text-slate-500 mb-2">Or show this QR code at the distribution table</p>
                <img src={qrUrl} alt="Your QR ticket" className="w-44 h-44 mx-auto rounded-xl border border-slate-200 mb-4" />
                <a
                  href={qrUrl}
                  download={`ticket-${registration.ticket_id}.png`}
                  className="flex items-center justify-center gap-2 w-full bg-slate-900 text-white py-3 rounded-xl text-[14px] font-semibold mb-2"
                >
                  <Download size={16} /> Save QR Ticket
                </a>
              </>
            )}

            <p className="text-[12px] text-slate-500 mt-3">
              Household size: <strong>{registration.household_size}</strong>
              {' '}· Date: <strong>{event?.distribution_date}</strong>
              {event?.location_name && <> · <MapPin size={12} className="inline" /> {event.location_name}</>}
            </p>
          </Card>

          <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-[13px] text-amber-800 font-semibold mb-1">What to do next</p>
            <ol className="text-[12px] text-amber-700 space-y-1 list-decimal list-inside">
              <li>Save or screenshot your QR code and 4-digit code.</li>
              <li>Arrive at the distribution table and show your code.</li>
              <li>A volunteer will scan your QR or enter your 4-digit code.</li>
              <li>Supplies will be given based on your household size.</li>
            </ol>
          </div>

          <Button
            fullWidth
            size="lg"
            className="mt-5 bg-[#2F7A64] text-white"
            onClick={() => setView('DASHBOARD')}
          >
            Done
          </Button>
        </div>
      </div>
    );
  }

  // ─── CONSENT STEP ──────────────────────
  if (step === 'consent') {
    return (
      <div className="min-h-screen bg-[#F6F8F7] px-5 py-8">
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep('form')} className="flex items-center gap-1.5 text-slate-500 mb-6 text-[13px]">
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Community Outreach</h2>
          <p className="text-[13px] text-slate-500 mb-6">Optional — takes 10 seconds</p>

          <Card className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Bell size={20} className="text-[#2F7A64] mt-0.5 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-slate-800">Safety Alerts</p>
                <p className="text-[13px] text-slate-600 mt-0.5">
                  Would you like to receive community safety alerts from nearby organizations?
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { handleOutreachToggle(true); }}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                  outreachOptIn
                    ? 'bg-[#2F7A64] text-white border-[#2F7A64]'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Yes, opt in
              </button>
              <button
                onClick={() => { setOutreachOptIn(false); }}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border transition-colors ${
                  !outreachOptIn
                    ? 'bg-slate-800 text-white border-slate-800'
                    : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                No thanks
              </button>
            </div>

            {outreachOptIn && (
              <div className="bg-emerald-50 rounded-xl p-3 flex items-start gap-2">
                <MapPin size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                <p className="text-[12px] text-emerald-700">
                  {locationGranted
                    ? 'Location captured. You will only receive alerts within a 3-mile radius.'
                    : 'Location permission denied. Enter your ZIP above to set alert area.'}
                </p>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              You can opt out at any time. Nearby org leaders only contact opted-in users within 3 miles.
            </p>
          </Card>

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          <Button
            fullWidth
            size="lg"
            className="mt-5 bg-[#2F7A64] text-white"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? 'Registering…' : 'Complete Registration'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── FORM STEP ─────────────────────────
  return (
    <div className="min-h-screen bg-[#F6F8F7] px-5 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-1.5 text-slate-500 mb-5 text-[13px]">
          <ArrowLeft size={16} /> Exit
        </button>

        <h2 className="text-[22px] font-bold text-slate-900 mb-0.5">Register</h2>
        <p className="text-[14px] text-slate-500 mb-6">{event?.name} · {event?.distribution_date}</p>

        {isConnectedUser && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[13px] font-semibold text-emerald-900">Using your saved AERA profile</p>
            <p className="text-[12px] text-emerald-800 mt-1">
              Connected users can use saved profile details by default and only answer event-specific questions.
            </p>

            <label className="mt-3 flex items-center gap-2 text-[12px] font-semibold text-emerald-900">
              <input
                type="checkbox"
                checked={useProfileInfo}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setUseProfileInfo(checked);
                  if (checked) applyProfileDefaults();
                }}
              />
              Use profile info
            </label>

            {useProfileInfo && profileDefaults && (
              <div className="mt-2 rounded-md border border-emerald-200 bg-white p-2 text-[12px] text-emerald-900">
                <p>{profileDefaults.fullName || 'Name missing in profile'}</p>
                <p>{profileDefaults.phone || 'No phone on file'}</p>
                <p>{profileDefaults.email || 'No email on file'}</p>
                <p>{profileDefaults.zipCode || 'No ZIP on file'}</p>
              </div>
            )}
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          {(!isConnectedUser || !useProfileInfo) && (
            <Card className="p-4 space-y-3">
              <p className="text-[13px] font-semibold text-slate-700">Your Info</p>
              <Input
                label="Full Name *"
                placeholder="First and last name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Input
                label="ZIP Code"
                placeholder="90210"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
              />
              <Input
                label="Phone (optional)"
                placeholder="(555) 555-5555"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                type="tel"
              />
              <Input
                label="Email (optional)"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
              />
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold text-slate-700">Household Size</p>
              <div className="flex items-center gap-1">
                <Info size={13} className="text-slate-400" />
                <span className="text-[11px] text-slate-400">Up to {FREE_HOUSEHOLD_LIMIT} extra free</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={() => setAdditionalMembers((prev) => Math.max(0, prev - 1))}
                className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-[18px] font-bold text-slate-600 hover:bg-slate-100"
              >
                −
              </button>
              <div className="flex-1 text-center">
                <p className="text-[28px] font-bold text-slate-900">{totalHousehold}</p>
                <p className="text-[11px] text-slate-400">people total</p>
              </div>
              <button
                onClick={() => setAdditionalMembers((prev) => prev + 1)}
                className="w-9 h-9 rounded-full border border-slate-300 flex items-center justify-center text-[18px] font-bold text-slate-600 hover:bg-slate-100"
              >
                +
              </button>
            </div>

            {additionalMembers > 0 && (
              <div className={`rounded-xl p-3 text-[12px] ${
                householdValidation.requiresAdminApproval
                  ? 'bg-amber-50 text-amber-800 border border-amber-200'
                  : 'bg-emerald-50 text-emerald-800'
              }`}>
                <strong>Primary (you)</strong> + {additionalMembers} additional member{additionalMembers !== 1 ? 's' : ''} = {totalHousehold} total
                {householdValidation.requiresAdminApproval && (
                  <><br /><span className="font-semibold">⚠ Requires admin approval for 3+ additional members.</span></>
                )}
              </div>
            )}

            {additionalMembers === 0 && (
              <p className="text-[12px] text-slate-500">
                You may add up to <strong>{FREE_HOUSEHOLD_LIMIT}</strong> additional household members for free.
              </p>
            )}
          </Card>

          <Button
            fullWidth
            size="lg"
            className="bg-[#2F7A64] text-white"
            onClick={handleFormNext}
          >
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
};
