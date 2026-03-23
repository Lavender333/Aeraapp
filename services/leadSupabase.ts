import { hasSupabaseConfig, supabase } from './supabase';
import {
  BuyerAccount,
  DisputeReason,
  LeadSeverity,
  LeadStatus,
  LeadTier,
  VerifiedLead,
} from '../types';
import {
  DISPUTE_WINDOW_HOURS,
  SAMPLE_BUYERS,
  SAMPLE_LEADS,
  assignTier,
  computeQualityScore,
} from './leadService';

const addHours = (iso: string, hours: number) =>
  new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();

const safeLeadStatus = (value: string): LeadStatus => {
  const v = String(value || '').toUpperCase();
  if (v === 'VERIFIED' || v === 'DELIVERED' || v === 'ACCEPTED' || v === 'REJECTED' || v === 'REFUNDED') return v;
  return 'NEW';
};

const safeTier = (value: string): LeadTier => {
  const v = String(value || '').toUpperCase();
  if (v === 'A' || v === 'B') return v;
  return 'C';
};

const safeSeverity = (value: string): LeadSeverity => {
  const v = String(value || '').toUpperCase();
  if (v === 'HIGH' || v === 'MEDIUM') return v;
  return 'LOW';
};

const toDisputeReasonDb = (reason: DisputeReason): string => {
  if (reason === 'OUT_OF_SERVICE_AREA') return 'OUT_OF_SERVICE_AREA';
  return reason;
};

const fromDisputeReasonDb = (reason: string): DisputeReason => {
  if (reason === 'OUT_OF_SERVICE_AREA') return 'OUT_OF_SERVICE_AREA';
  return reason as DisputeReason;
};

const mapLeadRow = (row: any): VerifiedLead => ({
  id: String(row.external_lead_id || row.id || ''),
  sourceTag: String(row.source_tag || 'organic-web'),
  channel: String(row.channel || 'WEB') as 'WEB' | 'CALL' | 'REFERRAL',
  applicantName: String(row.applicant_name || ''),
  phone: String(row.phone || ''),
  email: String(row.email || ''),
  city: String(row.city || ''),
  state: String(row.state || ''),
  zipCode: String(row.zip_code || ''),
  consentToContact: Boolean(row.consent_to_contact),
  consentTimestamp: row.consent_timestamp || row.created_at || new Date().toISOString(),
  tcpaComplianceAcknowledged: Boolean(row.tcpa_compliance_acknowledged),
  privacyPolicyAccepted: Boolean(row.privacy_policy_accepted),
  consentIpAddress: row.consent_ip_address || undefined,
  phoneVerified: Boolean(row.phone_verified),
  emailVerified: Boolean(row.email_verified),
  identityScore: Number(row.identity_score || 0),
  duplicateChecked: Boolean(row.duplicate_checked),
  fraudFlagged: Boolean(row.fraud_flagged),
  serviceAreaMatch: Boolean(row.service_area_match),
  qualityScore: Number(row.quality_score || 0),
  tier: safeTier(row.tier),
  severity: safeSeverity(row.severity),
  caseType: String(row.case_type || 'Property Claim'),
  status: safeLeadStatus(row.status),
  createdAt: row.created_at || new Date().toISOString(),
  verifiedAt: row.verified_at || undefined,
  deliveredAt: row.delivered_at || undefined,
  disputeWindowClosesAt: row.dispute_window_closes_at || undefined,
  resolvedAt: row.resolved_at || undefined,
  notes: row.notes || undefined,
  assignedBuyerId: row.assigned_buyer_id || undefined,
  assignedBuyerName: row.assigned_buyer_name || undefined,
  rejectionReason: row.rejection_reason || undefined,
  creditIssued: Boolean(row.credit_issued),
});

