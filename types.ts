
export type ViewState = 'SPLASH' | 'LOGIN' | 'REGISTRATION' | 'ACCOUNT_SETUP' | 'DASHBOARD' | 'HELP_WIZARD' | 'SETTINGS' | 'NEW_SIGNUPS' | 'MAP' | 'ALERTS' | 'GAP' | 'GAP_MANAGEMENT' | 'ASSESSMENT' | 'POPULATION' | 'RECOVERY' | 'DRONE' | 'LOGISTICS' | 'ORG_DASHBOARD' | 'PRESENTATION' | 'PRIVACY_POLICY' | 'RESET_PASSWORD' | 'BUILD_KIT' | 'READINESS' | 'READINESS_GAP' | 'EVENTS' | 'EVENT_SETUP' | 'EVENT_REGISTRATION' | 'VOLUNTEER_SCAN' | 'EVENT_DASHBOARD' | 'SHELTER_LOCATOR' | 'BUYER_PORTAL' | 'LEAD_INTAKE' | 'LEAD_ADMIN';

// ─── Verified Lead System ─────────────────────────────────────────────────────

export type LeadStatus = 'NEW' | 'VERIFIED' | 'DELIVERED' | 'ACCEPTED' | 'REJECTED' | 'REFUNDED';
export type LeadTier = 'A' | 'B' | 'C';
export type LeadSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export interface VerifiedLead {
  id: string;
  /** Source tag (utm_source, partner code, campaign id) */
  sourceTag: string;
  /** Intake channel: web form, call centre, referral */
  channel: 'WEB' | 'CALL' | 'REFERRAL';

  // Applicant identity
  applicantName: string;
  phone: string;
  email: string;
  city: string;
  state: string;
  zipCode: string;

  // Consent & compliance
  consentToContact: boolean;
  consentTimestamp: string;           // ISO timestamp
  tcpaComplianceAcknowledged: boolean;
  privacyPolicyAccepted: boolean;
  consentIpAddress?: string;

  // Verification
  phoneVerified: boolean;
  emailVerified: boolean;
  identityScore: number;              // 0–100
  duplicateChecked: boolean;
  fraudFlagged: boolean;
  serviceAreaMatch: boolean;

  // Scoring
  qualityScore: number;               // 0–100 composite
  tier: LeadTier;                     // A / B / C
  severity: LeadSeverity;
  caseType: string;                   // e.g. "Property Claim", "Housing"

  // Lifecycle
  status: LeadStatus;
  createdAt: string;
  verifiedAt?: string;
  deliveredAt?: string;
  disputeWindowClosesAt?: string;     // deliveredAt + 72 h
  resolvedAt?: string;
  notes?: string;

  // Buyer assignment
  assignedBuyerId?: string;
  assignedBuyerName?: string;
  rejectionReason?: string;
  creditIssued?: boolean;
}

// Tier pricing table
export interface LeadPricingTier {
  tier: LeadTier;
  label: string;
  priceUsd: number;       // charged per accepted lead
  description: string;
}

export const DEFAULT_LEAD_PRICING: LeadPricingTier[] = [
  { tier: 'A', label: 'Tier A — Fully Verified, High Intent', priceUsd: 275, description: 'Identity + contact + service-area confirmed, score ≥88, HIGH severity' },
  { tier: 'B', label: 'Tier B — Verified, Medium Intent',     priceUsd: 145, description: 'Contact verified, score 70–87, MEDIUM severity' },
  { tier: 'C', label: 'Tier C — Basic Verified',              priceUsd: 75,  description: 'Email/phone present, score 50–69, LOW severity' },
];

// Buyer account
export interface BuyerAccount {
  id: string;
  orgName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  licenseNumber?: string;
  coverageStates: string[];           // ['TX','LA','FL']
  acceptedCaseTypes: string[];
  dailyLeadCap: number;
  minQualityScore: number;
  acceptedSeverities: LeadSeverity[];
  billingModel: 'PREPAID_WALLET' | 'NET_7' | 'NET_15';
  walletBalanceCents: number;
  monthlyPlatformFeeCents: number;
  active: boolean;
  createdAt: string;
  tcpaVerified: boolean;
  licenseVerified: boolean;
}

