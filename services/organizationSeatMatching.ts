import type { OrganizationProfile } from '../types';
import type { OrganizationSeatManagement } from './api';

const normalizeLookupKey = (value?: string | null) => String(value || '').trim().toUpperCase();
const normalizeOrganizationName = (value?: string | null) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

export const indexOrganizationSeatManagement = (
  rows: OrganizationSeatManagement[],
): Record<string, OrganizationSeatManagement> =>
  rows.reduce((index, row) => {
    const codeKey = normalizeLookupKey(row.organizationCode);
    const idKey = normalizeLookupKey(row.organizationId);
    if (codeKey) index[codeKey] = row;
    if (idKey) index[idKey] = row;
    return index;
  }, {} as Record<string, OrganizationSeatManagement>);

export const findOrganizationSeatManagement = (
  organization: Pick<OrganizationProfile, 'id' | 'name' | 'supabaseId'> | null | undefined,
  index: Record<string, OrganizationSeatManagement>,
): OrganizationSeatManagement | undefined => {
  if (!organization) return undefined;

  const directKeys = [organization.supabaseId, organization.id]
    .map(normalizeLookupKey)
    .filter(Boolean);
  for (const key of directKeys) {
    if (index[key]) return index[key];
  }

  const organizationName = normalizeOrganizationName(organization.name);
  if (!organizationName) return undefined;

  const uniqueRows = Array.from(
    new Map(
      Object.values(index).map((row) => [row.organizationId, row]),
    ).values(),
  );
  const nameMatches = uniqueRows.filter(
    (row) => normalizeOrganizationName(row.organizationName) === organizationName,
  );

  return nameMatches.length === 1 ? nameMatches[0] : undefined;
};
