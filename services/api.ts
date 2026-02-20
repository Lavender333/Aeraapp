import type { HouseholdMember, OrgInventory, UserProfile } from '../types';
import { supabase, getOrgByCode, getOrgIdByCode } from './supabase';
import { calculateAgeFromDob, isValidPhoneForInvite, normalizePhoneDigits, validateHouseholdMembers } from './validation';

const mapInventory = (row: any): OrgInventory => ({
  water: Number(row?.water || 0),
  food: Number(row?.food || 0),
  blankets: Number(row?.blankets || 0),
  medicalKits: Number(row?.medical_kits || 0),
});

const normalizeRequestStatus = (status?: string | null) => {
  if (!status) return 'PENDING';
  if (status === 'APPROVED') return 'PENDING';
  return status;
};

const getOrgCodeById = async (orgId: string): Promise<string | null> => {
  const { data, error } = await supabase
    .from('organizations')
    .select('org_code')
    .eq('id', orgId)
    .single();
  if (error || !data) return null;
  return data.org_code;
};

const safeLogActivity = async (entry: {
  action: string;
  entityType?: string;
  entityId?: string | null;
  orgCode?: string | null;
  details?: Record<string, any>;
}) => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const userId = authData?.user?.id || null;
    const orgId = entry.orgCode ? await getOrgIdByCode(entry.orgCode) : null;
    await supabase
      .from('activity_log')
      .insert({
        org_id: orgId,
        user_id: userId,
        action: entry.action,
        entity_type: entry.entityType || null,
        entity_id: entry.entityId || null,
        details: entry.details || {},
      });
  } catch (err) {
    console.warn('Activity log write failed', err);
  }
};

const getProfileById = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, role, email, phone')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data;
};

const dataUrlToBlob = async (dataUrl: string): Promise<Blob> => {
  const response = await fetch(dataUrl);
  return response.blob();
};

type KitRuleRow = {
  trigger_type: string;
  trigger_key: string;
  operator: string;
  trigger_value: string;
  kit_item_id: string;
  kit_item: string;
  category: string;
  priority: string;
  outreach_flag: string | null;
  duration_bump_days: number;
  readiness_cap: number | null;
  explanation: string | null;
};

const asBoolean = (value: any): boolean => String(value).toLowerCase() === 'true';

const evaluateRule = (rule: KitRuleRow, context: Record<string, any>) => {
  const raw = context[rule.trigger_key];
  const op = (rule.operator || 'equals').toLowerCase();
  const triggerValue = rule.trigger_value;

  if (rule.trigger_type === 'profile_flag') {
    const current = Boolean(raw);
    const expected = asBoolean(triggerValue);
    if (op === 'equals') return current === expected;
    return false;
  }

  if (rule.trigger_type === 'risk_score') {
    const current = Number(raw || 0);
    const expected = Number(triggerValue || 0);
    if (op === 'gte') return current >= expected;
    if (op === 'lte') return current <= expected;
    if (op === 'equals') return current === expected;
    return false;
  }

  if (rule.trigger_type === 'alert_context') {
    const current = String(raw || '').toLowerCase();
    const expected = String(triggerValue || '').toLowerCase();
    if (op === 'contains') return current.includes(expected);
    if (op === 'equals') return current === expected;
    return false;
  }

  return false;
};

const durationFromRisk = (risk: number) => {
  if (risk >= 8) return 10;
  if (risk >= 5) return 7;
  return 3;
};

const deriveReadinessTier = (score: number): 'LOW' | 'MEDIUM' | 'HIGH' => {
  if (score >= 80) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
};

export async function fetchKitGuidanceForCurrentUser() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const profileId = authData.user.id;

  const [{ data: vpData }, { data: readyData }, { data: ruleData }, { data: profileScope }] = await Promise.all([
    supabase
      .from('vulnerability_profiles')
      .select('organization_id, county_id, state_id, risk_score, medication_dependency, insulin_dependency, oxygen_powered_device, mobility_limitation, transportation_access, financial_strain')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase
      .from('ready_kits')
      .select('checked_ids, total_items, checked_items')
      .eq('profile_id', profileId)
      .maybeSingle(),
    supabase
      .from('kit_rules')
      .select('trigger_type, trigger_key, operator, trigger_value, kit_item_id, kit_item, category, priority, outreach_flag, duration_bump_days, readiness_cap, explanation')
      .eq('is_active', true),
    supabase
      .from('profiles')
      .select('org_id, county_id, state_id')
      .eq('id', profileId)
      .maybeSingle(),
  ]);

  const scopeStateId = vpData?.state_id || profileScope?.state_id || null;
  const scopeCountyId = vpData?.county_id || profileScope?.county_id || null;
  let activeAlertTypes: string[] = [];

  try {
    let query = supabase
      .from('alerts')
      .select('event_type, expires_at')
      .or(`expires_at.is.null,expires_at.gte.${new Date().toISOString()}`)
      .order('created_at', { ascending: false })
      .limit(100);

    if (scopeStateId) query = query.eq('state_id', scopeStateId);
    if (scopeCountyId) query = query.eq('county_id', scopeCountyId);

    const { data: alertRows } = await query;
    activeAlertTypes = (alertRows || [])
      .map((row: any) => String(row.event_type || '').toLowerCase())
      .filter(Boolean);
  } catch {
    activeAlertTypes = [];
  }

  const context: Record<string, any> = {
    risk_score: Number(vpData?.risk_score || 0),
    medication_dependency: Boolean(vpData?.medication_dependency),
    insulin_dependency: Boolean(vpData?.insulin_dependency),
    oxygen_powered_device: Boolean(vpData?.oxygen_powered_device),
    mobility_limitation: Boolean(vpData?.mobility_limitation),
    transportation_access: Boolean(vpData?.transportation_access ?? true),
    financial_strain: Boolean(vpData?.financial_strain),
    active_alert_types: activeAlertTypes.join('|'),
  };

  const rules = (ruleData || []) as KitRuleRow[];
  const matched = rules.filter((rule) => evaluateRule(rule, context));

  const checkedIds = new Set<string>((readyData?.checked_ids || []) as string[]);
  const requiredIds = new Set<string>();
  const criticalMissingItems: any[] = [];
  const addedItems = matched.map((rule) => ({
    id: rule.kit_item_id,
    item: rule.kit_item,
    category: rule.category,
    priority: rule.priority,
    explanation: rule.explanation,
  }));

  let recommendedDurationDays = durationFromRisk(Number(context.risk_score || 0));
  let readinessCap = 100;
  const outreachFlags = new Set<string>();

  for (const rule of matched) {
    if (rule.duration_bump_days && Number(rule.duration_bump_days) > 0) {
      recommendedDurationDays += Number(rule.duration_bump_days);
    }

    if (String(rule.priority).toLowerCase() === 'critical') {
      requiredIds.add(rule.kit_item_id);
      if (!checkedIds.has(rule.kit_item_id)) {
        criticalMissingItems.push({
          id: rule.kit_item_id,
          item: rule.kit_item,
          explanation: rule.explanation,
        });
        readinessCap = Math.min(readinessCap, Number(rule.readiness_cap || 70));
        if (rule.outreach_flag) outreachFlags.add(rule.outreach_flag);
      }
    }
  }

  const totalItems = Math.max(1, Number(readyData?.total_items || 0));
  const checkedItems = Math.max(0, Number(readyData?.checked_items || 0));
  const baseCompletionPct = Number(((checkedItems / totalItems) * 100).toFixed(2));
  const readinessScore = Number(Math.min(baseCompletionPct, readinessCap).toFixed(2));

  const riskTier = context.risk_score >= 8 ? 'HIGH' : context.risk_score >= 5 ? 'ELEVATED' : 'STANDARD';

  const payload = {
    profile_id: profileId,
    organization_id: vpData?.organization_id || profileScope?.org_id || null,
    county_id: vpData?.county_id || profileScope?.county_id || null,
    state_id: vpData?.state_id || profileScope?.state_id || null,
    risk_score: Number(context.risk_score || 0),
    recommended_duration_days: recommendedDurationDays,
    required_item_ids: Array.from(requiredIds),
    added_items: addedItems,
    critical_missing_items: criticalMissingItems,
    outreach_flags: Array.from(outreachFlags),
    base_completion_pct: baseCompletionPct,
    readiness_cap: readinessCap,
    readiness_score: readinessScore,
    risk_tier: riskTier,
    source_version: 'kit-rules-v1',
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('kit_recommendations')
    .upsert(payload, { onConflict: 'profile_id' });

  if (upsertError) throw upsertError;

  return payload;
}