// Invoice / billing record
export type InvoiceStatus = 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'VOIDED';

export interface LeadInvoiceLine {
  leadId: string;
  tier: LeadTier;
  priceUsd: number;
  event: 'ACCEPTED' | 'PLATFORM_FEE' | 'CREDIT';
  description: string;
}

export interface LeadInvoice {
  id: string;
  buyerId: string;
  buyerName: string;
  periodStart: string;    // ISO date
  periodEnd: string;
  lines: LeadInvoiceLine[];
  subtotalCents: number;
  creditsCents: number;
  totalCents: number;
  status: InvoiceStatus;
  dueDate: string;        // Net-7 / Net-15
  stripePaymentIntentId?: string;
  paidAt?: string;
  createdAt: string;
}

// Dispute
export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED_CREDIT' | 'RESOLVED_DENIED';
export type DisputeReason =
  | 'DUPLICATE'
  | 'OUT_OF_SERVICE_AREA'
  | 'INVALID_CONTACT'
  | 'CONSENT_ISSUE'
  | 'ALREADY_CLIENT'
  | 'OTHER';

export interface LeadDispute {
  id: string;
  leadId: string;
  buyerId: string;
  reason: DisputeReason;
  notes?: string;
  status: DisputeStatus;
  submittedAt: string;
  resolvedAt?: string;
  creditIssuedCents?: number;
}

// Weekly reconciliation summary
export interface WeeklyReconSummary {
  weekStart: string;
  weekEnd: string;
  totalDelivered: number;
  totalAccepted: number;
  totalRejected: number;
  totalDisputed: number;
  grossRevenueCents: number;
  creditsCents: number;
  netRevenueCents: number;
  acceptanceRate: number;   // 0–1
  disputeRate: number;      // 0–1
}

// ─────────────────────────────────────────────────────────────────────────────

export interface GapRevenueSettings {
  /** App Store listing price per membership (USD) */
  membershipPriceUsd: number;
  /** Apple / Google platform fee % taken before developer receives funds (e.g. 30) */
  appStoreFeePercent: number;
  /** % of net developer proceeds allocated to the G.A.P. hardship fund (e.g. 30) */
  gapFundAllocationPercent: number;
  /** Billing cycle label shown to users */
  billingCycle: 'monthly' | 'annual';
  /** ISO timestamp of last change */
  updatedAt: string;
}

/** Bank / ACH profile submitted by an org for G.A.P. fund disbursement */
export interface GapDocumentAttachment {
  id?: string;
  fileName: string;
  url: string;
  uploadedAt: string;
}

/** Bank / ACH profile submitted by an org for G.A.P. fund disbursement */
export interface OrgBankInfo {
  id?: string;
  orgCode: string;
  orgName?: string;
  bankName: string;
  beneficiaryName: string;      // Legal registered name of the organization
  routingNumber: string;        // 9-digit ABA routing number (public info)
  accountLast4: string;         // Last 4 digits of account # for display/verification
  accountType: 'checking' | 'savings';
  ein?: string;                 // EIN format XX-XXXXXXX for charitable compliance
  bankAddress?: string;         // Optional branch address for wire transfers
  notes?: string;
  verified: boolean;
  verifiedAt?: string;
  updatedAt?: string;
}

/** Record of an actual bank transfer (ACH/wire/check) sent to an organization */
export interface GapDisbursement {
  id: string;
  orgCode: string;
  orgName?: string;
  amountCents: number;           // Amount in cents (e.g. 50000 = $500.00)
  status: 'INITIATED' | 'PENDING' | 'SENT' | 'CONFIRMED' | 'FAILED';
  disbursementDate: string;      // ISO date YYYY-MM-DD
  paymentMethod: 'ACH' | 'WIRE' | 'CHECK';
  referenceNumber?: string;      // Chase ACH trace / confirmation number
  notes?: string;
  approvedBy?: string;
  createdAt: string;
}

export interface GapDocumentAttachment {
  id: string;
  label: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  storagePath?: string;
  accessUrl?: string;
}

export interface GapReviewTrailEntry {
  id: string;
  action: 'Recommend' | 'Request Info' | 'Decline' | 'Approve' | 'Adjust' | 'Deny' | 'Override';
  reviewerRole: UserRole;
  reviewerId: string;
  reviewedAt: string;
  note?: string;
}

