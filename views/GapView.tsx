
import React, { useEffect, useState } from 'react';
import { GapDocumentAttachment, GapRevenueSettings, HelpRequestData, HelpRequestRecord, ViewState, UserRole } from '../types';
import { getGapRevenueSettingsRemote, saveGapRevenueSettingsRemote } from '../services/api';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { Input, Textarea } from '../components/Input';
import { StorageService } from '../services/storage';
import { calculateGapSuggestedAmount, resolveGapRequestAmount } from '../services/gapCalculation';
import { AlertCircle, ArrowLeft, Info, Settings2, ShieldCheck } from 'lucide-react';

type ReviewAction = 'Recommend' | 'Request Info' | 'Decline' | 'Approve' | 'Adjust' | 'Deny' | 'Override';

const REQUEST_INFO_OPTIONS = [
  'Government ID image is unclear or expired',
  'Proof of residency is missing or outdated',
  'Hardship statement needs more detail',
  'Bills / estimates / invoices are missing',
  'Household impacted count needs correction',
  'Monthly income loss documentation is needed',
] as const;

const HARDSHIP_TYPE_OPTIONS = [
  'Home damage',
  'Loss of income',
  'Medical emergency',
  'Temporary displacement',
  'Utility shutoff risk',
  'Business interruption',
  'Other',
] as const;

const EXPENSE_CATEGORY_OPTIONS = [
  'Rent / Mortgage',
  'Utilities',
  'Temporary housing',
  'Food',
  'Medical expenses',
  'Repairs',
  'Transportation',
  'Other',
] as const;

