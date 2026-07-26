import { describe, expect, it } from 'vitest';
import {
  findOrganizationSeatManagement,
  indexOrganizationSeatManagement,
} from '../services/organizationSeatMatching';
import type { OrganizationSeatManagement } from '../services/api';

const westside: OrganizationSeatManagement = {
  organizationId: '1dc8d950-8668-4b2f-9596-07b9fccfa123',
  organizationCode: '',
  organizationName: 'Westside Food Bank',
  contractStatus: 'pending',
  purchasedSeats: 0,
  organizationFundedMembers: 0,
  personallyPaidMembers: 0,
  connectedMembers: 0,
  availableSeats: 0,
  activeCodeCount: 0,
};

describe('organization seat matching', () => {
  it('indexes records by Supabase UUID even when an organization code is missing', () => {
    const index = indexOrganizationSeatManagement([westside]);
    expect(index[westside.organizationId.toUpperCase()]).toBe(westside);
  });

  it('matches a Supabase directory organization by its canonical UUID', () => {
    const index = indexOrganizationSeatManagement([westside]);
    expect(findOrganizationSeatManagement({
      id: westside.organizationId.toUpperCase(),
      supabaseId: westside.organizationId,
      name: westside.organizationName,
    }, index)).toBe(westside);
  });

  it('matches an older cached organization by one unique exact name', () => {
    const index = indexOrganizationSeatManagement([westside]);
    expect(findOrganizationSeatManagement({
      id: 'FOOD-1001',
      name: '  Westside   Food Bank ',
    }, index)).toBe(westside);
  });

  it('does not guess when organization names are ambiguous', () => {
    const duplicate = {
      ...westside,
      organizationId: '788f4fb7-cde8-4cc2-9231-846728495456',
    };
    const index = indexOrganizationSeatManagement([westside, duplicate]);
    expect(findOrganizationSeatManagement({
      id: 'FOOD-1001',
      name: 'Westside Food Bank',
    }, index)).toBeUndefined();
  });
});