export async function fetchOrgOutreachFlags(orgCode: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('organization_outreach_flags_view')
    .select('organization_id, state_id, county_id, outreach_flag, member_count, last_updated')
    .eq('organization_id', orgId)
    .order('member_count', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchOrgMemberPreparednessNeeds(orgCode: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data: recs, error: recError } = await supabase
    .from('kit_recommendations')
    .select('profile_id, readiness_score, readiness_cap, risk_tier, critical_missing_items, outreach_flags, updated_at')
    .eq('organization_id', orgId)
    .order('readiness_score', { ascending: true })
    .limit(100);

  if (recError) throw recError;
  if (!recs || recs.length === 0) return [];

  const profileIds = Array.from(new Set(recs.map((r: any) => r.profile_id).filter(Boolean)));
  if (profileIds.length === 0) return [];

  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, phone')
    .in('id', profileIds)
    .eq('org_id', orgId);

  if (profileError) throw profileError;

  const profileMap = new Map<string, { full_name: string | null; phone: string | null }>();
  for (const row of profiles || []) {
    profileMap.set(String((row as any).id), {
      full_name: (row as any).full_name || null,
      phone: (row as any).phone || null,
    });
  }

  return (recs || []).map((row: any) => {
    const profile = profileMap.get(String(row.profile_id));
    const criticalMissing = Array.isArray(row.critical_missing_items) ? row.critical_missing_items : [];
    const outreachFlags = Array.isArray(row.outreach_flags) ? row.outreach_flags : [];

    return {
      profile_id: String(row.profile_id),
      member_name: profile?.full_name || 'Unknown Member',
      phone: profile?.phone || null,
      readiness_score: Number(row.readiness_score || 0),
      readiness_cap: Number(row.readiness_cap || 100),
      risk_tier: String(row.risk_tier || 'STANDARD'),
      critical_missing_items: criticalMissing,
      critical_missing_count: criticalMissing.length,
      outreach_flags: outreachFlags,
      updated_at: row.updated_at || null,
    };
  });
}

export async function getOrganizationByCode(orgCode: string) {
  return getOrgByCode(orgCode);
}

export async function searchOrganizations(searchTerm: string) {
  if (!searchTerm?.trim()) return [];
  const term = `%${searchTerm.trim()}%`;
  const { data, error } = await supabase
    .from('organizations')
    .select('id, org_code, name, address')
    .or(`name.ilike.${term},org_code.ilike.${term}`)
    .order('name', { ascending: true })
    .limit(10);

  if (error) throw error;
  return data || [];
}

export async function createOrganization(payload: {
  name: string;
  type?: string | null;
  address?: string | null;
  adminContact?: string | null;
  adminPhone?: string | null;
  replenishmentEmail?: string | null;
  replenishmentPhone?: string | null;
}) {
  const { data, error } = await supabase
    .from('organizations')
    .insert({
      name: payload.name,
      type: payload.type || null,
      address: payload.address || null,
      contact_person: payload.adminContact || null,
      contact_phone: payload.adminPhone || null,
      email: payload.replenishmentEmail || null,
      phone: payload.replenishmentPhone || null,
    })
    .select('id, org_code, name')
    .single();

  if (error || !data) throw new Error('Unable to register organization');
  await safeLogActivity({
    action: 'CREATE',
    entityType: 'organizations',
    entityId: data.id,
    orgCode: data.org_code || null,
    details: { name: data.name },
  });
  return data;
}

export async function updateProfile(profile: Partial<UserProfile> & { id: string }) {
  const orgId = profile.communityId ? await getOrgIdByCode(profile.communityId) : null;

  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: profile.id,
      email: profile.email || null,
      phone: profile.phone || null,
      full_name: profile.fullName || null,
      role: profile.role || 'GENERAL_USER',
      org_id: orgId,
    });

  if (error) throw error;
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'profiles',
    entityId: profile.id,
    orgCode: profile.communityId || null,
  });
  return { ok: true };
}

export async function updateProfileForUser(payload: {
  fullName: string;
  phone: string;
  email?: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  zip?: string;
  latitude?: number;
  longitude?: number;
  googlePlaceId?: string;
  addressVerified?: boolean;
  addressVerifiedAt?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
  communityId?: string;
  role?: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const orgId = payload.communityId ? await getOrgIdByCode(payload.communityId) : null;

  const emergencyContact = {
    name: payload.emergencyContactName || null,
    phone: payload.emergencyContactPhone || null,
    relation: payload.emergencyContactRelation || null,
  };

  const profileUpdate: Record<string, any> = {
    full_name: payload.fullName || null,
    phone: payload.phone || null,
    mobile_phone: payload.phone || null,
    email: payload.email || null,
    role: payload.role || undefined,
    org_id: orgId,
    home_address: payload.address || null,
    emergency_contact: emergencyContact,
  };

  if (Object.prototype.hasOwnProperty.call(payload, 'addressLine1')) {
    profileUpdate.address_line_1 = payload.addressLine1 || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'addressLine2')) {
    profileUpdate.address_line_2 = payload.addressLine2 || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'city')) {
    profileUpdate.city = payload.city || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'state')) {
    profileUpdate.state = payload.state || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'zip')) {
    profileUpdate.zip = payload.zip || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'latitude')) {
    profileUpdate.latitude = Number.isFinite(payload.latitude as number) ? payload.latitude : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'longitude')) {
    profileUpdate.longitude = Number.isFinite(payload.longitude as number) ? payload.longitude : null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'googlePlaceId')) {
    profileUpdate.google_place_id = payload.googlePlaceId || null;
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'addressVerified')) {
    profileUpdate.address_verified = Boolean(payload.addressVerified);
  }
  if (Object.prototype.hasOwnProperty.call(payload, 'addressVerifiedAt')) {
    profileUpdate.address_verified_at = payload.addressVerifiedAt || null;
  }

  const { error } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', authData.user.id);

  if (error) throw error;
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'profiles',
    entityId: authData.user.id,
    orgCode: payload.communityId || null,
  });
  return { ok: true };
}

export type HouseholdSummary = {
  householdId: string;
  householdCode: string;
  householdName: string;
  householdRole: 'OWNER' | 'MEMBER';
  memberCount: number;
};

export type HouseholdOption = {
  householdId: string;
  householdCode: string;
  householdName: string;
  householdRole: 'OWNER' | 'MEMBER';
};

export type HouseholdInvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export type HouseholdInvitationRecord = {
  id: string;
  householdId: string;
  inviterProfileId: string;
  inviteeMemberRef?: string;
  inviteeName?: string;
  inviteePhone?: string;
  invitationCode: string;
  status: HouseholdInvitationStatus;
  acceptedByProfileId?: string;
  acceptedAt?: string;
  expiresAt?: string;
  createdAt: string;
};

export type HouseholdJoinRequestStatus = 'pending' | 'approved' | 'rejected';

export type HouseholdJoinRequestRecord = {
  id: string;
  householdId: string;
  requestingUserId: string;
  requestingUserName?: string;
  requestingUserPhone?: string;
  requestingUserEmail?: string;
  status: HouseholdJoinRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
};

export type AppNotificationRecord = {
  id: string;
  userId: string;
  type: string;
  relatedId?: string;
  read: boolean;
  createdAt: string;
  metadata?: Record<string, any>;
};

export type HouseholdJoinResolutionAction = 'approved' | 'rejected';

const mapJoinRequestRecord = (
  row: any,
  profileLookup: Map<string, { full_name?: string | null; phone?: string | null; email?: string | null }>
): HouseholdJoinRequestRecord => {
  const requester = profileLookup.get(String(row.requesting_user_id));
  return {
    id: row.id,
    householdId: row.household_id,
    requestingUserId: row.requesting_user_id,
    requestingUserName: requester?.full_name || undefined,
    requestingUserPhone: requester?.phone || undefined,
    requestingUserEmail: requester?.email || undefined,
    status: String(row.status || 'pending').toLowerCase() as HouseholdJoinRequestStatus,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at || undefined,
    resolvedBy: row.resolved_by || undefined,
  };
};

const mapNotificationRecord = (row: any): AppNotificationRecord => ({
  id: row.id,
  userId: row.user_id,
  type: row.type,
  relatedId: row.related_id || undefined,
  read: Boolean(row.read),
  createdAt: row.created_at,
  metadata: row.metadata || {},
});

const normalizeHouseholdCode = (code: string) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 6);

const normalizeInvitationCode = (code: string) =>
  String(code || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 24);

