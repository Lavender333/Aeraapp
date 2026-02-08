import type { OrgInventory, UserProfile } from '../types';
import { supabase, getOrgByCode, getOrgIdByCode } from './supabase';

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

const getProfileById = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, org_id, full_name, role, email, phone')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data;
};

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
  return { ok: true };
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

  if (error) throw error;

  const userId = data.user?.id;
  let resolvedOrgId: string | null = null;
  if (orgId) resolvedOrgId = await getOrgIdByCode(orgId);

  if (userId) {
    await supabase.from('profiles').upsert({
      id: userId,
      email: data.user?.email || email || null,
      phone: phone || null,
      full_name: fullName || null,
      role: role || 'GENERAL_USER',
      org_id: resolvedOrgId,
    });
  }

  return {
    token: data.session?.access_token || null,
    refreshToken: data.session?.refresh_token || null,
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
  return data || [];
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
  return { ok: true };
}
