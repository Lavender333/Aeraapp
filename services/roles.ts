import { UserRole } from '../types';

const VALID_ROLES: UserRole[] = [
  'ADMIN',
  'CONTRACTOR',
  'LOCAL_AUTHORITY',
  'FIRST_RESPONDER',
  'GENERAL_USER',
  'INSTITUTION_ADMIN',
  'STATE_ADMIN',
  'COUNTY_ADMIN',
  'ORG_ADMIN',
  'MEMBER',
];

export function normalizeUserRole(role: unknown): UserRole {
  const normalized = String(role || 'GENERAL_USER').toUpperCase();
  return VALID_ROLES.includes(normalized as UserRole)
    ? (normalized as UserRole)
    : 'GENERAL_USER';
}
