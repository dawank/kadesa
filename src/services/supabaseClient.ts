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

export interface DatabaseConnectionStatus {
  status: 'CONNECTED' | 'UNCONFIGURED' | 'ERROR' | 'RLS_RESTRICTED';
  message: string;
  latencyMs?: number;
  urlHost?: string;
}

/**
 * Health-check nyata read-only ke Supabase Cloud.
 * Membedakan status: Terkonfigurasi vs Terhubung vs Gagal vs Proteksi RLS Aktif.
 */
export const checkDatabaseConnection = async (): Promise<DatabaseConnectionStatus> => {
  if (!isSupabaseConfigured()) {
    return {
      status: 'UNCONFIGURED',
      message: 'Kredensial URL & Anon Key Supabase belum terpasang di environment.',
    };
  }

  const client = getSupabaseClient();
  let urlHost = '';
  try {
    urlHost = new URL(supabaseUrl).host;
  } catch {}

  const startTime = performance.now();
  try {
    // Read-only probe terhadap tabel publik yang terdefinisi dalam skema
    const { error } = await client
      .from('villages')
      .select('id', { head: true, count: 'exact' });

    const latencyMs = Math.round(performance.now() - startTime);

    if (error) {
      if (error.code === '42501' || error.message.toLowerCase().includes('permission denied')) {
        return {
          status: 'RLS_RESTRICTED',
          message: 'Koneksi database aktif, proteksi akses RLS aktif.',
          latencyMs,
          urlHost,
        };
      }
      return {
        status: 'ERROR',
        message: `Koneksi database gagal: ${error.message}`,
        latencyMs,
        urlHost,
      };
    }

    return {
      status: 'CONNECTED',
      message: 'Terhubung ke database Supabase Cloud PostgreSQL.',
      latencyMs,
      urlHost,
    };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      status: 'ERROR',
      message: `Kegagalan jaringan saat menghubungi Supabase: ${err.message || err}`,
      latencyMs,
      urlHost,
    };
  }
};
