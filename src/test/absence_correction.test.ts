import { describe, it, expect } from 'vitest';
import { absenceService } from '../services/absenceService';
import { correctionService } from '../services/correctionService';

describe('Absence, Leave and Attendance Correction Tests', () => {
  it('should process leave through multi-stage workflow: SUBMITTED -> VERIFIED -> APPROVED', async () => {
    // 1. Submit leave
    const submitRes = await absenceService.submitLeave(
      'usr-perangkat-1',
      'Dewi Lestari',
      'Kaur Keuangan',
      'TAHUNAN',
      '2026-11-10',
      '2026-11-12',
      'Cuti keperluan keluarga'
    );
    expect(submitRes.success).toBe(true);
    expect(submitRes.data?.state).toBe('SUBMITTED');

    const leaveId = submitRes.data!.id;

    // 2. Verification by Sekdes
    const verifyRes = await absenceService.verifyLeave(
      leaveId,
      'usr-sekdes',
      'Bambang Wijaya',
      'Syarat kuota terpenuhi'
    );
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.data?.state).toBe('VERIFIED');

    // 3. Final Approval by non-Kades should FAIL
    const invalidApprove = await absenceService.approveLeave(
      leaveId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA',
      'APPROVED'
    );
    expect(invalidApprove.success).toBe(false);

    // 4. Final Approval by Kepala Desa should SUCCEED
    const validApprove = await absenceService.approveLeave(
      leaveId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA',
      'APPROVED',
      'Disetujui penuh oleh Kepala Desa'
    );
    expect(validApprove.success).toBe(true);
    expect(validApprove.data?.state).toBe('APPROVED');
    expect(validApprove.data?.approvedByNama).toBe('Drs. H. Ahmad Dahlan');
  });

  it('should process attendance correction non-destructively preserving original values', async () => {
    const res = await correctionService.submitCorrection(
      'att-01',
      'usr-operator',
      'Siti Rahmawati (Operator)',
      {
        userId: 'usr-kades',
        userNama: 'Drs. H. Ahmad Dahlan',
        userJabatan: 'Kepala Desa',
        attendanceDate: '2026-10-09',
        originalCheckIn: '2026-10-09T07:22:10Z',
        originalCheckOut: null,
        originalStatus: 'HADIR',
        correctedCheckIn: '2026-10-09T07:22:10Z',
        correctedCheckOut: '2026-10-09T15:45:00Z',
        correctedStatus: 'HADIR',
        reason: 'Koreksi administratif lupa check-out dinas',
      }
    );

    expect(res.success).toBe(true);
    expect(res.data?.originalCheckOut).toBeNull();
    expect(res.data?.correctedCheckOut).toBe('2026-10-09T15:45:00Z');
    expect(res.data?.state).toBe('PENDING');

    // Test separate approval by authorized official
    const approveRes = await correctionService.approveCorrection(
      res.data!.id,
      'usr-sekdes',
      'Budi Santoso'
    );
    expect(approveRes.success).toBe(true);
    expect(approveRes.data?.state).toBe('APPROVED');
  });
});
