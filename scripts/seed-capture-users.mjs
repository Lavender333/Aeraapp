#!/usr/bin/env node
import 'dotenv/config';
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

const PASSWORD = 'AeraDemo!2026';
const USERS = [
  { email: 'pastor@example.com', fullName: 'Pastor John', role: 'INSTITUTION_ADMIN', phone: '555-0101', orgCode: 'CH-9921' },
  { email: 'alice@example.com', fullName: 'Alice Johnson', role: 'GENERAL_USER', phone: '555-1001', orgCode: 'CH-9921' },
  { email: 'david@example.com', fullName: 'David Brown', role: 'GENERAL_USER', phone: '555-1002', orgCode: 'CH-9921' },
];

async function getOrgIdByCode(orgCode) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, org_code, name')
    .eq('org_code', orgCode)
    .single();

  if (error || !data) {
    throw new Error(`Organization not found for ${orgCode}`);
  }

  return data.id;
}

async function findExistingUser(email) {
  const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  return (data?.users || []).find((u) => String(u.email || '').toLowerCase() === email.toLowerCase()) || null;
}

async function ensureAuthUser(user) {
  const existing = await findExistingUser(user.email);

  if (existing) {
    const { error } = await supabase.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: user.fullName },
    });
    if (error) throw error;
    console.log(`Updated auth user: ${user.email}`);
    return existing.id;
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: user.fullName },
  });

  if (error) throw error;
  console.log(`Created auth user: ${user.email}`);
  return data.user.id;
}

async function upsertProfile(userId, user, orgId) {
  const { error } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: user.email,
      full_name: user.fullName,
      phone: user.phone,
      role: user.role,
      org_id: orgId,
    });

  if (error) throw error;
  console.log(`Upserted profile: ${user.email} (${user.role}) -> ${user.orgCode}`);
}

async function main() {
  for (const user of USERS) {
    const orgId = await getOrgIdByCode(user.orgCode);
    const userId = await ensureAuthUser(user);
    await upsertProfile(userId, user, orgId);
  }

  console.log('\nDone. Login credentials for capture users:');
  for (const user of USERS) {
    console.log(`- ${user.email} | ${PASSWORD}`);
  }
}

main().catch((error) => {
  console.error('Seed failed:', error.message || error);
  process.exit(1);
});
