import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

/**
 * Memeriksa apakah kredensial Supabase (URL dan Anon Key) telah dikonfigurasi di environment.
 */
export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('your-project-ref')
  );
};

/**
 * Supabase Client Instance Tunggal (Singleton)
 * Jika kredensial belum tersedia di .env, instance dummy dibuat agar app tidak crash.
 */
let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient => {
  if (!clientInstance) {
    if (isSupabaseConfigured()) {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } else {
      // Inisialisasi fallback aman saat belum ada kredensial live
      clientInstance = createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      });
    }
  }
  return clientInstance;
};

export const supabase = getSupabaseClient();