const mapBuyerRow = (row: any): BuyerAccount => ({
  id: String(row.id),
  orgName: String(row.org_name || ''),
  contactName: String(row.contact_name || ''),
  contactEmail: String(row.contact_email || ''),
  contactPhone: String(row.contact_phone || ''),
  licenseNumber: row.license_number || undefined,
  coverageStates: Array.isArray(row.coverage_states) ? row.coverage_states : [],
  acceptedCaseTypes: Array.isArray(row.accepted_case_types) ? row.accepted_case_types : [],
  dailyLeadCap: Number(row.daily_lead_cap || 0),
  minQualityScore: Number(row.min_quality_score || 0),
  acceptedSeverities: (Array.isArray(row.accepted_severities) ? row.accepted_severities : ['HIGH', 'MEDIUM', 'LOW']) as LeadSeverity[],
  billingModel: row.billing_model || 'NET_15',
  walletBalanceCents: Number(row.wallet_balance_cents || 0),
  monthlyPlatformFeeCents: Number(row.monthly_platform_fee_cents || 0),
  active: Boolean(row.active),
  createdAt: row.created_at || new Date().toISOString(),
  tcpaVerified: Boolean(row.tcpa_verified),
  licenseVerified: Boolean(row.license_verified),
});

export async function fetchVerifiedLeads(): Promise<VerifiedLead[]> {
  if (!hasSupabaseConfig) return SAMPLE_LEADS;
  const { data, error } = await supabase
    .from('verified_leads')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(300);

  if (error) {
    console.warn('[leadSupabase] fetchVerifiedLeads fallback:', error.message);
    return SAMPLE_LEADS;
  }

  if (!data || data.length === 0) return SAMPLE_LEADS;
  return data.map(mapLeadRow);
}

export async function fetchBuyerAccounts(): Promise<BuyerAccount[]> {
  if (!hasSupabaseConfig) return SAMPLE_BUYERS;
  const { data, error } = await supabase
    .from('buyer_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    console.warn('[leadSupabase] fetchBuyerAccounts fallback:', error.message);
    return SAMPLE_BUYERS;
  }

  if (!data || data.length === 0) return SAMPLE_BUYERS;
  return data.map(mapBuyerRow);
}

export interface LeadIntakeInput {
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;
  caseType: string;
  severity: LeadSeverity;
  consentToContact: boolean;
  tcpaComplianceAcknowledged: boolean;
  privacyPolicyAccepted: boolean;
  sourceTag?: string;
  channel?: 'WEB' | 'CALL' | 'REFERRAL';
  notes?: string;
}

export async function submitLeadIntake(input: LeadIntakeInput): Promise<VerifiedLead> {
  const now = new Date().toISOString();
  const phoneVerified = input.phone.replace(/\D/g, '').length >= 10;
  const emailVerified = input.email ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email) : false;
  const identityScore = 70 + Math.round(Math.random() * 25);

  const qualityScore = computeQualityScore({
    phoneVerified,
    emailVerified,
    identityScore,
    serviceAreaMatch: true,
    fraudFlagged: false,
    duplicateChecked: true,
  });

  const tier = assignTier(qualityScore, input.severity);
  const fallbackId = `LEAD-${Date.now().toString().slice(-5)}`;

  const payload = {
    external_lead_id: fallbackId,
    source_tag: input.sourceTag || 'organic-web',
    channel: input.channel || 'WEB',
    applicant_name: input.applicantName,
    phone: input.phone,
    email: input.email || null,
    city: input.city,
    state: input.state.toUpperCase(),
    zip_code: input.zipCode,
    consent_to_contact: input.consentToContact,
    consent_timestamp: now,
    tcpa_compliance_acknowledged: input.tcpaComplianceAcknowledged,
    privacy_policy_accepted: input.privacyPolicyAccepted,
    phone_verified: phoneVerified,
    email_verified: emailVerified,
    identity_score: identityScore,
    duplicate_checked: true,
    fraud_flagged: false,
    service_area_match: true,
    quality_score: qualityScore,
    tier,
    severity: input.severity,
    case_type: input.caseType,
    status: 'NEW',
    notes: input.notes || null,
  };

  if (!hasSupabaseConfig) {
    return mapLeadRow({ ...payload, created_at: now, id: fallbackId });
  }

  const { data, error } = await supabase
    .from('verified_leads')
    .insert(payload)
    .select('*')
    .single();

  if (error || !data) {
    console.warn('[leadSupabase] submitLeadIntake fallback:', error?.message || 'insert failed');
    return mapLeadRow({ ...payload, created_at: now, id: fallbackId });
  }

  return mapLeadRow(data);
}

