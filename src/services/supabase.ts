import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Initialize client if environment variables are configured
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Logger to help developers debug Supabase integration
if (!supabase) {
  console.info(
    'Supabase environment variables (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY) are not configured. Falling back to client-side LocalStorage DB.'
  );
} else {
  console.info('Supabase client successfully initialized. Active email auth and Postgres DB sync are enabled.');
}
