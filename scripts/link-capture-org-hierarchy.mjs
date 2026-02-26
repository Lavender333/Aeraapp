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

const PARENT_CODE = 'NG-1001';
const CHILD_CODES = ['CH-9921', 'NGO-5500'];

async function getOrgByCode(orgCode) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, org_code, name, parent_org_id')
    .eq('org_code', orgCode)
    .single();

  if (error || !data) throw new Error(`Organization not found: ${orgCode}`);
  return data;
}

async function main() {
  const parent = await getOrgByCode(PARENT_CODE);
  console.log(`Parent: ${parent.org_code} (${parent.id})`);

  const { error: clearParentError } = await supabase
    .from('organizations')
    .update({ parent_org_id: null })
    .eq('id', parent.id);

  if (clearParentError) throw clearParentError;
  console.log(`Set ${parent.org_code} as top-level (parent_org_id=NULL)`);

  for (const childCode of CHILD_CODES) {
    const child = await getOrgByCode(childCode);

    if (child.id === parent.id) {
      throw new Error(`Child cannot be same as parent: ${childCode}`);
    }

    const { error } = await supabase
      .from('organizations')
      .update({ parent_org_id: parent.id })
      .eq('id', child.id);

    if (error) throw error;
    console.log(`Linked child ${child.org_code} -> parent ${parent.org_code}`);
  }

  const { data: rows, error: verifyError } = await supabase
    .from('organizations')
    .select('org_code, name, parent_org_id')
    .in('org_code', [PARENT_CODE, ...CHILD_CODES])
    .order('org_code', { ascending: true });

  if (verifyError) throw verifyError;

  console.log('\nHierarchy verification:');
  for (const row of rows || []) {
    console.log(`- ${row.org_code} | parent_org_id=${row.parent_org_id || 'NULL'}`);
  }
}

main().catch((error) => {
  console.error('Linking failed:', error.message || error);
  process.exit(1);
});
