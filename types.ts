
export type ViewState = 'SPLASH' | 'LOGIN' | 'REGISTRATION' | 'ORG_REGISTRATION' | 'DASHBOARD' | 'HELP_WIZARD' | 'SETTINGS' | 'MAP' | 'ALERTS' | 'GAP' | 'ASSESSMENT' | 'POPULATION' | 'RECOVERY' | 'DRONE' | 'LOGISTICS' | 'ORG_DASHBOARD' | 'PRESENTATION';

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
}

export interface HelpRequestRecord extends HelpRequestData {
  id: string;
  userId: string; // Link to User
  timestamp: string;
  status: 'PENDING' | 'RECEIVED' | 'DISPATCHED' | 'RESOLVED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  synced?: boolean; // Offline sync status
}

export type UserRole = 'ADMIN' | 'CONTRACTOR' | 'LOCAL_AUTHORITY' | 'FIRST_RESPONDER' | 'GENERAL_USER' | 'INSTITUTION_ADMIN';

export type LanguageCode = 'en' | 'es' | 'fr';

export interface HouseholdMember {
  id: string;
  name: string;
  age: string;
  needs: string; // Special needs or medical notes
}

export interface UserProfile {
  id: string; // Unique ID (UUID)
  fullName: string;
  phone: string;
  address: string; // Home Address for dispatch
  householdMembers: number; // Legacy count (kept for backward compat, derived from household array)
  household: HouseholdMember[]; // Detailed list
  petDetails: string; // E.g. "2 Dogs"
  medicalNeeds: string; // Critical info (Oxygen, Dialysis, Mobility)
  
  // Emergency Contact (Split)
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;

  communityId: string; // For Community Onboarding via trusted institutions
  role: UserRole; // Current user's role
  language: LanguageCode; // Preferred Language
  active: boolean; // Account status
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
  adminContact: string;
  adminPhone: string;
  replenishmentProvider: string; // Who fulfills their requests (e.g. "FEMA Region 4", "Diocese HQ")
  replenishmentEmail: string; // Email for requests
  replenishmentPhone: string; // Phone for requests
  verified: boolean;
  active: boolean; // Organization status
  currentBroadcast?: string; // Scoped message for members only
  lastBroadcastTime?: string;
}

export interface ReplenishmentRequest {
  id: string;
  orgId: string;
  orgName: string;
  item: string;
  quantity: number;
  status: 'PENDING' | 'APPROVED' | 'FULFILLED';
  timestamp: string;
  provider: string;
  signature?: string; // Base64 data URL of the signature (Released By)
  signedAt?: string; // Timestamp of signature (Released By)
  receivedSignature?: string; // Base64 data URL (Received By)
  receivedAt?: string; // Timestamp of signature (Received By)
  synced?: boolean; // Offline sync status
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
  currentUser: string | null; // ID of logged in user
  tickerMessage: string; // System-wide scrolling broadcast (ADMIN ONLY)
}
