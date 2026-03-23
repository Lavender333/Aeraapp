import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle, ShieldCheck, User, Loader } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import {
  getShareableIntakeLinkByToken,
  submitPublicLeadIntake,
  PublicIntakeLinkInfo,
} from '../services/shareableIntake';

type Step = 'IDENTITY' | 'SITUATION' | 'CONSENT' | 'CONFIRMATION';

interface IntakeForm {
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  caseType: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  situationSummary: string;
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

interface PublicIntakeViewProps {
  shareToken?: string;
}

export const PublicIntakeView: React.FC<PublicIntakeViewProps> = ({ shareToken = '' }) => {
  const [step, setStep] = useState<Step>('IDENTITY');
  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [submittedId, setSubmittedId] = useState<string>('');
  const [shareInfo, setShareInfo] = useState<PublicIntakeLinkInfo | null>(null);
  const [isLoading, setIsLoading] = useState(!!shareToken);
  const [loadError, setLoadError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const set = (field: keyof IntakeForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  // Load share link info if token provided
  useEffect(() => {
    if (!shareToken) {
      setLoadError('This share link is missing. Please use the full link provided by your AERA contact.');
      setIsLoading(false);
      return;
    }

    let mounted = true;
    const loadShareInfo = async () => {
      try {
        const link = await getShareableIntakeLinkByToken(shareToken);
        if (!mounted) return;

        if (!link) {
          setLoadError('This share link is invalid or has expired.');
          setIsLoading(false);
          return;
        }

        setShareInfo(link);
        setLoadWarning('');
      } catch (err) {
        if (mounted) {
          // Do not block form usage if metadata lookup fails.
          // Token validity is still enforced on submit.
          setLoadWarning('We could not load sharer details, but you can still submit this form.');
          console.error('Error loading share link:', err);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void loadShareInfo();
    return () => {
      mounted = false;
    };
  }, [shareToken]);

  const validateStep = (): boolean => {
    const errs: Partial<Record<keyof IntakeForm, string>> = {};
    if (step === 'IDENTITY') {
      if (!form.applicantName.trim()) errs.applicantName = 'Name is required';
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
      if (!form.tcpaComplianceAcknowledged)
        errs.tcpaComplianceAcknowledged = 'TCPA acknowledgment is required';
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

  const submitIntake = async () => {
    if (!validateStep()) return;
    setSubmitError('');
    setIsSubmitting(true);
    try {
      const lead = await submitPublicLeadIntake({
        shareToken,
        applicantName: form.applicantName,
        phone: form.phone,
        email: form.email,
        city: form.city,
        state: form.state,
        zipCode: form.zipCode,
        caseType: form.caseType,
        severity: form.severity,
        consentToContact: form.consentToContact,
        tcpaComplianceAcknowledged: form.tcpaComplianceAcknowledged,
        privacyPolicyAccepted: form.privacyPolicyAccepted,
        notes: form.situationSummary,
      });

      setSubmittedId(lead.external_lead_id || lead.id);
      setStep('CONFIRMATION');
    } catch (err) {
      const message = String((err as { message?: string } | null)?.message || '');
      const lower = message.toLowerCase();
      if (lower.includes('invalid or expired share token')) {
        setSubmitError('This share link is invalid or has expired. Please request a new link.');
      } else if (message) {
        setSubmitError(message);
      } else {
        setSubmitError('We could not submit your intake right now. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <Loader size={40} className="animate-spin text-slate-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading form...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="border-rose-200 bg-rose-50 max-w-md">
          <h2 className="font-bold text-rose-900 mb-2">Unable to Load Form</h2>
          <p className="text-sm text-rose-800">{loadError}</p>
          <Button variant="outline" className="mt-4 w-full" onClick={() => window.location.href = '/'}>
            Return Home
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <a href="/" className="inline-flex items-center gap-2 text-sm text-slate-700 hover:text-slate-900">
            <ArrowLeft size={16} />
            Back
          </a>
          <span className="text-sm font-semibold text-slate-900">Referral Intake</span>
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold border border-emerald-200">
            <ShieldCheck size={13} />
            Secure
          </div>
        </div>
      </header>

      {/* Referrer banner if from share link */}
      {shareInfo && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
          <div className="max-w-2xl mx-auto text-sm text-blue-900">
            <p>
              <strong>Shared by:</strong> {shareInfo.referrer_name}
              {shareInfo.organization_name && ` (${shareInfo.organization_name})`}
            </p>
          </div>
        </div>
      )}

      {loadWarning && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-3">
          <div className="max-w-2xl mx-auto text-sm text-amber-900">
            {loadWarning}
          </div>
        </div>
      )}

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
                    <span className={`text-[10px] font-semibold ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                      {s.label}
                    </span>
                  </div>
                  {i < 2 && <div className={`flex-1 h-px ${i < currentIndex ? 'bg-emerald-500' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-4 space-y-4">
        {submitError && (
          <Card className="border-rose-200 bg-rose-50">
            <p className="text-sm text-rose-800">{submitError}</p>
          </Card>
        )}

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
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="City"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  placeholder="Portland"
                  error={errors.city}
                />
                <Input
                  label="State"
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  placeholder="OR"
                  error={errors.state}
                />
              </div>
              <Input
                label="ZIP Code"
                value={form.zipCode}
                onChange={(e) => set('zipCode', e.target.value)}
                placeholder="97201"
                error={errors.zipCode}
              />
            </div>
            <div className="flex gap-2 mt-6">
              <Button fullWidth onClick={nextStep} size="lg" className="font-bold">
                Next
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 2: Situation ─────────────────────────────────────────── */}
        {step === 'SITUATION' && (
          <Card className="border-slate-200 bg-white">
            <h2 className="text-lg font-bold text-slate-900 mb-4">What's Your Situation?</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Case Type</label>
                <select
                  value={form.caseType}
                  onChange={(e) => set('caseType', e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  {CASE_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">Severity</label>
                <div className="flex gap-2">
                  {(['HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
                    <button
                      key={sev}
                      onClick={() => set('severity', sev)}
                      className={`flex-1 px-3 py-2 rounded-lg font-semibold text-sm transition ${
                        form.severity === sev
                          ? sev === 'HIGH'
                            ? 'bg-rose-600 text-white'
                            : sev === 'MEDIUM'
                            ? 'bg-amber-600 text-white'
                            : 'bg-emerald-600 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {sev}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Describe The Situation
                </label>
                <textarea
                  value={form.situationSummary}
                  onChange={(e) => set('situationSummary', e.target.value)}
                  placeholder="What happened? Please provide details..."
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
                {errors.situationSummary && (
                  <p className="text-rose-600 text-sm mt-1">{errors.situationSummary}</p>
                )}
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" fullWidth onClick={() => setStep('IDENTITY')}>
                Back
              </Button>
              <Button fullWidth onClick={nextStep} size="lg" className="font-bold">
                Next
              </Button>
            </div>
          </Card>
        )}

        {/* ── Step 3: Consent ─────────────────────────────────────────── */}
        {step === 'CONSENT' && (
          <Card className="border-slate-200 bg-white">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Consent & Acknowledgments</h2>
            <div className="space-y-3">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.consentToContact}
                  onChange={(e) => set('consentToContact', e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700">
                  I consent to be contacted about this referral via phone or email.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.tcpaComplianceAcknowledged}
                  onChange={(e) => set('tcpaComplianceAcknowledged', e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700">
                  I acknowledge that I have read and understand TCPA regulations regarding phone and text messages.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.privacyPolicyAccepted}
                  onChange={(e) => set('privacyPolicyAccepted', e.target.checked)}
                  className="mt-1"
                />
                <span className="text-sm text-slate-700">
                  I have read and agree to the{' '}
                  <a href="/privacy-policy" className="font-semibold text-slate-900 hover:underline" target="_blank" rel="noopener noreferrer">
                    Privacy Policy
                  </a>
                  .
                </span>
              </label>
            </div>
            <div className="flex gap-2 mt-6">
              <Button variant="outline" fullWidth onClick={() => setStep('SITUATION')}>
                Back
              </Button>
              <Button
                fullWidth
                onClick={submitIntake}
                size="lg"
                className="font-bold"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Referral'}
              </Button>
            </div>
          </Card>
        )}

        {/* ── Confirmation ─────────────────────────────────────────── */}
        {step === 'CONFIRMATION' && (
          <Card className="border-emerald-200 bg-emerald-50">
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-16 h-16 rounded-full bg-emerald-600 flex items-center justify-center">
                  <CheckCircle size={32} className="text-white" />
                </div>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Thank You!</h2>
                <p className="text-slate-600 mt-2">
                  Your referral has been successfully submitted with ID: <code className="bg-white px-2 py-1 rounded text-slate-900 font-mono text-sm">{submittedId}</code>
                </p>
              </div>
              <p className="text-sm text-slate-600">
                We have received your information and will review it shortly. You will receive contact regarding your referral status via the phone number or email you provided.
              </p>
              <Button
                fullWidth
                onClick={() => (window.location.href = '/')}
                className="font-bold"
              >
                Return Home
              </Button>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
};
