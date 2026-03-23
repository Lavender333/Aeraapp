/**
 * AERA Verified Lead Service
 * Handles: scoring, tier assignment, buyer matching, billing calculations,
 * dispute processing, and Stripe payment intent creation (stub).
 */

import {
  VerifiedLead,
  LeadTier,
  LeadSeverity,
  LeadStatus,
  BuyerAccount,
  LeadInvoice,
  LeadInvoiceLine,
  LeadDispute,
  WeeklyReconSummary,
  DEFAULT_LEAD_PRICING,
  DisputeReason,
} from '../types';
import { createStripePaymentIntentViaSupabase } from './leadSupabase';

// ── Dispute window (hours) ──────────────────────────────────────────────────
export const DISPUTE_WINDOW_HOURS = 72;

// ── Sample buyer accounts (replace with Supabase fetch) ────────────────────
export const SAMPLE_BUYERS: BuyerAccount[] = [
  {
    id: 'BUYER-001',
    orgName: 'Gulf Coast Public Adjusters',
    contactName: 'James Tran',
    contactEmail: 'jtran@gcpa.com',
    contactPhone: '(504) 555-0190',
    licenseNumber: 'LA-PA-88214',
    coverageStates: ['TX', 'LA', 'FL', 'MS', 'AL'],
    acceptedCaseTypes: ['Property Claim', 'Storm Damage', 'Flood'],
    dailyLeadCap: 25,
    minQualityScore: 75,
    acceptedSeverities: ['HIGH', 'MEDIUM'],
    billingModel: 'NET_15',
    walletBalanceCents: 0,
    monthlyPlatformFeeCents: 49900,   // $499/mo
    active: true,
    createdAt: '2026-01-10T00:00:00.000Z',
    tcpaVerified: true,
    licenseVerified: true,
  },
  {
    id: 'BUYER-002',
    orgName: 'Rapid Recovery Network',
    contactName: 'Priya Sharma',
    contactEmail: 'priya@rrn.io',
    contactPhone: '(713) 555-0127',
    coverageStates: ['TX', 'OK'],
    acceptedCaseTypes: ['Property Claim', 'Emergency Housing', 'Fire'],
    dailyLeadCap: 15,
    minQualityScore: 80,
    acceptedSeverities: ['HIGH'],
    billingModel: 'PREPAID_WALLET',
    walletBalanceCents: 126000,       // $1,260
    monthlyPlatformFeeCents: 29900,   // $299/mo
    active: true,
    createdAt: '2026-02-01T00:00:00.000Z',
    tcpaVerified: true,
    licenseVerified: false,
  },
];