export interface HelpRequestData {
  // Step 1: Safety
  isSafe: boolean | null;
  location: string;
  emergencyType: string;
  isInjured: boolean | null;
  injuryDetails: string;
  
  // Step 2: Situation
  situationDescription: string;
  canEvacuate: boolean | null;
  hazardsPresent: boolean | null;
  hazardDetails: string;
  peopleCount: number;
  petsPresent: boolean | null;

  // Step 3: Resources
  hasWater: boolean | null;
  hasFood: boolean | null;
  hasMeds: boolean | null;
  hasPower: boolean | null;
  hasPhone: boolean | null;

  // Step 4: Vulnerabilities & Media
  needsTransport: boolean | null;
  vulnerableGroups: string[];
  medicalConditions: string;
  damageType: string;
  
  // Step 5: Submission
  consentToShare: boolean;

  // Optional G.A.P. intake metadata
  gapApplication?: {
    program: 'HARDSHIP' | 'ADVANCE';
    householdImpacted: number;
    requestedAmount: number;
    hardshipType?: string;
    hardshipDate?: string;
    relatedToDeclaredDisaster?: boolean;
    declaredDisasterEvent?: string;
    immediateExpenseCategories?: string[];
    urgencyRisk?: string;
    customRequestedAmount?: number;
    monthlyIncomeLoss?: number;
    hardshipSummary?: string;
    declarationNoGuarantee?: boolean;
    documentsProvided?: string[];
    documents?: GapDocumentAttachment[];
    submittedToOrgQueue?: boolean;
    submittedToCoreQueue?: boolean;
    submittedAt?: string;
    reviewTrail?: GapReviewTrailEntry[];
    lastReviewAction?: GapReviewTrailEntry['action'];
    lastReviewedAt?: string;
  };
}

export interface HelpRequestRecord extends HelpRequestData {
  id: string;
  clientId?: string;
  serverId?: string;
  userId: string; // Link to User
  timestamp: string;
  status: 'PENDING' | 'RECEIVED' | 'DISPATCHED' | 'RESOLVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  synced?: boolean; // Offline sync status
}

export type UserRole =
  | 'ADMIN'
  | 'CONTRACTOR'
  | 'LOCAL_AUTHORITY'
  | 'FIRST_RESPONDER'
  | 'GENERAL_USER'
  | 'INSTITUTION_ADMIN'
  | 'STATE_ADMIN'
  | 'COUNTY_ADMIN'
  | 'ORG_ADMIN'
  | 'MEMBER';

export type LanguageCode = 'en' | 'es' | 'fr';

export interface HouseholdMember {
  id: string;
  name: string;
  age: string;
  needs: string; // Special needs or medical notes
  ageGroup?: 'ADULT' | 'TEEN' | 'CHILD' | 'SENIOR' | 'INFANT';
  mobilityFlag?: boolean;
  medicalFlag?: boolean;
  medicationDependency?: boolean;
  insulinDependency?: boolean;
  oxygenPoweredDevice?: boolean;
  transportationAccess?: boolean;
  loginEnabled?: boolean;
  loginPhone?: string;
}

export interface UserProfile {
  id: string; // Unique ID (UUID)
  fullName: string;
  avatarDataUrl?: string;
  email?: string;
  createdAt?: string; // ISO timestamp of account creation
  phone: string;
  address: string; // Home Address for dispatch
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  addressVerified?: boolean;
  addressVerifiedAt?: string;
  geofencedOutreachOptIn?: boolean;
  geofencedOutreachRadiusMiles?: number;
  geofencedOutreachConsentAt?: string;
  householdMembers: number; // Legacy count (kept for backward compat, derived from household array)
  household: HouseholdMember[]; // Detailed list
  petDetails: string; // E.g. "2 Dogs"
  medicalNeeds: string; // Critical info (Oxygen, Dialysis, Mobility)
  fireMeetLocation?: string;
  severeWeatherMeetLocation?: string;