const normalizeInvitePhone = (phone: string) => {
  const digits = normalizePhoneDigits(phone || '');
  if (!digits) return '';
  return digits.length > 10 ? digits : digits.slice(-10);
};

const phonesMatchForInvite = (invitePhone: string, userPhone: string) => {
  const left = normalizeInvitePhone(invitePhone);
  const right = normalizeInvitePhone(userPhone);
  if (!left || !right) return false;
  if (left === right) return true;
  return left.slice(-10) === right.slice(-10);
};

const mapInvitationRecord = (row: any): HouseholdInvitationRecord => ({
  id: row.id,
  householdId: row.household_id,
  inviterProfileId: row.inviter_profile_id,
  inviteeMemberRef: row.invitee_member_ref || undefined,
  inviteeName: row.invitee_name || undefined,
  inviteePhone: row.invitee_phone || undefined,
  invitationCode: row.invitation_code,
  status: String(row.status || 'PENDING').toUpperCase() as HouseholdInvitationStatus,
  acceptedByProfileId: row.accepted_by_profile_id || undefined,
  acceptedAt: row.accepted_at || undefined,
  expiresAt: row.expires_at || undefined,
  createdAt: row.created_at,
});

const getCurrentHouseholdMembership = async (profileId: string) => {
  const { data: membership, error: membershipError } = await supabase
    .from('household_memberships')
    .select('household_id, role')
    .eq('profile_id', profileId)
    .maybeSingle();

  if (membershipError) throw membershipError;
  return membership as { household_id: string; role: 'OWNER' | 'MEMBER' } | null;
};

const getHouseholdSummaryForMembership = async (membership: {
  household_id: string;
  role: 'OWNER' | 'MEMBER';
}): Promise<HouseholdSummary> => {
  const { data: household, error: householdError } = await supabase
    .from('households')
    .select('id, household_code, home_name')
    .eq('id', membership.household_id)
    .single();

  if (householdError || !household) {
    throw householdError || new Error('Household not found');
  }

  const { count } = await supabase
    .from('household_memberships')
    .select('profile_id', { count: 'exact', head: true })
    .eq('household_id', membership.household_id);

  return {
    householdId: household.id,
    householdCode: household.household_code,
    householdName: household.home_name || 'Your Home',
    householdRole: membership.role,
    memberCount: Number(count || 1),
  };
};

export async function fetchHouseholdForCurrentUser(): Promise<HouseholdSummary | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const membership = await getCurrentHouseholdMembership(authData.user.id);
  if (!membership) return null;

  return getHouseholdSummaryForMembership(membership as { household_id: string; role: 'OWNER' | 'MEMBER' });
}

export async function listHouseholdInvitationsForCurrentUser(): Promise<HouseholdInvitationRecord[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const membership = await getCurrentHouseholdMembership(authData.user.id);
  if (!membership?.household_id) return [];

  const { data, error } = await supabase
    .from('household_invitations')
    .select('id, household_id, inviter_profile_id, invitee_member_ref, invitee_name, invitee_phone, invitation_code, status, accepted_by_profile_id, accepted_at, expires_at, created_at')
    .eq('household_id', membership.household_id)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;

  const rows = data || [];
  const now = Date.now();
  const expiredIds = rows
    .filter((row: any) => row.status === 'PENDING' && row.expires_at && Date.parse(row.expires_at) <= now)
    .map((row: any) => row.id);

  if (expiredIds.length > 0) {
    await supabase
      .from('household_invitations')
      .update({ status: 'EXPIRED' })
      .in('id', expiredIds);
  }

  return rows.map((row: any) => {
    if (expiredIds.includes(row.id)) {
      return mapInvitationRecord({ ...row, status: 'EXPIRED' });
    }
    return mapInvitationRecord(row);
  });
}

export async function createHouseholdInvitationForMember(payload: {
  memberId: string;
  memberName: string;
  inviteePhone: string;
  suggestedCode?: string;
  expiresInDays?: number;
  forceNew?: boolean;
}): Promise<HouseholdInvitationRecord> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');
  const userId = authData.user.id;

  const membership = await getCurrentHouseholdMembership(userId);
  if (!membership?.household_id) throw new Error('Join or create a household first.');
  if (membership.role !== 'OWNER') throw new Error('Only household owners can create member invites.');

  if (!isValidPhoneForInvite(payload.inviteePhone || '')) {
    throw new Error('A valid member phone is required to create an account invite.');
  }
  const normalizedInvitePhone = normalizeInvitePhone(payload.inviteePhone);

  const { data: existingPending } = await supabase
    .from('household_invitations')
    .select('id, household_id, inviter_profile_id, invitee_member_ref, invitee_name, invitee_phone, invitation_code, status, accepted_by_profile_id, accepted_at, expires_at, created_at')
    .eq('household_id', membership.household_id)
    .eq('invitee_member_ref', payload.memberId)
    .eq('status', 'PENDING')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingPendingPhone = normalizeInvitePhone((existingPending as any)?.invitee_phone || '');

  if (existingPending && !payload.forceNew && existingPendingPhone === normalizedInvitePhone) {
    const existingExpiresAt = existingPending.expires_at ? Date.parse(existingPending.expires_at) : 0;
    if (!existingExpiresAt || existingExpiresAt > Date.now()) {
      return mapInvitationRecord(existingPending);
    }
  }

  if (existingPending && (payload.forceNew || existingPendingPhone !== normalizedInvitePhone)) {
    await supabase
      .from('household_invitations')
      .update({ status: 'REVOKED' })
      .eq('id', existingPending.id)
      .eq('status', 'PENDING');
  }

  const household = await getHouseholdSummaryForMembership(membership);
  const normalizedSuggested = normalizeInvitationCode(payload.suggestedCode || '');
  const nameSeed = String(payload.memberName || '')
    .replace(/[^A-Z0-9]/gi, '')
    .toUpperCase()
    .slice(0, 3)
    .padEnd(3, 'X');

  const makeCandidate = (suffix: string) => normalizeInvitationCode(`${household.householdCode}-${suffix}`);
  let invitationCode = normalizedSuggested || makeCandidate(nameSeed);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { data: existingCode } = await supabase
      .from('household_invitations')
      .select('id')
      .eq('invitation_code', invitationCode)
      .maybeSingle();

    if (!existingCode) break;

    const randomSuffix = Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(2, 5).padEnd(3, 'X');
    invitationCode = makeCandidate(randomSuffix);
  }

  const expiresInDays = Math.max(1, Number(payload.expiresInDays || 14));
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: created, error } = await supabase
    .from('household_invitations')
    .insert({
      household_id: membership.household_id,
      inviter_profile_id: userId,
      invitee_member_ref: payload.memberId,
      invitee_name: payload.memberName || null,
      invitee_phone: normalizedInvitePhone,
      invitation_code: invitationCode,
      status: 'PENDING',
      expires_at: expiresAt,
    })
    .select('id, household_id, inviter_profile_id, invitee_member_ref, invitee_name, invitee_phone, invitation_code, status, accepted_by_profile_id, accepted_at, expires_at, created_at')
    .single();

  if (error || !created) throw error || new Error('Unable to create invitation.');

  await safeLogActivity({
    action: 'CREATE',
    entityType: 'household_invitations',
    entityId: created.id,
    details: { householdId: membership.household_id, invitationCode },
  });

  return mapInvitationRecord(created);
}

export async function revokeHouseholdInvitationForCurrentUser(invitationId: string): Promise<{ ok: true }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const membership = await getCurrentHouseholdMembership(authData.user.id);
  if (!membership?.household_id) throw new Error('Household not found.');
  if (membership.role !== 'OWNER') throw new Error('Only household owners can revoke invites.');

  const { data: invite, error: inviteError } = await supabase
    .from('household_invitations')
    .select('id, household_id, status')
    .eq('id', invitationId)
    .maybeSingle();

  if (inviteError) throw inviteError;
  if (!invite || invite.household_id !== membership.household_id) {
    throw new Error('Invitation not found.');
  }
  if (invite.status !== 'PENDING') {
    throw new Error('Only pending invitations can be revoked.');
  }

  const { error } = await supabase
    .from('household_invitations')
    .update({ status: 'REVOKED' })
    .eq('id', invitationId)
    .eq('status', 'PENDING');

  if (error) throw error;

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'household_invitations',
    entityId: invitationId,
    details: { status: 'REVOKED' },
  });

  return { ok: true };
}

