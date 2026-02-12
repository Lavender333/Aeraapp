#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const community = {
  org_code: 'NG-1001',
  name: 'Red Cross Local Chapter',
  type: 'NGO',
  address: '456 Oak Ave',
  city: 'Springfield',
  state: 'IL',
  phone: '555-0200',
  email: 'contact@redcross.local',
  contact_person: 'Sarah Connor',
};

const demoMembers = [
  {
    email: 'ng1001.orgadmin@aera.demo',
    password: 'AeraDemo!2026',
    full_name: 'Noah Grant',
    role: 'ORG_ADMIN',
    phone: '555-2101',
    zip_code: '62701',
    county_id: 'sangamon',
    state_id: 'IL',
    household_size: 3,
    medication_dependency: false,
    insulin_dependency: false,
    oxygen_powered_device: false,
    mobility_limitation: false,
    transportation_access: true,
    financial_strain: false,
  },
  {
    email: 'ng1001.member1@aera.demo',
    password: 'AeraDemo!2026',
    full_name: 'Maya Brooks',
    role: 'GENERAL_USER',
    phone: '555-2102',
    zip_code: '62703',
    county_id: 'sangamon',
    state_id: 'IL',
    household_size: 4,
    medication_dependency: true,
    insulin_dependency: true,
    oxygen_powered_device: false,
    mobility_limitation: false,
    transportation_access: false,
    financial_strain: true,
  },
  {
    email: 'ng1001.member2@aera.demo',
    password: 'AeraDemo!2026',
    full_name: 'Darnell Hayes',
    role: 'GENERAL_USER',
    phone: '555-2103',
    zip_code: '62704',
    county_id: 'sangamon',
    state_id: 'IL',
    household_size: 2,
    medication_dependency: true,
    insulin_dependency: false,
    oxygen_powered_device: true,
    mobility_limitation: true,
    transportation_access: true,
    financial_strain: false,
  },
  {
    email: 'ng1001.member3@aera.demo',
    password: 'AeraDemo!2026',
    full_name: 'Elena Ortiz',
    role: 'GENERAL_USER',
    phone: '555-2104',
    zip_code: '62707',
    county_id: 'sangamon',
    state_id: 'IL',
    household_size: 5,
    medication_dependency: false,
    insulin_dependency: false,
    oxygen_powered_device: false,
    mobility_limitation: true,
    transportation_access: false,
    financial_strain: true,
  },
];

async function ensureOrg() {
  const { data, error } = await supabase
    .from('organizations')
    .upsert(community, { onConflict: 'org_code' })
    .select('id, org_code, name')
    .single();

  if (error) throw error;
  return data;
}

