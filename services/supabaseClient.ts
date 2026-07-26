// Keep one auth/session owner for the entire browser. Creating a second
// GoTrueClient with the same storage key causes refresh and startup races.
export { supabase } from './supabase';