export async function ensureHouseholdForCurrentUser(): Promise<HouseholdSummary> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const existing = await fetchHouseholdForCurrentUser();
  if (existing) return existing;

  const userId = authData.user.id;

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: userId,
        email: authData.user.email || null,
      },
      { onConflict: 'id' }
    );

  if (profileError) throw profileError;

  const { data: household, error: householdError } = await supabase
    .from('households')
    .insert({
      owner_profile_id: userId,
      home_name: 'Your Home',
    })
    .select('id, household_code, home_name')
    .single();

  if (householdError || !household) throw householdError || new Error('Unable to create household');

  const { error: membershipError } = await supabase
    .from('household_memberships')
    .insert({
      household_id: household.id,
      profile_id: userId,
      role: 'OWNER',
    });

  if (membershipError) throw membershipError;

  await safeLogActivity({
    action: 'CREATE',
    entityType: 'households',
    entityId: household.id,
    details: { householdCode: household.household_code },
  });

  return {
    householdId: household.id,
    householdCode: household.household_code,
    householdName: household.home_name || 'Your Home',
    householdRole: 'OWNER',
    memberCount: 1,
  };
}

export async function joinHouseholdByCode(code: string): Promise<HouseholdSummary> {
  const normalizedCode = normalizeHouseholdCode(code);
  const normalizedInviteCode = normalizeInvitationCode(code);
  const couldBeInvite = normalizedInviteCode.includes('-') || normalizedInviteCode.length > 6;
  if ((!normalizedCode || normalizedCode.length < 6) && !couldBeInvite) {
    throw new Error('Enter a valid household or invite code.');
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');
  const userId = authData.user.id;

  let target: { id: string; household_code: string; home_name: string | null } | null = null;
  let usedInvitationId: string | null = null;
  let usedInvitationCode: string | null = null;

  if (couldBeInvite) {
    const { data: inviteRow } = await supabase
      .from('household_invitations')
      .select('id, household_id, invitation_code, invitee_phone, status, expires_at')
      .eq('invitation_code', normalizedInviteCode)
      .maybeSingle();

    if (inviteRow) {
      if (inviteRow.status !== 'PENDING') {
        throw new Error('This invitation is no longer active.');
      }

      if (inviteRow.expires_at && Date.parse(inviteRow.expires_at) <= Date.now()) {
        await supabase
          .from('household_invitations')
          .update({ status: 'EXPIRED' })
          .eq('id', inviteRow.id);
        throw new Error('This invitation code has expired.');
      }

      if (inviteRow.invitee_phone) {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('phone')
          .eq('id', userId)
          .maybeSingle();

        const authPhone = authData.user.phone || '';
        const profilePhone = (profileRow as any)?.phone || '';
        if (!phonesMatchForInvite(inviteRow.invitee_phone, profilePhone) && !phonesMatchForInvite(inviteRow.invitee_phone, authPhone)) {
          throw new Error('This invite is tied to a different phone number. Sign in with the invited account phone.');
        }
      }

      const { data: inviteHousehold } = await supabase
        .from('households')
        .select('id, household_code, home_name')
        .eq('id', inviteRow.household_id)
        .maybeSingle();

      if (!inviteHousehold) {
        throw new Error('Invitation household was not found.');
      }

      target = inviteHousehold;
      usedInvitationId = inviteRow.id;
      usedInvitationCode = inviteRow.invitation_code;
    }
  }

  if (!target) {
    const { data, error: targetError } = await supabase
      .from('households')
      .select('id, household_code, home_name')
      .eq('household_code', normalizedCode)
      .single();

    if (targetError || !data) {
      throw new Error('Household code not found.');
    }
    target = data;
  }

  const currentMembership = await getCurrentHouseholdMembership(userId);

  if (currentMembership?.household_id === target.id) {
    if (usedInvitationId) {
      await supabase
        .from('household_invitations')
        .update({
          status: 'ACCEPTED',
          accepted_by_profile_id: userId,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', usedInvitationId)
        .eq('status', 'PENDING');
    }

    return getHouseholdSummaryForMembership({
      household_id: target.id,
      role: (currentMembership.role as 'OWNER' | 'MEMBER') || 'MEMBER',
    });
  }

  if (currentMembership?.household_id) {
    const { data: leaveData, error: leaveError } = await supabase.rpc('leave_household', {
      p_household_id: currentMembership.household_id,
      p_profile_id: userId,
    });
    if (leaveError) throw leaveError;
    if (leaveData && typeof leaveData === 'object' && leaveData.success === false) {
      throw new Error(leaveData.error || 'Unable to leave existing household.');
    }
  }

  const { error: joinError } = await supabase
    .from('household_memberships')
    .insert({
      household_id: target.id,
      profile_id: userId,
      role: 'MEMBER',
    });

  if (joinError) throw joinError;

  if (usedInvitationId) {
    await supabase
      .from('household_invitations')
      .update({
        status: 'ACCEPTED',
        accepted_by_profile_id: userId,
        accepted_at: new Date().toISOString(),
      })
      .eq('id', usedInvitationId)
      .eq('status', 'PENDING');
  }

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'household_memberships',
    entityId: target.id,
    details: { joinedBy: userId, householdCode: target.household_code, invitationCode: usedInvitationCode },
  });

  return getHouseholdSummaryForMembership({ household_id: target.id, role: 'MEMBER' });
}

export async function requestHouseholdJoinByCode(code: string): Promise<{
  joinRequestId: string;
  householdId: string;
  status: HouseholdJoinRequestStatus;
  message: string;
}> {
  const normalized = normalizeHouseholdCode(code);
  if (!normalized || normalized.length < 6) {
    throw new Error('Enter a valid household code.');
  }

  const { data, error } = await supabase.rpc('request_household_join_by_code', {
    p_household_code: normalized,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.join_request_id) throw new Error('Unable to create household join request.');

  return {
    joinRequestId: row.join_request_id,
    householdId: row.household_id,
    status: String(row.status || 'pending').toLowerCase() as HouseholdJoinRequestStatus,
    message: String(row.message || 'Request sent. Waiting for approval.'),
  };
}

export async function listMyHouseholdJoinRequests(limit = 20): Promise<HouseholdJoinRequestRecord[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('household_join_requests')
    .select('id, household_id, requesting_user_id, status, created_at, resolved_at, resolved_by')
    .eq('requesting_user_id', authData.user.id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const profileLookup = new Map<string, { full_name?: string | null; phone?: string | null; email?: string | null }>();
  return (data || []).map((row: any) => mapJoinRequestRecord(row, profileLookup));
}

export async function listHouseholdJoinRequestsForOwner(limit = 50): Promise<HouseholdJoinRequestRecord[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const membership = await getCurrentHouseholdMembership(authData.user.id);
  if (!membership?.household_id || membership.role !== 'OWNER') return [];

  const { data, error } = await supabase
    .from('household_join_requests')
    .select('id, household_id, requesting_user_id, status, created_at, resolved_at, resolved_by')
    .eq('household_id', membership.household_id)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  const requesterIds = Array.from(new Set((data || []).map((row: any) => String(row.requesting_user_id)).filter(Boolean)));
  const profileLookup = new Map<string, { full_name?: string | null; phone?: string | null; email?: string | null }>();

  if (requesterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, phone, email')
      .in('id', requesterIds);

    for (const profile of profiles || []) {
      profileLookup.set(String((profile as any).id), {
        full_name: (profile as any).full_name,
        phone: (profile as any).phone,
        email: (profile as any).email,
      });
    }
  }

  return (data || []).map((row: any) => mapJoinRequestRecord(row, profileLookup));
}

export async function resolveHouseholdJoinRequest(
  joinRequestId: string,
  action: HouseholdJoinResolutionAction,
): Promise<{ joinRequestId: string; status: HouseholdJoinRequestStatus }> {
  const normalizedAction = action === 'rejected' ? 'rejected' : 'approved';

  const { data, error } = await supabase.functions.invoke('approve-household-join', {
    body: {
      join_request_id: joinRequestId,
      action: normalizedAction,
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to resolve household join request.');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Unable to resolve household join request.');
  }

  return {
    joinRequestId,
    status: normalizedAction,
  };
}

export async function listHouseholdsForCurrentUser(): Promise<HouseholdOption[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data: memberships, error: membershipsError } = await supabase
    .from('household_memberships')
    .select('household_id, role')
    .eq('profile_id', authData.user.id);

  if (membershipsError) throw membershipsError;
  if (!memberships?.length) return [];

  const householdIds = Array.from(new Set(memberships.map((row: any) => row.household_id).filter(Boolean)));
  if (householdIds.length === 0) return [];

  const { data: households, error: householdsError } = await supabase
    .from('households')
    .select('id, household_code, home_name')
    .in('id', householdIds);

  if (householdsError) throw householdsError;

  const householdMap = new Map<string, any>((households || []).map((household: any) => [String(household.id), household]));

  return memberships
    .map((membership: any) => {
      const household = householdMap.get(String(membership.household_id));
      if (!household) return null;
      return {
        householdId: String(household.id),
        householdCode: String(household.household_code || ''),
        householdName: String(household.home_name || 'Your Home'),
        householdRole: (String(membership.role || 'MEMBER').toUpperCase() === 'OWNER' ? 'OWNER' : 'MEMBER') as 'OWNER' | 'MEMBER',
      };
    })
    .filter(Boolean) as HouseholdOption[];
}

export async function switchActiveHousehold(householdId: string): Promise<{ activeHouseholdId: string }> {
  const { data, error } = await supabase.rpc('switch_active_household', {
    p_household_id: householdId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.active_household_id && !row?.activeHouseholdId) {
    return { activeHouseholdId: householdId };
  }

  return {
    activeHouseholdId: String(row.active_household_id || row.activeHouseholdId || householdId),
  };
}

export async function transferHouseholdOwnership(householdId: string, newOwnerId: string): Promise<{ success: true }> {
  const { data, error } = await supabase.functions.invoke('transfer-household-ownership', {
    body: {
      household_id: householdId,
      new_owner_id: newOwnerId,
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to transfer ownership.');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Unable to transfer ownership.');
  }

  return { success: true };
}

export async function leaveCurrentHousehold(householdId?: string): Promise<{ success: true }> {
  const { data, error } = await supabase.functions.invoke('leave-household', {
    body: {
      household_id: householdId || null,
    },
  });

  if (error) {
    throw new Error(error.message || 'Unable to leave household.');
  }

  if (!data?.success) {
    throw new Error(data?.error || 'Unable to leave household.');
  }

  return { success: true };
}

export async function listNotificationsForCurrentUser(limit = 50): Promise<AppNotificationRecord[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('id, user_id, type, related_id, metadata, read, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapNotificationRecord);
}

export async function markNotificationRead(notificationId: string): Promise<{ ok: true }> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) throw error;
  return { ok: true };
}

export async function createHouseholdSafetyNotificationsForCurrentUser(payload: {
  status: 'SAFE' | 'DANGER';
  requestId?: string;
  location?: string;
  emergencyType?: string;
}): Promise<{ count: number }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const userId = authData.user.id;
  const membership = await getCurrentHouseholdMembership(userId);
  if (!membership?.household_id) return { count: 0 };

  const [{ data: profile }, { data: householdMembers }, { data: acceptedInvite }] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('household_memberships')
      .select('profile_id')
      .eq('household_id', membership.household_id),
    supabase
      .from('household_invitations')
      .select('invitee_member_ref')
      .eq('household_id', membership.household_id)
      .eq('accepted_by_profile_id', userId)
      .eq('status', 'ACCEPTED')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const reporterName = String((profile as any)?.full_name || 'Household member');
  const memberRef = String((acceptedInvite as any)?.invitee_member_ref || '');

  const recipientIds = Array.from(new Set((householdMembers || [])
    .map((row: any) => String(row.profile_id || ''))
    .filter((id: string) => Boolean(id) && id !== userId)));

  if (recipientIds.length === 0) return { count: 0 };

  const notificationType = payload.status === 'DANGER'
    ? 'household_member_reported_danger'
    : 'household_member_reported_safe';

  const metadata = {
    householdId: membership.household_id,
    reporterId: userId,
    reporterName,
    status: payload.status,
    emergencyType: payload.emergencyType || null,
    location: payload.location || null,
    requestId: payload.requestId || null,
    memberRef: memberRef || null,
    createdAt: new Date().toISOString(),
  };

  const rows = recipientIds.map((recipientId) => ({
    user_id: recipientId,
    type: notificationType,
    related_id: payload.requestId || null,
    metadata,
    read: false,
  }));

  const { error } = await supabase
    .from('notifications')
    .insert(rows);

  if (error) throw error;
  return { count: rows.length };
}

export async function listRecentHouseholdModelEvents(limit = 50) {
  const { data, error } = await supabase
    .from('household_model_events')
    .select('id, household_id, event_type, payload, created_at, processed_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
}

export async function updateVitalsForUser(payload: {
  household: UserProfile['household'];
  householdMembers: number;
  petDetails: string;
  medicalNeeds: string;
  zipCode?: string;
  medicationDependency?: boolean;
  insulinDependency?: boolean;
  oxygenPoweredDevice?: boolean;
  mobilityLimitation?: boolean;
  transportationAccess?: boolean;
  financialStrain?: boolean;
  consentPreparednessPlanning?: boolean;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const memberValidation = validateHouseholdMembers(payload.household || []);
  if (!memberValidation.ok) {
    throw new Error(memberValidation.error);
  }

  if (!payload.consentPreparednessPlanning) {
    throw new Error('Consent is required for Vital Intake data.');
  }

  // Ensure profile exists before vitals upsert (FK constraint)
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email: authData.user.email || null,
    }, { onConflict: 'id' });

  if (profileError) throw profileError;

  const { error } = await supabase
    .from('vitals')
    .upsert({
      profile_id: authData.user.id,
      medical_needs: payload.medicalNeeds || null,
      household: payload.household || [],
      pet_details: payload.petDetails || null,
      household_size: Math.max(1, Number(payload.householdMembers) || (payload.household || []).length || 1),
      medication_dependency: Boolean(payload.medicationDependency),
      insulin_dependency: Boolean(payload.insulinDependency),
      oxygen_powered_device: Boolean(payload.oxygenPoweredDevice),
      mobility_limitation: Boolean(payload.mobilityLimitation),
      transportation_access: Boolean(payload.transportationAccess),
      financial_strain: Boolean(payload.financialStrain),
      zip_code: payload.zipCode || null,
      consent_preparedness_planning: true,
      consent_timestamp: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

  if (error) throw error;

  const profile = await getProfileById(authData.user.id);
  const householdSize = Math.max(1, Number(payload.householdMembers) || (payload.household || []).length || 1);

  const { error: vpError } = await supabase
    .from('vulnerability_profiles')
    .upsert({
      profile_id: authData.user.id,
      organization_id: profile?.org_id || null,
      county_id: null,
      state_id: null,
      household_size: householdSize,
      medication_dependency: Boolean(payload.medicationDependency),
      insulin_dependency: Boolean(payload.insulinDependency),
      oxygen_powered_device: Boolean(payload.oxygenPoweredDevice),
      mobility_limitation: Boolean(payload.mobilityLimitation),
      transportation_access: Boolean(payload.transportationAccess),
      financial_strain: Boolean(payload.financialStrain),
      zip_code: payload.zipCode || null,
      consent_preparedness_planning: true,
      consent_timestamp: new Date().toISOString(),
      intake_source: 'settings_vital_intake',
      intake_version: 'v2-state-ready',
      updated_by: authData.user.id,
    }, { onConflict: 'profile_id' });

  if (vpError) {
    throw vpError;
  }

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'vitals',
    entityId: authData.user.id,
  });
  return { ok: true };
}

export async function syncHouseholdMembersForUser(household: HouseholdMember[]) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const memberValidation = validateHouseholdMembers(household || []);
  if (!memberValidation.ok) {
    throw new Error(memberValidation.error);
  }

  const profileId = authData.user.id;

  const { error: deleteError } = await supabase
    .from('household_members')
    .delete()
    .eq('profile_id', profileId);

  if (deleteError) throw deleteError;

  const rows = (household || []).map((member) => ({
    profile_id: profileId,
    name: member.name,
    relationship: null,
    age: calculateAgeFromDob(String(member.age || '')),
    date_of_birth: String(member.age || '').trim() || null,
    age_group: member.ageGroup || null,
    mobility_flag: Boolean(member.mobilityFlag),
    medical_flag: Boolean(member.medicalFlag),
    login_enabled: Boolean(member.loginEnabled),
    special_needs: member.needs || null,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('household_members')
      .insert(rows);
    if (insertError) throw insertError;
  }

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'household_members',
    entityId: profileId,
    details: { count: rows.length },
  });

  return { ok: true };
}

export async function syncPetsForUser(petDetails: string) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const profileId = authData.user.id;

  const { error: deleteError } = await supabase
    .from('pets')
    .delete()
    .eq('profile_id', profileId);

  if (deleteError) throw deleteError;

  const raw = (petDetails || '').trim();
  const parts = raw
    ? raw.split(/[,;]+/).map((item) => item.trim()).filter(Boolean)
    : [];

  const rows = parts.map((entry) => ({
    profile_id: profileId,
    name: entry.slice(0, 255),
    type: null,
    medical_needs: null,
  }));

  if (rows.length > 0) {
    const { error: insertError } = await supabase
      .from('pets')
      .insert(rows);
    if (insertError) throw insertError;
  }

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'pets',
    entityId: profileId,
    details: { count: rows.length },
  });

  return { ok: true };
}

