/**
 * Single Source of Truth Kebijakan Kata Sandi KADESA
 * Menyeragamkan panjang minimum, placeholder, pesan validasi, dan penanganan error Supabase Auth
 */
export const MIN_PASSWORD_LENGTH = 8;

export const PASSWORD_MIN_LENGTH_MESSAGE = `Kata sandi minimal ${MIN_PASSWORD_LENGTH} karakter`;
export const PASSWORD_NEW_MIN_LENGTH_MESSAGE = `Kata sandi baru minimal ${MIN_PASSWORD_LENGTH} karakter`;
export const PASSWORD_INITIAL_MIN_LENGTH_MESSAGE = `Password awal wajib diisi minimal ${MIN_PASSWORD_LENGTH} karakter`;
export const PASSWORD_CONFIRM_MISMATCH_MESSAGE = 'Konfirmasi kata sandi tidak cocok';

export const PASSWORD_PLACEHOLDER = `Minimal ${MIN_PASSWORD_LENGTH} karakter`;
export const PASSWORD_INITIAL_PLACEHOLDER = `Minimal ${MIN_PASSWORD_LENGTH} karakter`;

/**
 * Validasi panjang kata sandi di sisi frontend sebelum request dikirim
 */
export function validatePasswordLength(
  password: string,
  fieldLabel = 'Kata sandi'
): { isValid: boolean; message?: string } {
  if (!password || password.trim().length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      message: `${fieldLabel} minimal ${MIN_PASSWORD_LENGTH} karakter`,
    };
  }
  return { isValid: true };
}

/**
 * Menerjemahkan pesan error Supabase Auth menjadi pesan yang ramah pengguna
 */
export function formatAuthPasswordError(errorMsg?: string): string {
  if (!errorMsg) return 'Gagal memproses kata sandi di sistem autentikasi.';
  const lower = errorMsg.toLowerCase();
  if (lower.includes('at least') || lower.includes('characters') || lower.includes('length') || lower.includes('karakter')) {
    return `Kata sandi harus memiliki minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (lower.includes('weak') || lower.includes('pwned') || lower.includes('simple')) {
    return `Kata sandi terlalu mudah ditebak. Gunakan kombinasi huruf dan angka minimal ${MIN_PASSWORD_LENGTH} karakter.`;
  }
  if (lower.includes('same') || lower.includes('different')) {
    return 'Kata sandi baru harus berbeda dari kata sandi sebelumnya.';
  }
  return errorMsg;
}
