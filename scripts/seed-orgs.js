import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const organizations = [
  {
    org_code: 'CH-9921',
    name: 'Grace Community Church',
    type: 'CHURCH',
    address: '4500 Main St',
    contact_person: 'Pastor John',
    contact_phone: '555-0101',
    email: 'supply@diocese.example.org',
    is_active: true,
  },
  {
    org_code: 'NGO-5500',
    name: 'Regional Aid Network',
    type: 'NGO',
    address: '100 Relief Blvd',
    contact_person: 'Sarah Connor',
    contact_phone: '555-0102',
    email: 'logistics@fema.example.gov',
    is_active: true,
  },
];

const run = async () => {
  const { data, error } = await supabase
    .from('organizations')
    .upsert(organizations, { onConflict: 'org_code' })
    .select('id, org_code, name');

  if (error) {
    console.error('Seed failed:', error.message || error);
    process.exit(1);
  }

  console.log('Seeded organizations:', data);
};

run();