export async function saveReadyKit(payload: {
  checkedIds: string[];
  totalItems: number;
  checkedItems: number;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('ready_kits')
    .upsert({
      profile_id: authData.user.id,
      checked_ids: payload.checkedIds || [],
      total_items: payload.totalItems || 0,
      checked_items: payload.checkedItems || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'profile_id' });

  if (error) throw error;

  try {
    let membership = await getCurrentHouseholdMembership(authData.user.id);
    if (!membership) {
      await ensureHouseholdForCurrentUser();
      membership = await getCurrentHouseholdMembership(authData.user.id);
    }

    if (membership?.household_id) {
      const safeTotal = Math.max(0, Number(payload.totalItems) || 0);
      const safeChecked = Math.max(0, Number(payload.checkedItems) || 0);
      const readinessScore = safeTotal > 0
        ? Math.round((safeChecked / safeTotal) * 10000) / 100
        : 0;
      const nowIso = new Date().toISOString();

      await supabase
        .from('household_readiness_scores')
        .upsert({
          household_id: membership.household_id,
          readiness_score: readinessScore,
          readiness_tier: deriveReadinessTier(readinessScore),
          total_items: safeTotal,
          checked_items: safeChecked,
          recommended_duration_days: Math.max(3, Math.ceil(safeTotal / 10) || 3),
          last_assessed_at: nowIso,
          updated_at: nowIso,
        }, { onConflict: 'household_id' });

      await supabase
        .from('readiness_items')
        .update({ is_completed: false, updated_at: nowIso })
        .eq('household_id', membership.household_id)
        .eq('source', 'ready_kit');

      const checkedRows = (payload.checkedIds || [])
        .map((itemId) => String(itemId || '').trim())
        .filter(Boolean)
        .map((itemId) => ({
          household_id: membership!.household_id,
          item_id: itemId,
          item_name: itemId.replace(/[-_]/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()),
          category: null,
          quantity_target: null,
          is_completed: true,
          source: 'ready_kit',
          updated_at: nowIso,
        }));

      if (checkedRows.length > 0) {
        await supabase
          .from('readiness_items')
          .upsert(checkedRows, { onConflict: 'household_id,item_id' });
      }
    }
  } catch (readinessSyncError) {
    console.warn('Readiness domain sync skipped', readinessSyncError);
  }

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'ready_kits',
    entityId: authData.user.id,
    details: { checkedItems: payload.checkedItems, totalItems: payload.totalItems },
  });

  try {
    await fetchKitGuidanceForCurrentUser();
  } catch (err) {
    console.warn('Kit guidance recompute failed', err);
  }

  return { ok: true };
}

