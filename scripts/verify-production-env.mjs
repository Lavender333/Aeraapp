import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const supabaseUrl = String(process.env.VITE_SUPABASE_URL || '').trim();
const supabaseAnonKey = String(process.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('example.supabase.co')) {
  console.error('iOS production build blocked: configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY first.');
  process.exit(1);
}

console.log('iOS production environment is configured.');
