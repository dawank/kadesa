import { describe, it, expect, beforeEach } from 'vitest';
import { masterService } from '../services/masterService';
import { authService } from '../services/authService';
import { User } from '../types/auth';

describe('Operator Desa Role Assignment & Authorization Tests', () => {
  it('should allow Operator role to be assigned to users with various village apparatus positions', async () => {
    // Test that Operator is NOT bound exclusively to Kaur TU & Umum
    // It can be assigned to Kaur Keuangan, Kaur Perencanaan, or any other apparatus position
    const apparatusRes = await masterService.getApparatusList();
    expect(apparatusRes.success).toBe(true);
    const users = apparatusRes.data || [];

    // Find user with jabatan other than Kaur TU (e.g. pos-03 Kaur Keuangan or pos-04 Kaur Perencanaan)
    const dewi = users.find(u => u.nama.includes('Dewi Lestari'));
    expect(dewi).toBeDefined();

    // Super Admin assigns Operator role to Dewi (who is Kaur Keuangan)
    const updateRes = await masterService.updateApparatus(
      dewi!.id,
      { role: 'OPERATOR_DESA' },
      'SUPER_ADMIN',
      'usr-admin'
    );

    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.role).toBe('OPERATOR_DESA');
    // Ensure jabatan remains intact (Kaur Keuangan)
    expect(updateRes.data?.jabatanNama).toBe('Kaur Keuangan');
  });

  it('should guarantee that changing role does not alter user position (jabatan)', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const dewi = apparatusRes.data?.find(u => u.nama.includes('Dewi Lestari'))!;
    const originalJabatanId = dewi.jabatanId;
    const originalJabatanNama = dewi.jabatanNama;

    // Change role from OPERATOR_DESA back to PERANGKAT_DESA
    const res = await masterService.updateApparatus(
      dewi.id,
      { role: 'PERANGKAT_DESA' },
      'SUPER_ADMIN',
      'usr-admin'
    );

    expect(res.success).toBe(true);
    expect(res.data?.role).toBe('PERANGKAT_DESA');
    expect(res.data?.jabatanId).toBe(originalJabatanId);
    expect(res.data?.jabatanNama).toBe(originalJabatanNama);
  });

  it('should guarantee that changing position (jabatan) does not alter user role', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const dewi = apparatusRes.data?.find(u => u.nama.includes('Dewi Lestari'))!;
    const originalRole = dewi.role;

    // Change jabatan from Kaur Keuangan to Kaur Perencanaan (pos-04)
    const res = await masterService.updateApparatus(
      dewi.id,
      { jabatanId: 'pos-04', jabatanNama: 'Kaur Perencanaan' },
      'OPERATOR_DESA',
      'usr-operator'
    );

    expect(res.success).toBe(true);
    expect(res.data?.jabatanNama).toBe('Kaur Perencanaan');
    // Role must remain strictly unchanged
    expect(res.data?.role).toBe(originalRole);
  });

  it('should prevent Operator from modifying their own role', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const operatorUser = apparatusRes.data?.find(u => u.role === 'OPERATOR_DESA')!;
    expect(operatorUser).toBeDefined();

    // Operator attempts to change own role to SUPER_ADMIN or PERANGKAT_DESA
    const res = await masterService.updateApparatus(
      operatorUser.id,
      { role: 'SUPER_ADMIN' },
      'OPERATOR_DESA',
      operatorUser.id // actorId === target id
    );

    expect(res.success).toBe(false);
    expect(res.message).toContain('Operator tidak memiliki wewenang untuk mengubah peran akunnya sendiri');
  });

  it('should prevent Operator from granting OPERATOR_DESA or SUPER_ADMIN role to any other user', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const dewi = apparatusRes.data?.find(u => u.nama.includes('Dewi Lestari'))!;

    // 1. Operator attempts to grant OPERATOR_DESA role to Dewi
    const grantOperatorRes = await masterService.updateApparatus(
      dewi.id,
      { role: 'OPERATOR_DESA' },
      'OPERATOR_DESA',
      'usr-operator'
    );
    expect(grantOperatorRes.success).toBe(false);
    expect(grantOperatorRes.message).toContain('menetapkan peran Operator Desa');

    // 2. Operator attempts to grant SUPER_ADMIN role to Dewi
    const grantSuperAdminRes = await masterService.updateApparatus(
      dewi.id,
      { role: 'SUPER_ADMIN' },
      'OPERATOR_DESA',
      'usr-operator'
    );
    expect(grantSuperAdminRes.success).toBe(false);
    expect(grantSuperAdminRes.message).toContain('Operator tidak memiliki wewenang untuk menetapkan peran Super Admin');

    // 3. Operator attempts to revoke OPERATOR_DESA role from an existing Operator (ADR-011)
    const revokeOperatorRes = await masterService.updateApparatus(
      'usr-operator',
      { role: 'PERANGKAT_DESA' },
      'OPERATOR_DESA',
      'usr-another-op'
    );
    expect(revokeOperatorRes.success).toBe(false);
    expect(revokeOperatorRes.message).toContain('mencabut peran Operator Desa');
  });

  it('should prevent Operator from creating a new account with OPERATOR_DESA or SUPER_ADMIN role', async () => {
    // 1. Operator attempts to create a new user as OPERATOR_DESA
    const createOperatorRes = await masterService.addApparatus(
      {
        username: 'operator_baru',
        nama: 'Operator Pengganti',
        nik: '3201019999990001',
        nipd: '199901012022011001',
        nomorWhatsapp: '081234567890',
        role: 'OPERATOR_DESA',
        jabatanId: 'pos-05',
        jabatanNama: 'Kaur Tata Usaha & Umum',
        attendanceRequired: true,
        active: true,
        effectiveFrom: '2025-01-01',
      },
      'OPERATOR_DESA',
      'PasswordKuat2026!'
    );
    expect(createOperatorRes.success).toBe(false);
    expect(createOperatorRes.message).toContain('Operator tidak memiliki wewenang untuk membuat akun baru dengan peran Operator Desa');

    // 2. Operator attempts to create a new user as SUPER_ADMIN
    const createSuperAdminRes = await masterService.addApparatus(
      {
        username: 'super_baru',
        nama: 'Super Admin Baru',
        nik: '3201019999990002',
        nipd: null,
        nomorWhatsapp: '081234567891',
        role: 'SUPER_ADMIN',
        jabatanId: 'pos-99',
        jabatanNama: 'Administrator Sistem',
        attendanceRequired: false,
        active: true,
        effectiveFrom: '2025-01-01',
      },
      'OPERATOR_DESA',
      'PasswordKuat2026!'
    );
    expect(createSuperAdminRes.success).toBe(false);
    expect(createSuperAdminRes.message).toContain('Operator tidak memiliki wewenang untuk membuat akun baru dengan peran Super Admin');
  });

  it('should prevent Operator from editing or deactivating Super Admin account', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const superAdmin = apparatusRes.data?.find(u => u.role === 'SUPER_ADMIN')!;
    expect(superAdmin).toBeDefined();

    // 1. Edit Super Admin
    const editRes = await masterService.updateApparatus(
      superAdmin.id,
      { nama: 'Budi Santoso (Edited)' },
      'OPERATOR_DESA',
      'usr-operator'
    );
    expect(editRes.success).toBe(false);
    expect(editRes.message).toContain('Operator tidak memiliki wewenang untuk mengubah data akun Super Admin');

    // 2. Deactivate Super Admin
    const toggleRes = await masterService.toggleApparatusStatus(superAdmin.id, 'OPERATOR_DESA');
    expect(toggleRes.success).toBe(false);
    expect(toggleRes.message).toContain('Operator tidak memiliki wewenang untuk mengubah status akun Super Admin');
  });

  it('should allow Operator to manage regular village apparatus per permission matrix', async () => {
    const apparatusRes = await masterService.getApparatusList();
    const dewi = apparatusRes.data?.find(u => u.nama.includes('Dewi Lestari'))!;

    // Operator updates Dewi's contact / data
    const updateRes = await masterService.updateApparatus(
      dewi.id,
      { nomorWhatsapp: '085699998888' },
      'OPERATOR_DESA',
      'usr-operator'
    );
    expect(updateRes.success).toBe(true);
    expect(updateRes.data?.nomorWhatsapp).toBe('085699998888');

    // Operator can toggle status of regular apparatus
    const toggleRes = await masterService.toggleApparatusStatus(dewi.id, 'OPERATOR_DESA');
    expect(toggleRes.success).toBe(true);
  });
});
