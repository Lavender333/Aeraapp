import { UserRole, ViewState } from '../types';
import { normalizeUserRole } from './roles';
import type { CommercialFeature } from './commercialAccess';

type RestrictedView =
  | 'NEW_SIGNUPS'
  | 'MAP'
  | 'GAP_MANAGEMENT'
  | 'POPULATION'
  | 'RECOVERY'
  | 'DRONE'
  | 'LOGISTICS'
  | 'ORG_DASHBOARD'
  | 'EVENT_SETUP'
  | 'VOLUNTEER_SCAN'
  | 'EVENT_DASHBOARD'
  | 'BUYER_PORTAL'
  | 'LEAD_INTAKE'
  | 'LEAD_ADMIN'
  | 'FINANCE_DASHBOARD';

export type AdminAreaFeature =
  | 'USER_DIRECTORY'
  | 'ROLES_ACCESS'
  | 'NEW_SIGNUPS'
  | 'MEMBER_ACTIVITY'
  | 'ORGANIZATION_DIRECTORY'
  | 'SEAT_MANAGEMENT'
  | 'COMMUNITY_CODES'
  | 'ORGANIZATION_ADDRESS'
  | 'REFERRAL_INTAKE'
  | 'LEAD_PIPELINE'
  | 'BUYER_PORTAL'
  | 'INVENTORY'
  | 'EVENTS'
  | 'BROADCASTS'
  | 'FINANCE';

const viewAccess: Record<RestrictedView, readonly UserRole[]> = {
  NEW_SIGNUPS: ['ADMIN'],
  MAP: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'],
  GAP_MANAGEMENT: ['ADMIN'],
  POPULATION: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'],
  RECOVERY: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY', 'CONTRACTOR'],
  DRONE: ['ADMIN'],
  LOGISTICS: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY', 'CONTRACTOR'],
  ORG_DASHBOARD: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  EVENT_SETUP: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  VOLUNTEER_SCAN: ['ADMIN', 'FIRST_RESPONDER'],
  EVENT_DASHBOARD: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN', 'FIRST_RESPONDER', 'LOCAL_AUTHORITY'],
  BUYER_PORTAL: ['ADMIN'],
  LEAD_INTAKE: ['ADMIN'],
  LEAD_ADMIN: ['ADMIN'],
  FINANCE_DASHBOARD: ['ADMIN'],
};

const adminAreaAccess: Record<AdminAreaFeature, readonly UserRole[]> = {
  USER_DIRECTORY: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  ROLES_ACCESS: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  NEW_SIGNUPS: ['ADMIN'],
  MEMBER_ACTIVITY: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  ORGANIZATION_DIRECTORY: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  SEAT_MANAGEMENT: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  COMMUNITY_CODES: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  ORGANIZATION_ADDRESS: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  REFERRAL_INTAKE: ['ADMIN', 'ORG_ADMIN'],
  LEAD_PIPELINE: ['ADMIN'],
  BUYER_PORTAL: ['ADMIN'],
  INVENTORY: ['ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  EVENTS: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  BROADCASTS: ['ADMIN', 'STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN'],
  FINANCE: ['ADMIN'],
};

const commercialViewFeature: Partial<Record<ViewState, CommercialFeature>> = {
  BUYER_PORTAL: 'BUYERS',
  LEAD_INTAKE: 'LEADS',
  LEAD_ADMIN: 'LEADS',
  FINANCE_DASHBOARD: 'FINANCE',
};

export function canRoleAccessView(
  role: unknown,
  view: ViewState,
  commercialFeatures: ReadonlySet<CommercialFeature> = new Set()
): boolean {
  const normalizedRole = normalizeUserRole(role);
  const commercialFeature = commercialViewFeature[view];
  if (commercialFeature) {
    return normalizedRole === 'ADMIN' || commercialFeatures.has(commercialFeature);
  }
  const allowedRoles = viewAccess[view as RestrictedView];
  return allowedRoles ? allowedRoles.includes(normalizedRole) : true;
}

export function canRoleAccessAdminFeature(role: unknown, feature: AdminAreaFeature): boolean {
  return adminAreaAccess[feature].includes(normalizeUserRole(role));
}
