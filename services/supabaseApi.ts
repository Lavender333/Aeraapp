import { supabase } from './supabaseClient';
import type { OrgInventory } from '../types';

const resolveOrgId = async (orgCode: string) => {
  const { data, error } = await supabase
    .from('organizations')
    .select('id')
    .eq('org_code', orgCode)
    .maybeSingle();

  if (error) throw error;
  if (!data?.id) throw new Error('Organization not found');
  return data.id as string;
};

export async function listOrganizations() {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, org_code, name, type, address, is_active')
    .eq('is_active', true)
    .order('name');
  if (error) throw error;
  return data || [];
}

export async function getInventorySupabase(orgCode: string): Promise<OrgInventory> {
  const orgId = await resolveOrgId(orgCode);
  const { data, error } = await supabase
    .from('inventory')
    .select('water, food, blankets, medical_kits')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return {
    water: data?.water || 0,
    food: data?.food || 0,
    blankets: data?.blankets || 0,
    medicalKits: data?.medical_kits || 0,
  };
}

export async function saveInventorySupabase(orgCode: string, inventory: OrgInventory) {
  const orgId = await resolveOrgId(orgCode);
  const { error } = await supabase
    .from('inventory')
    .upsert({
      org_id: orgId,
      water: inventory.water,
      food: inventory.food,
      blankets: inventory.blankets,
      medical_kits: inventory.medicalKits,
    }, { onConflict: 'org_id' });
  if (error) throw error;
}

export async function listMembersSupabase(orgCode: string) {
  const orgId = await resolveOrgId(orgCode);
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addMemberSupabase(orgCode: string, payload: any) {
  const orgId = await resolveOrgId(orgCode);
  const { data, error } = await supabase
    .from('members')
    .insert({
      org_id: orgId,
      name: payload.name,
      status: payload.status || 'UNKNOWN',
      location: payload.location,
      last_update: new Date().toISOString(),
      needs: payload.needs || [],
      phone: payload.phone,
      address: payload.address,
      emergency_contact_name: payload.emergencyContactName,
      emergency_contact_phone: payload.emergencyContactPhone,
      emergency_contact_relation: payload.emergencyContactRelation,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateMemberSupabase(orgCode: string, memberId: string, payload: any) {
  const orgId = await resolveOrgId(orgCode);
  const { data, error } = await supabase
    .from('members')
    .update({
      status: payload.status,
      location: payload.location,
      needs: payload.needs,
      phone: payload.phone,
      address: payload.address,
      emergency_contact_name: payload.emergencyContactName,
      emergency_contact_phone: payload.emergencyContactPhone,
      emergency_contact_relation: payload.emergencyContactRelation,
      last_update: new Date().toISOString(),
    })
    .eq('id', memberId)
    .eq('org_id', orgId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function removeMemberSupabase(orgCode: string, memberId: string) {
  const orgId = await resolveOrgId(orgCode);
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', memberId)
    .eq('org_id', orgId);
  if (error) throw error;
}

export async function getBroadcastSupabase(orgCode: string) {
  const orgId = await resolveOrgId(orgCode);
  const { data, error } = await supabase
    .from('broadcasts')
    .select('message, history')
    .eq('org_id', orgId)
    .maybeSingle();
  if (error) throw error;
  return data || { message: '', history: [] };
}

export async function setBroadcastSupabase(orgCode: string, message: string, authorId?: string) {
  const orgId = await resolveOrgId(orgCode);
  const entry = { message, created_at: new Date().toISOString(), author_id: authorId || null };
  const { data, error } = await supabase
    .from('broadcasts')
    .upsert({
      org_id: orgId,
      message,
      history: [entry],
    }, { onConflict: 'org_id' })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}