export async function fetchReadyKit() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('ready_kits')
    .select('checked_ids, total_items, checked_items, updated_at')
    .eq('profile_id', authData.user.id)
    .single();

  if (error) return null;
  return data;
}

export async function syncMemberDirectoryForUser(payload: {
  communityId?: string;
  fullName: string;
  phone?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');
  if (!payload.communityId) return { ok: true };

  const orgId = await getOrgIdByCode(payload.communityId);
  if (!orgId) throw new Error('Organization not found');

  const memberId = authData.user.id;

  const { error } = await supabase
    .from('members')
    .upsert({
      id: memberId,
      org_id: orgId,
      name: payload.fullName,
      status: 'UNKNOWN',
      needs: [],
      phone: payload.phone || null,
      address: payload.address || null,
      emergency_contact_name: payload.emergencyContactName || null,
      emergency_contact_phone: payload.emergencyContactPhone || null,
      emergency_contact_relation: payload.emergencyContactRelation || null,
    }, { onConflict: 'id' });

  if (error) throw error;

  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'members',
    entityId: memberId,
    orgCode: payload.communityId,
  });

  return { ok: true };
}

export async function fetchProfileForUser(): Promise<Partial<UserProfile> | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, phone, mobile_phone, email, role, org_id, home_address, address_line_1, address_line_2, city, state, zip, latitude, longitude, google_place_id, address_verified, address_verified_at, emergency_contact')
    .eq('id', authData.user.id)
    .single();

  if (error || !data) return null;

  const orgCode = data.org_id ? await getOrgCodeById(data.org_id) : null;

  return {
    fullName: data.full_name || '',
    phone: data.mobile_phone || data.phone || '',
    email: data.email || '',
    role: (data.role as UserProfile['role']) || 'GENERAL_USER',
    communityId: orgCode || '',
    address: data.home_address || '',
    addressLine1: data.address_line_1 || '',
    addressLine2: data.address_line_2 || '',
    city: data.city || '',
    state: data.state || '',
    zipCode: data.zip || '',
    latitude: Number.isFinite(data.latitude) ? Number(data.latitude) : undefined,
    longitude: Number.isFinite(data.longitude) ? Number(data.longitude) : undefined,
    googlePlaceId: data.google_place_id || '',
    addressVerified: Boolean(data.address_verified),
    addressVerifiedAt: data.address_verified_at || undefined,
    emergencyContactName: data.emergency_contact?.name || '',
    emergencyContactPhone: data.emergency_contact?.phone || '',
    emergencyContactRelation: data.emergency_contact?.relation || '',
  };
}

export async function fetchVitalsForUser(): Promise<Partial<UserProfile> | null> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('vitals')
    .select('household, pet_details, medical_needs, household_size, medication_dependency, insulin_dependency, oxygen_powered_device, mobility_limitation, transportation_access, financial_strain, zip_code, consent_preparedness_planning, consent_timestamp')
    .eq('profile_id', authData.user.id)
    .single();

  if (error || !data) return null;

  return {
    household: (data.household || []) as UserProfile['household'],
    householdMembers: Number(data.household_size || (data.household || []).length || 1),
    petDetails: data.pet_details || '',
    medicalNeeds: data.medical_needs || '',
    zipCode: data.zip_code || '',
    medicationDependency: Boolean(data.medication_dependency),
    insulinDependency: Boolean(data.insulin_dependency),
    oxygenPoweredDevice: Boolean(data.oxygen_powered_device),
    mobilityLimitation: Boolean(data.mobility_limitation),
    transportationAccess: Boolean(data.transportation_access),
    financialStrain: Boolean(data.financial_strain),
    consentPreparednessPlanning: Boolean(data.consent_preparedness_planning),
    consentTimestamp: data.consent_timestamp || undefined,
  };
}

// Inventory
export async function getInventory(orgCode: string): Promise<OrgInventory> {
  const org = await getOrgByCode(orgCode);
  if (!org) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('inventory')
    .select('water, food, blankets, medical_kits')
    .eq('org_id', org.orgId)
    .maybeSingle();

  if (error) throw new Error('Failed to load inventory');
  if (!data) return { water: 0, food: 0, blankets: 0, medicalKits: 0 };
  return mapInventory(data);
}

export async function saveInventory(orgCode: string, inventory: OrgInventory): Promise<void> {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  const { error } = await supabase
    .from('inventory')
    .upsert({
      org_id: orgId,
      water: inventory.water,
      food: inventory.food,
      blankets: inventory.blankets,
      medical_kits: inventory.medicalKits,
      last_updated_by: userId,
    }, { onConflict: 'org_id' });

  if (error) throw new Error('Failed to save inventory');
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'inventory',
    orgCode,
    details: inventory,
  });
}

