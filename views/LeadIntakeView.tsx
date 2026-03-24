import React, { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle, Clock3, FileText, ShieldCheck, User, Users, Link, Copy } from 'lucide-react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { VerifiedLead, ViewState } from '../types';
import { fetchSubmittedReferralLeads, submitLeadIntake } from '../services/leadSupabase';
import { createShareableIntakeLink, getUserShareableIntakeLinks, getPublicShareUrl, ShareableIntakeLink } from '../services/shareableIntake';
import { StorageService } from '../services/storage';

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
  const [submittedLeads, setSubmittedLeads] = useState<VerifiedLead[]>([]);
  const [isLoadingSubmitted, setIsLoadingSubmitted] = useState(true);
  const [errors, setErrors] = useState<Partial<Record<keyof IntakeForm, string>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
    const [shareableLinks, setShareableLinks] = useState<ShareableIntakeLink[]>([]);
    const [isLoadingLinks, setIsLoadingLinks] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);
    const [isCreatingLink, setIsCreatingLink] = useState(false);
    const [shareOrgName, setShareOrgName] = useState('');
    const [copiedToken, setCopiedToken] = useState<string | null>(null);
    const sharerName = StorageService.getProfile()?.fullName?.trim() || 'AERA Team Member';

  const currentIndex = STEPS.findIndex((s) => s.id === step);

  const set = (field: keyof IntakeForm, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    let mounted = true;
    const loadSubmitted = async () => {
      const rows = await fetchSubmittedReferralLeads();
      if (!mounted) return;
      setSubmittedLeads(rows);
      setIsLoadingSubmitted(false);
    };
    void loadSubmitted();
    return () => {
      mounted = false;
    };
  }, []);

    // Load shareable links
    useEffect(() => {
      let mounted = true;
      const loadLinks = async () => {
        try {
          setIsLoadingLinks(true);
          const links = await getUserShareableIntakeLinks();
          if (mounted) setShareableLinks(links);
        } catch (err) {
          console.error('Error loading shareable links:', err);
        } finally {
          if (mounted) setIsLoadingLinks(false);
        }
      };
      void loadLinks();
      return () => {
        mounted = false;
      };
    }, []);

  const referralStatusLabel = (status: VerifiedLead['status']) => {
    if (status === 'NEW') return 'Submitted';
    if (status === 'VERIFIED') return 'Under Review';
    if (status === 'DELIVERED') return 'Matched';
    if (status === 'ACCEPTED') return 'Partner Engaged';
    if (status === 'REJECTED') return 'Closed';
    return 'Resolved';
  };

  const referralStatusBadge = (status: VerifiedLead['status']) => {
    if (status === 'NEW') return 'bg-blue-100 text-blue-700';
    if (status === 'VERIFIED') return 'bg-amber-100 text-amber-700';
    if (status === 'DELIVERED') return 'bg-violet-100 text-violet-700';
    if (status === 'ACCEPTED') return 'bg-emerald-100 text-emerald-700';
    if (status === 'REJECTED') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-200 text-slate-700';
  };

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

  const submitIntake = async () => {
    if (!validateStep()) return;
    setIsSubmitting(true);
    try {
      const lead = await submitLeadIntake({
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
        channel: 'WEB',
        sourceTag: 'organic-web',
      });
      setSubmittedId(lead.id);
      setSubmittedLeads((prev) => [lead, ...prev]);
      setStep('CONFIRMATION');
    } finally {
      setIsSubmitting(false);
    }
  };

    const handleCreateShareLink = async () => {
      setIsCreatingLink(true);
      try {
        const link = await createShareableIntakeLink({
          referrer_name: sharerName,
          organization_name: shareOrgName || undefined,
          expiresInDays: 90,
        });
        setShareableLinks((prev) => [link, ...prev]);
        setShowShareModal(false);
        setShareOrgName('');
      } catch (err) {
        console.error('Error creating share link:', err);
        alert('Failed to create share link. Please try again.');
      } finally {
        setIsCreatingLink(false);
      }
    };

    const handleCopyUrl = (link: ShareableIntakeLink) => {
      const url = getPublicShareUrl(link.share_token, {
        referrerName: link.referrer_name,
        organizationName: link.organization_name,
      });
      navigator.clipboard.writeText(url);
      setCopiedToken(link.share_token);
      setTimeout(() => setCopiedToken(null), 2000);
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
          <span className="text-sm font-semibold text-slate-900">Referral Intake</span>
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
              <h2 className="text-lg font-bold text-slate-900">Referral Contact Information</h2>
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
              <h2 className="text-lg font-bold text-slate-900">Describe the Referral</h2>
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
              <h2 className="text-lg font-bold text-slate-900">Referral Permissions & Consent</h2>
            </div>
            <div className="space-y-4 text-sm">
              {[
                {
                  field: 'consentToContact' as keyof IntakeForm,
                  label: (
                    <>I consent to be contacted by phone, email, or text about my case.</>
                  ),
                  subtext: 'A qualified specialist may reach out regarding your submission.',
                },
                {
                  field: 'tcpaComplianceAcknowledged' as keyof IntakeForm,
                  label: (
                    <>
                      I acknowledge I may receive automated calls or texts (
                      <a
                        href="https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-64/subpart-L"
                        className="font-semibold text-slate-900 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        TCPA
                      </a>
                      ).
                    </>
                  ),
                  subtext: 'Standard message & data rates may apply. Reply STOP to opt out at any time.',
                },
                {
                  field: 'privacyPolicyAccepted' as keyof IntakeForm,
                  label: (
                    <>
                      I have read and accept the{' '}
                      <a
                        href="/privacy-policy"
                        className="font-semibold text-slate-900 hover:underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        AERA Privacy Policy
                      </a>
                      .
                    </>
                  ),
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
              <h2 className="text-xl font-bold text-emerald-900">Referral Submitted</h2>
              <p className="text-sm text-emerald-800 max-w-sm">
                Your referral has been received. A verification specialist will review the context
                and route it to a qualified partner if there is a match.
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
              <Button onClick={submitIntake} disabled={isSubmitting}>
                {isSubmitting ? 'Submitting...' : 'Submit Referral'}  <ArrowRight size={14} className="ml-1 inline" />
              </Button>
            ) : (
              <Button onClick={nextStep}>
                Continue  <ArrowRight size={14} className="ml-1 inline" />
              </Button>
            )}
          </div>
        )}

          {/* Share Form Card */}
          <Card className="border-emerald-200 bg-emerald-50">
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Link size={18} className="text-emerald-700" />
                <div>
                  <h2 className="text-lg font-bold text-emerald-900">Share Intake Form</h2>
                  <p className="text-sm text-emerald-700">Generate a link for others to submit referrals</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={() => setShowShareModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                Generate Link
              </Button>
            </div>

            {isLoadingLinks ? (
              <p className="text-sm text-emerald-700">Loading share links…</p>
            ) : shareableLinks.length === 0 ? (
              <p className="text-sm text-emerald-700">No shareable links created yet. Generate one to get started!</p>
            ) : (
              <div className="space-y-2">
                {shareableLinks.map((link) => (
                  <div key={link.id} className="bg-white border border-emerald-200 rounded-lg p-3 flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">{link.referrer_name}</p>
                      {link.organization_name && (
                        <p className="text-sm text-slate-600">{link.organization_name}</p>
                      )}
                      <p className="text-xs text-slate-500 mt-1">
                        {link.submission_count} submission{link.submission_count !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopyUrl(link)}
                      className={copiedToken === link.share_token ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : ''}
                    >
                      <Copy size={14} className="mr-1" />
                      {copiedToken === link.share_token ? 'Copied!' : 'Copy'}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Card>

        <Card className="border-slate-200 bg-white">
          <div className="flex items-center gap-2 mb-4">
            <Users size={18} className="text-slate-600" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Referral Tracker</h2>
              <p className="text-sm text-slate-500">Track whether someone was submitted, is under review, or has been matched.</p>
            </div>
          </div>

          {isLoadingSubmitted ? (
            <p className="text-sm text-slate-500">Loading submitted referrals…</p>
          ) : submittedLeads.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center">
              <Clock3 size={20} className="text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No referrals submitted yet</p>
              <p className="text-xs text-slate-500 mt-1">Once you submit a referral, its status will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submittedLeads.slice(0, 6).map((lead) => (
                <div key={lead.id} className="border border-slate-200 rounded-xl p-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{lead.applicantName}</p>
                    <p className="text-xs text-slate-500">{lead.city}, {lead.state} · {lead.caseType}</p>
                    <p className="text-[11px] text-slate-400 mt-1">Ref #{lead.id}</p>
                  </div>
                  <span className={`shrink-0 text-[10px] font-bold px-2 py-1 rounded-full ${referralStatusBadge(lead.status)}`}>
                    {referralStatusLabel(lead.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </main>

        {/* Share Modal */}
        {showShareModal && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-md w-full border-slate-300 bg-white">
              <div className="flex items-center gap-2 mb-4">
                <Link size={20} className="text-emerald-600" />
                <h2 className="text-lg font-bold text-slate-900">Create Shareable Form</h2>
              </div>
              <p className="text-sm text-slate-600 mb-4">
                This creates a public link to the intake form pre-filled with your information. Anyone with the link can submit a referral without logging in.
              </p>
              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Your Name (Referrer)
                  </label>
                  <p className="text-sm text-slate-600 mb-2">This will be displayed to people filling out the form</p>
                  <p className="text-sm font-mono bg-slate-50 p-2 rounded border border-slate-200 text-slate-700">
                    {sharerName}
                  </p>
                </div>
                <div>
                  <label htmlFor="orgName" className="block text-sm font-semibold text-slate-900 mb-2">
                    Organization Name (Optional)
                  </label>
                  <Input
                    id="orgName"
                    value={shareOrgName}
                    onChange={(e) => setShareOrgName(e.target.value)}
                    placeholder="e.g. Red Cross, Local Fire Department"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setShowShareModal(false);
                    setShareOrgName('');
                  }}
                  disabled={isCreatingLink}
                >
                  Cancel
                </Button>
                <Button
                  fullWidth
                  onClick={handleCreateShareLink}
                  disabled={isCreatingLink}
                >
                  {isCreatingLink ? 'Creating...' : 'Create Link'}
                </Button>
              </div>
            </Card>
          </div>
        )}
    </div>
  );
};
