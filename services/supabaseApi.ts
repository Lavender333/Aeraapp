import { supabase } from './supabaseClient';
import type { OrgInventory } from '../types';

export type MapRegionRecord = {
  id: string;
  organization_id: string | null;
  county_id: string;
  state_id: string;
  region_name: string;
  region_type: string;
  geojson: any;
  centroid_geojson: any;
  updated_at?: string;
};

export type RegionSnapshotLatestRecord = {
  id: string;
  snapshot_date: string;
  organization_id: string | null;
  county_id: string;
  state_id: string;
  region_id: string | null;
  profile_count: number;
  avg_risk_score: number;
  max_risk_score: number;
  min_risk_score: number;
  risk_growth_pct: number;
  drift_value: number;
  drift_status: 'STABLE' | 'ESCALATING' | 'ACCELERATING' | string;
  kmeans_cluster: number | null;
  dbscan_cluster: number | null;
  anomaly_count: number;
  projection_14d: number | null;
  model_version: string;
  pipeline_run_id: string | null;
  created_at?: string;
};

export type StateAlertRecord = {
  id: string;
  source: string;
  event_type: string;
  severity: string;
  headline: string;
  description: string | null;
  effective_at: string | null;
  expires_at: string | null;
  organization_id: string | null;
  county_id: string | null;
  state_id: string | null;
  region_id: string | null;
  created_at?: string;
};

export type StateHouseholdJoinActivityRecord = {
  state_id: string;
  county_id: string;
  pending_requests: number;
  approved_last_24h: number;
  rejected_last_24h: number;
  submitted_last_24h: number;
  last_activity_at: string | null;
};

export type OrganizationPopulationRollupRecord = {
  organization_id: string;
  state_id: string;
  county_id: string;
  profile_count: number;
  avg_risk_score: number;
  max_risk_score: number;
  min_risk_score: number;
  high_risk_count: number;
  evacuation_assist_count: number;
  transportation_gap_count: number;
  mobility_limited_count: number;
};

export async function getCurrentMapScope() {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData?.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, org_id, county_id, state_id')
    .eq('id', authData.user.id)
    .single();

  if (error || !data) throw new Error('Unable to load user map scope');
  return data;
}

export async function listMapRegions(): Promise<MapRegionRecord[]> {
  const { data, error } = await supabase
    .from('geography_regions_map_view')
    .select('id, organization_id, county_id, state_id, region_name, region_type, geojson, centroid_geojson, updated_at')
    .order('region_name', { ascending: true });

  if (error) throw error;
  return (data || []) as MapRegionRecord[];
}

export async function listLatestRegionSnapshots(): Promise<RegionSnapshotLatestRecord[]> {
  const { data, error } = await supabase
    .from('region_snapshot_latest_view')
    .select('id, snapshot_date, organization_id, county_id, state_id, region_id, profile_count, avg_risk_score, max_risk_score, min_risk_score, risk_growth_pct, drift_value, drift_status, kmeans_cluster, dbscan_cluster, anomaly_count, projection_14d, model_version, pipeline_run_id, created_at')
    .order('snapshot_date', { ascending: false });

  if (error) throw error;
  return (data || []) as RegionSnapshotLatestRecord[];
}

export async function listActiveStateAlerts(limit = 100): Promise<StateAlertRecord[]> {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabase
    .from('alerts')
    .select('id, source, event_type, severity, headline, description, effective_at, expires_at, organization_id, county_id, state_id, region_id, created_at')
    .or(`expires_at.is.null,expires_at.gte.${nowIso}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []) as StateAlertRecord[];
}

export async function listStateHouseholdJoinActivity(): Promise<StateHouseholdJoinActivityRecord[]> {
  const { data, error } = await supabase
    .from('state_household_join_activity_view')
    .select('state_id, county_id, pending_requests, approved_last_24h, rejected_last_24h, submitted_last_24h, last_activity_at')
    .order('pending_requests', { ascending: false })
    .limit(250);

  if (error) throw error;
  return (data || []) as StateHouseholdJoinActivityRecord[];
}

export async function listOrganizationPopulationRollups(orgIds: string[]): Promise<OrganizationPopulationRollupRecord[]> {
  const normalizedOrgIds = Array.from(new Set((orgIds || []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (normalizedOrgIds.length === 0) return [];

  const query = supabase
    .from('vulnerability_profiles')
    .select('organization_id, state_id, county_id, risk_score, mobility_limitation, transportation_access')
    .not('state_id', 'is', null)
    .not('county_id', 'is', null);

  const { data, error } = normalizedOrgIds.length === 1
    ? await query.eq('organization_id', normalizedOrgIds[0])
    : await query.in('organization_id', normalizedOrgIds);

  if (error) throw error;

  const grouped = new Map<string, OrganizationPopulationRollupRecord>();

  for (const row of data || []) {
    const stateId = String((row as any).state_id || '').trim();
    const countyId = String((row as any).county_id || '').trim();

    if (!stateId || !countyId) continue;

    const key = `${stateId}::${countyId}`;
    const riskScore = Number((row as any).risk_score || 0);
    const mobilityLimited = Boolean((row as any).mobility_limitation);
    const transportationAccess = Boolean((row as any).transportation_access ?? true);

    const current = grouped.get(key) || {
      organization_id: normalizedOrgIds[0],
      state_id: stateId,
      county_id: countyId,
      profile_count: 0,
      avg_risk_score: 0,
      max_risk_score: 0,
      min_risk_score: 0,
      high_risk_count: 0,
      evacuation_assist_count: 0,
      transportation_gap_count: 0,
      mobility_limited_count: 0,
    };

    const nextCount = current.profile_count + 1;
    const nextRiskTotal = current.avg_risk_score * current.profile_count + riskScore;

    current.profile_count = nextCount;
    current.avg_risk_score = nextRiskTotal / nextCount;
    current.max_risk_score = nextCount === 1 ? riskScore : Math.max(current.max_risk_score, riskScore);
    current.min_risk_score = nextCount === 1 ? riskScore : Math.min(current.min_risk_score, riskScore);

    if (riskScore >= 8) current.high_risk_count += 1;
    if (mobilityLimited) current.mobility_limited_count += 1;
    if (!transportationAccess) current.transportation_gap_count += 1;
    if (mobilityLimited || !transportationAccess) current.evacuation_assist_count += 1;

    grouped.set(key, current);
  }

  return Array.from(grouped.values()).sort((a, b) => {
    if (b.profile_count !== a.profile_count) return b.profile_count - a.profile_count;
    return b.avg_risk_score - a.avg_risk_score;
  });
}

export async function listOrganizationPopulationRollup(orgId: string): Promise<OrganizationPopulationRollupRecord[]> {
  if (!orgId) return [];
  return listOrganizationPopulationRollups([orgId]);
}

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

export async function listOrganizations(options?: { activeOnly?: boolean }) {
  const activeOnly = options?.activeOnly ?? true;

  let query = supabase
    .from('organizations')
    .select(
      'id, org_code, name, type, address, is_active, contact_person, contact_phone, email, phone, replenishment_provider, replenishment_email, replenishment_phone, verified, registered_population, parent_org_id'
    )
    .order('name');

  if (activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
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