// Replenishment Requests
export async function listRequests(orgCode: string) {
  const org = await getOrgByCode(orgCode);
  if (!org) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('replenishment_requests')
    .select('id, org_id, org_name, item, quantity, status, provider, created_at, delivered_quantity')
    .eq('org_id', org.orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to load requests');
  return (data || []).map((row: any) => ({
    id: row.id,
    orgId: org.orgCode,
    orgName: row.org_name || org.orgName || '',
    item: row.item,
    quantity: row.quantity,
    status: normalizeRequestStatus(row.status),
    timestamp: row.created_at,
    provider: row.provider || '',
    deliveredQuantity: row.delivered_quantity || 0,
    synced: true,
  }));
}

export async function createRequest(orgCode: string, payload: { item: string; quantity: number; provider?: string; orgName?: string }) {
  const org = await getOrgByCode(orgCode);
  if (!org) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('replenishment_requests')
    .insert({
      org_id: org.orgId,
      org_name: payload.orgName || org.orgName || '',
      item: payload.item,
      quantity: payload.quantity,
      status: 'PENDING',
      provider: payload.provider || null,
    })
    .select('id, org_id, org_name, item, quantity, status, provider, created_at, delivered_quantity')
    .single();

  if (error || !data) throw new Error('Failed to create request');
  await safeLogActivity({
    action: 'CREATE',
    entityType: 'replenishment_requests',
    entityId: data.id,
    orgCode,
    details: { item: payload.item, quantity: payload.quantity },
  });
  return {
    id: data.id,
    orgId: org.orgCode,
    orgName: data.org_name || org.orgName || '',
    item: data.item,
    quantity: data.quantity,
    status: normalizeRequestStatus(data.status),
    timestamp: data.created_at,
    provider: data.provider || '',
    deliveredQuantity: data.delivered_quantity || 0,
    synced: true,
  };
}

export async function updateRequestStatus(id: string, payload: { status: string; deliveredQuantity?: number }) {
  const normalized = normalizeRequestStatus(payload.status);
  const { data, error } = await supabase
    .from('replenishment_requests')
    .update({
      status: normalized,
      delivered_quantity: payload.deliveredQuantity ?? undefined,
    })
    .eq('id', id)
    .select('id, org_id, org_name, item, quantity, status, provider, created_at, delivered_quantity')
    .single();

  if (error || !data) throw new Error('Failed to update request');

  const orgCode = data.org_id ? await getOrgCodeById(data.org_id) : null;
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'replenishment_requests',
    entityId: data.id,
    orgCode: orgCode || null,
    details: { status: normalized, deliveredQuantity: payload.deliveredQuantity ?? null },
  });
  return {
    id: data.id,
    orgId: orgCode || '',
    orgName: data.org_name || '',
    item: data.item,
    quantity: data.quantity,
    status: normalizeRequestStatus(data.status),
    timestamp: data.created_at,
    provider: data.provider || '',
    deliveredQuantity: data.delivered_quantity || 0,
    synced: true,
  };
}

// Member Status
export async function getMemberStatus(orgCode: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('member_statuses')
    .select('member_id, name, status, last_check_in')
    .eq('org_id', orgId);

  if (error) throw new Error('Failed to load member status');

  const members = (data || []).map((row: any) => ({
    id: row.member_id,
    name: row.name,
    status: row.status || 'UNKNOWN',
    lastUpdate: row.last_check_in || '',
  }));

  const counts = members.reduce(
    (acc: { safe: number; danger: number; unknown: number }, m: any) => {
      if (m.status === 'SAFE') acc.safe += 1;
      else if (m.status === 'DANGER') acc.danger += 1;
      else acc.unknown += 1;
      return acc;
    },
    { safe: 0, danger: 0, unknown: 0 }
  );

  return { counts, members };
}

export async function setMemberStatus(orgCode: string, payload: { memberId: string; name?: string; status: 'SAFE' | 'DANGER' | 'UNKNOWN' }) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { error } = await supabase
    .from('member_statuses')
    .upsert({
      org_id: orgId,
      member_id: payload.memberId,
      name: payload.name || 'Unknown',
      status: payload.status,
      last_check_in: new Date().toISOString(),
    }, { onConflict: 'org_id,member_id' });

  if (error) throw new Error('Failed to save member status');
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'member_statuses',
    entityId: payload.memberId,
    orgCode,
    details: { status: payload.status },
  });
  return { ok: true };
}

// Broadcasts
export async function getBroadcast(orgCode: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('broadcasts')
    .select('message')
    .eq('org_id', orgId)
    .maybeSingle();

  if (error) throw new Error('Failed to load broadcast');
  return data || { message: '' };
}

export async function setBroadcast(orgCode: string, message: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data: authData } = await supabase.auth.getUser();
  const userId = authData?.user?.id || null;

  const { error } = await supabase
    .from('broadcasts')
    .upsert({
      org_id: orgId,
      message,
      posted_by: userId,
    }, { onConflict: 'org_id' });

  if (error) throw new Error('Failed to save broadcast');
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'broadcasts',
    orgCode,
  });
  return { message };
}

// Auth
export async function registerAuth(payload: { email?: string; phone?: string; password: string; fullName?: string; role?: string; orgId?: string }) {
  const { email, phone, password, fullName, role, orgId } = payload;
  const { data, error } = await supabase.auth.signUp({
    email: email || undefined,
    phone: phone || undefined,
    password,
    options: {
      data: {
        full_name: fullName || '',
        role: role || 'GENERAL_USER',
        org_code: orgId || '',
      },
    },
  });

  if (error) {
    const message = String((error as any)?.message || '').toLowerCase();
    if (message.includes('already registered') || message.includes('already been registered') || message.includes('already exists')) {
      throw new Error('That email already has an account. Log in or reset your password.');
    }
    throw error;
  }

  const userId = data.user?.id;
  let resolvedOrgId: string | null = null;
  if (orgId) resolvedOrgId = await getOrgIdByCode(orgId);

  if (userId && data.session?.access_token) {
    const { error: profileError } = await supabase.from('profiles').upsert({
      id: userId,
      email: data.user?.email || email || null,
      phone: phone || null,
      full_name: fullName || null,
      role: role || 'GENERAL_USER',
      org_id: resolvedOrgId,
    });

    if (profileError) {
      const profileMessage = String((profileError as any)?.message || '').toLowerCase();
      if (profileMessage.includes('profiles_email_key') || profileMessage.includes('duplicate key')) {
        throw new Error('That email already has an account. Log in or reset your password.');
      }
      throw profileError;
    }
  }

  return {
    token: data.session?.access_token || null,
    refreshToken: data.session?.refresh_token || null,
    needsEmailConfirm: !data.session?.access_token,
    user: {
      id: userId,
      email: data.user?.email || email || '',
      phone: phone || '',
      fullName: fullName || '',
      role: role || 'GENERAL_USER',
      orgId: orgId || '',
    },
  };
}

export async function loginAuth(payload: { email?: string; phone?: string; password: string }) {
  if (!payload.email && !payload.phone) throw new Error('Email or phone required');

  const { data, error } = await supabase.auth.signInWithPassword({
    email: payload.email || undefined,
    password: payload.password,
  });

  if (error) throw error;

  const userId = data.user?.id || '';
  const profile = userId ? await getProfileById(userId) : null;
  const orgCode = profile?.org_id ? await getOrgCodeById(profile.org_id) : null;

  return {
    token: data.session?.access_token || null,
    refreshToken: data.session?.refresh_token || null,
    user: {
      id: userId,
      email: data.user?.email || payload.email || '',
      phone: profile?.phone || '',
      fullName: profile?.full_name || '',
      role: profile?.role || 'GENERAL_USER',
      orgId: orgCode || '',
    },
  };
}

export async function forgotPassword(payload: { email: string }) {
  const redirectTo = typeof window !== 'undefined'
    ? `${window.location.origin}/reset-password`
    : undefined;

  const { error } = await supabase.auth.resetPasswordForEmail(payload.email, {
    redirectTo,
  });
  if (error) throw error;
  return { ok: true };
}

export async function resetPassword(payload: { email: string; token: string; newPassword: string }) {
  if (payload.token) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      type: 'recovery',
      token: payload.token,
      email: payload.email,
    });
    if (verifyError) throw verifyError;
  }

  const { error } = await supabase.auth.updateUser({
    password: payload.newPassword,
  });
  if (error) throw error;
  return { ok: true };
}

export async function notifyEmergencyContact(payload: {
  contactName?: string;
  contactPhone?: string;
  userName?: string;
  emergencyType?: string;
  description?: string;
  location?: string;
  requestId?: string;
}) {
  const { data, error } = await supabase.functions.invoke('notify-emergency-contact', {
    body: payload,
  });
  if (error) throw error;
  return data;
}

