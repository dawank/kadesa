import { describe, it, expect } from 'vitest';
import { dlService } from '../services/dlService';

describe('Dinas Luar Workflow and State Machine Tests', () => {
  it('should create new DL assignment with initial PENDING state', async () => {
    const res = await dlService.createAssignment(
      'usr-perangkat-1',
      'Dewi Lestari',
      'PERANGKAT_DESA',
      {
        subjectUserId: 'usr-perangkat-1',
        subjectUserNama: 'Dewi Lestari',
        subjectUserJabatan: 'Kaur Keuangan',
        purpose: 'Rapat Evaluasi APBDes di Kantor Camat',
        startDate: '2026-10-15',
        endDate: '2026-10-15',
        locations: [
          { namaLokasi: 'Kantor Camat', latitude: -6.495, longitude: 106.852, radius: 100 },
        ],
      }
    );

    expect(res.success).toBe(true);
    expect(res.data?.state).toBe('PENDING');
    expect(res.data?.locations.length).toBe(1);

    const dlId = res.data!.id;

    // Step 1: Verification
    const verifyRes = await dlService.verifyAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA',
      'Berkas terverifikasi'
    );
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.data?.state).toBe('VERIFIED');

    // Step 2: Approval
    const approveRes = await dlService.approveAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA',
      'Disetujui. Menunggu ratifikasi Kades.'
    );
    expect(approveRes.success).toBe(true);
    expect(approveRes.data?.state).toBe('APPROVED');
    expect(approveRes.data?.ratificationDeadline).not.toBeNull();

    // Step 3: Ratification by non-Kades should FAIL
    const invalidRatify = await dlService.ratifyAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA' // Sekdes CANNOT ratify!
    );
    expect(invalidRatify.success).toBe(false);

    // Step 4: Ratification by Kades should SUCCEED
    const validRatify = await dlService.ratifyAssignment(
      dlId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA' // Kades CAN ratify
    );
    expect(validRatify.success).toBe(true);
    expect(validRatify.data?.state).toBe('RATIFIED');
  });

  it('should require rejection reason when rejecting a DL', async () => {
    const res = await dlService.createAssignment(
      'usr-perangkat-2',
      'Eko Prasetyo',
      'PERANGKAT_DESA',
      {
        subjectUserId: 'usr-perangkat-2',
        subjectUserNama: 'Eko Prasetyo',
        subjectUserJabatan: 'Kasi Pemerintahan',
        purpose: 'Tugas survey',
        startDate: '2026-10-18',
        endDate: '2026-10-18',
        locations: [
          { namaLokasi: 'Titik A', latitude: -6.49, longitude: 106.85, radius: 100 },
        ],
      }
    );

    const dlId = res.data!.id;

    // Reject without reason
    const rejWithoutReason = await dlService.rejectAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA',
      '   '
    );
    expect(rejWithoutReason.success).toBe(false);

    // Reject with reason
    const rejWithReason = await dlService.rejectAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA',
      'Tidak ada anggaran untuk kegiatan terkait'
    );
    expect(rejWithReason.success).toBe(true);
    expect(rejWithReason.data?.state).toBe('REJECTED');
  });

  it('should enforce strict state transition guards and direct approval rules', async () => {
    // Create new DL
    const res = await dlService.createAssignment(
      'usr-perangkat-1',
      'Dewi Lestari',
      'PERANGKAT_DESA',
      {
        subjectUserId: 'usr-perangkat-1',
        subjectUserNama: 'Dewi Lestari',
        subjectUserJabatan: 'Kaur Keuangan',
        purpose: 'Rapat Koordinasi Bapenda',
        startDate: '2026-10-25',
        endDate: '2026-10-25',
        locations: [{ namaLokasi: 'Kantor Bapenda', latitude: -6.48, longitude: 106.85, radius: 100 }],
      }
    );
    const dlId = res.data!.id;

    // 1. Non-Kades (Sekdes) CANNOT approve directly when state is PENDING (must be VERIFIED first)
    const invalidApprove = await dlService.approveAssignment(
      dlId,
      'usr-sekdes',
      'Bambang Wijaya',
      'SEKRETARIS_DESA'
    );
    expect(invalidApprove.success).toBe(false);
    expect(invalidApprove.message).toContain('harus berstatus VERIFIED');

    // 2. Kades CAN directly approve when state is PENDING
    const kadesDirectApprove = await dlService.approveAssignment(
      dlId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA',
      'Direct approval oleh Kepala Desa'
    );
    expect(kadesDirectApprove.success).toBe(true);
    expect(kadesDirectApprove.data?.state).toBe('APPROVED');

    // 3. Ratify already approved DL by Kades
    const kadesRatify = await dlService.ratifyAssignment(
      dlId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA'
    );
    expect(kadesRatify.success).toBe(true);
    expect(kadesRatify.data?.state).toBe('RATIFIED');

    // 4. Cannot re-approve an already RATIFIED DL
    const reApprove = await dlService.approveAssignment(
      dlId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA'
    );
    expect(reApprove.success).toBe(false);
  });

  it('should require mandatory selfie and location verification for DL attendance', async () => {
    // 1. Create a fresh approved DL
    const createRes = await dlService.createAssignment(
      'usr-perangkat-1',
      'Dewi Lestari',
      'PERANGKAT_DESA',
      {
        subjectUserId: 'usr-perangkat-1',
        subjectUserNama: 'Dewi Lestari',
        subjectUserJabatan: 'Kaur Keuangan',
        purpose: 'Kegiatan Monitoring Dinas Luar',
        startDate: '2026-10-28',
        endDate: '2026-10-28',
        locations: [{ namaLokasi: 'Titik Pos 1', latitude: -6.49502, longitude: 106.85201, radius: 100 }],
      }
    );
    const dlId = createRes.data!.id;

    // Approve directly by Kades
    await dlService.approveAssignment(
      dlId,
      'usr-kades',
      'Drs. H. Ahmad Dahlan',
      'KEPALA_DESA'
    );

    const locationCoords = { latitude: -6.49502, longitude: 106.85201, accuracy: 12 };

    // 2. Check-In without selfie MUST FAIL
    const noSelfie = await dlService.submitDLAttendance(
      dlId,
      'CHECK_IN',
      locationCoords,
      ''
    );
    expect(noSelfie.success).toBe(false);
    expect(noSelfie.errorCode).toBe('SELFIE_REQUIRED');

    // 3. Check-In with valid selfie MUST SUCCEED
    const mockSelfie = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...mockSelfie';
    const validCheckIn = await dlService.submitDLAttendance(
      dlId,
      'CHECK_IN',
      locationCoords,
      mockSelfie
    );
    expect(validCheckIn.success).toBe(true);
    expect(validCheckIn.data?.hasCheckedIn).toBe(true);

    // 4. Early Check-Out without reason MUST FAIL if before shift end
    const earlyCheckOutNoReason = await dlService.submitDLAttendance(
      dlId,
      'CHECK_OUT',
      locationCoords,
      mockSelfie,
      ''
    );
    // If current time is earlier than 15:30 (shift end), it requires reason
    const nowHour = new Date().getHours();
    const nowMinutes = new Date().getMinutes();
    const isShiftEnded = nowHour > 15 || (nowHour === 15 && nowMinutes >= 30);

    if (!isShiftEnded) {
      expect(earlyCheckOutNoReason.success).toBe(false);
      expect(earlyCheckOutNoReason.errorCode).toBe('EARLY_LEAVE_REASON_REQUIRED');

      // 5. Check-Out with valid reason MUST SUCCEED
      const validCheckOut = await dlService.submitDLAttendance(
        dlId,
        'CHECK_OUT',
        locationCoords,
        mockSelfie,
        'Tugas dinas lapangan selesai'
      );
      expect(validCheckOut.success).toBe(true);
      expect(validCheckOut.data?.hasCheckedOut).toBe(true);
    } else {
      // After 15:30, check-out without early reason is allowed by business rule
      expect(earlyCheckOutNoReason.success).toBe(true);
      expect(earlyCheckOutNoReason.data?.hasCheckedOut).toBe(true);
    }
  });
});
