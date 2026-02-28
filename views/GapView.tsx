
import React, { useEffect, useState } from 'react';
import { GapDocumentAttachment, HelpRequestData, HelpRequestRecord, ViewState, UserRole } from '../types';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input, Textarea } from '../components/Input';
import { StorageService } from '../services/storage';
import { AlertCircle, ArrowLeft, Info, ShieldCheck } from 'lucide-react';

type ReviewAction = 'Recommend' | 'Request Info' | 'Decline' | 'Approve' | 'Adjust' | 'Deny' | 'Override';

const REQUEST_INFO_OPTIONS = [
  'Government ID image is unclear or expired',
  'Proof of residency is missing or outdated',
  'Hardship statement needs more detail',
  'Bills / estimates / invoices are missing',
  'Household impacted count needs correction',
  'Monthly income loss documentation is needed',
] as const;

export const GapView: React.FC<{ setView: (v: ViewState) => void }> = ({ setView }) => {
  const profile = StorageService.getProfile();
  const db = StorageService.getDB();
  const role = String(profile.role || 'GENERAL_USER').toUpperCase() as UserRole;
  const reviewerScopeKey = `aera_gap_review_actions:${String(profile.id || 'guest')}:${String(profile.communityId || '').trim()}:${role}`;
  const [reviewActions, setReviewActions] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem(reviewerScopeKey);
      if (!raw) return {};
      const parsed = JSON.parse(raw) as Record<string, string>;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  });
  const [showGapForm, setShowGapForm] = useState(false);
  const [showStatusTracker, setShowStatusTracker] = useState(false);
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [showGrantDirectory, setShowGrantDirectory] = useState(false);
  const [selectedGrantUrl, setSelectedGrantUrl] = useState('');
  const [decisionDraft, setDecisionDraft] = useState<{
    requestId: string;
    action: ReviewAction;
    note: string;
  } | null>(null);
  const [requestInfoSelections, setRequestInfoSelections] = useState<string[]>([]);
  const [selectedOrgApplication, setSelectedOrgApplication] = useState<HelpRequestRecord | null>(null);
  const [decisionError, setDecisionError] = useState('');
  const [queueProgramFilter, setQueueProgramFilter] = useState<'ALL' | 'HARDSHIP' | 'ADVANCE'>('ALL');
  const [queueMissingDocsOnly, setQueueMissingDocsOnly] = useState(false);
  const [queueSortBy, setQueueSortBy] = useState<'NEWEST' | 'HIGHEST_AMOUNT'>('NEWEST');
  const [documentUrlById, setDocumentUrlById] = useState<Record<string, string>>({});
  const [documentOpenError, setDocumentOpenError] = useState('');
  const [formMode, setFormMode] = useState<'HARDSHIP' | 'ADVANCE'>('HARDSHIP');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState({
    householdImpacted: Math.max(1, Number(profile.householdMembers || profile.household?.length || 1)),
    monthlyIncomeLoss: '',
    hardshipSummary: '',
    contactPhone: String(profile.phone || '').trim(),
    docsPhotoId: false,
    docsResidency: false,
    docsHardshipStatement: false,
    docsBillsEstimate: false,
    consentToReview: true,
    attestTruth: false,
  });
  const [documentFiles, setDocumentFiles] = useState<{
    photoId: File | null;
    residency: File | null;
    hardshipStatement: File | null;
    billsEstimate: File | null;
  }>({
    photoId: null,
    residency: null,
    hardshipStatement: null,
    billsEstimate: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(reviewerScopeKey, JSON.stringify(reviewActions));
    } catch {
      // Ignore storage write failures to keep workflow usable.
    }
  }, [reviewActions, reviewerScopeKey]);

  const isCoreAdmin = role === 'ADMIN';
  const isOrgAdmin = role === 'ORG_ADMIN' || role === 'INSTITUTION_ADMIN';
  const isMemberView = !isCoreAdmin && !isOrgAdmin;

  const users = db.users || [];
  const allRequests = (db.requests || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const allOrganizations = db.organizations || [];

  const resolveOrgForRequest = (request: HelpRequestRecord) => {
    const user = users.find((u) => u.id === request.userId);
    return String(user?.communityId || '').trim();
  };

  const orgScopeId = String(profile.communityId || '').trim();
  const orgMembers = orgScopeId ? StorageService.getOrgMembers(orgScopeId) : [];
  const orgMemberById = new Map(orgMembers.map((member) => [member.id, member.name]));

  const pendingStatuses = new Set(['PENDING', 'RECEIVED']);
  const resolvedStatuses = new Set(['RESOLVED']);
  const memberRequests = allRequests.filter((req) => req.userId === profile.id);
  const memberPendingRequests = memberRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const memberResolvedRequests = memberRequests.filter((req) => resolvedStatuses.has(String(req.status || '').toUpperCase()));
  const orgRequests = isOrgAdmin
    ? allRequests.filter((req) => resolveOrgForRequest(req) === orgScopeId)
    : [];

  const pendingOrgRequests = orgRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));

  const connectedUsersByOrg = users.reduce((map, user) => {
    const communityId = String(user.communityId || '').trim();
    if (!communityId) return map;
    map.set(communityId, (map.get(communityId) || 0) + 1);
    return map;
  }, new Map<string, number>());

  const getRequestAmount = (request: HelpRequestRecord) => {
    const gapAmount = Number(request.gapApplication?.requestedAmount || 0);
    if (gapAmount > 0) return gapAmount;
    return Math.max(100, Number(request.peopleCount || 1) * 125);
  };

  const communityIds = Array.from(new Set([
    ...Array.from(connectedUsersByOrg.keys()),
    ...allRequests.map((request) => resolveOrgForRequest(request)).filter(Boolean),
  ]));

  const communityFundingById = new Map<string, {
    connectedUsers: number;
    participatingUsers: number;
    participationPct: number;
    pooledFund: number;
    allocationCapacity: number;
    amountDisbursed: number;
    remainingBalance: number;
  }>();

  for (const communityId of communityIds) {
    const connectedUsers = Number(connectedUsersByOrg.get(communityId) || 0);
    const communityRequests = allRequests.filter((request) => resolveOrgForRequest(request) === communityId);
    const participatingUsers = new Set(communityRequests.map((request) => request.userId)).size;
    const participationRatio = connectedUsers > 0 ? Math.min(1, participatingUsers / connectedUsers) : 0;
    const participationPct = Math.round(participationRatio * 100);
    const basePooledFund = connectedUsers * 250;
    const pooledFund = Math.round(basePooledFund * participationRatio);
    const amountDisbursed = communityRequests
      .filter((request) => resolvedStatuses.has(String(request.status || '').toUpperCase()))
      .reduce((sum, request) => sum + getRequestAmount(request), 0);
    const allocationCapacity = pooledFund;
    const remainingBalance = Math.max(0, allocationCapacity - amountDisbursed);

    communityFundingById.set(communityId, {
      connectedUsers,
      participatingUsers,
      participationPct,
      pooledFund,
      allocationCapacity,
      amountDisbursed,
      remainingBalance,
    });
  }

  const scopedFunding = orgScopeId ? communityFundingById.get(orgScopeId) : undefined;
  const participationBase = scopedFunding?.connectedUsers || 0;
  const participationPct = scopedFunding?.participationPct || 0;
  const pooledFund = scopedFunding?.pooledFund || 0;
  const allocationCapacity = scopedFunding?.allocationCapacity || 0;
  const amountDisbursed = scopedFunding?.amountDisbursed || 0;
  const remainingBalance = scopedFunding?.remainingBalance || 0;

  const totalConnectedUsers = Array.from(communityFundingById.values()).reduce((sum, item) => sum + item.connectedUsers, 0);
  const totalParticipatingUsers = Array.from(communityFundingById.values()).reduce((sum, item) => sum + item.participatingUsers, 0);
  const overallParticipationPct = totalConnectedUsers > 0 ? Math.round((totalParticipatingUsers / totalConnectedUsers) * 100) : 0;
  const totalHardshipFund = Array.from(communityFundingById.values()).reduce((sum, item) => sum + item.pooledFund, 0);
  const totalAllocationCapacity = Array.from(communityFundingById.values()).reduce((sum, item) => sum + item.allocationCapacity, 0);
  const totalRemainingBalance = Array.from(communityFundingById.values()).reduce((sum, item) => sum + item.remainingBalance, 0);

  const displayedParticipationPct = isCoreAdmin ? overallParticipationPct : participationPct;
  const displayedPooledFund = isCoreAdmin ? totalHardshipFund : pooledFund;
  const displayedAllocationCapacity = isCoreAdmin ? totalAllocationCapacity : allocationCapacity;
  const displayedRemainingBalance = isCoreAdmin ? totalRemainingBalance : remainingBalance;

  const corePendingApplications = allRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const orgsWithPending = new Set(corePendingApplications.map((req) => resolveOrgForRequest(req)).filter(Boolean)).size;

  const reviewTarget = corePendingApplications[0] || null;

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);

  const applyReviewAction = (requestId: string, action: ReviewAction, note: string) => {
    setReviewActions((prev) => ({ ...prev, [requestId]: action }));

    const statusByAction: Partial<Record<ReviewAction, HelpRequestRecord['status']>> = {
      Approve: 'RESOLVED',
      Deny: 'RESOLVED',
      Override: 'RESOLVED',
      Adjust: 'RECEIVED',
      Recommend: 'PENDING',
      'Request Info': 'RECEIVED',
      Decline: 'PENDING',
    };

    const nextStatus = statusByAction[action];
    if (nextStatus) {
      const dbToUpdate = StorageService.getDB();
      const idx = dbToUpdate.requests.findIndex((req) => req.id === requestId);
      if (idx >= 0) {
        const request = dbToUpdate.requests[idx];
        const currentGap = request.gapApplication || {
          program: 'HARDSHIP' as const,
          householdImpacted: Math.max(1, Number(request.peopleCount || 1)),
          requestedAmount: getRequestAmount(request),
        };

        const reviewTrail = [
          ...(currentGap.reviewTrail || []),
          {
            id: `${requestId}:${Date.now()}`,
            action,
            reviewerRole: role,
            reviewerId: String(profile.id || 'unknown'),
            reviewedAt: new Date().toISOString(),
            note: String(note || '').trim() || undefined,
          },
        ];

        const nextGapApplication = {
          ...currentGap,
          reviewTrail,
          lastReviewAction: action,
          lastReviewedAt: new Date().toISOString(),
        };

        StorageService.syncRequestReviewDecision({
          requestId,
          status: nextStatus,
          gapApplication: nextGapApplication,
        }).catch((error) => {
          console.warn('Failed to sync review decision', error);
        });
      }
    }
  };

  const openDecisionDialog = (requestId: string, action: ReviewAction) => {
    setDecisionError('');
    setRequestInfoSelections([]);
    setDecisionDraft({
      requestId,
      action,
      note: '',
    });
  };

  const submitDecision = () => {
    if (!decisionDraft) return;
    const requiresNote =
      decisionDraft.action === 'Deny' ||
      decisionDraft.action === 'Decline' ||
      decisionDraft.action === 'Override' ||
      decisionDraft.action === 'Request Info';
    const freeTextNote = String(decisionDraft.note || '').trim();
    const hasRequestInfoChecklist = decisionDraft.action === 'Request Info' && requestInfoSelections.length > 0;
    const hasRequestInfoDetails = decisionDraft.action === 'Request Info' && Boolean(freeTextNote);

    if (decisionDraft.action === 'Request Info' && !hasRequestInfoChecklist && !hasRequestInfoDetails) {
      setDecisionError(
        'Select at least one missing item or provide additional details for the member.'
      );
      return;
    }

    if (requiresNote && decisionDraft.action !== 'Request Info' && !freeTextNote) {
      setDecisionError('A decision note is required for this action.');
      return;
    }

    const finalNote = decisionDraft.action === 'Request Info'
      ? [
          requestInfoSelections.length > 0 ? `Missing items: ${requestInfoSelections.join('; ')}` : '',
          freeTextNote ? `Additional details: ${freeTextNote}` : '',
        ].filter(Boolean).join('\n')
      : freeTextNote;

    applyReviewAction(decisionDraft.requestId, decisionDraft.action, finalNote);
    setDecisionDraft(null);
    setRequestInfoSelections([]);
    setDecisionError('');
  };

  const setDocument = (key: 'photoId' | 'residency' | 'hardshipStatement' | 'billsEstimate', file: File | null) => {
    setDocumentFiles((prev) => ({ ...prev, [key]: file }));
    setFormState((prev) => ({
      ...prev,
      docsPhotoId: key === 'photoId' ? Boolean(file) : prev.docsPhotoId,
      docsResidency: key === 'residency' ? Boolean(file) : prev.docsResidency,
      docsHardshipStatement: key === 'hardshipStatement' ? Boolean(file) : prev.docsHardshipStatement,
      docsBillsEstimate: key === 'billsEstimate' ? Boolean(file) : prev.docsBillsEstimate,
    }));
  };

  const buildDocumentAttachments = async (): Promise<GapDocumentAttachment[]> => {
    const candidates: Array<{ file: File | null; label: string }> = [
      { file: documentFiles.photoId, label: 'Government ID' },
      { file: documentFiles.residency, label: 'Proof of residency' },
      { file: documentFiles.hardshipStatement, label: 'Hardship statement' },
      { file: documentFiles.billsEstimate, label: 'Bills / estimate / invoice' },
    ];

    const attachments: GapDocumentAttachment[] = [];
    let uploadIndex = 0;
    for (const candidate of candidates) {
      if (!candidate.file) continue;
      const uploaded = await StorageService.uploadGapDocument(candidate.file, candidate.label);
      attachments.push({
        id: `${Date.now()}-${uploadIndex}`,
        label: candidate.label,
        fileName: String(candidate.file?.name || ''),
        mimeType: String(candidate.file?.type || 'application/octet-stream'),
        sizeBytes: Number(candidate.file?.size || 0),
        uploadedAt: new Date().toISOString(),
        storagePath: uploaded.storagePath,
        accessUrl: uploaded.accessUrl || undefined,
      });
      uploadIndex += 1;
    }

    return attachments;
  };

  const householdForAmount = Math.max(1, Number(formState.householdImpacted || 1));
  const suggestedAmount = formMode === 'ADVANCE' ? householdForAmount * 125 : householdForAmount * 250;

  const openGapForm = (mode: 'HARDSHIP' | 'ADVANCE') => {
    setFormMode(mode);
    setFormError('');
    setShowGapForm(true);
  };

  const openGrantDirectory = () => {
    setSelectedGrantUrl('');
    setShowGrantDirectory(true);
  };

  const openSelectedGrant = () => {
    const target = String(selectedGrantUrl || '').trim();
    if (!target) return;
    window.open(target, '_blank', 'noopener,noreferrer');
  };

  const submitGapForm = async () => {
    if (!formState.hardshipSummary.trim()) {
      setFormError('Please provide a short hardship summary.');
      return;
    }
    if (!formState.consentToReview || !formState.attestTruth) {
      setFormError('Consent and attestation are required before submission.');
      return;
    }
    if (!documentFiles.photoId || !documentFiles.hardshipStatement) {
      setFormError('Government ID file and hardship statement file are required.');
      return;
    }

    const payload: HelpRequestData = {
      isSafe: true,
      location: String(profile.address || '').trim(),
      emergencyType: formMode === 'ADVANCE' ? 'Advance Request' : 'Hardship Assistance',
      isInjured: null,
      injuryDetails: '',
      situationDescription: formState.hardshipSummary.trim(),
      canEvacuate: null,
      hazardsPresent: null,
      hazardDetails: '',
      peopleCount: householdForAmount,
      petsPresent: null,
      hasWater: null,
      hasFood: null,
      hasMeds: null,
      hasPower: null,
      hasPhone: Boolean(formState.contactPhone.trim()),
      needsTransport: null,
      vulnerableGroups: [],
      medicalConditions: '',
      damageType: '',
      consentToShare: true,
    };

    setIsSubmittingForm(true);
    setFormError('');
    try {
      const attachments = await buildDocumentAttachments();
      const docs: string[] = attachments.map((item) => item.label);

      payload.gapApplication = {
        program: formMode,
        householdImpacted: householdForAmount,
        requestedAmount: suggestedAmount,
        monthlyIncomeLoss: Number(formState.monthlyIncomeLoss || 0) || undefined,
        hardshipSummary: formState.hardshipSummary.trim(),
        documentsProvided: docs,
        documents: attachments,
        submittedToOrgQueue: true,
        submittedToCoreQueue: true,
        submittedAt: new Date().toISOString(),
      };

      await StorageService.submitRequest(payload);
      setShowGapForm(false);
      setFormState((prev) => ({
        ...prev,
        monthlyIncomeLoss: '',
        hardshipSummary: '',
        docsPhotoId: false,
        docsResidency: false,
        docsHardshipStatement: false,
        docsBillsEstimate: false,
        attestTruth: false,
      }));
      setDocumentFiles({
        photoId: null,
        residency: null,
        hardshipStatement: null,
        billsEstimate: null,
      });
    } catch (err) {
      setFormError(String((err as Error)?.message || 'Unable to submit application.'));
    } finally {
      setIsSubmittingForm(false);
    }
  };

  const getLatestReviewAction = (request: HelpRequestRecord) => {
    const trail = request.gapApplication?.reviewTrail || [];
    if (trail.length === 0) return '';
    return trail[trail.length - 1].action;
  };

  const getMemberStatusLabel = (request: HelpRequestRecord) => {
    const latestAction = getLatestReviewAction(request);
    return latestAction || reviewActions[request.id] || request.status;
  };

  const getRequestProgramLabel = (request: HelpRequestRecord) =>
    request.gapApplication?.program === 'ADVANCE' ? 'Advance' : 'Hardship';

  const getSubmittedDocs = (request: HelpRequestRecord) =>
    request.gapApplication?.documentsProvided || request.gapApplication?.documents?.map((item) => item.label) || [];

  const isDocsReady = (request: HelpRequestRecord) => {
    const submittedDocs = getSubmittedDocs(request);
    return submittedDocs.length >= 2 || (Boolean(String(request.situationDescription || '').trim()) && Boolean(request.consentToShare));
  };

  const filteredPendingOrgRequests = pendingOrgRequests
    .filter((request) => {
      if (queueProgramFilter === 'ALL') return true;
      const requestProgram = request.gapApplication?.program || 'HARDSHIP';
      return requestProgram === queueProgramFilter;
    })
    .filter((request) => {
      if (!queueMissingDocsOnly) return true;
      return !isDocsReady(request);
    })
    .sort((left, right) => {
      if (queueSortBy === 'HIGHEST_AMOUNT') {
        return getRequestAmount(right) - getRequestAmount(left);
      }
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime();
    });

  const grantCatalog = [
    {
      id: 'fema-ia',
      title: 'FEMA Individual Assistance',
      detail: 'Federal support for eligible disaster-related expenses.',
      url: 'https://www.disasterassistance.gov/',
    },
    {
      id: '211',
      title: '2-1-1 Community Resource Search',
      detail: 'Local housing, food, utility, and emergency support referrals.',
      url: 'https://www.211.org/',
    },
    {
      id: 'sba-disaster',
      title: 'SBA Disaster Assistance',
      detail: 'Low-interest disaster loans for homeowners, renters, and businesses.',
      url: 'https://www.sba.gov/funding-programs/disaster-assistance',
    },
  ];

  const openDocument = async (document: GapDocumentAttachment) => {
    setDocumentOpenError('');
    try {
      const cachedUrl = documentUrlById[document.id];
      const resolved = cachedUrl || await StorageService.resolveGapDocumentAccessUrl(document.storagePath, document.accessUrl);
      if (!cachedUrl) {
        setDocumentUrlById((prev) => ({ ...prev, [document.id]: resolved }));
      }
      window.open(resolved, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setDocumentOpenError(String((error as Error)?.message || 'Unable to open document.'));
    }
  };

  return (
    <div className="min-h-screen bg-emerald-50 flex flex-col pb-safe animate-fade-in">
      <div className="bg-gradient-to-br from-emerald-950 to-emerald-800 border-b border-emerald-700 p-4 sticky top-0 z-20 text-white shadow-sm">
        <div className="flex items-start gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-white/90 hover:text-white">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-xl">G.A.P. Center</h1>
            <p className="text-xs text-white/95">Community Support Hub</p>
            <p className="text-xs text-white/95">Powered by CORE (Community Organized Response &amp; Education)</p>
            <p className="text-[11px] text-emerald-50/95 mt-2 font-medium">Charitable hardship assistance is subject to documented need and available funds.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <Card className="border-emerald-300 bg-white">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-[0.08em]">G.A.P. Center</p>
          <p className="text-base font-semibold text-slate-900 mt-1">Grants • Advances • Provision</p>
          <p className="text-xs text-slate-600 mt-1">Support options based on documented need and current eligibility.</p>
        </Card>

        <Card className="border-slate-200 bg-white space-y-3">
          <h3 className="font-bold text-slate-900">How G.A.P. Works in App</h3>
          <p className="text-xs text-slate-700">
            This screen reflects live G.A.P. operating rules: pooled hardship funds, participation-based allocation caps, and documented-need review.
          </p>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="text-xs font-semibold text-slate-700 mb-1">Fund Flow</p>
            <p className="text-xs text-slate-700">Member Registration / Contributions → AERA Payment + Community ID → Revenue Split Logic</p>
            <p className="text-xs text-slate-700">→ CORE Pooled Hardship Fund → Participation Percentage per Church → Allocation Capacity</p>
            <p className="text-xs text-slate-700">→ Member Application → Church Admin Recommendation → CORE Review</p>
            <p className="text-xs text-slate-700">→ Disbursement (if approved) → Audit Log + Compliance Record</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Pooled Fund</p>
              <p className="text-xs font-semibold text-slate-900">{formatCurrency(displayedPooledFund)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Your Participation</p>
              <p className="text-xs font-semibold text-slate-900">{displayedParticipationPct}%</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Allocation Capacity</p>
              <p className="text-xs font-semibold text-slate-900">{formatCurrency(displayedAllocationCapacity)}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Remaining Balance</p>
              <p className="text-xs font-semibold text-slate-900">{formatCurrency(displayedRemainingBalance)}</p>
            </div>
          </div>
          <p className="text-xs text-slate-700">
            Allocation capacity is a maximum access cap, not a guaranteed payout. Assistance remains subject to documented hardship and available charitable resources.
          </p>
          {isCoreAdmin && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-700">Admin Calculation Breakdown</p>
              <p className="text-xs text-slate-600">Connected users: {totalConnectedUsers}</p>
              <p className="text-xs text-slate-600">Participating users: {totalParticipatingUsers} ({overallParticipationPct}%)</p>
              <p className="text-xs text-slate-600">Pooled fund = connected users × $250 × participation ratio</p>
              <p className="text-xs text-slate-600">Allocation capacity = pooled fund</p>
              <p className="text-xs text-slate-600">Remaining balance = allocation capacity − distributed amount</p>
            </div>
          )}
        </Card>

        {isMemberView && (
          <>
            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Hardship Assistance (CORE)</h3>
              <Button fullWidth onClick={() => openGapForm('HARDSHIP')}>Apply for Assistance</Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowStatusTracker(true)}>
                  Status Tracker
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowPaymentHistory(true)}>
                  Payment History
                </Button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-slate-500">Logged</p>
                  <p className="text-sm font-bold text-slate-900">{memberRequests.length}</p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-amber-700">Pending</p>
                  <p className="text-sm font-bold text-amber-800">{memberPendingRequests.length}</p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-2 text-center">
                  <p className="text-[10px] uppercase font-bold text-emerald-700">Resolved</p>
                  <p className="text-sm font-bold text-emerald-800">{memberResolvedRequests.length}</p>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
                <p className="text-xs font-semibold text-slate-700">Recent Applications</p>
                {memberRequests.slice(0, 3).map((req) => (
                  <div key={req.id} className="flex items-center justify-between text-xs">
                    <span className="text-slate-700">{getRequestProgramLabel(req)} • {new Date(req.timestamp).toLocaleDateString()}</span>
                    <span className="font-semibold text-slate-900">{getMemberStatusLabel(req)}</span>
                  </div>
                ))}
                {memberRequests.length === 0 && <p className="text-xs text-slate-500">No applications yet. Start with Apply for Assistance.</p>}
              </div>
            </Card>

            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Advances (If Enabled)</h3>
              <p className="text-sm text-slate-600">Short-term assistance pending other funding.</p>
              <Button fullWidth variant="outline" onClick={() => openGapForm('ADVANCE')}>Request Advance</Button>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs text-slate-700">Advance requests are reviewed alongside your hardship application to prevent duplicate awards.</p>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white space-y-3">
              <h3 className="font-bold text-slate-900">Grants</h3>
              <p className="text-sm text-slate-600">External resources.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button variant="outline" onClick={openGrantDirectory}>View Available Grants</Button>
                <Button onClick={openSelectedGrant} disabled={!selectedGrantUrl}>Apply Externally</Button>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2 text-xs text-slate-700">
                {grantCatalog.map((grant) => (
                  <label key={grant.id} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="grant-selection"
                      className="mt-0.5"
                      checked={selectedGrantUrl === grant.url}
                      onChange={() => setSelectedGrantUrl(grant.url)}
                    />
                    <span>
                      <span className="font-semibold text-slate-800">{grant.title}</span>
                      <span className="block text-slate-600">{grant.detail}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          </>
        )}

        {isOrgAdmin && (
          <>
            <Card className="border-emerald-200 bg-white/95">
              <h3 className="font-bold text-slate-900 mb-3">G.A.P. Allocation Overview</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Participation Percentage</p><p className="text-lg font-black text-slate-900">{participationPct}%</p></div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <p className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1">Allocation Capacity <Info size={12} className="text-slate-400" title="Allocation capacity represents the maximum potential hardship support available to your organization during the current review period." /></p>
                  <p className="text-lg font-black text-slate-900">{formatCurrency(allocationCapacity)}</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Amount Disbursed</p><p className="text-lg font-black text-slate-900">{formatCurrency(amountDisbursed)}</p></div>
                <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Remaining Balance</p><p className="text-lg font-black text-slate-900">{formatCurrency(remainingBalance)}</p></div>
              </div>
            </Card>

            <Card className="border-slate-200 bg-white/95 space-y-3">
              <h3 className="font-bold text-slate-900">Member Applications Queue</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                  Program
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-800 bg-white"
                    value={queueProgramFilter}
                    onChange={(event) => setQueueProgramFilter(event.target.value as 'ALL' | 'HARDSHIP' | 'ADVANCE')}
                  >
                    <option value="ALL">All</option>
                    <option value="HARDSHIP">Hardship only</option>
                    <option value="ADVANCE">Advance only</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-600 flex flex-col gap-1">
                  Sort
                  <select
                    className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm font-medium text-slate-800 bg-white"
                    value={queueSortBy}
                    onChange={(event) => setQueueSortBy(event.target.value as 'NEWEST' | 'HIGHEST_AMOUNT')}
                  >
                    <option value="NEWEST">Newest first</option>
                    <option value="HIGHEST_AMOUNT">High amount first</option>
                  </select>
                </label>

                <label className="text-xs font-semibold text-slate-600 flex items-center gap-2 mt-5 md:mt-6">
                  <input
                    type="checkbox"
                    checked={queueMissingDocsOnly}
                    onChange={(event) => setQueueMissingDocsOnly(event.target.checked)}
                  />
                  Missing docs only
                </label>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="py-2">Member</th>
                      <th className="py-2">Type</th>
                      <th className="py-2">Requested</th>
                      <th className="py-2">Docs</th>
                      <th className="py-2">Status</th>
                      <th className="py-2">Recommend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPendingOrgRequests.slice(0, 8).map((req) => {
                      const submittedDocs = getSubmittedDocs(req);
                      const docsReady = isDocsReady(req);
                      const memberName = orgMemberById.get(req.userId) || users.find((u) => u.id === req.userId)?.fullName || 'Member';
                      const requestedAmount = getRequestAmount(req);
                      return (
                        <tr key={req.id} className="border-b border-slate-100">
                          <td className="py-3 font-medium text-slate-900">{memberName}</td>
                          <td className="py-3">{req.gapApplication?.program === 'ADVANCE' ? 'Advance' : 'Hardship'}</td>
                          <td className="py-3">{formatCurrency(requestedAmount)}</td>
                          <td className="py-3">{docsReady ? `${submittedDocs.length || 2} docs` : 'Needs Info'}</td>
                          <td className="py-3">{getLatestReviewAction(req) || reviewActions[req.id] || 'Pending'}</td>
                          <td>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => setSelectedOrgApplication(req)}>View App</Button>
                              <Button size="sm" onClick={() => openDecisionDialog(req.id, 'Recommend')}>Recommend</Button>
                              <Button size="sm" variant="outline" onClick={() => openDecisionDialog(req.id, 'Request Info')}>Request Info</Button>
                              <Button size="sm" variant="outline" onClick={() => openDecisionDialog(req.id, 'Decline')}>Decline</Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredPendingOrgRequests.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-500">No pending applications.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-600">Member submissions route to the organization queue first, then CORE review for final hardship disbursement decisions.</p>
            </Card>
          </>
        )}

        {isCoreAdmin && (
          <Card className="border-emerald-300 bg-white/95 space-y-4">
            <div className="flex items-center gap-2">
              <ShieldCheck size={18} className="text-emerald-700" />
              <h3 className="font-bold text-slate-900">G.A.P. Administration (CORE)</h3>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Total Hardship Fund</p><p className="text-lg font-black text-slate-900">{formatCurrency(totalHardshipFund)}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Pending Applications</p><p className="text-lg font-black text-slate-900">{corePendingApplications.length}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Allocation Distribution</p><p className="text-lg font-black text-slate-900">{orgsWithPending}/{allOrganizations.length || 1}</p></div>
              <div className="rounded-lg border border-slate-200 p-3"><p className="text-[10px] text-slate-500 uppercase font-bold">Override Log</p><p className="text-lg font-black text-slate-900">{Object.values(reviewActions).filter((v) => v === 'Override').length}</p></div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4 space-y-3">
              <h4 className="font-bold text-slate-900">Application Review Panel</h4>
              <p className="text-sm text-slate-600">Full documentation • Allocation cap check • Approve / Adjust / Deny • Override (logged)</p>
              {reviewTarget ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
                  <p className="font-semibold text-slate-900">{users.find((u) => u.id === reviewTarget.userId)?.fullName || reviewTarget.userId}</p>
                  <p className="text-slate-600">Program: {reviewTarget.gapApplication?.program === 'ADVANCE' ? 'Advance' : 'Hardship'} • Priority: {reviewTarget.priority}</p>
                  <p className="text-slate-600">Requested: {formatCurrency(getRequestAmount(reviewTarget))} • Household: {reviewTarget.gapApplication?.householdImpacted || reviewTarget.peopleCount || 1}</p>
                  <p className="text-slate-600">Docs: {(reviewTarget.gapApplication?.documentsProvided || reviewTarget.gapApplication?.documents?.map((item) => item.label) || []).join(', ') || (reviewTarget.consentToShare ? 'Consented' : 'Missing Consent')}</p>
                  <p className="text-slate-600">Summary: {reviewTarget.gapApplication?.hardshipSummary || reviewTarget.situationDescription || 'Not provided'}</p>
                  {reviewTarget.gapApplication?.documents?.length ? (
                    <div className="mt-2 space-y-1">
                      <p className="text-slate-600">Files:</p>
                      {reviewTarget.gapApplication.documents.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => openDocument(document)}
                          className="block text-left text-xs text-emerald-700 underline"
                        >
                          {document.label}: {document.fileName}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {reviewTarget.gapApplication?.reviewTrail?.length ? (
                    <p className="text-slate-600">Latest Decision: {reviewTarget.gapApplication.reviewTrail[reviewTarget.gapApplication.reviewTrail.length - 1].action} ({new Date(reviewTarget.gapApplication.reviewTrail[reviewTarget.gapApplication.reviewTrail.length - 1].reviewedAt).toLocaleDateString()})</p>
                  ) : null}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No pending applications to review.</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!reviewTarget} onClick={() => reviewTarget && openDecisionDialog(reviewTarget.id, 'Approve')}>Approve</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && openDecisionDialog(reviewTarget.id, 'Adjust')}>Adjust</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && openDecisionDialog(reviewTarget.id, 'Deny')}>Deny</Button>
                <Button size="sm" variant="outline" disabled={!reviewTarget} onClick={() => reviewTarget && openDecisionDialog(reviewTarget.id, 'Override')}>Override (Logged)</Button>
              </div>
              {reviewTarget && reviewActions[reviewTarget.id] && (
                <p className="text-xs text-emerald-700 font-semibold">Review action recorded: {reviewActions[reviewTarget.id]}</p>
              )}
              {documentOpenError && <p className="text-xs text-red-600">{documentOpenError}</p>}
            </div>
          </Card>
        )}

        <Card className="border-slate-200 bg-white/95">
          <p className="text-xs text-slate-700 flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 text-slate-500" />
            CORE (Community Organized Response &amp; Education) distributes hardship assistance based on documented need and available charitable resources.
          </p>
        </Card>
      </div>

      {isMemberView && showGapForm && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 max-h-[92vh] overflow-y-auto space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{formMode === 'ADVANCE' ? 'Advance Request Form' : 'Hardship Assistance Form'}</h3>
                <p className="text-xs text-slate-600 mt-1">Submission routes to your organization reviewer queue and CORE administration queue.</p>
              </div>
              <button onClick={() => setShowGapForm(false)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                min={1}
                label="Household impacted"
                value={formState.householdImpacted}
                onChange={(event) => setFormState((prev) => ({ ...prev, householdImpacted: Math.max(1, Number(event.target.value || 1)) }))}
              />
              <Input
                type="number"
                min={0}
                label="Monthly income loss (optional)"
                value={formState.monthlyIncomeLoss}
                onChange={(event) => setFormState((prev) => ({ ...prev, monthlyIncomeLoss: event.target.value }))}
                placeholder="0"
              />
            </div>

            <Input
              label="Primary contact phone"
              value={formState.contactPhone}
              onChange={(event) => setFormState((prev) => ({ ...prev, contactPhone: event.target.value }))}
              placeholder="Phone"
            />

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-800 font-semibold">Suggested request amount: {formatCurrency(suggestedAmount)}</p>
              <p className="text-xs text-emerald-700 mt-1">{formMode === 'ADVANCE' ? 'Advance estimate uses $125 per impacted household member.' : 'Hardship estimate uses $250 per impacted household member.'}</p>
            </div>

            <Textarea
              label="Hardship summary"
              value={formState.hardshipSummary}
              onChange={(event) => setFormState((prev) => ({ ...prev, hardshipSummary: event.target.value }))}
              placeholder="Describe what happened, current need, and immediate expenses."
            />

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Document uploads</p>
              <div className="space-y-1">
                <p className="text-xs text-slate-700">Government ID (required)</p>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setDocument('photoId', event.target.files?.[0] || null)} className="block w-full text-xs text-slate-700" />
                {documentFiles.photoId && <p className="text-[11px] text-slate-500">{documentFiles.photoId.name}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-700">Proof of residency</p>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setDocument('residency', event.target.files?.[0] || null)} className="block w-full text-xs text-slate-700" />
                {documentFiles.residency && <p className="text-[11px] text-slate-500">{documentFiles.residency.name}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-700">Hardship statement (required)</p>
                <input type="file" accept="image/*,.pdf,.txt" onChange={(event) => setDocument('hardshipStatement', event.target.files?.[0] || null)} className="block w-full text-xs text-slate-700" />
                {documentFiles.hardshipStatement && <p className="text-[11px] text-slate-500">{documentFiles.hardshipStatement.name}</p>}
              </div>
              <div className="space-y-1">
                <p className="text-xs text-slate-700">Bills / estimate / invoice</p>
                <input type="file" accept="image/*,.pdf" onChange={(event) => setDocument('billsEstimate', event.target.files?.[0] || null)} className="block w-full text-xs text-slate-700" />
                {documentFiles.billsEstimate && <p className="text-[11px] text-slate-500">{documentFiles.billsEstimate.name}</p>}
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formState.consentToReview} onChange={(event) => setFormState((prev) => ({ ...prev, consentToReview: event.target.checked }))} /> I consent to organization and CORE review of this request and attached documentation.</label>
              <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formState.attestTruth} onChange={(event) => setFormState((prev) => ({ ...prev, attestTruth: event.target.checked }))} /> I attest this information is true and complete to the best of my knowledge.</label>
            </div>

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" fullWidth onClick={() => setShowGapForm(false)} disabled={isSubmittingForm}>Cancel</Button>
              <Button fullWidth onClick={submitGapForm} disabled={isSubmittingForm}>{isSubmittingForm ? 'Submitting…' : 'Submit for Review'}</Button>
            </div>
          </div>
        </div>
      )}

      {isMemberView && showStatusTracker && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Status Tracker</h3>
                <p className="text-xs text-slate-600 mt-1">Track each G.A.P. application from submission to final review.</p>
              </div>
              <button onClick={() => setShowStatusTracker(false)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>
            <div className="space-y-2">
              {memberRequests.length === 0 && <p className="text-sm text-slate-500">No applications submitted yet.</p>}
              {memberRequests.map((request) => {
                const latestTrail = request.gapApplication?.reviewTrail?.[request.gapApplication.reviewTrail.length - 1];
                return (
                  <div key={request.id} className="rounded-xl border border-slate-200 p-3 space-y-1">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{getRequestProgramLabel(request)} • {formatCurrency(getRequestAmount(request))}</p>
                      <p className="text-xs font-semibold text-slate-700">{getMemberStatusLabel(request)}</p>
                    </div>
                    <p className="text-xs text-slate-600">Submitted: {new Date(request.timestamp).toLocaleString()}</p>
                    {latestTrail?.note ? (
                      <p className="text-xs text-slate-700">Reviewer note: {latestTrail.note}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isMemberView && showPaymentHistory && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Payment History</h3>
                <p className="text-xs text-slate-600 mt-1">Resolved applications and award decisions recorded in your account timeline.</p>
              </div>
              <button onClick={() => setShowPaymentHistory(false)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>
            <div className="space-y-2">
              {memberResolvedRequests.length === 0 && <p className="text-sm text-slate-500">No completed disbursements yet.</p>}
              {memberResolvedRequests.map((request) => {
                const resolvedAt = request.gapApplication?.lastReviewedAt || request.timestamp;
                const latestAction = getLatestReviewAction(request) || 'Resolved';
                return (
                  <div key={request.id} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{getRequestProgramLabel(request)} • {formatCurrency(getRequestAmount(request))}</p>
                      <p className="text-xs font-semibold text-emerald-700">{latestAction}</p>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">Finalized: {new Date(resolvedAt).toLocaleString()}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {isMemberView && showGrantDirectory && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Available Grants</h3>
                <p className="text-xs text-slate-600 mt-1">Choose a resource and launch the official external application site.</p>
              </div>
              <button onClick={() => setShowGrantDirectory(false)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>
            <div className="space-y-2">
              {grantCatalog.map((grant) => (
                <label key={grant.id} className="block rounded-xl border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
                  <div className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="grant-directory-selection"
                      className="mt-1"
                      checked={selectedGrantUrl === grant.url}
                      onChange={() => setSelectedGrantUrl(grant.url)}
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{grant.title}</p>
                      <p className="text-xs text-slate-600">{grant.detail}</p>
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" fullWidth onClick={() => setShowGrantDirectory(false)}>Close</Button>
              <Button fullWidth onClick={openSelectedGrant} disabled={!selectedGrantUrl}>Apply Externally</Button>
            </div>
          </div>
        </div>
      )}

      {decisionDraft && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">{decisionDraft.action} Application</h3>
                <p className="text-xs text-slate-600 mt-1">Record this review decision in the request trail.</p>
              </div>
              <button
                onClick={() => {
                  setDecisionDraft(null);
                  setRequestInfoSelections([]);
                  setDecisionError('');
                }}
                className="text-slate-500 hover:text-slate-900 text-sm font-semibold"
              >
                Close
              </button>
            </div>
            <Textarea
              label="Decision note"
              value={decisionDraft.note}
              onChange={(event) => setDecisionDraft((prev) => prev ? ({ ...prev, note: event.target.value }) : prev)}
              placeholder={
                decisionDraft.action === 'Request Info'
                  ? 'List missing items (e.g., updated hardship statement, utility bill, proof of residency, corrected household count).'
                  : decisionDraft.action === 'Deny' || decisionDraft.action === 'Decline' || decisionDraft.action === 'Override'
                    ? 'Required note for this action'
                    : 'Optional note'
              }
            />
            {decisionDraft.action === 'Request Info' && (
              <>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 space-y-2">
                  <p className="text-xs text-amber-800 font-semibold">Select missing items to request from member:</p>
                  <div className="space-y-1">
                    {REQUEST_INFO_OPTIONS.map((item) => {
                      const checked = requestInfoSelections.includes(item);
                      return (
                        <label key={item} className="flex items-start gap-2 text-xs text-amber-900">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={checked}
                            onChange={(event) => {
                              const isChecked = event.target.checked;
                              setRequestInfoSelections((prev) => {
                                if (isChecked) return prev.includes(item) ? prev : [...prev, item];
                                return prev.filter((entry) => entry !== item);
                              });
                            }}
                          />
                          <span>{item}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-2">
                  <p className="text-xs text-amber-800 font-semibold">Member will see selected missing items and your details in Status Tracker.</p>
                </div>
              </>
            )}
            {decisionError && <p className="text-sm text-red-600">{decisionError}</p>}
            <div className="flex gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setDecisionDraft(null);
                  setRequestInfoSelections([]);
                  setDecisionError('');
                }}
              >
                Cancel
              </Button>
              <Button fullWidth onClick={submitDecision}>Save Decision</Button>
            </div>
          </div>
        </div>
      )}

      {isOrgAdmin && selectedOrgApplication && (
        <div className="fixed inset-0 z-40 bg-black/40 p-4 flex items-end sm:items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl p-4 sm:p-5 max-h-[90vh] overflow-y-auto space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Application Details</h3>
                <p className="text-xs text-slate-600 mt-1">Full member submission for recommendation decisions.</p>
              </div>
              <button onClick={() => setSelectedOrgApplication(null)} className="text-slate-500 hover:text-slate-900 text-sm font-semibold">Close</button>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1 text-sm">
              <p className="font-semibold text-slate-900">{users.find((u) => u.id === selectedOrgApplication.userId)?.fullName || 'Member'}</p>
              <p className="text-slate-700">Program: {getRequestProgramLabel(selectedOrgApplication)}</p>
              <p className="text-slate-700">Requested amount: {formatCurrency(getRequestAmount(selectedOrgApplication))}</p>
              <p className="text-slate-700">Household impacted: {selectedOrgApplication.gapApplication?.householdImpacted || selectedOrgApplication.peopleCount || 1}</p>
              <p className="text-slate-700">Submitted: {new Date(selectedOrgApplication.timestamp).toLocaleString()}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-900">Hardship Summary</p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">{selectedOrgApplication.gapApplication?.hardshipSummary || selectedOrgApplication.situationDescription || 'Not provided'}</p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3 space-y-2">
              <p className="text-sm font-semibold text-slate-900">Submitted Documents</p>
              {selectedOrgApplication.gapApplication?.documents?.length ? (
                <div className="space-y-1">
                  {selectedOrgApplication.gapApplication.documents.map((document) => (
                    <button
                      key={document.id}
                      type="button"
                      onClick={() => openDocument(document)}
                      className="block text-left text-xs text-emerald-700 underline"
                    >
                      {document.label}: {document.fileName}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-600">No files uploaded.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => openDecisionDialog(selectedOrgApplication.id, 'Recommend')}>Recommend</Button>
              <Button variant="outline" onClick={() => openDecisionDialog(selectedOrgApplication.id, 'Request Info')}>Request Info</Button>
              <Button variant="outline" onClick={() => openDecisionDialog(selectedOrgApplication.id, 'Decline')}>Decline</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
