import { describe, it, expect } from 'vitest';
import { masterService } from '../services/masterService';
import { authService } from '../services/authService';

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

  it('should validate minimum password length (min 6 characters) on user creation', async () => {
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
      '12345' // only 5 characters
    );

    expect(shortPassRes.success).toBe(false);
    expect(shortPassRes.message).toContain('minimal 6 karakter');
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
});
