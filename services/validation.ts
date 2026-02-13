import { HouseholdMember, OrgInventory } from '../types';

// Single source of truth for requestable items -> inventory keys
export const REQUEST_ITEM_MAP: Record<string, keyof OrgInventory> = {
  'Water Cases': 'water',
  'Food Boxes': 'food',
  'Blankets': 'blankets',
  'Medical Kits': 'medicalKits',
};

export const isValidRequestItem = (item: string): item is keyof typeof REQUEST_ITEM_MAP => {
  return Object.prototype.hasOwnProperty.call(REQUEST_ITEM_MAP, item);
};

const DOB_REGEX = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19\d{2}|20\d{2})$/;

export const isValidDobFormat = (value: string): boolean => DOB_REGEX.test((value || '').trim());

const parseDob = (value: string): Date | null => {
  if (!isValidDobFormat(value)) return null;
  const [mm, dd, yyyy] = value.split('/').map((part) => Number(part));
  const parsed = new Date(yyyy, mm - 1, dd);
  if (parsed.getFullYear() !== yyyy || parsed.getMonth() !== mm - 1 || parsed.getDate() !== dd) {
    return null;
  }
  return parsed;
};

export const calculateAgeFromDob = (value: string): number | null => {
  const parsed = parseDob(value);
  if (!parsed) return null;

  const today = new Date();
  let age = today.getFullYear() - parsed.getFullYear();
  const monthDelta = today.getMonth() - parsed.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < parsed.getDate())) {
    age -= 1;
  }

  if (age < 0 || age > 130) return null;
  return age;
};

export const deriveAgeGroupFromDob = (value: string): HouseholdMember['ageGroup'] | undefined => {
  const age = calculateAgeFromDob(value);
  if (age === null) return undefined;
  if (age <= 2) return 'INFANT';
  if (age <= 12) return 'CHILD';
  if (age <= 17) return 'TEEN';
  if (age >= 65) return 'SENIOR';
  return 'ADULT';
};

export const validateHouseholdMembers = (members: HouseholdMember[]): { ok: true } | { ok: false; error: string } => {
  for (let index = 0; index < (members || []).length; index += 1) {
    const member = members[index];
    const label = member?.name?.trim() || `Member ${index + 1}`;
    if (!member?.name?.trim()) {
      return { ok: false, error: `Household member ${index + 1} name is required.` };
    }
    const dob = String(member.age || '').trim();
    if (!isValidDobFormat(dob) || calculateAgeFromDob(dob) === null) {
      return { ok: false, error: `${label}: Date of birth must use MM/DD/YYYY.` };
    }
    if (typeof member.mobilityFlag !== 'boolean') {
      return { ok: false, error: `${label}: Mobility flag is required.` };
    }
    if (typeof member.medicalFlag !== 'boolean') {
      return { ok: false, error: `${label}: Medical flag is required.` };
    }
  }

  return { ok: true };
};
