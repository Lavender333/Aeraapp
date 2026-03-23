import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, FileText, Phone, Mail, MapPin, ShieldCheck, User } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { ViewState } from '../types';
import { computeQualityScore, assignTier, SAMPLE_LEADS } from '../services/leadService';

type Step = 'IDENTITY' | 'SITUATION' | 'CONSENT' | 'CONFIRMATION';

interface IntakeForm {
  // Step 1 – Identity
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;

  // Step 2 – Situation
  caseType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  situationSummary: string;

  // Step 3 – Consent
  consentToContact: boolean;
  tcpaComplianceAcknowledged: boolean;
  privacyPolicyAccepted: boolean;
}

const EMPTY_FORM: IntakeForm = {
  applicantName: '',
  phone: '',
  email: '',
  city: '',
  state: '',
  zipCode: '',
  caseType: 'Property Claim',
  severity: 'HIGH',
  situationSummary: '',
  consentToContact: false,
  tcpaComplianceAcknowledged: false,
  privacyPolicyAccepted: false,
};

const CASE_TYPES = [
  'Property Claim',
  'Storm Damage',
  'Flood Damage',
  'Fire Damage',
  'Emergency Housing',
  'Other',
];

const STEPS: Array<{ id: Step; label: string }> = [
  { id: 'IDENTITY', label: 'Contact Info' },
  { id: 'SITUATION', label: 'Situation' },
  { id: 'CONSENT', label: 'Consent' },
  { id: 'CONFIRMATION', label: 'Submitted' },
];

interface LeadIntakeViewProps {
  setView: (view: ViewState) => void;
}