// ── Sample leads (replace with Supabase fetch) ──────────────────────────────
export const SAMPLE_LEADS: VerifiedLead[] = [
  {
    id: 'LEAD-24001',
    sourceTag: 'organic-web',
    channel: 'WEB',
    applicantName: 'Maria Jackson',
    phone: '(713) 555-0144',
    email: 'mjackson@email.com',
    city: 'Houston',
    state: 'TX',
    zipCode: '77002',
    consentToContact: true,
    consentTimestamp: '2026-03-22T13:18:00.000Z',
    tcpaComplianceAcknowledged: true,
    privacyPolicyAccepted: true,
    consentIpAddress: '192.168.1.1',
    phoneVerified: true,
    emailVerified: true,
    identityScore: 95,
    duplicateChecked: true,
    fraudFlagged: false,
    serviceAreaMatch: true,
    qualityScore: 92,
    tier: 'A',
    severity: 'HIGH',
    caseType: 'Property Claim',
    status: 'DELIVERED',
    createdAt: '2026-03-22T13:20:00.000Z',
    verifiedAt: '2026-03-22T13:21:00.000Z',
    deliveredAt: '2026-03-22T13:22:00.000Z',
    disputeWindowClosesAt: addHours('2026-03-22T13:22:00.000Z', DISPUTE_WINDOW_HOURS),
    assignedBuyerId: 'BUYER-001',
    assignedBuyerName: 'Gulf Coast Public Adjusters',
  },
  {
    id: 'LEAD-24002',
    sourceTag: 'partner-fema-ref',
    channel: 'REFERRAL',
    applicantName: 'Carter Green',
    phone: '(337) 555-0109',
    email: 'cgreen@mailbox.net',
    city: 'Lake Charles',
    state: 'LA',
    zipCode: '70601',
    consentToContact: true,
    consentTimestamp: '2026-03-21T17:00:00.000Z',
    tcpaComplianceAcknowledged: true,
    privacyPolicyAccepted: true,
    phoneVerified: true,
    emailVerified: false,
    identityScore: 80,
    duplicateChecked: true,
    fraudFlagged: false,
    serviceAreaMatch: true,
    qualityScore: 85,
    tier: 'B',
    severity: 'MEDIUM',
    caseType: 'Flood Damage',
    status: 'DELIVERED',
    createdAt: '2026-03-21T17:08:00.000Z',
    verifiedAt: '2026-03-21T17:10:00.000Z',
    deliveredAt: '2026-03-21T17:12:00.000Z',
    disputeWindowClosesAt: addHours('2026-03-21T17:12:00.000Z', DISPUTE_WINDOW_HOURS),
    assignedBuyerId: 'BUYER-001',
    assignedBuyerName: 'Gulf Coast Public Adjusters',
  },
  {
    id: 'LEAD-24003',
    sourceTag: 'paid-social-01',
    channel: 'WEB',
    applicantName: 'Sasha Reid',
    phone: '(850) 555-0188',
    email: 'sreid@outlook.com',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '32501',
    consentToContact: true,
    consentTimestamp: '2026-03-20T09:00:00.000Z',
    tcpaComplianceAcknowledged: true,
    privacyPolicyAccepted: true,
    phoneVerified: true,
    emailVerified: true,
    identityScore: 70,
    duplicateChecked: true,
    fraudFlagged: false,
    serviceAreaMatch: true,
    qualityScore: 74,
    tier: 'C',
    severity: 'LOW',
    caseType: 'Storm Damage',
    status: 'ACCEPTED',
    createdAt: '2026-03-20T09:02:00.000Z',
    verifiedAt: '2026-03-20T09:05:00.000Z',
    deliveredAt: '2026-03-20T09:07:00.000Z',
    disputeWindowClosesAt: addHours('2026-03-20T09:07:00.000Z', DISPUTE_WINDOW_HOURS),
    resolvedAt: '2026-03-20T11:00:00.000Z',
    assignedBuyerId: 'BUYER-001',
    assignedBuyerName: 'Gulf Coast Public Adjusters',
  },
  {
    id: 'LEAD-24004',
    sourceTag: 'organic-web',
    channel: 'WEB',
    applicantName: 'DeShawn Williams',
    phone: '(832) 555-0213',
    email: 'dwilliams@gmail.com',
    city: 'Houston',
    state: 'TX',
    zipCode: '77084',
    consentToContact: true,
    consentTimestamp: '2026-03-22T09:30:00.000Z',
    tcpaComplianceAcknowledged: true,
    privacyPolicyAccepted: true,
    phoneVerified: true,
    emailVerified: true,
    identityScore: 93,
    duplicateChecked: true,
    fraudFlagged: false,
    serviceAreaMatch: true,
    qualityScore: 91,
    tier: 'A',
    severity: 'HIGH',
    caseType: 'Property Claim',
    status: 'NEW',
    createdAt: '2026-03-22T09:32:00.000Z',
  },
];

// ── Utilities ───────────────────────────────────────────────────────────────

function addHours(iso: string, hours: number): string {
  return new Date(new Date(iso).getTime() + hours * 3_600_000).toISOString();
}

