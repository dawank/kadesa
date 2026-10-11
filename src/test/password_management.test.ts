import { describe, it, expect } from 'vitest';
import { masterService } from '../services/masterService';
import { authService } from '../services/authService';
import {
  MIN_PASSWORD_LENGTH,
  validatePasswordLength,
  formatAuthPasswordError,
  PASSWORD_PLACEHOLDER,
} from '../types/auth';

describe('Password Management & Admin Reset Password Tests', () => {
  it('should allow Super Admin or Operator to set initial password when adding new apparatus', async () => {
    const newApparatusRes = await masterService.addApparatus(
      {
        username: 'budi_sukamaju',
        nama: 'Budi Santoso, S.Kom.',
        nik: '3201018888880001',
        nipd: '198801012022011005',
        nomorWhatsapp: '081298765432',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-06',
        jabatanNama: 'Kasi Pemerintahan',
        attendanceRequired: true,
        active: true,
        effectiveFrom: '2025-01-01',
      },
      'OPERATOR_DESA',
      'rahasiaBudi2026'
    );

    expect(newApparatusRes.success).toBe(true);
    expect(newApparatusRes.data).toBeDefined();

    // Verify user can login with the initial password created by operator
    const loginSuccess = await authService.login('budi_sukamaju', 'rahasiaBudi2026');
    expect(loginSuccess.success).toBe(true);
    expect(loginSuccess.data?.user.username).toBe('budi_sukamaju');

    // Verify user cannot login with wrong password
    const loginFail = await authService.login('budi_sukamaju', 'password_salah');
    expect(loginFail.success).toBe(false);
    expect(loginFail.message).toContain('Username atau kata sandi tidak valid');
  });

  it('should validate minimum password length (min 8 characters) on user creation', async () => {
    const shortPassRes = await masterService.addApparatus(
      {
        username: 'ani_pendek',
        nama: 'Ani Permata',
        nik: '3201018888880002',
        nipd: null,
        nomorWhatsapp: '081298765433',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-07',
        jabatanNama: 'Kasi Kesejahteraan',
        attendanceRequired: true,
        active: true,
        effectiveFrom: '2025-01-01',
      },
      'SUPER_ADMIN',
      '1234567' // 7 characters (< 8)
    );

    expect(shortPassRes.success).toBe(false);
    expect(shortPassRes.message).toContain('minimal 8 karakter');
  });

  it('should allow Super Admin or Operator to reset password when user forgets password', async () => {
    // 1. Create a user first
    const userRes = await masterService.addApparatus(
      {
        username: 'candra_lupa',
        nama: 'Candra Wijaya',
        nik: '3201018888880003',
        nipd: null,
        nomorWhatsapp: '081298765434',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-08',
        jabatanNama: 'Kasi Pelayanan',
        attendanceRequired: true,
        active: true,
        effectiveFrom: '2025-01-01',
      },
      'OPERATOR_DESA',
      'passwordLama123'
    );

    const userId = userRes.data!.id;

    // Login with initial password works
    const initialLogin = await authService.login('candra_lupa', 'passwordLama123');
    expect(initialLogin.success).toBe(true);

    // 2. User forgot password -> Operator resets password
    const resetRes = await masterService.resetApparatusPassword(
      userId,
      'passwordBaru2026',
      'OPERATOR_DESA',
      'usr-operator',
      'Operator Desa'
    );
    expect(resetRes.success).toBe(true);
    expect(resetRes.message).toContain('berhasil direset');

    // 3. Old password is no longer valid
    const oldLogin = await authService.login('candra_lupa', 'passwordLama123');
    expect(oldLogin.success).toBe(false);

    // 4. New password works immediately
    const newLogin = await authService.login('candra_lupa', 'passwordBaru2026');
    expect(newLogin.success).toBe(true);
  });

  it('should prevent Operator from resetting Super Admin password', async () => {
    const apparatusList = await masterService.getApparatusList();
    const superAdmin = apparatusList.data?.find((u) => u.role === 'SUPER_ADMIN');
    expect(superAdmin).toBeDefined();

    const resetRes = await masterService.resetApparatusPassword(
      superAdmin!.id,
      'hackedAdminPass',
      'OPERATOR_DESA',
      'usr-operator',
      'Operator Desa'
    );

    expect(resetRes.success).toBe(false);
    expect(resetRes.message).toContain('Operator tidak memiliki wewenang untuk mereset kata sandi akun Super Admin');
  });

  it('should prevent Operator from resetting own password via admin reset', async () => {
    const resetRes = await masterService.resetApparatusPassword(
      'usr-operator',
      'newOperatorPass123',
      'OPERATOR_DESA',
      'usr-operator',
      'Operator Desa'
    );

    expect(resetRes.success).toBe(false);
    expect(resetRes.message).toContain('Gunakan menu Profil Saya untuk memperbarui kata sandi akun Anda sendiri');
  });

  it('should allow Super Admin to reset password of any user including Operator', async () => {
    const resetRes = await masterService.resetApparatusPassword(
      'usr-operator',
      'resetBySuperAdmin123',
      'SUPER_ADMIN',
      'usr-admin',
      'Super Administrator'
    );

    expect(resetRes.success).toBe(true);
    expect(resetRes.message).toContain('berhasil direset');

    const loginRes = await authService.login('operator', 'resetBySuperAdmin123');
    expect(loginRes.success).toBe(true);
  });

  it('should reject admin reset password shorter than 8 characters (7 chars) and accept 8 characters', async () => {
    // 7 characters rejected
    const reset7Chars = await masterService.resetApparatusPassword(
      'usr-01',
      '1234567', // 7 chars
      'SUPER_ADMIN',
      'usr-admin',
      'Super Administrator'
    );
    expect(reset7Chars.success).toBe(false);
    expect(reset7Chars.message).toContain('minimal 8 karakter');

    // 8 characters accepted
    const reset8Chars = await masterService.resetApparatusPassword(
      'usr-operator',
      '12345678', // exactly 8 chars
      'SUPER_ADMIN',
      'usr-admin',
      'Super Administrator'
    );
    expect(reset8Chars.success).toBe(true);
    expect(reset8Chars.message).toContain('berhasil direset');
  });

  it('should reject user password change shorter than 8 characters (7 chars) and accept 8 characters', async () => {
    // 7 characters rejected
    const change7Chars = await authService.changePassword('oldPass123', '1234567');
    expect(change7Chars.success).toBe(false);
    expect(change7Chars.message).toContain('minimal 8 karakter');

    // 8 characters accepted
    const change8Chars = await authService.changePassword('oldPass123', '12345678');
    expect(change8Chars.success).toBe(true);
    expect(change8Chars.message).toContain('berhasil diubah');
  });

  it('should properly validate password length helper and confirmation matching', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8);
    expect(PASSWORD_PLACEHOLDER).toBe('Minimal 8 karakter');

    // Helper validation checks
    const val6 = validatePasswordLength('123456', 'Kata sandi');
    expect(val6.isValid).toBe(false);
    expect(val6.message).toBe('Kata sandi minimal 8 karakter');

    const val7 = validatePasswordLength('1234567', 'Kata sandi baru');
    expect(val7.isValid).toBe(false);
    expect(val7.message).toBe('Kata sandi baru minimal 8 karakter');

    const val8 = validatePasswordLength('12345678', 'Kata sandi baru');
    expect(val8.isValid).toBe(true);
    expect(val8.message).toBeUndefined();

    const valTrim = validatePasswordLength('   1234   ', 'Kata sandi');
    expect(valTrim.isValid).toBe(false); // trimmed length is 4
  });

  it('should translate Supabase Auth password errors into friendly Indonesian messages', () => {
    const lengthErr = formatAuthPasswordError('Password should be at least 8 characters');
    expect(lengthErr).toContain('minimal 8 karakter');

    const weakErr = formatAuthPasswordError('Password is too weak or pwned');
    expect(weakErr).toContain('terlalu mudah ditebak');

    const sameErr = formatAuthPasswordError('New password should be different');
    expect(sameErr).toContain('harus berbeda');
  });

  it('should strictly reject empty or omitted password on user creation without applying password123 fallback', async () => {
    // 1. Omitted/undefined initial password
    const omittedPassRes = await masterService.addApparatus(
      {
        username: 'user_no_pass',
        nama: 'User Tanpa Password',
        nik: '3201019999990001',
        nipd: null,
        nomorWhatsapp: '081299990001',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-01',
        jabatanNama: 'Kasi Pemerintahan',
        active: true,
        attendanceRequired: true,
        effectiveFrom: '2025-01-01',
      },
      'SUPER_ADMIN',
      undefined
    );

    expect(omittedPassRes.success).toBe(false);
    expect(omittedPassRes.message).toContain('minimal 8 karakter');

    // 2. Empty string initial password
    const emptyPassRes = await masterService.addApparatus(
      {
        username: 'user_empty_pass',
        nama: 'User Password Kosong',
        nik: '3201019999990002',
        nipd: null,
        nomorWhatsapp: '081299990002',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-01',
        jabatanNama: 'Kasi Pemerintahan',
        active: true,
        attendanceRequired: true,
        effectiveFrom: '2025-01-01',
      },
      'SUPER_ADMIN',
      ''
    );

    expect(emptyPassRes.success).toBe(false);
    expect(emptyPassRes.message).toContain('minimal 8 karakter');

    // 3. Whitespace-only initial password
    const blankPassRes = await masterService.addApparatus(
      {
        username: 'user_blank_pass',
        nama: 'User Password Spasi',
        nik: '3201019999990003',
        nipd: null,
        nomorWhatsapp: '081299990003',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-01',
        jabatanNama: 'Kasi Pemerintahan',
        active: true,
        attendanceRequired: true,
        effectiveFrom: '2025-01-01',
      },
      'SUPER_ADMIN',
      '       '
    );

    expect(blankPassRes.success).toBe(false);
    expect(blankPassRes.message).toContain('minimal 8 karakter');

    // 4. Verify no account was created and password123 fallback was NEVER applied
    const loginOmitted = await authService.login('user_no_pass', 'password123');
    expect(loginOmitted.success).toBe(false);

    const loginEmpty = await authService.login('user_empty_pass', 'password123');
    expect(loginEmpty.success).toBe(false);

    const loginBlank = await authService.login('user_blank_pass', 'password123');
    expect(loginBlank.success).toBe(false);
  });

  it('should accept valid 8-character password on user creation and permit login', async () => {
    const valid8Res = await masterService.addApparatus(
      {
        username: 'user_pass_8char',
        nama: 'User Delapan Karakter',
        nik: '3201019999990004',
        nipd: null,
        nomorWhatsapp: '081299990004',
        role: 'PERANGKAT_DESA',
        jabatanId: 'pos-01',
        jabatanNama: 'Kasi Pemerintahan',
        active: true,
        attendanceRequired: true,
        effectiveFrom: '2025-01-01',
      },
      'SUPER_ADMIN',
      'Pass8Ok!' // exactly 8 characters
    );

    expect(valid8Res.success).toBe(true);
    expect(valid8Res.data?.username).toBe('user_pass_8char');

    // Login with the created password must succeed
    const loginValid = await authService.login('user_pass_8char', 'Pass8Ok!');
    expect(loginValid.success).toBe(true);

    // Login with password123 must fail
    const loginDefaultFail = await authService.login('user_pass_8char', 'password123');
    expect(loginDefaultFail.success).toBe(false);
  });
});
