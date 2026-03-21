/**
 * EventRegistrationView — Public-facing self-registration kiosk.
 * Reads ?event=<id> from URL (or accepts eventId prop), lets users register once,
 * and allows authenticated users to edit their existing response.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  MapPin,
  CheckCircle,
  AlertTriangle,
  Download,
  ArrowLeft,
  Bell,
  Info,
  Package,
} from 'lucide-react';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { Card } from '../components/Card';
import { ViewState } from '../types';
import { fetchProfileForUser } from '../services/api';
import { supabase } from '../services/supabase';
import {
  getEvent,
  getMyEventRegistration,
  getSupplyItems,
  registerParticipant,
  validateHouseholdSize,
  generateQrDataUrl,
  buildQrPayload,
  FREE_HOUSEHOLD_LIMIT,
  DistributionEvent,
  EventRegistration,
  EventSupplyItem,
} from '../services/eventDistribution';

interface EventRegistrationViewProps {
  setView: (v: ViewState) => void;
  eventId?: string;
}

type Step = 'loading' | 'event_not_found' | 'form' | 'consent' | 'done';

export const EventRegistrationView: React.FC<EventRegistrationViewProps> = ({
  setView,
  eventId: propEventId,
}) => {
  const getEventIdFromUrl = () => {
    const searchId = new URLSearchParams(window.location.search).get('event');
    if (searchId) return searchId;
    const hash = window.location.hash || '';
    const hashQuery = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
    const hashId = hashQuery ? new URLSearchParams(hashQuery).get('event') : null;
    return hashId || '';
  };

  const resolvedEventId = propEventId ?? getEventIdFromUrl() ?? '';

  const [step, setStep] = useState<Step>('loading');
  const [event, setEvent] = useState<DistributionEvent | null>(null);
  const [supplyItems, setSupplyItems] = useState<EventSupplyItem[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [isConnectedUser, setIsConnectedUser] = useState(false);
  const [useProfileInfo, setUseProfileInfo] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [editingExisting, setEditingExisting] = useState(false);

  const [fullName, setFullName] = useState('');
  const [additionalMembers, setAdditionalMembers] = useState(0);
  const [zipCode, setZipCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [contactPreference, setContactPreference] = useState<'SMS' | 'CALL' | 'EMAIL'>('SMS');
  const [pickupAfterTime, setPickupAfterTime] = useState('');
  const [proxyPickup, setProxyPickup] = useState(false);
  const [urgencyTier, setUrgencyTier] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');
  const [deliveryBarrier, setDeliveryBarrier] = useState('');
  const [childrenCount, setChildrenCount] = useState(0);
  const [seniorsCount, setSeniorsCount] = useState(0);
  const [disabilityPresent, setDisabilityPresent] = useState(false);
  const [preferredLanguage, setPreferredLanguage] = useState('en');

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

  const [requestedBySupplyId, setRequestedBySupplyId] = useState<Record<string, number>>({});

  const [registration, setRegistration] = useState<EventRegistration | null>(null);
  const [qrUrl, setQrUrl] = useState('');

  const householdValidation = validateHouseholdSize(additionalMembers);
  const totalHousehold = 1 + additionalMembers;

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!resolvedEventId) {
        setStep('event_not_found');
        return;
      }
      try {
        const ev = await getEvent(resolvedEventId);
        if (!active) return;
        if (!ev || ev.status === 'CANCELLED') {
          setStep('event_not_found');
          return;
        }
        setEvent(ev);
        setStep('form');

        const items = await getSupplyItems(resolvedEventId);
        if (!active) return;
        setSupplyItems(items);
      } catch {
        if (active) setStep('event_not_found');
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [resolvedEventId]);

  useEffect(() => {
    let active = true;
    const loadConnectedUserDefaults = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active || !data?.session?.user) return;

        setCurrentProfileId(data.session.user.id);
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
        if (profile.language) setPreferredLanguage(String(profile.language));
        if (defaults.outreachOptIn) setOutreachOptIn(true);
        if (defaults.location) {
          setLocationLatLng(defaults.location);
          setLocationGranted(true);
        }
      } catch {
        // Anonymous/public users are allowed.
      }
    };

    loadConnectedUserDefaults();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const loadExistingRegistration = async () => {
      if (!resolvedEventId || !currentProfileId) return;
      try {
        const existing = await getMyEventRegistration(resolvedEventId, currentProfileId);
        if (!active || !existing) return;

        setEditingExisting(true);
        setFullName(existing.full_name || '');
        setAdditionalMembers(Math.max(0, Number(existing.additional_members || 0)));
        setZipCode(existing.zip_code || '');
        setPhone(existing.phone || '');
        setEmail(existing.email || '');
        setContactPreference((existing.contact_preference as any) || 'SMS');
        setPickupAfterTime(existing.pickup_after_time || '');
        setProxyPickup(Boolean(existing.proxy_pickup));
        setUrgencyTier((existing.urgency_tier as any) || 'MEDIUM');
        setDeliveryBarrier(existing.delivery_barrier || '');
        setChildrenCount(Math.max(0, Number(existing.children_count || 0)));
        setSeniorsCount(Math.max(0, Number(existing.seniors_count || 0)));
        setDisabilityPresent(Boolean(existing.disability_present));
        setPreferredLanguage(existing.preferred_language || 'en');
        setOutreachOptIn(Boolean(existing.outreach_opt_in));

        const needs = Array.isArray(existing.requested_supplies) ? existing.requested_supplies : [];
        const mapped: Record<string, number> = {};
        for (const n of needs) {
          if (n?.supply_item_id) mapped[n.supply_item_id] = Number(n.quantity || 0);
        }
        setRequestedBySupplyId(mapped);

        if (typeof existing.latitude === 'number' && typeof existing.longitude === 'number') {
          setLocationLatLng({ lat: existing.latitude, lng: existing.longitude });
          setLocationGranted(true);
        }
      } catch {
        // Ignore lookup issues; user can still submit.
      }
    };

    loadExistingRegistration();
    return () => {
      active = false;
    };
  }, [resolvedEventId, currentProfileId]);

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

  const requestedSummaryCount = useMemo(
    () => Object.values(requestedBySupplyId).reduce((sum, qty) => sum + (Number(qty) || 0), 0),
    [requestedBySupplyId]
  );

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
      setError('Please enter your name.');
      return;
    }
    if (additionalMembers < 0) {
      setError('Additional members cannot be negative.');
      return;
    }
    if (fields.zipCode && !/^\d{5}(-\d{4})?$/.test(fields.zipCode.trim())) {
      setError('Please enter a valid ZIP code.');
      return;
    }
    setStep('consent');
  };

  const handleSubmit = async () => {
    if (!event) return;
    setSubmitting(true);
    setError('');

    try {
      const fields = effectiveFields();
      const requestedSupplies = supplyItems
        .map((item) => ({
          supplyItemId: item.id,
          supplyLabel: item.supply_label,
          quantity: Math.max(0, Math.round(Number(requestedBySupplyId[item.id] || 0))),
        }))
        .filter((s) => s.quantity > 0);

      const reg = await registerParticipant({
        eventId: event.id,
        eventName: event.name,
        profileId: currentProfileId || undefined,
        fullName: fields.fullName,
        householdSize: totalHousehold,
        additionalMembers,
        zipCode: fields.zipCode || undefined,
        phone: fields.phone || undefined,
        email: fields.email || undefined,
        contactPreference,
        pickupAfterTime: pickupAfterTime || undefined,
        proxyPickup,
        urgencyTier,
        deliveryBarrier: deliveryBarrier.trim() || undefined,
        childrenCount,
        seniorsCount,
        disabilityPresent,
        preferredLanguage,
        outreachOptIn,
        latitude: locationLatLng?.lat,
        longitude: locationLatLng?.lng,
        consentVersion: 'event-registration-v1',
        consentChannel: 'WEB',
        geocodeConfidence: locationLatLng ? 0.9 : undefined,
        geocodedAt: locationLatLng ? new Date().toISOString() : undefined,
        requestedSupplies,
      });

      setRegistration(reg);
      setEditingExisting(true);
      const qrPayload = buildQrPayload(event.id, reg.participant_code);
      setQrUrl(await generateQrDataUrl(qrPayload));
      setStep('done');
    } catch (e: any) {
      setError(e?.message ?? 'Registration failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F6F8F7]">
        <p className="text-slate-500 text-sm">Loading event…</p>
      </div>
    );
  }

  if (step === 'event_not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F6F8F7] p-6 text-center">
        <AlertTriangle size={40} className="text-amber-400 mb-3" />
        <h2 className="text-[18px] font-bold text-slate-800 mb-2">Event not found</h2>
        <p className="text-[14px] text-slate-500 mb-6">This registration link may be invalid or the event has ended.</p>
        <Button onClick={() => setView('DASHBOARD')} size="sm">Return Home</Button>
      </div>
    );
  }

  if (step === 'done' && registration) {
    return (
      <div className="min-h-screen bg-[#F6F8F7] flex flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <CheckCircle size={48} className="text-emerald-500 mx-auto mb-3" />
            <h2 className="text-[22px] font-bold text-slate-900">{editingExisting ? 'Response Saved' : "You're registered!"}</h2>
            <p className="text-[14px] text-slate-500 mt-1">{event?.name}</p>
          </div>

          <Card className="p-5 text-center">
            <p className="text-[12px] uppercase tracking-wider text-slate-500 mb-1">Your ticket ID</p>
            <p className="text-[28px] font-bold text-slate-900 tracking-widest mb-4">{registration.ticket_id}</p>

            <p className="text-[12px] uppercase tracking-wider text-slate-500 mb-1">Backup 4-digit code</p>
            <p className="text-[40px] font-extrabold text-[#2F7A64] tracking-[0.15em] mb-4">{registration.participant_code}</p>

            {qrUrl && (
              <>
                <p className="text-[12px] text-slate-500 mb-2">Show this QR code at the distribution table</p>
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

          <Button fullWidth size="lg" className="mt-5 bg-[#2F7A64] text-white" onClick={() => setView('EVENTS')}>
            View My Event Tickets
          </Button>
        </div>
      </div>
    );
  }

  if (step === 'consent') {
    return (
      <div className="min-h-screen bg-[#F6F8F7] px-5 py-8">
        <div className="max-w-sm mx-auto">
          <button onClick={() => setStep('form')} className="flex items-center gap-1.5 text-slate-500 mb-6 text-[13px]">
            <ArrowLeft size={16} /> Back
          </button>
          <h2 className="text-[20px] font-bold text-slate-900 mb-1">Final Step</h2>
          <p className="text-[13px] text-slate-500 mb-6">Community alerts are optional</p>

          <Card className="p-4 mb-4 border border-emerald-200 bg-emerald-50">
            <p className="text-[11px] uppercase font-bold text-emerald-700">Registering For</p>
            <p className="text-[15px] font-bold text-emerald-900">Event Name: {event?.name}</p>
            <p className="text-[12px] text-emerald-800 mt-1">
              Date: {event?.distribution_date}
            </p>
            <p className="text-[12px] text-emerald-800 mt-1">
              Location Address: {event?.location_name || 'Not provided yet'}
            </p>
          </Card>

          <Card className="p-5 space-y-4">
            <div className="flex items-start gap-3">
              <Bell size={20} className="text-[#2F7A64] mt-0.5 shrink-0" />
              <div>
                <p className="text-[14px] font-semibold text-slate-800">Safety Alerts</p>
                <p className="text-[13px] text-slate-600 mt-0.5">Receive nearby safety alerts from organizations?</p>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleOutreachToggle(true)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border ${
                  outreachOptIn ? 'bg-[#2F7A64] text-white border-[#2F7A64]' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setOutreachOptIn(false)}
                className={`flex-1 py-2.5 rounded-xl text-[13px] font-semibold border ${
                  !outreachOptIn ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-700 border-slate-300'
                }`}
              >
                No
              </button>
            </div>

            {outreachOptIn && (
              <div className="bg-emerald-50 rounded-xl p-3 text-[12px] text-emerald-700">
                {locationGranted
                  ? 'Location captured. Alerts are limited to nearby radius.'
                  : 'Location permission denied. ZIP code will be used when possible.'}
              </div>
            )}
          </Card>

          {error && (
            <div className="mt-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
              <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-[13px] text-red-700">{error}</p>
            </div>
          )}

          <Button fullWidth size="lg" className="mt-5 bg-[#2F7A64] text-white" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving…' : editingExisting ? 'Save Updates' : 'Complete Registration'}
          </Button>
        </div>
      </div>
    );
  }

  const fields = effectiveFields();

  return (
    <div className="min-h-screen bg-[#F6F8F7] px-5 py-8">
      <div className="max-w-sm mx-auto">
        <button onClick={() => setView('DASHBOARD')} className="flex items-center gap-1.5 text-slate-500 mb-5 text-[13px]">
          <ArrowLeft size={16} /> Exit
        </button>

        <Card className="p-4 mb-4 border border-emerald-200 bg-emerald-50">
          <p className="text-[11px] uppercase font-bold text-emerald-700">You Are Registering For</p>
          <p className="text-[16px] font-bold text-emerald-900">Event Name: {event?.name}</p>
          <p className="text-[12px] text-emerald-800 mt-1">
            Date: {event?.distribution_date}
          </p>
          <p className="text-[12px] text-emerald-800 mt-1">
            Location Address: {event?.location_name || 'Not provided yet'}
          </p>
        </Card>

        {editingExisting && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-[12px] text-blue-700 font-medium">
              You already registered for this event. Update your details below and submit to save changes.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3">
            <AlertTriangle size={15} className="text-red-500 mt-0.5 shrink-0" />
            <p className="text-[13px] text-red-700">{error}</p>
          </div>
        )}

        {isConnectedUser && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-[13px] font-semibold text-emerald-900">Use your saved profile</p>
            <label className="mt-2 flex items-center gap-2 text-[12px] font-semibold text-emerald-900">
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
          </div>
        )}

        <div className="space-y-4">
          {(!isConnectedUser || !useProfileInfo) && (
            <Card className="p-4 space-y-3">
              <p className="text-[13px] font-semibold text-slate-700">Your Info</p>
              <Input label="Full Name *" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="First and last name" />
              <Input label="ZIP Code" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="90210" />
              <Input label="Phone (optional)" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(555) 555-5555" type="tel" />
              <Input label="Email (optional)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" type="email" />
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
                -
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
            {householdValidation.requiresAdminApproval && (
              <div className="rounded-xl p-3 text-[12px] bg-amber-50 text-amber-800 border border-amber-200">
                Larger households may require admin review.
              </div>
            )}
          </Card>

          {supplyItems.length > 0 && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Package size={15} className="text-slate-600" />
                <p className="text-[13px] font-semibold text-slate-700">What supplies do you need?</p>
              </div>
              <p className="text-[12px] text-slate-500">Select quantities from this event's available inventory.</p>
              {supplyItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2">
                  <div>
                    <p className="text-[13px] font-medium text-slate-800">{item.supply_label}</p>
                  </div>
                  <input
                    type="number"
                    min={0}
                    value={requestedBySupplyId[item.id] ?? 0}
                    onChange={(e) => {
                      const next = Math.max(0, Math.round(Number(e.target.value) || 0));
                      setRequestedBySupplyId((prev) => ({ ...prev, [item.id]: next }));
                    }}
                    className="w-20 border border-slate-300 rounded-lg px-2 py-1.5 text-[13px]"
                  />
                </div>
              ))}
              <p className="text-[11px] text-slate-500">Total requested items: {requestedSummaryCount}</p>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <p className="text-[13px] font-semibold text-slate-700">Support & Preferences</p>
            <div>
              <label className="text-[12px] font-medium text-slate-600 mb-1 block">Preferred Contact Method</label>
              <select
                value={contactPreference}
                onChange={(e) => setContactPreference(e.target.value as 'SMS' | 'CALL' | 'EMAIL')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
              >
                <option value="SMS">SMS</option>
                <option value="CALL">Phone Call</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
            <div>
              <label className="text-[12px] font-medium text-slate-600 mb-1 block">Can Pick Up After (optional)</label>
              <input
                type="time"
                value={pickupAfterTime}
                onChange={(e) => setPickupAfterTime(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={proxyPickup}
                onChange={(e) => setProxyPickup(e.target.checked)}
              />
              I need a proxy to pick up for my household.
            </label>
            <div>
              <label className="text-[12px] font-medium text-slate-600 mb-1 block">Urgency Level</label>
              <select
                value={urgencyTier}
                onChange={(e) => setUrgencyTier(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH')}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </div>
            <Input
              label="Delivery/Access Barrier (optional)"
              value={deliveryBarrier}
              onChange={(e) => setDeliveryBarrier(e.target.value)}
              placeholder="No transportation, homebound, etc."
            />
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Children Count"
                type="number"
                min={0}
                value={String(childrenCount)}
                onChange={(e) => setChildrenCount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              />
              <Input
                label="Seniors Count"
                type="number"
                min={0}
                value={String(seniorsCount)}
                onChange={(e) => setSeniorsCount(Math.max(0, Math.round(Number(e.target.value) || 0)))}
              />
            </div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={disabilityPresent}
                onChange={(e) => setDisabilityPresent(e.target.checked)}
              />
              Household includes someone with a disability.
            </label>
            <div>
              <label className="text-[12px] font-medium text-slate-600 mb-1 block">Preferred Language</label>
              <select
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-[14px] text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#2F7A64]"
              >
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
              </select>
            </div>
          </Card>

          <Button fullWidth size="lg" className="bg-[#2F7A64] text-white" onClick={handleFormNext}>
            Continue
          </Button>

          {fields.fullName && isConnectedUser && useProfileInfo && (
            <p className="text-center text-[11px] text-slate-500">Using profile: {fields.fullName}</p>
          )}
        </div>
      </div>
    </div>
  );
};
