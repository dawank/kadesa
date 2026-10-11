export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
}

// Configurable simulated latency for realistic asynchronous UI feedback in demo/test modes
export const simulateNetworkDelay = async (ms: number = 300): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Penentuan Ketat Mode Demo vs Mode Produksi
 * 
 * Aturan Kebijakan (PRD & Dokumen Audit):
 * 1. Produksi (PROD / mode 'production'): WAJIB selalu menggunakan mode backend nyata (Supabase Cloud).
 *    Semua upaya mengaktifkan demo mode di production DITOLAK secara tegas.
 * 2. Development (DEV): Hanya mengaktifkan demo jika secara eksplisit disetel 'true' (VITE_ENABLE_DEMO_MODE === 'true').
 * 3. Test (MODE === 'test'): Default true untuk isolasi unit test offline,
 *    kecuali jika VITE_TEST_WITH_LIVE_DB === 'true' atau VITE_ENABLE_DEMO_MODE === 'false'.
 */
const isProd = Boolean(import.meta.env.PROD || import.meta.env.MODE === 'production');
const isTest = import.meta.env.MODE === 'test';
const envDemoFlag = String(import.meta.env.VITE_ENABLE_DEMO_MODE ?? '').trim().toLowerCase();

let computedDemoMode = false;

if (isProd) {
  if (envDemoFlag === 'true') {
    console.warn(
      '[KADESA SECURITY WARNING] Percobaan mengaktifkan VITE_ENABLE_DEMO_MODE pada build produksi ditolak. Sistem dipaksa berjalan pada mode operasional Supabase Cloud.'
    );
  }
  computedDemoMode = false;
} else if (isTest) {
  // Vitest unit tests run offline in mock mode unless explicitly testing live DB
  computedDemoMode = import.meta.env.VITE_TEST_WITH_LIVE_DB === 'true' ? false : true;
} else {
  // Development mode: hanya aktif jika disetel eksplisit 'true'
  computedDemoMode = envDemoFlag === 'true';
}

export const IS_DEMO_MODE = computedDemoMode;

export const getAppRuntimeEnvironment = () => ({
  isProduction: isProd,
  isTest,
  isDemoMode: IS_DEMO_MODE,
  mode: import.meta.env.MODE,
});