  // Structured vulnerability intake (state-ready)
  zipCode?: string;
  medicationDependency?: boolean;
  insulinDependency?: boolean;
  oxygenPoweredDevice?: boolean;
  mobilityLimitation?: boolean;
  transportationAccess?: boolean;
  financialStrain?: boolean;
  consentPreparednessPlanning?: boolean;
  consentTimestamp?: string;
  
  // Emergency Contact (Split)
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;

  householdId?: string;
  householdName?: string;
  householdCode?: string;
  householdRole?: 'OWNER' | 'MEMBER';

  communityId: string; // For Community Onboarding via trusted institutions
  role: UserRole; // Current user's role
  language: LanguageCode; // Preferred Language
  active: boolean; // Account status
  onboardComplete?: boolean; // Required account setup done
  notifications: {
    push: boolean;
    sms: boolean;
    email: boolean;
  };
  pendingStatusRequest?: { // New: For Ping Feature
    requesterName: string;
    timestamp: string;
  };
}

export interface OrganizationProfile {
  id: string; // The generated Community ID (e.g. CH-1234)
  name: string;
  type: 'CHURCH' | 'NGO' | 'COMMUNITY_CENTER' | 'LOCAL_GOV';
  address: string;
  latitude?: number;
  longitude?: number;
  adminContact: string;
  adminPhone: string;
  replenishmentProvider: string; // Who fulfills their requests (e.g. "FEMA Region 4", "Diocese HQ")
  replenishmentEmail: string; // Email for requests
  replenishmentPhone: string; // Phone for requests
  verified: boolean;
  active: boolean; // Organization status
  currentBroadcast?: string; // Scoped message for members only
  lastBroadcastTime?: string;
  registeredPopulation?: number; // People registered
  parentOrgId?: string; // reference to a supervising organization
}

export interface ReplenishmentRequest {
  id: string;
  orgId: string;
  orgName: string;
  item: string;
  quantity: number;
  status: 'PENDING' | 'APPROVED' | 'FULFILLED' | 'STOCKED';
  timestamp: string;
  provider: string;
  signature?: string; // Base64 data URL of the signature (Released By)
  signedAt?: string; // Timestamp of signature (Released By)
  receivedSignature?: string; // Base64 data URL (Received By)
  receivedAt?: string; // Timestamp of signature (Received By)
  stocked?: boolean; // Marked as stocked in hub inventory
  stockedAt?: string; // Timestamp when stocked was confirmed
  stockedQuantity?: number; // Quantity applied to inventory
  orgConfirmed?: boolean; // Org confirmed delivery at fulfill step
  orgConfirmedAt?: string;
  synced?: boolean; // Offline sync status
}

export interface ReplenishmentAggregate {
  item: string;
  pending: number;
  approved: number;
  fulfilled: number;
  totalRequested: number;
  pendingQuantity: number;
}

export interface RoleDefinition {
  id: UserRole;
  label: string;
  description: string;
  permissions: {
    canViewPII: boolean;
    canDispatchDrone: boolean;
    canApproveFunds: boolean;
    canManageInventory: boolean;
    canBroadcastAlerts: boolean;
  };
}

export interface MockUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface OrgMember {
  id: string;
  name: string;
  status: 'SAFE' | 'DANGER' | 'UNKNOWN';
  lastUpdate: string;
  lastLoginAt?: string;
  location: string;
  needs: string[];
  phone: string;
  address: string;
  
  // Emergency Contact Info
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export interface OrgInventory {
  water: number; // cases
  food: number; // boxes
  blankets: number; // count
  medicalKits: number; // count
}

export type StepId = 1 | 2 | 3 | 4 | 5;

export interface Alert {
  id: string;
  type: 'CRITICAL' | 'WARNING' | 'INFO';
  message: string;
  timestamp: string;
  location: string;
}

// Backend Database Schema
export interface DatabaseSchema {
  users: UserProfile[];
  organizations: OrganizationProfile[];
  inventories: Record<string, OrgInventory>; // OrgID -> Inventory
  requests: HelpRequestRecord[];
  replenishmentRequests: ReplenishmentRequest[]; // New: System-wide supply requests
  orgMembers?: Record<string, OrgMember[]>; // Cached members from API
  currentUser: string | null; // ID of logged in user
  tickerMessage: string; // System-wide scrolling broadcast (ADMIN ONLY)
}