const URGENCY_OPTIONS = [
  'Risk of eviction',
  'Risk of utility shutoff',
  'Unsafe housing conditions',
  'No immediate safety risk',
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
  const [networkCommunityIds, setNetworkCommunityIds] = useState<string[]>(() => {
    const initialCommunityId = String(profile.communityId || '').trim();
    return initialCommunityId ? [initialCommunityId] : [];
  });
  const isCoreAdmin = role === 'ADMIN';
  const isOrgAdmin = role === 'ORG_ADMIN' || role === 'INSTITUTION_ADMIN';
  const isMemberView = !isCoreAdmin && !isOrgAdmin;
  const [showRevenueSetup, setShowRevenueSetup] = useState(false);
  const [revenueSettings, setRevenueSettings] = useState<GapRevenueSettings>(() => StorageService.getGapRevenueSettings());
  const [revenueDraft, setRevenueDraft] = useState<GapRevenueSettings>(() => StorageService.getGapRevenueSettings());
  const [revenueSaveMsg, setRevenueSaveMsg] = useState('');

  // Sync revenue settings from server on mount (CORE admin only)
  useEffect(() => {
    if (!isCoreAdmin) return;
    getGapRevenueSettingsRemote()
      .then((remote) => {
        if (!remote) return;
        StorageService.setGapRevenueSettings(remote);
        setRevenueSettings(remote);
        setRevenueDraft(remote);
      })
      .catch(() => {/* silently fall back to local */});
  }, [isCoreAdmin]);
  const [formMode, setFormMode] = useState<'HARDSHIP' | 'ADVANCE'>('HARDSHIP');
  const [formStep, setFormStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [formState, setFormState] = useState({
    householdImpacted: Math.max(1, Number(profile.householdMembers || profile.household?.length || 1)),
    hardshipType: '',
    hardshipDate: '',
    relatedToDeclaredDisaster: false,
    declaredDisasterEvent: '',
    immediateExpenseCategories: [] as string[],
    customRequestedAmount: '',
    urgencyRisk: '',
    monthlyIncomeLoss: '',
    hardshipSummary: '',
    contactPhone: String(profile.phone || '').trim(),
    docsPhotoId: false,
    docsResidency: false,
    docsHardshipStatement: false,
    docsBillsEstimate: false,
    docsInsuranceClaim: false,
    consentToReview: true,
    attestTruth: false,
    noGuaranteeAcknowledge: false,
  });
  const [documentFiles, setDocumentFiles] = useState<{
    photoId: File | null;
    residency: File | null;
    hardshipStatement: File | null;
    billsEstimate: File | null;
    insuranceClaim: File | null;
  }>({
    photoId: null,
    residency: null,
    hardshipStatement: null,
    billsEstimate: null,
    insuranceClaim: null,
  });

  useEffect(() => {
    try {
      localStorage.setItem(reviewerScopeKey, JSON.stringify(reviewActions));
    } catch {
      // Ignore storage write failures to keep workflow usable.
    }
  }, [reviewActions, reviewerScopeKey]);

  useEffect(() => {
    let active = true;
    const baseCommunityId = String(profile.communityId || '').trim();

    if (!baseCommunityId || !isOrgAdmin) {
      setNetworkCommunityIds(baseCommunityId ? [baseCommunityId] : []);
      return () => {
        active = false;
      };
    }

    const loadNetworkCommunities = async () => {
      try {
        const localChildren = StorageService.getChildOrganizations(baseCommunityId) as any[];
        const localCodes = localChildren.map((org) => String(org?.orgCode || org?.id || '').trim()).filter(Boolean);
        if (active) {
          setNetworkCommunityIds(Array.from(new Set([baseCommunityId, ...localCodes])));
        }

        const { orgs } = await StorageService.fetchChildOrganizationsRemote(baseCommunityId);
        if (!active) return;
        const remoteCodes = (orgs as any[]).map((org) => String(org?.orgCode || org?.id || '').trim()).filter(Boolean);
        setNetworkCommunityIds(Array.from(new Set([baseCommunityId, ...remoteCodes])));
      } catch (error) {
        if (!active) return;
        console.warn('Unable to load GAP org network', error);
        setNetworkCommunityIds([baseCommunityId]);
      }
    };

    loadNetworkCommunities();

    return () => {
      active = false;
    };
  }, [isOrgAdmin, profile.communityId]);

  const users = db.users || [];
  const allRequests = (db.requests || []).slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const allOrganizations = db.organizations || [];

  const resolveOrgForRequest = (request: HelpRequestRecord) => {
    const user = users.find((u) => u.id === request.userId);
    return String(user?.communityId || '').trim();
  };

  const orgScopeId = String(profile.communityId || '').trim();
  const scopedCommunityIds = networkCommunityIds.length > 0 ? networkCommunityIds : (orgScopeId ? [orgScopeId] : []);
  const scopedCommunitySet = new Set(scopedCommunityIds);
  const orgMembers = orgScopeId ? StorageService.getOrgMembers(orgScopeId) : [];
  const orgMemberById = new Map(orgMembers.map((member) => [member.id, member.name]));

  const pendingStatuses = new Set(['PENDING', 'RECEIVED']);
  const resolvedStatuses = new Set(['RESOLVED']);
  const memberRequests = allRequests.filter((req) => req.userId === profile.id);
  const memberPendingRequests = memberRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));
  const memberResolvedRequests = memberRequests.filter((req) => resolvedStatuses.has(String(req.status || '').toUpperCase()));
  const orgRequests = isOrgAdmin
    ? allRequests.filter((req) => scopedCommunitySet.has(resolveOrgForRequest(req)))
    : [];

  const pendingOrgRequests = orgRequests.filter((req) => pendingStatuses.has(String(req.status || '').toUpperCase()));

  const connectedUsersByOrg = users.reduce((map, user) => {
    const communityId = String(user.communityId || '').trim();
    if (!communityId) return map;
    map.set(communityId, (map.get(communityId) || 0) + 1);
    return map;
  }, new Map<string, number>());

  const getRequestAmount = (request: HelpRequestRecord) => {
    return resolveGapRequestAmount({
      requestedAmount: request.gapApplication?.requestedAmount,
      program: request.gapApplication?.program,
      householdImpacted: request.gapApplication?.householdImpacted,
      fallbackPeopleCount: request.peopleCount,
    });
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

  const scopedFundingSummary = scopedCommunityIds.reduce(
    (summary, communityId) => {
      const item = communityFundingById.get(communityId);
      if (!item) return summary;
      summary.connectedUsers += item.connectedUsers;
      summary.participatingUsers += item.participatingUsers;
      summary.pooledFund += item.pooledFund;
      summary.allocationCapacity += item.allocationCapacity;
      summary.amountDisbursed += item.amountDisbursed;
      summary.remainingBalance += item.remainingBalance;
      return summary;
    },
    { connectedUsers: 0, participatingUsers: 0, pooledFund: 0, allocationCapacity: 0, amountDisbursed: 0, remainingBalance: 0 },
  );
  const participationPct = scopedFundingSummary.connectedUsers > 0
    ? Math.round((scopedFundingSummary.participatingUsers / scopedFundingSummary.connectedUsers) * 100)
    : 0;
  const pooledFund = scopedFundingSummary.pooledFund;
  const allocationCapacity = scopedFundingSummary.allocationCapacity;
  const amountDisbursed = scopedFundingSummary.amountDisbursed;
  const remainingBalance = scopedFundingSummary.remainingBalance;

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

  const setDocument = (key: 'photoId' | 'residency' | 'hardshipStatement' | 'billsEstimate' | 'insuranceClaim', file: File | null) => {
    setDocumentFiles((prev) => ({ ...prev, [key]: file }));
    setFormState((prev) => ({
      ...prev,
      docsPhotoId: key === 'photoId' ? Boolean(file) : prev.docsPhotoId,
      docsResidency: key === 'residency' ? Boolean(file) : prev.docsResidency,
      docsHardshipStatement: key === 'hardshipStatement' ? Boolean(file) : prev.docsHardshipStatement,
      docsBillsEstimate: key === 'billsEstimate' ? Boolean(file) : prev.docsBillsEstimate,
      docsInsuranceClaim: key === 'insuranceClaim' ? Boolean(file) : prev.docsInsuranceClaim,
    }));
  };

  const buildDocumentAttachments = async (): Promise<GapDocumentAttachment[]> => {
    const candidates: Array<{ file: File | null; label: string }> = [
      { file: documentFiles.photoId, label: 'Government ID' },
      { file: documentFiles.residency, label: 'Proof of residency' },
      { file: documentFiles.hardshipStatement, label: 'Hardship statement' },
      { file: documentFiles.billsEstimate, label: 'Bills / estimate / invoice' },
      { file: documentFiles.insuranceClaim, label: 'Insurance claim (if applicable)' },
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
  const suggestedAmount = calculateGapSuggestedAmount(formMode, householdForAmount);
  const customRequestedAmount = Number(formState.customRequestedAmount || 0);
  const finalRequestedAmount = customRequestedAmount > 0 ? customRequestedAmount : suggestedAmount;

  const toggleExpenseCategory = (category: string, checked: boolean) => {
    setFormState((prev) => ({
      ...prev,
      immediateExpenseCategories: checked
        ? Array.from(new Set([...prev.immediateExpenseCategories, category]))
        : prev.immediateExpenseCategories.filter((entry) => entry !== category),
    }));
  };

  const canProceedStep = () => {
    if (formStep === 1) {
      return Boolean(formState.householdImpacted >= 1 && formState.hardshipType && formState.hardshipDate);
    }
    if (formStep === 2) {
      return formState.immediateExpenseCategories.length > 0 && Boolean(formState.urgencyRisk);
    }
    if (formStep === 3) {
      return Boolean(String(formState.hardshipSummary || '').trim());
    }
    if (formStep === 4) {
      return Boolean(documentFiles.photoId && documentFiles.hardshipStatement);
    }
    return true;
  };

  const resetGapFormState = () => {
    setFormStep(1);
    setFormState({
      householdImpacted: Math.max(1, Number(profile.householdMembers || profile.household?.length || 1)),
      hardshipType: '',
      hardshipDate: '',
      relatedToDeclaredDisaster: false,
      declaredDisasterEvent: '',
      immediateExpenseCategories: [],
      customRequestedAmount: '',
      urgencyRisk: '',
      monthlyIncomeLoss: '',
      hardshipSummary: '',
      contactPhone: String(profile.phone || '').trim(),
      docsPhotoId: false,
      docsResidency: false,
      docsHardshipStatement: false,
      docsBillsEstimate: false,
      docsInsuranceClaim: false,
      consentToReview: true,
      attestTruth: false,
      noGuaranteeAcknowledge: false,
    });
    setDocumentFiles({
      photoId: null,
      residency: null,
      hardshipStatement: null,
      billsEstimate: null,
      insuranceClaim: null,
    });
  };

  const openGapForm = (mode: 'HARDSHIP' | 'ADVANCE') => {
    setFormMode(mode);
    setFormError('');
    resetGapFormState();
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
    if (!formState.hardshipType || !formState.hardshipDate) {
      setFormError('Please complete hardship type and hardship date.');
      return;
    }
    if (formState.immediateExpenseCategories.length === 0 || !formState.urgencyRisk) {
      setFormError('Please complete immediate expenses and urgency risk.');
      return;
    }
    if (!formState.hardshipSummary.trim()) {
      setFormError('Please provide a short hardship summary.');
      return;
    }
    if (!formState.consentToReview || !formState.attestTruth || !formState.noGuaranteeAcknowledge) {
      setFormError('All declarations are required before submission.');
      return;
    }
    if (!documentFiles.photoId || !documentFiles.hardshipStatement) {
      setFormError('Government ID file and hardship statement file are required.');
      return;
    }

    const payload: HelpRequestData = {
      isSafe: true,
      location: String(profile.address || '').trim(),
      emergencyType: formState.hardshipType || (formMode === 'ADVANCE' ? 'Advance Request' : 'Hardship Assistance'),
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
        requestedAmount: finalRequestedAmount,
        hardshipType: formState.hardshipType,
        hardshipDate: formState.hardshipDate,
        relatedToDeclaredDisaster: Boolean(formState.relatedToDeclaredDisaster),
        declaredDisasterEvent: formState.relatedToDeclaredDisaster ? String(formState.declaredDisasterEvent || '').trim() || undefined : undefined,
        immediateExpenseCategories: formState.immediateExpenseCategories,
        urgencyRisk: formState.urgencyRisk,
        customRequestedAmount: customRequestedAmount > 0 ? customRequestedAmount : undefined,
        monthlyIncomeLoss: Number(formState.monthlyIncomeLoss || 0) || undefined,
        hardshipSummary: formState.hardshipSummary.trim(),
        declarationNoGuarantee: formState.noGuaranteeAcknowledge,
        documentsProvided: docs,
        documents: attachments,
        submittedToOrgQueue: true,
        submittedToCoreQueue: true,
        submittedAt: new Date().toISOString(),
      };

      await StorageService.submitRequest(payload);
      setShowGapForm(false);
      resetGapFormState();
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

  const getHardshipScorePreview = (request: HelpRequestRecord) => {
    let score = 0;
    const factors: string[] = [];

    const householdImpacted = Math.max(1, Number(request.gapApplication?.householdImpacted || request.peopleCount || 1));
    const householdPoints = Math.min(20, householdImpacted * 3);
    score += householdPoints;
    factors.push(`Household impact: +${householdPoints}`);

    const urgencyRisk = String(request.gapApplication?.urgencyRisk || '').toLowerCase();
    if (urgencyRisk.includes('eviction')) {
      score += 25;
      factors.push('Urgency (eviction risk): +25');
    } else if (urgencyRisk.includes('utility')) {
      score += 20;
      factors.push('Urgency (utility shutoff): +20');
    } else if (urgencyRisk.includes('unsafe')) {
      score += 20;
      factors.push('Urgency (unsafe housing): +20');
    }

    const monthlyIncomeLoss = Number(request.gapApplication?.monthlyIncomeLoss || 0);
    if (monthlyIncomeLoss >= 3000) {
      score += 20;
      factors.push('Income loss (high): +20');
    } else if (monthlyIncomeLoss >= 1500) {
      score += 15;
      factors.push('Income loss (moderate): +15');
    } else if (monthlyIncomeLoss >= 500) {
      score += 10;
      factors.push('Income loss (some): +10');
    } else if (monthlyIncomeLoss > 0) {
      score += 5;
      factors.push('Income loss (reported): +5');
    }

    if (request.gapApplication?.relatedToDeclaredDisaster) {
      score += 10;
      factors.push('Declared disaster related: +10');
    }

    const submittedDocs = getSubmittedDocs(request);
    const hasCoreDocs = submittedDocs.length >= 2;
    const docsPoints = hasCoreDocs ? 15 : submittedDocs.length > 0 ? 8 : 0;
    if (docsPoints > 0) {
      score += docsPoints;
      factors.push(`Documentation support: +${docsPoints}`);
    }

    const hardshipSummary = String(request.gapApplication?.hardshipSummary || request.situationDescription || '').trim();
    if (hardshipSummary.length >= 40) {
      score += 10;
      factors.push('Narrative detail provided: +10');
    } else if (hardshipSummary.length > 0) {
      score += 5;
      factors.push('Narrative provided: +5');
    }

    const normalizedScore = Math.max(0, Math.min(100, score));
    const priority =
      normalizedScore >= 75 ? 'CRITICAL' :
      normalizedScore >= 55 ? 'HIGH' :
      normalizedScore >= 35 ? 'MEDIUM' : 'LOW';

    return {
      score: normalizedScore,
      priority,
      factors,
    };
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
      <div className="bg-white border-b border-slate-200 p-4 sticky top-0 z-20 text-slate-900 shadow-sm">
        <div className="flex items-start gap-3">
          <button onClick={() => setView('DASHBOARD')} className="p-2 -ml-2 text-slate-700 hover:text-slate-900">
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="font-bold text-xl text-slate-900">G.A.P. Center</h1>
            <p className="text-xs text-slate-800">Community Support Hub</p>
            <p className="text-xs text-slate-800">Powered by CORE (Community Organized Response &amp; Education)</p>
            <p className="text-[11px] text-slate-700 mt-2 font-medium">Charitable hardship assistance is subject to documented need and available funds.</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <Card className="border-emerald-300 bg-white">
          <p className="text-xs font-bold text-emerald-800 uppercase tracking-[0.08em]">G.A.P. Center</p>
          <p className="text-base font-semibold text-slate-900 mt-1">Grants • Advances • Provision</p>
          <p className="text-xs text-slate-600 mt-1">Support options based on documented need and current eligibility.</p>
        </Card>

        {isCoreAdmin && (
          <Card className="border-emerald-200 bg-white space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-slate-900">G.A.P. Revenue Setup</h3>
                <p className="text-xs text-slate-500">Configure how App Store membership revenue is split into the G.A.P. hardship fund.</p>
              </div>
              <button
                onClick={() => {
                  setRevenueDraft({ ...revenueSettings });
                  setRevenueSaveMsg('');
                  setShowRevenueSetup((v) => !v);
                }}
                className="flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900"
              >
                <Settings2 size={14} />{showRevenueSetup ? 'Close' : 'Configure'}
              </button>
            </div>

            {/* Revenue math summary (always visible) */}
            {(() => {
              const price = Number(revenueSettings.membershipPriceUsd || 9.99);
              const platformFee = Number(revenueSettings.appStoreFeePercent || 30) / 100;
              const gapPct = Number(revenueSettings.gapFundAllocationPercent || 30) / 100;
              const netPerMember = price * (1 - platformFee);
              const gapPerMember = netPerMember * gapPct;
              const monthlyMultiplier = revenueSettings.billingCycle === 'annual' ? 12 : 1;
              const gapPerMemberMonthly = gapPerMember / monthlyMultiplier;
              const estimatedMonthlyPool = gapPerMemberMonthly * totalConnectedUsers;
              return (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 space-y-1">
                  <p className="text-xs font-semibold text-emerald-800">Per-Member Fund Calculation</p>
                  <p className="text-xs text-slate-700">App Store price: <span className="font-semibold">{formatCurrency(price)}</span> / {revenueSettings.billingCycle}</p>
                  <p className="text-xs text-slate-700">Platform fee ({revenueSettings.appStoreFeePercent}%): &minus;{formatCurrency(price * platformFee)}</p>
                  <p className="text-xs text-slate-700">Net developer proceeds: <span className="font-semibold">{formatCurrency(netPerMember)}</span></p>
                  <p className="text-xs text-slate-700">G.A.P. allocation ({revenueSettings.gapFundAllocationPercent}% of net): <span className="font-bold text-emerald-700">{formatCurrency(gapPerMember)}</span> / {revenueSettings.billingCycle}</p>
                  <p className="text-xs text-slate-700 font-semibold mt-1">Estimated monthly G.A.P. pool ({totalConnectedUsers} members): <span className="text-emerald-800">{formatCurrency(estimatedMonthlyPool)}</span></p>
                </div>
              );
            })()}

            {/* Editable setup form */}
            {showRevenueSetup && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min={0.99}
                    step={0.01}
                    label="Membership price (USD)"
                    value={revenueDraft.membershipPriceUsd}
                    onChange={(e) => setRevenueDraft((p) => ({ ...p, membershipPriceUsd: Number(e.target.value) }))}
                  />
                  <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                    Billing cycle
                    <select
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                      value={revenueDraft.billingCycle}
                      onChange={(e) => setRevenueDraft((p) => ({ ...p, billingCycle: e.target.value as 'monthly' | 'annual' }))}
                    >
                      <option value="monthly">Monthly</option>
                      <option value="annual">Annual</option>
                    </select>
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      App Store platform fee % <span className="text-slate-400 font-normal text-xs">(Apple: 30% standard / 15% small dev)</span>
                    </label>
                    <input
                      type="range" min={0} max={50} step={1}
                      value={revenueDraft.appStoreFeePercent}
                      onChange={(e) => setRevenueDraft((p) => ({ ...p, appStoreFeePercent: Number(e.target.value) }))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600 mt-0.5">{revenueDraft.appStoreFeePercent}%</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-700 block mb-1">
                      G.A.P. fund allocation % <span className="text-slate-400 font-normal text-xs">(of net proceeds)</span>
                    </label>
                    <input
                      type="range" min={1} max={100} step={1}
                      value={revenueDraft.gapFundAllocationPercent}
                      onChange={(e) => setRevenueDraft((p) => ({ ...p, gapFundAllocationPercent: Number(e.target.value) }))}
                      className="w-full"
                    />
                    <p className="text-xs text-slate-600 mt-0.5">{revenueDraft.gapFundAllocationPercent}%</p>
                  </div>
                </div>

                {/* Live preview while editing */}
                {(() => {
                  const price = Number(revenueDraft.membershipPriceUsd || 9.99);
                  const pfee = Number(revenueDraft.appStoreFeePercent || 30) / 100;
                  const gpct = Number(revenueDraft.gapFundAllocationPercent || 30) / 100;
                  const net = price * (1 - pfee);
                  const gapPerCycle = net * gpct;
                  const monthlyDiv = revenueDraft.billingCycle === 'annual' ? 12 : 1;
                  const monthly = gapPerCycle / monthlyDiv;
                  return (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700 space-y-0.5">
                      <p className="font-semibold text-slate-800">Preview</p>
                      <p>Net developer proceeds: {formatCurrency(net)} / {revenueDraft.billingCycle}</p>
                      <p>G.A.P. contribution per member: <span className="font-semibold text-emerald-700">{formatCurrency(gapPerCycle)}</span> / {revenueDraft.billingCycle} ({formatCurrency(monthly)}/mo)</p>
                      <p>Estimated monthly fund ({totalConnectedUsers} members): <span className="font-semibold">{formatCurrency(monthly * totalConnectedUsers)}</span></p>
                    </div>
                  );
                })()}

                {/* Per-org disbursement table */}
                {communityIds.length > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white overflow-x-auto">
                    <p className="text-xs font-semibold text-slate-700 px-3 pt-3 pb-1">Org Disbursement Breakdown (pro-rata by member count)</p>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="px-3 py-2 text-left">Community ID</th>
                          <th className="px-3 py-2 text-right">Members</th>
                          <th className="px-3 py-2 text-right">Share</th>
                          <th className="px-3 py-2 text-right">Est. Monthly</th>
                        </tr>
                      </thead>
                      <tbody>
                        {communityIds.map((cid) => {
                          const funding = communityFundingById.get(cid);
                          if (!funding) return null;
                          const price = Number(revenueDraft.membershipPriceUsd || 9.99);
                          const pfee = Number(revenueDraft.appStoreFeePercent || 30) / 100;
                          const gpct = Number(revenueDraft.gapFundAllocationPercent || 30) / 100;
                          const monthlyDiv = revenueDraft.billingCycle === 'annual' ? 12 : 1;
                          const gapMonthlyPerMember = (price * (1 - pfee) * gpct) / monthlyDiv;
                          const orgMonthly = gapMonthlyPerMember * funding.connectedUsers;
                          const sharePct = totalConnectedUsers > 0 ? Math.round((funding.connectedUsers / totalConnectedUsers) * 1000) / 10 : 0;
                          return (
                            <tr key={cid} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2 font-mono text-slate-800">{cid}</td>
                              <td className="px-3 py-2 text-right">{funding.connectedUsers}</td>
                              <td className="px-3 py-2 text-right">{sharePct}%</td>
                              <td className="px-3 py-2 text-right font-semibold text-emerald-700">{formatCurrency(orgMonthly)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="text-[10px] text-slate-500 px-3 pb-3 pt-1">Disbursement to each organization is proportional to its registered member count. Actual disbursement requires documented hardship approval.</p>
                  </div>
                )}

                {revenueSaveMsg && <p className="text-xs text-emerald-700 font-semibold">{revenueSaveMsg}</p>}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setRevenueDraft({ ...revenueSettings });
                      setRevenueSaveMsg('');
                    }}
                  >Reset</Button>
                  <Button
                    onClick={() => {
                        const localSaved = StorageService.setGapRevenueSettings(revenueDraft);
                        setRevenueSettings(localSaved);
                        setRevenueDraft(localSaved);
                        setRevenueSaveMsg('Saving…');
                        saveGapRevenueSettingsRemote(localSaved)
                          .then(() => setRevenueSaveMsg('Revenue settings saved to server.'))
                          .catch(() => setRevenueSaveMsg('Saved locally. Remote sync failed — will retry on next load.'));
                    }}
                  >Save Settings</Button>
                </div>
              </div>
            )}
          </Card>
        )}

        {isCoreAdmin && (
          <Card className="border-emerald-200 bg-emerald-50 space-y-2">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-bold text-slate-900">G.A.P. Fund Management</h3>
                <p className="text-xs text-slate-600">Manage all org bank info, record disbursements, and track fund balances.</p>
              </div>
              <Button onClick={() => setView('GAP_MANAGEMENT')}>
                Open Management →
              </Button>
            </div>
          </Card>
        )}

        {isCoreAdmin && (
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
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-slate-700">Admin Calculation Breakdown</p>
              <p className="text-xs text-slate-600">Connected users: {totalConnectedUsers}</p>
              <p className="text-xs text-slate-600">Participating users: {totalParticipatingUsers} ({overallParticipationPct}%)</p>
              <p className="text-xs text-slate-600">Pooled fund = connected users × $250 × participation ratio</p>
              <p className="text-xs text-slate-600">Allocation capacity = pooled fund</p>
              <p className="text-xs text-slate-600">Remaining balance = allocation capacity − distributed amount</p>
            </div>
          </Card>
        )}

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
                  {(() => {
                    const hardshipPreview = getHardshipScorePreview(reviewTarget);
                    return (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-white p-2 space-y-1">
                        <p className="text-xs font-semibold text-slate-800">Internal Hardship Score (Admin only)</p>
                        <p className="text-xs text-slate-700">Score: {hardshipPreview.score}/100 • Priority Preview: {hardshipPreview.priority}</p>
                        <div className="space-y-0.5">
                          {hardshipPreview.factors.map((factor, index) => (
                            <p key={`${factor}-${index}`} className="text-[11px] text-slate-600">• {factor}</p>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
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

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">Step {formStep} of 5</p>
              <p className="text-xs text-slate-600 mt-1">
                {formStep === 1 && 'Impact'}
                {formStep === 2 && 'Financial Need'}
                {formStep === 3 && 'Narrative'}
                {formStep === 4 && 'Documents'}
                {formStep === 5 && 'Declarations'}
              </p>
            </div>

            {formStep === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min={1}
                    label="How many people in your household were impacted?"
                    value={formState.householdImpacted}
                    onChange={(event) => setFormState((prev) => ({ ...prev, householdImpacted: Math.max(1, Number(event.target.value || 1)) }))}
                  />
                  <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                    What type of hardship are you experiencing?
                    <select
                      value={formState.hardshipType}
                      onChange={(event) => setFormState((prev) => ({ ...prev, hardshipType: event.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="">Select hardship type</option>
                      {HARDSHIP_TYPE_OPTIONS.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="date"
                    label="When did this hardship occur?"
                    value={formState.hardshipDate}
                    onChange={(event) => setFormState((prev) => ({ ...prev, hardshipDate: event.target.value }))}
                  />
                  <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                    Is this related to a declared disaster event?
                    <select
                      value={formState.relatedToDeclaredDisaster ? 'YES' : 'NO'}
                      onChange={(event) => setFormState((prev) => ({
                        ...prev,
                        relatedToDeclaredDisaster: event.target.value === 'YES',
                        declaredDisasterEvent: event.target.value === 'YES' ? prev.declaredDisasterEvent : '',
                      }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                    >
                      <option value="NO">No</option>
                      <option value="YES">Yes</option>
                    </select>
                  </label>
                </div>

                {formState.relatedToDeclaredDisaster && (
                  <Input
                    label="Declared disaster event (if known)"
                    value={formState.declaredDisasterEvent}
                    onChange={(event) => setFormState((prev) => ({ ...prev, declaredDisasterEvent: event.target.value }))}
                    placeholder="Event name or reference"
                  />
                )}
              </div>
            )}

            {formStep === 2 && (
              <div className="space-y-3">
                <div className="rounded-xl border border-slate-200 p-3 space-y-2">
                  <p className="text-sm font-medium text-slate-800">What immediate expenses are you requesting assistance for?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {EXPENSE_CATEGORY_OPTIONS.map((category) => {
                      const checked = formState.immediateExpenseCategories.includes(category);
                      return (
                        <label key={category} className="flex items-start gap-2 text-sm text-slate-700">
                          <input
                            type="checkbox"
                            className="mt-1"
                            checked={checked}
                            onChange={(event) => toggleExpenseCategory(category, event.target.checked)}
                          />
                          <span>{category}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    type="number"
                    min={0}
                    label="Monthly income loss (optional)"
                    value={formState.monthlyIncomeLoss}
                    onChange={(event) => setFormState((prev) => ({ ...prev, monthlyIncomeLoss: event.target.value }))}
                    placeholder="0"
                  />
                  <Input
                    type="number"
                    min={0}
                    label="Total amount requested"
                    value={formState.customRequestedAmount}
                    onChange={(event) => setFormState((prev) => ({ ...prev, customRequestedAmount: event.target.value }))}
                    placeholder={`${suggestedAmount}`}
                  />
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                  <p className="text-xs text-emerald-800 font-semibold">Suggested request amount: {formatCurrency(suggestedAmount)}</p>
                  <p className="text-xs text-emerald-700 mt-1">
                    Calculated as {formMode === 'ADVANCE' ? '$125' : '$250'} × {householdForAmount} household impacted. Suggested amount is based on estimated immediate hardship. Final award may vary.
                  </p>
                </div>

                <label className="text-sm font-medium text-slate-700 flex flex-col gap-1">
                  Is this situation currently putting your household at risk?
                  <select
                    value={formState.urgencyRisk}
                    onChange={(event) => setFormState((prev) => ({ ...prev, urgencyRisk: event.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
                  >
                    <option value="">Select urgency level</option>
                    {URGENCY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </label>
              </div>
            )}

            {formStep === 3 && (
              <div className="space-y-3">
                <Input
                  label="Primary contact phone"
                  value={formState.contactPhone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  placeholder="Phone"
                />
                <Textarea
                  label="Briefly describe what happened, your current financial need, and what this assistance will help cover."
                  value={formState.hardshipSummary}
                  onChange={(event) => setFormState((prev) => ({ ...prev, hardshipSummary: event.target.value }))}
                  placeholder="Keep this short and specific."
                />
              </div>
            )}

            {formStep === 4 && (
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
                <div className="space-y-1">
                  <p className="text-xs text-slate-700">Insurance claim (optional, if applicable)</p>
                  <input type="file" accept="image/*,.pdf" onChange={(event) => setDocument('insuranceClaim', event.target.files?.[0] || null)} className="block w-full text-xs text-slate-700" />
                  {documentFiles.insuranceClaim && <p className="text-[11px] text-slate-500">{documentFiles.insuranceClaim.name}</p>}
                </div>
              </div>
            )}

            {formStep === 5 && (
              <div className="space-y-2">
                <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formState.consentToReview} onChange={(event) => setFormState((prev) => ({ ...prev, consentToReview: event.target.checked }))} /> I consent to organization and CORE review of this request and attached documentation.</label>
                <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formState.attestTruth} onChange={(event) => setFormState((prev) => ({ ...prev, attestTruth: event.target.checked }))} /> I attest this information is true and complete to the best of my knowledge.</label>
                <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" className="mt-1" checked={formState.noGuaranteeAcknowledge} onChange={(event) => setFormState((prev) => ({ ...prev, noGuaranteeAcknowledge: event.target.checked }))} /> I understand that assistance is not guaranteed and is subject to eligibility review and available charitable funds.</label>
              </div>
            )}

            {formError && <p className="text-sm text-red-600">{formError}</p>}

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                fullWidth
                onClick={() => {
                  setShowGapForm(false);
                  resetGapFormState();
                  setFormError('');
                }}
                disabled={isSubmittingForm}
              >
                Cancel
              </Button>
              {formStep > 1 && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => {
                    setFormStep((prev) => (Math.max(1, prev - 1) as 1 | 2 | 3 | 4 | 5));
                    setFormError('');
                  }}
                  disabled={isSubmittingForm}
                >
                  Back
                </Button>
              )}
              {formStep < 5 ? (
                <Button
                  fullWidth
                  onClick={() => {
                    if (!canProceedStep()) {
                      setFormError('Please complete required fields before continuing.');
                      return;
                    }
                    setFormError('');
                    setFormStep((prev) => (Math.min(5, prev + 1) as 1 | 2 | 3 | 4 | 5));
                  }}
                  disabled={isSubmittingForm}
                >
                  Continue
                </Button>
              ) : (
                <Button fullWidth onClick={submitGapForm} disabled={isSubmittingForm}>{isSubmittingForm ? 'Submitting…' : 'Submit for Review'}</Button>
              )}
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