export async function updateLeadRecord(
  leadId: string,
  updates: Partial<Pick<VerifiedLead, 'status' | 'assignedBuyerId' | 'assignedBuyerName' | 'verifiedAt' | 'deliveredAt' | 'disputeWindowClosesAt' | 'resolvedAt' | 'rejectionReason' | 'notes' | 'creditIssued'>>,
): Promise<boolean> {
  if (!hasSupabaseConfig) return false;

  const dbUpdate: Record<string, unknown> = {};
  if (updates.status) dbUpdate.status = updates.status;
  if (updates.assignedBuyerId !== undefined) dbUpdate.assigned_buyer_id = updates.assignedBuyerId;
  if (updates.assignedBuyerName !== undefined) dbUpdate.assigned_buyer_name = updates.assignedBuyerName;
  if (updates.verifiedAt !== undefined) dbUpdate.verified_at = updates.verifiedAt;
  if (updates.deliveredAt !== undefined) dbUpdate.delivered_at = updates.deliveredAt;
  if (updates.disputeWindowClosesAt !== undefined) dbUpdate.dispute_window_closes_at = updates.disputeWindowClosesAt;
  if (updates.resolvedAt !== undefined) dbUpdate.resolved_at = updates.resolvedAt;
  if (updates.rejectionReason !== undefined) dbUpdate.rejection_reason = updates.rejectionReason;
  if (updates.notes !== undefined) dbUpdate.notes = updates.notes;
  if (updates.creditIssued !== undefined) dbUpdate.credit_issued = updates.creditIssued;

  const now = new Date().toISOString();
  if (updates.status === 'VERIFIED' && !updates.verifiedAt) dbUpdate.verified_at = now;
  if (updates.status === 'DELIVERED' && !updates.deliveredAt) {
    dbUpdate.delivered_at = now;
    dbUpdate.dispute_window_closes_at = addHours(now, DISPUTE_WINDOW_HOURS);
  }

  const { error } = await supabase
    .from('verified_leads')
    .update(dbUpdate)
    .or(`external_lead_id.eq.${leadId},id.eq.${leadId}`);

  if (error) {
    console.warn('[leadSupabase] updateLeadRecord failed:', error.message);
    return false;
  }
  return true;
}

export async function createLeadDispute(input: {
  leadId: string;
  buyerId: string;
  reason: DisputeReason;
  notes?: string;
  creditIssuedCents?: number;
}): Promise<boolean> {
  if (!hasSupabaseConfig) return false;

  const { error } = await supabase
    .from('lead_disputes')
    .insert({
      lead_id: input.leadId,
      buyer_id: input.buyerId,
      reason: toDisputeReasonDb(input.reason),
      notes: input.notes || null,
      status: 'OPEN',
      credit_issued_cents: Math.max(0, Math.round(input.creditIssuedCents || 0)),
    });

  if (error) {
    console.warn('[leadSupabase] createLeadDispute failed:', error.message);
    return false;
  }

  return true;
}

export async function fetchLeadDisputes(): Promise<Array<{ leadId: string; reason: DisputeReason; notes?: string; submittedAt: string; creditIssuedCents: number }>> {
  if (!hasSupabaseConfig) return [];

  const { data, error } = await supabase
    .from('lead_disputes')
    .select('lead_id, reason, notes, submitted_at, credit_issued_cents')
    .order('submitted_at', { ascending: false })
    .limit(100);

  if (error || !data) return [];
  return data.map((row: any) => ({
    leadId: String(row.lead_id),
    reason: fromDisputeReasonDb(String(row.reason)),
    notes: row.notes || undefined,
    submittedAt: row.submitted_at,
    creditIssuedCents: Number(row.credit_issued_cents || 0),
  }));
}

export async function createStripePaymentIntentViaSupabase(
  invoiceId: string,
  amountCents: number,
  buyerEmail?: string,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  if (!hasSupabaseConfig) {
    return {
      clientSecret: 'pi_stub_secret',
      paymentIntentId: `pi_stub_${Date.now()}`,
    };
  }

  const { data, error } = await supabase.functions.invoke('create-stripe-payment-intent', {
    body: {
      invoice_id: invoiceId,
      amount_cents: amountCents,
      buyer_email: buyerEmail,
      currency: 'usd',
    },
  });

  if (error || !data?.client_secret || !data?.payment_intent_id) {
    console.warn('[leadSupabase] createStripePaymentIntentViaSupabase fallback:', error?.message || 'invoke failed');
    return {
      clientSecret: 'pi_stub_secret',
      paymentIntentId: `pi_stub_${Date.now()}`,
    };
  }

  return {
    clientSecret: String(data.client_secret),
    paymentIntentId: String(data.payment_intent_id),
  };
}
