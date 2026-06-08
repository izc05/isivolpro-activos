import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const defaultSupabaseUrl = 'https://ubfbhzovebrmmjpyygnm.supabase.co';
const defaultSupabaseAnonKey = 'sb_publishable_gVjUFVQRfzLKDMHJ2XU6Wg_lyrsuuac';

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase usa la configuracion publica por defecto. Para otro entorno define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(supabaseUrl || defaultSupabaseUrl, supabaseAnonKey || defaultSupabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.sessionStorage
  }
});