/** Compute quality score from raw verification signals */
export function computeQualityScore(input: {
  phoneVerified: boolean;
  emailVerified: boolean;
  identityScore: number;
  serviceAreaMatch: boolean;
  fraudFlagged: boolean;
  duplicateChecked: boolean;
}): number {
  let score = 0;
  if (input.fraudFlagged) return 0;
  if (!input.serviceAreaMatch) return 0;
  score += input.phoneVerified ? 25 : 0;
  score += input.emailVerified ? 15 : 0;
  score += Math.round(input.identityScore * 0.4);  // 40% weight on identity
  score += input.duplicateChecked ? 10 : 0;
  score += input.serviceAreaMatch ? 10 : 0;
  return Math.min(100, score);
}

/** Derive tier from composite quality score + severity */
export function assignTier(qualityScore: number, severity: LeadSeverity): LeadTier {
  if (qualityScore >= 88 && severity === 'HIGH') return 'A';
  if (qualityScore >= 70 && severity !== 'LOW') return 'B';
  return 'C';
}

/** Price in USD for a given tier */
export function getLeadPrice(tier: LeadTier): number {
  return DEFAULT_LEAD_PRICING.find((p) => p.tier === tier)?.priceUsd ?? 75;
}

/** Check if dispute window is still open */
export function isDisputeWindowOpen(lead: VerifiedLead): boolean {
  if (!lead.disputeWindowClosesAt) return false;
  return new Date() < new Date(lead.disputeWindowClosesAt);
}

/**
 * Match a lead to the best available buyer.
 * Returns the first buyer that matches state, case type, severity, score, and has capacity.
 */
export function matchBuyer(lead: VerifiedLead, buyers: BuyerAccount[]): BuyerAccount | null {
  const eligible = buyers.filter(
    (b) =>
      b.active &&
      b.licenseVerified &&
      b.tcpaVerified &&
      b.coverageStates.includes(lead.state) &&
      b.acceptedCaseTypes.some((t) => t.toLowerCase() === lead.caseType.toLowerCase()) &&
      b.acceptedSeverities.includes(lead.severity) &&
      lead.qualityScore >= b.minQualityScore
  );
  return eligible[0] ?? null;
}

/**
 * Generate a draft invoice for a buyer for the current billing period.
 * Billing event fires on ACCEPTED status (or when dispute window closes without rejection).
 */