async function findUserByEmail(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function ensureAuthUser(member) {
  const createResp = await supabase.auth.admin.createUser({
    email: member.email,
    password: member.password,
    email_confirm: true,
    phone_confirm: true,
    user_metadata: { full_name: member.full_name },
  });

  if (!createResp.error && createResp.data?.user) return createResp.data.user;

  const existing = await findUserByEmail(member.email);
  if (!existing) {
    throw createResp.error || new Error(`Unable to create or find user ${member.email}`);
  }

  // keep account password aligned with seed value
  await supabase.auth.admin.updateUserById(existing.id, {
    password: member.password,
    user_metadata: { ...(existing.user_metadata || {}), full_name: member.full_name },
  });

  return existing;
}

async function seedMember(member, orgId) {
  const authUser = await ensureAuthUser(member);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert(
      {
        id: authUser.id,
        org_id: orgId,
        email: member.email,
        phone: member.phone,
        mobile_phone: member.phone,
        full_name: member.full_name,
        role: member.role,
        state_id: member.state_id,
        county_id: member.county_id,
        is_active: true,
      },
      { onConflict: 'id' },
    );

  if (profileError) throw profileError;

  const household = Array.from({ length: member.household_size }).map((_, idx) => ({
    id: `${authUser.id}-hh-${idx + 1}`,
    name: idx === 0 ? member.full_name : `Household Member ${idx + 1}`,
    age: idx === 0 ? 'Adult' : 'Child',
    needs: idx === 0 ? (member.medication_dependency ? 'Medication support' : '') : '',
  }));

  const { error: vitalsError } = await supabase
    .from('vitals')
    .upsert(
      {
        profile_id: authUser.id,
        household,
        household_size: member.household_size,
        medical_needs: member.medication_dependency ? 'Requires medication continuity planning' : null,
        pet_details: '',
        medication_dependency: member.medication_dependency,
        insulin_dependency: member.insulin_dependency,
        oxygen_powered_device: member.oxygen_powered_device,
        mobility_limitation: member.mobility_limitation,
        transportation_access: member.transportation_access,
        financial_strain: member.financial_strain,
        zip_code: member.zip_code,
        consent_preparedness_planning: true,
        consent_timestamp: new Date().toISOString(),
      },
      { onConflict: 'profile_id' },
    );

  if (vitalsError) throw vitalsError;

  const { error: vulnError } = await supabase
    .from('vulnerability_profiles')
    .upsert(
      {
        profile_id: authUser.id,
        organization_id: orgId,
        county_id: member.county_id,
        state_id: member.state_id,
        household_size: member.household_size,
        medication_dependency: member.medication_dependency,
        insulin_dependency: member.insulin_dependency,
        oxygen_powered_device: member.oxygen_powered_device,
        mobility_limitation: member.mobility_limitation,
        transportation_access: member.transportation_access,
        financial_strain: member.financial_strain,
        zip_code: member.zip_code,
        consent_preparedness_planning: true,
        consent_timestamp: new Date().toISOString(),
        intake_source: 'seed-ng1001-members',
        intake_version: 'v1-demo',
        updated_by: authUser.id,
      },
      { onConflict: 'profile_id' },
    );

  if (vulnError) throw vulnError;

  const starterKit = ['water', 'food', 'flashlight', 'radio'];
  const { error: readyError } = await supabase
    .from('ready_kits')
    .upsert(
      {
        profile_id: authUser.id,
        checked_ids: starterKit,
        checked_items: starterKit.length,
        total_items: 28,
      },
      { onConflict: 'profile_id' },
    );

  if (readyError) throw readyError;

  const criticalMissingItems = [];
  const outreachFlags = [];

  if (member.medication_dependency) {
    criticalMissingItems.push({
      id: 'medication_backup_container',
      item: 'Medication Backup Container',
      explanation: 'Medication dependency requires backup storage for continuity.',
    });
    outreachFlags.push('medical-medication-continuity');
  }

  if (member.insulin_dependency) {
    criticalMissingItems.push({
      id: 'insulated_medication_pouch',
      item: 'Insulated Medication Pouch',
      explanation: 'Insulin users require temperature-stable medication storage.',
    });
    outreachFlags.push('medical-insulin-continuity');
  }

  if (member.oxygen_powered_device) {
    criticalMissingItems.push({
      id: 'backup_power_plan',
      item: 'Backup Power Plan',
      explanation: 'Powered medical devices require backup power continuity.',
    });
    outreachFlags.push('medical-power-continuity');
  }

  if (!member.transportation_access) {
    criticalMissingItems.push({
      id: 'evacuation_assistance_contact',
      item: 'Evacuation Assistance Contact',
      explanation: 'No transport access requires pre-arranged evacuation assistance.',
    });
    outreachFlags.push('transport-evacuation-coordination');
  }

  if (member.financial_strain) {
    outreachFlags.push('financial-support-outreach');
  }

  const uniqueFlags = Array.from(new Set(outreachFlags));
  const readinessCap = criticalMissingItems.length > 0 ? 70 : 100;
  const baseCompletionPct = Number(((starterKit.length / 28) * 100).toFixed(2));
  const readinessScore = Number(Math.min(baseCompletionPct, readinessCap).toFixed(2));

  const { error: recommendationError } = await supabase
    .from('kit_recommendations')
    .upsert(
      {
        profile_id: authUser.id,
        organization_id: orgId,
        county_id: member.county_id,
        state_id: member.state_id,
        risk_score: 0,
        recommended_duration_days: member.household_size >= 4 ? 7 : 3,
        required_item_ids: criticalMissingItems.map((i) => i.id),
        added_items: criticalMissingItems,
        critical_missing_items: criticalMissingItems,
        outreach_flags: uniqueFlags,
        base_completion_pct: baseCompletionPct,
        readiness_cap: readinessCap,
        readiness_score: readinessScore,
        risk_tier: criticalMissingItems.length >= 2 ? 'HIGH' : criticalMissingItems.length === 1 ? 'ELEVATED' : 'STANDARD',
        source_version: 'seed-ng1001-members-v1',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'profile_id' },
    );

  if (recommendationError) throw recommendationError;

  return {
    profileId: authUser.id,
    memberName: member.full_name,
    phone: member.phone,
    needs: criticalMissingItems.map((i) => i.item),
    status: criticalMissingItems.length >= 2 ? 'DANGER' : criticalMissingItems.length === 1 ? 'UNKNOWN' : 'SAFE',
  };
}

async function seedOrgOperationalData(orgId, seededMembers) {
  const { error: inventoryError } = await supabase
    .from('inventory')
    .upsert(
      {
        org_id: orgId,
        water: 42,
        food: 35,
        blankets: 28,
        medical_kits: 18,
      },
      { onConflict: 'org_id' },
    );
  if (inventoryError) throw inventoryError;

  for (let idx = 0; idx < seededMembers.length; idx += 1) {
    const m = seededMembers[idx];

    const { error: membersError } = await supabase
      .from('members')
      .upsert(
        {
          id: m.profileId,
          org_id: orgId,
          name: m.memberName,
          status: m.status,
          location: `Sector ${idx + 1}, Springfield`,
          last_update: new Date().toISOString(),
          needs: m.needs,
          phone: m.phone,
          address: `${100 + idx} Relief Ave, Springfield, IL`,
          emergency_contact_name: `Emergency Contact ${idx + 1}`,
          emergency_contact_phone: `555-300${idx + 1}`,
          emergency_contact_relation: 'Family',
        },
        { onConflict: 'id' },
      );
    if (membersError) throw membersError;

    const { error: statusError } = await supabase
      .from('member_statuses')
      .upsert(
        {
          org_id: orgId,
          member_id: m.profileId,
          name: m.memberName,
          status: m.status,
          last_check_in: new Date(Date.now() - idx * 3600 * 1000).toISOString(),
        },
        { onConflict: 'org_id,member_id' },
      );
    if (statusError) throw statusError;
  }
}

async function main() {
  const org = await ensureOrg();
  console.log(`Using community ${org.org_code} (${org.id})`);

  const seeded = [];
  for (const member of demoMembers) {
    const result = await seedMember(member, org.id);
    seeded.push({ id: result.profileId, email: member.email, role: member.role, ...result });
    console.log(`Seeded: ${member.email} (${member.role})`);
  }

  await seedOrgOperationalData(org.id, seeded);
  console.log('Seeded org inventory, member directory, and member status rows.');

  console.log('\nDone. Demo accounts for NG-1001:');
  for (const row of seeded) {
    console.log(`- ${row.email} | role=${row.role} | id=${row.id}`);
  }

  console.log('\nNext: run nightly pipeline so region snapshots reflect these member risk profiles:');
  console.log('python scripts/nightly-level3-pipeline.py');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
