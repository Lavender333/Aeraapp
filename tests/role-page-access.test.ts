import { describe, expect, it } from 'vitest';
import { canRoleAccessAdminFeature, canRoleAccessView } from '../services/rolePageAccess';

describe('role page access', () => {
  it('keeps contractor access limited to recovery and logistics operations', () => {
    expect(canRoleAccessView('CONTRACTOR', 'RECOVERY')).toBe(true);
    expect(canRoleAccessView('CONTRACTOR', 'LOGISTICS')).toBe(true);
    expect(canRoleAccessView('CONTRACTOR', 'MAP')).toBe(false);
    expect(canRoleAccessView('CONTRACTOR', 'POPULATION')).toBe(false);
    expect(canRoleAccessView('CONTRACTOR', 'DRONE')).toBe(false);
    expect(canRoleAccessView('CONTRACTOR', 'VOLUNTEER_SCAN')).toBe(false);
  });

  it('gives responders working event and scanning tools', () => {
    expect(canRoleAccessView('FIRST_RESPONDER', 'EVENT_DASHBOARD')).toBe(true);
    expect(canRoleAccessView('FIRST_RESPONDER', 'VOLUNTEER_SCAN')).toBe(true);
    expect(canRoleAccessView('LOCAL_AUTHORITY', 'EVENT_DASHBOARD')).toBe(true);
    expect(canRoleAccessView('LOCAL_AUTHORITY', 'EVENT_SETUP')).toBe(false);
  });

  it('does not show referral intake to institution administrators', () => {
    expect(canRoleAccessAdminFeature('INSTITUTION_ADMIN', 'REFERRAL_INTAKE')).toBe(false);
    expect(canRoleAccessView('INSTITUTION_ADMIN', 'LEAD_INTAKE')).toBe(false);
    expect(canRoleAccessAdminFeature('ORG_ADMIN', 'REFERRAL_INTAKE')).toBe(true);
  });

  it('reserves platform-only pages for the Administrator', () => {
    for (const role of ['STATE_ADMIN', 'COUNTY_ADMIN', 'ORG_ADMIN', 'INSTITUTION_ADMIN', 'BUYER']) {
      expect(canRoleAccessView(role, 'FINANCE_DASHBOARD')).toBe(false);
      expect(canRoleAccessView(role, 'NEW_SIGNUPS')).toBe(false);
    }
    expect(canRoleAccessView('ADMIN', 'FINANCE_DASHBOARD')).toBe(true);
    expect(canRoleAccessView('ADMIN', 'NEW_SIGNUPS')).toBe(true);
  });

  it('supports state and county oversight without seat or code administration', () => {
    for (const role of ['STATE_ADMIN', 'COUNTY_ADMIN']) {
      expect(canRoleAccessView(role, 'ORG_DASHBOARD')).toBe(true);
      expect(canRoleAccessView(role, 'EVENT_DASHBOARD')).toBe(true);
      expect(canRoleAccessAdminFeature(role, 'MEMBER_ACTIVITY')).toBe(true);
      expect(canRoleAccessAdminFeature(role, 'ORGANIZATION_DIRECTORY')).toBe(true);
      expect(canRoleAccessAdminFeature(role, 'SEAT_MANAGEMENT')).toBe(false);
      expect(canRoleAccessAdminFeature(role, 'COMMUNITY_CODES')).toBe(false);
    }
  });

  it('keeps Buyer, General User, and Member out of administrative operations', () => {
    expect(canRoleAccessView('BUYER', 'BUYER_PORTAL')).toBe(true);
    for (const role of ['BUYER', 'GENERAL_USER', 'MEMBER']) {
      expect(canRoleAccessView(role, 'MAP')).toBe(false);
      expect(canRoleAccessView(role, 'ORG_DASHBOARD')).toBe(false);
      expect(canRoleAccessView(role, 'EVENT_DASHBOARD')).toBe(false);
      expect(canRoleAccessView(role, 'FINANCE_DASHBOARD')).toBe(false);
    }
  });

  it('gives the Administrator the complete operational toolset', () => {
    for (const view of [
      'MAP',
      'POPULATION',
      'RECOVERY',
      'DRONE',
      'LOGISTICS',
      'ORG_DASHBOARD',
      'EVENT_SETUP',
      'EVENT_DASHBOARD',
      'GAP_MANAGEMENT',
      'BUYER_PORTAL',
      'LEAD_ADMIN',
      'FINANCE_DASHBOARD',
    ] as const) {
      expect(canRoleAccessView('ADMIN', view)).toBe(true);
    }
  });
});