export function generateDraftInvoice(
  buyer: BuyerAccount,
  acceptedLeads: VerifiedLead[],
  credits: LeadDispute[],
  periodStart: string,
  periodEnd: string,
): LeadInvoice {
  const lines: LeadInvoiceLine[] = [];

  // Platform fee line
  lines.push({
    leadId: '',
    tier: 'A',
    priceUsd: buyer.monthlyPlatformFeeCents / 100,
    event: 'PLATFORM_FEE',
    description: 'Monthly platform access fee',
  });

  // Per-accepted-lead lines
  acceptedLeads.forEach((lead) => {
    const price = getLeadPrice(lead.tier);
    lines.push({
      leadId: lead.id,
      tier: lead.tier,
      priceUsd: price,
      event: 'ACCEPTED',
      description: `${lead.tier} lead accepted – ${lead.caseType} (${lead.state})`,
    });
  });

  // Credit lines for resolved disputes
  credits.forEach((dispute) => {
    if (dispute.creditIssuedCents && dispute.creditIssuedCents > 0) {
      lines.push({
        leadId: dispute.leadId,
        tier: 'C',
        priceUsd: -(dispute.creditIssuedCents / 100),
        event: 'CREDIT',
        description: `Credit: ${dispute.reason} – Lead ${dispute.leadId}`,
      });
    }
  });

  const subtotalCents = lines
    .filter((l) => l.event !== 'CREDIT')
    .reduce((sum, l) => sum + Math.round(l.priceUsd * 100), 0);

  const creditsCents = lines
    .filter((l) => l.event === 'CREDIT')
    .reduce((sum, l) => sum + Math.round(Math.abs(l.priceUsd) * 100), 0);

  const totalCents = Math.max(0, subtotalCents - creditsCents);

  const netDays = buyer.billingModel === 'NET_7' ? 7 : buyer.billingModel === 'NET_15' ? 15 : 0;
  const dueDate = new Date(Date.now() + netDays * 86_400_000).toISOString().split('T')[0];

  return {
    id: `INV-${Date.now()}`,
    buyerId: buyer.id,
    buyerName: buyer.orgName,
    periodStart,
    periodEnd,
    lines,
    subtotalCents,
    creditsCents,
    totalCents,
    status: 'DRAFT',
    dueDate,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Stripe payment intent stub.
 * Replace with actual Stripe SDK call server-side.
 */
export async function createStripePaymentIntent(
  invoiceId: string,
  amountCents: number,
  buyerEmail: string,
): Promise<{ clientSecret: string; paymentIntentId: string }> {
  return createStripePaymentIntentViaSupabase(invoiceId, amountCents, buyerEmail);
}

/** Deduct accepted lead from prepaid wallet */
export function deductFromWallet(
  buyer: BuyerAccount,
  amountCents: number,
): { success: boolean; remainingCents: number } {
  if (buyer.billingModel !== 'PREPAID_WALLET') return { success: false, remainingCents: buyer.walletBalanceCents };
  if (buyer.walletBalanceCents < amountCents) return { success: false, remainingCents: buyer.walletBalanceCents };
  return { success: true, remainingCents: buyer.walletBalanceCents - amountCents };
}

/** Check if dispute is valid and should receive a credit */
export function evaluateDispute(
  reason: DisputeReason,
  lead?: VerifiedLead,
  windowOpen: boolean = true,
): { valid: boolean; creditPercent: number } {
  if (!windowOpen) return { valid: false, creditPercent: 0 };
  if (lead?.status === 'REFUNDED') return { valid: false, creditPercent: 0 };

  const autoCredit: Partial<Record<DisputeReason, number>> = {
    DUPLICATE: 100,
    INVALID_CONTACT: 100,
    OUT_OF_SERVICE_AREA: 100,
    CONSENT_ISSUE: 100,
    ALREADY_CLIENT: 75,
    OTHER: 50,
  };

  const pct = autoCredit[reason] ?? 0;
  return { valid: pct > 0, creditPercent: pct };
}

/** Generate weekly reconciliation summary from a set of leads */
export function weeklyReconciliation(leads: VerifiedLead[]): WeeklyReconSummary {
  const delivered = leads.filter((l) => l.status !== 'NEW' && l.status !== 'VERIFIED');
  const accepted = delivered.filter((l) => l.status === 'ACCEPTED');
  const rejected = delivered.filter((l) => l.status === 'REJECTED');
  const refunded = delivered.filter((l) => l.status === 'REFUNDED');

  const grossRevenueCents = accepted.reduce((s, l) => s + Math.round(getLeadPrice(l.tier) * 100), 0);
  const creditsCents      = refunded.reduce((s, l)  => s + Math.round(getLeadPrice(l.tier) * 100), 0);

  const dates = delivered.map((l) => l.deliveredAt!).filter(Boolean).sort();
  const weekStart = dates[0] ?? new Date().toISOString();
  const weekEnd   = dates[dates.length - 1] ?? new Date().toISOString();

  return {
    weekStart,
    weekEnd,
    totalDelivered: delivered.length,
    totalAccepted: accepted.length,
    totalRejected: rejected.length,
    totalDisputed: refunded.length,
    grossRevenueCents,
    creditsCents,
    netRevenueCents: Math.max(0, grossRevenueCents - creditsCents),
    acceptanceRate: delivered.length > 0 ? accepted.length / delivered.length : 0,
    disputeRate:    delivered.length > 0 ? refunded.length  / delivered.length : 0,
  };
}
