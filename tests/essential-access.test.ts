import { describe, expect, it } from 'vitest';
import { ESSENTIAL_NAV_ITEMS, shouldShowEssentialNavigation } from '../services/essentialAccess';
import { UserRole, ViewState } from '../types';

const SYSTEM_ROLES: UserRole[] = [
  'ADMIN',
  'STATE_ADMIN',
  'COUNTY_ADMIN',
  'ORG_ADMIN',
  'INSTITUTION_ADMIN',
  'FIRST_RESPONDER',
  'LOCAL_AUTHORITY',
  'CONTRACTOR',
  'BUYER',
  'GENERAL_USER',
  'MEMBER',
];

describe('universal authenticated access', () => {
  it('provides the same essential navigation to every system role', () => {
    const expectedViews: ViewState[] = ['DASHBOARD', 'HELP_WIZARD', 'EVENTS', 'SETTINGS'];

    for (const role of SYSTEM_ROLES) {
      expect(role).toBeTruthy();
      expect(ESSENTIAL_NAV_ITEMS.map((item) => item.id)).toEqual(expectedViews);
    }
  });

  it('keeps essential navigation on specialized authenticated pages', () => {
    const specializedViews: ViewState[] = [
      'ORG_DASHBOARD',
      'EVENT_DASHBOARD',
      'BUYER_PORTAL',
      'LEAD_ADMIN',
      'FINANCE_DASHBOARD',
      'PRIVACY_POLICY',
    ];

    for (const view of specializedViews) {
      expect(shouldShowEssentialNavigation(view, true)).toBe(true);
    }
  });

  it('does not show authenticated navigation on public or sign-in flows', () => {
    const publicViews: ViewState[] = [
      'SPLASH',
      'LOGIN',
      'REGISTRATION',
      'ACCOUNT_SETUP',
      'RESET_PASSWORD',
      'EVENT_REGISTRATION',
      'PUBLIC_INTAKE',
    ];

    for (const view of publicViews) {
      expect(shouldShowEssentialNavigation(view, true)).toBe(false);
    }
    expect(shouldShowEssentialNavigation('DASHBOARD', false)).toBe(false);
  });
});