// Damage Assessments
export async function submitDamageAssessment(payload: {
  damageType: string;
  severity: number;
  description: string;
  imageDataUrl?: string | null;
}) {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const profile = await getProfileById(authData.user.id);
  const orgId = profile?.org_id || null;

  let photoPath: string | null = null;

  if (payload.imageDataUrl) {
    const blob = await dataUrlToBlob(payload.imageDataUrl);
    const path = `${authData.user.id}/${Date.now()}.jpg`;
    const { error: uploadError } = await supabase
      .storage
      .from('assessment_photos')
      .upload(path, blob, { contentType: 'image/jpeg' });

    if (uploadError) throw uploadError;
    photoPath = path;
  }

  const { data, error } = await supabase
    .from('damage_assessments')
    .insert({
      profile_id: authData.user.id,
      org_id: orgId,
      damage_type: payload.damageType,
      severity: payload.severity,
      description: payload.description || null,
      photo_path: photoPath,
    })
    .select('id, photo_path')
    .single();

  if (error || !data) throw new Error('Failed to submit assessment');
  await safeLogActivity({
    action: 'CREATE',
    entityType: 'damage_assessments',
    entityId: data.id,
    details: { damageType: payload.damageType, severity: payload.severity },
  });
  return data;
}

export async function getAssessmentPhotoSignedUrl(path: string, expiresInSeconds = 3600) {
  const { data, error } = await supabase
    .storage
    .from('assessment_photos')
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) throw new Error('Failed to create signed URL');
  return data.signedUrl;
}

export type DamageAssessmentResult = {
  id: string;
  profileId: string;
  orgId: string | null;
  orgName: string | null;
  orgCode: string | null;
  reporterName: string;
  reporterEmail: string | null;
  reporterPhone: string | null;
  damageType: string;
  severity: number;
  description: string | null;
  photoPath: string | null;
  location: string | null;
  createdAt: string;
};

export async function listDamageAssessmentsForCurrentUser(limit = 75): Promise<DamageAssessmentResult[]> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const profile = await getProfileById(authData.user.id);
  const role = String(profile?.role || 'GENERAL_USER').toUpperCase();

  const canViewAll = role === 'ADMIN' || role === 'STATE_ADMIN' || role === 'COUNTY_ADMIN';
  const canViewOrg = role === 'ORG_ADMIN' || role === 'INSTITUTION_ADMIN';

  if (!canViewAll && !canViewOrg) return [];

  let query = supabase
    .from('damage_assessments')
    .select('id, profile_id, org_id, damage_type, severity, description, photo_path, location, created_at')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (canViewOrg) {
    if (!profile?.org_id) return [];
    query = query.eq('org_id', profile.org_id);
  }

  const { data: rows, error } = await query;
  if (error) throw new Error('Failed to load assessment results');

  const profileIds = Array.from(new Set((rows || []).map((r: any) => r.profile_id).filter(Boolean)));
  const orgIds = Array.from(new Set((rows || []).map((r: any) => r.org_id).filter(Boolean)));

  const [profilesResp, orgsResp] = await Promise.all([
    profileIds.length
      ? supabase
          .from('profiles')
          .select('id, full_name, email, phone')
          .in('id', profileIds)
      : Promise.resolve({ data: [], error: null } as any),
    orgIds.length
      ? supabase
          .from('organizations')
          .select('id, org_code, name')
          .in('id', orgIds)
      : Promise.resolve({ data: [], error: null } as any),
  ]);

  if (profilesResp.error) throw new Error('Failed to resolve assessment reporters');
  if (orgsResp.error) throw new Error('Failed to resolve assessment organizations');

  const profileMap = new Map((profilesResp.data || []).map((p: any) => [p.id, p]));
  const orgMap = new Map((orgsResp.data || []).map((o: any) => [o.id, o]));

  return (rows || []).map((row: any) => {
    const reporter = profileMap.get(row.profile_id);
    const org = row.org_id ? orgMap.get(row.org_id) : null;

    return {
      id: row.id,
      profileId: row.profile_id,
      orgId: row.org_id || null,
      orgName: org?.name || null,
      orgCode: org?.org_code || null,
      reporterName: reporter?.full_name || 'Unknown Reporter',
      reporterEmail: reporter?.email || null,
      reporterPhone: reporter?.phone || null,
      damageType: row.damage_type,
      severity: Number(row.severity || 1),
      description: row.description || null,
      photoPath: row.photo_path || null,
      location: row.location || null,
      createdAt: row.created_at,
    };
  });
}

// Help Requests
export async function createHelpRequest(userId: string, payload: any) {
  const orgId = payload?.orgId ? await getOrgIdByCode(payload.orgId) : null;

  const { data, error } = await supabase
    .from('help_requests')
    .insert({
      user_id: userId,
      org_id: orgId,
      status: payload.status || 'RECEIVED',
      priority: payload.priority || 'LOW',
      data: payload.data || {},
      location: payload.location || null,
    })
    .select('id, user_id, status, priority, data, location, created_at')
    .single();

  if (error || !data) throw new Error('Failed to create help request');
  await safeLogActivity({
    action: 'CREATE',
    entityType: 'help_requests',
    entityId: data.id,
    orgCode: payload?.orgId || null,
  });
  return {
    id: data.id,
    userId: data.user_id,
    status: data.status,
    priority: data.priority,
    data: data.data,
    location: data.location,
    timestamp: data.created_at,
  };
}

export async function getActiveHelpRequest(userId: string) {
  const { data, error } = await supabase
    .from('help_requests')
    .select('id, user_id, status, priority, data, location, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error('Failed to load help request');
  if (!data) return null;
  return {
    id: data.id,
    userId: data.user_id,
    status: data.status,
    priority: data.priority,
    data: data.data,
    location: data.location,
    timestamp: data.created_at,
  };
}

export async function updateHelpRequestLocation(id: string, location: string) {
  const { error } = await supabase
    .from('help_requests')
    .update({ location })
    .eq('id', id);
  if (error) throw new Error('Failed to update help request location');
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'help_requests',
    entityId: id,
    details: { location },
  });
  return { ok: true };
}

// Member CRUD
export async function listMembers(orgCode: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('members')
    .select('id, name, status, location, last_update, needs, phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) throw new Error('Failed to load members');

  const memberRows = data || [];
  const existingIds = new Set(memberRows.map((row: any) => row.id));

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name, email, phone, mobile_phone, home_address, emergency_contact, created_at')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (profileError) {
    return memberRows;
  }

  const profileBackfill = (profileRows || [])
    .filter((profile: any) => profile?.id && !existingIds.has(profile.id))
    .map((profile: any) => ({
      id: profile.id,
      name: profile.full_name || profile.email || 'Member',
      status: 'UNKNOWN',
      location: null,
      last_update: null,
      needs: [],
      phone: profile.phone || profile.mobile_phone || null,
      address: profile.home_address || null,
      emergency_contact_name: profile.emergency_contact?.name || null,
      emergency_contact_phone: profile.emergency_contact?.phone || null,
      emergency_contact_relation: profile.emergency_contact?.relation || null,
    }));

  return [...memberRows, ...profileBackfill];
}

export async function addMember(orgCode: string, payload: any) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('members')
    .insert({
      org_id: orgId,
      name: payload.name,
      status: payload.status || 'UNKNOWN',
      location: payload.location || null,
      last_update: payload.lastUpdate || null,
      needs: payload.needs || [],
      phone: payload.phone || null,
      address: payload.address || null,
      emergency_contact_name: payload.emergencyContactName || null,
      emergency_contact_phone: payload.emergencyContactPhone || null,
      emergency_contact_relation: payload.emergencyContactRelation || null,
    })
    .select('id, name, status, location, last_update, needs, phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation')
    .single();

  if (error || !data) throw new Error('Failed to add member');
  await safeLogActivity({
    action: 'CREATE',
    entityType: 'members',
    entityId: data.id,
    orgCode,
  });
  return data;
}

export async function updateMember(orgCode: string, memberId: string, payload: any) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { data, error } = await supabase
    .from('members')
    .update({
      name: payload.name,
      status: payload.status,
      location: payload.location,
      last_update: payload.lastUpdate,
      needs: payload.needs,
      phone: payload.phone,
      address: payload.address,
      emergency_contact_name: payload.emergencyContactName,
      emergency_contact_phone: payload.emergencyContactPhone,
      emergency_contact_relation: payload.emergencyContactRelation,
    })
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('id, name, status, location, last_update, needs, phone, address, emergency_contact_name, emergency_contact_phone, emergency_contact_relation')
    .single();

  if (error || !data) throw new Error('Failed to update member');
  await safeLogActivity({
    action: 'UPDATE',
    entityType: 'members',
    entityId: data.id,
    orgCode,
  });
  return data;
}

export async function removeMember(orgCode: string, memberId: string) {
  const orgId = await getOrgIdByCode(orgCode);
  if (!orgId) throw new Error('Organization not found');

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', orgId);

  if (error) throw new Error('Failed to remove member');
  await safeLogActivity({
    action: 'DELETE',
    entityType: 'members',
    entityId: memberId,
    orgCode,
  });
  return { ok: true };
}
