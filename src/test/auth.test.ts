import { describe, it, expect } from 'vitest';
import { authService } from '../services/authService';

describe('AuthService and Permission Matrix Tests', () => {
  it('should authenticate valid user and reject invalid user', async () => {
    const valid = await authService.login('operator', 'password123');
    expect(valid.success).toBe(true);
    expect(valid.data?.user.role).toBe('OPERATOR_DESA');

    const invalid = await authService.login('unknown_user', 'wrong');
    expect(invalid.success).toBe(false);
  });

  it('should switch roles and load corresponding user profile', async () => {
    const kades = await authService.switchRole('KEPALA_DESA');
    expect(kades.role).toBe('KEPALA_DESA');
    expect(kades.jabatanNama).toBe('Kepala Desa');
    expect(kades.nipd).toBeNull(); // Kepala Desa can have null NIPD

    const sekdes = await authService.switchRole('SEKRETARIS_DESA');
    expect(sekdes.role).toBe('SEKRETARIS_DESA');
  });

  it('should strictly enforce permission matrix per PRD Section 5', () => {
    // Regular Attendance: all except Super Admin
    expect(authService.hasPermission('PERANGKAT_DESA', 'regular_attendance')).toBe(true);
    expect(authService.hasPermission('OPERATOR_DESA', 'regular_attendance')).toBe(true);
    expect(authService.hasPermission('KEPALA_DESA', 'regular_attendance')).toBe(true);
    expect(authService.hasPermission('SEKRETARIS_DESA', 'regular_attendance')).toBe(true);
    expect(authService.hasPermission('SUPER_ADMIN', 'regular_attendance')).toBe(false);

    // Attendance Correction: ONLY Operator
    expect(authService.hasPermission('OPERATOR_DESA', 'attendance_correction')).toBe(true);
    expect(authService.hasPermission('PERANGKAT_DESA', 'attendance_correction')).toBe(false);
    expect(authService.hasPermission('KEPALA_DESA', 'attendance_correction')).toBe(false);
    expect(authService.hasPermission('SEKRETARIS_DESA', 'attendance_correction')).toBe(false);

    // DL Ratification: ONLY Kepala Desa
    expect(authService.hasPermission('KEPALA_DESA', 'dl_ratify')).toBe(true);
    expect(authService.hasPermission('SEKRETARIS_DESA', 'dl_ratify')).toBe(false);
    expect(authService.hasPermission('OPERATOR_DESA', 'dl_ratify')).toBe(false);
    expect(authService.hasPermission('PERANGKAT_DESA', 'dl_ratify')).toBe(false);

    // Cuti Final Approval: ONLY Kepala Desa
    expect(authService.hasPermission('KEPALA_DESA', 'approve_cuti')).toBe(true);
    expect(authService.hasPermission('SEKRETARIS_DESA', 'approve_cuti')).toBe(false);
    expect(authService.hasPermission('OPERATOR_DESA', 'approve_cuti')).toBe(false);

    // Cuti Verification: Sekdes & Operator
    expect(authService.hasPermission('SEKRETARIS_DESA', 'verify_cuti')).toBe(true);
    expect(authService.hasPermission('OPERATOR_DESA', 'verify_cuti')).toBe(true);
    expect(authService.hasPermission('PERANGKAT_DESA', 'verify_cuti')).toBe(false);
  });

  it('should return null for getCurrentUser when unauthenticated or logged out', async () => {
    // Pastikan saat logout, user tidak memiliki sesi aktif
    await authService.logout();
    const noUser = await authService.getCurrentUser();
    expect(noUser).toBeNull();

    // Login kemudian pastikan user tersedia
    await authService.login('operator', 'password123');
    const loggedInUser = await authService.getCurrentUser();
    expect(loggedInUser).not.toBeNull();
    expect(loggedInUser?.username).toBe('operator');

    // Logout kembali dan pastikan kembali null
    await authService.logout();
    const afterLogoutUser = await authService.getCurrentUser();
    expect(afterLogoutUser).toBeNull();
  });
});