export const LeadIntakeView: React.FC<LeadIntakeViewProps> = ({ setView }) => {
  const [step, setStep] = useState<Step>('IDENTITY');
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [submittedId, setSubmittedId] = useState<string>('');
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeForm, string>>>({});

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const set = (field: keyof IntakeForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validateStep = (): boolean => {
    const errs: Partial<Record<keyof IntakeForm, string>> = {};
    if (step === 'IDENTITY') {
      if (!form.applicantName.trim()) errs.applicantName = 'Name is required';
      if (!/^\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}$/.test(form.phone.replace(/\D/g, '').replace(/^(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3')))
        if (form.phone.replace(/\D/g, '').length < 10) errs.phone = 'Valid 10-digit phone required';
      if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
        errs.email = 'Valid email required';
      if (!form.city.trim()) errs.city = 'City is required';
      if (!form.state.trim()) errs.state = 'State is required';
      if (!form.zipCode.trim()) errs.zipCode = 'ZIP is required';
    }
    if (step === 'SITUATION') {
      if (!form.situationSummary.trim()) errs.situationSummary = 'Please describe the situation';
    }
    if (step === 'CONSENT') {
      if (!form.consentToContact) errs.consentToContact = 'Contact consent is required';
      if (!form.tcpaComplianceAcknowledged) errs.tcpaComplianceAcknowledged = 'TCPA acknowledgment is required';
      if (!form.privacyPolicyAccepted) errs.privacyPolicyAccepted = 'Privacy policy acceptance is required';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (!validateStep()) return;
    const next = STEPS[currentIndex + 1];
    if (next) setStep(next.id);
  };

  const submitIntake = () => {
    if (!validateStep()) return;
    // In production: POST to /api/leads/intake
    const phoneVerified = form.phone.replace(/\D/g, '').length === 10;
    const emailVerified = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email);
    const identityScore = 70 + Math.round(Math.random() * 25);
    const qualityScore = computeQualityScore({
      phoneVerified,
      emailVerified,
      identityScore,
      serviceAreaMatch: true,
      fraudFlagged: false,
      duplicateChecked: true,
    });
    const tier = assignTier(qualityScore, form.severity);
    const leadId = `LEAD-${Date.now().toString().slice(-5)}`;
    console.log('[LeadIntake] Submitted:', { leadId, tier, qualityScore, ...form });
    setSubmittedId(leadId);
    setStep('CONFIRMATION');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <button
            className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900"
            onClick={() => setView('DASHBOARD')}
          >
            <ArrowLeft size={16} />
            Cancel
          </button>
          <span className="text-sm font-semibold text-slate-900">Lead Intake</span>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-200">
            <ShieldCheck size={13} />
            Secure
          </div>
        </div>
      </header>

      {/* Step progress */}
      {step !== 'CONFIRMATION' && (
        <div className="max-w-2xl mx-auto px-4 pt-5">
          <div className="flex items-center gap-2 mb-6">
            {STEPS.filter((s) => s.id !== 'CONFIRMATION').map((s, i) => {
              const done = i < currentIndex;
              const active = s.id === step;
              return (
                <React.Fragment key={s.id}>
                  <div className="flex flex-col items-center gap-1 flex-1">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        done
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : active
                          ? 'bg-white border-slate-900 text-slate-900'
                          : 'bg-white border-slate-300 text-slate-400'
                      }`}
                    >
                      {done ? <CheckCircle size={14} /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}>{s.label}</span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-px ${i < currentIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 space-y-4">
        {/* ── Step 1: Identity ─────────────────────────────────────────── */}
        {step === 'IDENTITY' && (
          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <User size={18} className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-900">Your Contact Information</h2>
            </div>
            <div className="space-y-3">
              <Input
                label="Full Name"
                value={form.applicantName}
                onChange={(e) => set('applicantName', e.target.value)}
                placeholder="Jane Smith"
                error={errors.applicantName}
              />
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  placeholder="(555) 000-0000"
                  error={errors.phone}
                />
                <Input
                  label="Email Address"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  placeholder="you@email.com"
                  error={errors.email}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <Input
                    label="City"
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Houston"
                    error={errors.city}
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    label="State"
                    value={form.state}
                    onChange={(e) => set('state', e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="TX"
                    error={errors.state}
                  />
                </div>
                <div className="col-span-1">
                  <Input
                    label="ZIP Code"
                    value={form.zipCode}
                    onChange={(e) => set('zipCode', e.target.value)}
                    placeholder="77001"
                    error={errors.zipCode}
                  />
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* ── Step 2: Situation ────────────────────────────────────────── */}
        {step === 'SITUATION' && (
          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <FileText size={18} className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-900">Describe Your Situation</h2>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Case Type</label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  value={form.caseType}
                  onChange={(e) => set('caseType', e.target.value)}
                >
                  {CASE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Urgency Level</label>
                <div className="flex gap-2 flex-wrap">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((s) => (
                    <button
                      key={s}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                        form.severity === s
                          ? s === 'HIGH' ? 'bg-rose-600 border-rose-600 text-white'
                          : s === 'MEDIUM' ? 'bg-amber-500 border-amber-500 text-white'
                          : 'bg-slate-400 border-slate-400 text-white'
                          : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                      onClick={() => set('severity', s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Situation Summary <span className="text-slate-400">(min 20 chars)</span>
                </label>
                <textarea
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 resize-none"
                  rows={4}
                  placeholder="Briefly describe the damage, loss, or need you're seeking help with…"
                  value={form.situationSummary}
                  onChange={(e) => set('situationSummary', e.target.value)}
                />
                {errors.situationSummary && (
                  <p className="text-xs text-rose-600 mt-1">{errors.situationSummary}</p>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* ── Step 3: Consent ──────────────────────────────────────────── */}
        {step === 'CONSENT' && (
          <Card className="border-slate-200 bg-white">
            <div className="flex items-center gap-2 mb-4">
              <ShieldCheck size={18} className="text-slate-600" />
              <h2 className="text-lg font-bold text-slate-900">Permissions & Consent</h2>
            </div>
            <div className="space-y-4 text-sm">
              {[
                {
                  field: 'consentToContact' as keyof IntakeForm,
                  label: 'I consent to be contacted by phone, email, or text about my case.',
                  subtext: 'A qualified specialist may reach out regarding your submission.',
                },
                {
                  field: 'tcpaComplianceAcknowledged' as keyof IntakeForm,
                  label: 'I acknowledge I may receive automated calls or texts (TCPA).',
                  subtext: 'Standard message & data rates may apply. Reply STOP to opt out at any time.',
                },
                {
                  field: 'privacyPolicyAccepted' as keyof IntakeForm,
                  label: 'I have read and accept the AERA Privacy Policy.',
                  subtext: 'Your information is protected and will only be shared with licensed, verified partners.',
                },
              ].map(({ field, label, subtext }) => (
                <label key={field} className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    className="mt-0.5 accent-slate-900 w-4 h-4 flex-shrink-0"
                    checked={Boolean(form[field])}
                    onChange={(e) => set(field, e.target.checked)}
                  />
                  <div>
                    <p className="font-medium text-slate-900">{label}</p>
                    <p className="text-slate-500 text-xs mt-0.5">{subtext}</p>
                    {errors[field] && <p className="text-xs text-rose-600 mt-1">{errors[field]}</p>}
                  </div>
                </label>
              ))}

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 mt-2">
                <strong>Data Handling:</strong> Your information is retained for 90 days and may be deleted upon request.
                Leads are only delivered to buyers licensed to operate in your state. Consent is recorded with a timestamp
                and IP address for compliance auditing.
              </div>
            </div>
          </Card>
        )}

        {/* ── Confirmation ─────────────────────────────────────────────── */}
        {step === 'CONFIRMATION' && (
          <Card className="border-emerald-200 bg-emerald-50">
            <div className="flex flex-col items-center text-center gap-3 py-6">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold text-emerald-900">Intake Submitted</h2>
              <p className="text-sm text-emerald-800 max-w-sm">
                Your lead has been received. A verification specialist will review your information
                and a qualified partner will be in touch within 24 hours.
              </p>
              <div className="bg-white border border-emerald-200 rounded-xl px-6 py-3 text-sm font-mono font-bold text-slate-900">
                {submittedId}
              </div>
              <p className="text-xs text-emerald-700">Save this reference number for your records.</p>
              <Button className="mt-2" onClick={() => setView('DASHBOARD')}>
                Return to Dashboard
              </Button>
            </div>
          </Card>
        )}

        {/* Navigation buttons */}
        {step !== 'CONFIRMATION' && (
          <div className="flex items-center justify-between gap-3 pt-2">
            {currentIndex > 0 ? (
              <Button variant="outline" onClick={() => setStep(STEPS[currentIndex - 1].id)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step === 'CONSENT' ? (
              <Button onClick={submitIntake}>
                Submit Lead  <ArrowRight size={14} className="ml-1 inline" />
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Continue  <ArrowRight size={14} className="ml-1 inline" />
              </Button>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
