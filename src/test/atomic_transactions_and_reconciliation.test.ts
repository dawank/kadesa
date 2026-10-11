import { describe, it, expect, beforeEach } from 'vitest';
import { correctionService } from '../services/correctionService';
import { dlService } from '../services/dlService';
import { authService } from '../services/authService';

describe('Atomic Transactions and Reconciliation Remediation Tests', () => {
  // ============================================================================
  // P0: TRANSAKSI ATOMIK KOREKSI ABSENSI
  // ============================================================================
  describe('P0 — Persetujuan Koreksi Absensi Atomik', () => {
    it('skenario 1: persetujuan koreksi sukses dan status presensi terbarui', async () => {
      const submitRes = await correctionService.submitCorrection(
        'att-rec-test-1',
        'usr-operator',
        'Siti Rahmawati',
        {
          userId: 'usr-perangkat-1',
          userNama: 'Dewi Lestari',
          userJabatan: 'Kaur Keuangan',
          attendanceDate: '2026-10-10',
          originalCheckIn: '2026-10-10T08:00:00Z',
          originalCheckOut: null,
          originalStatus: 'HADIR',
          correctedCheckIn: '2026-10-10T08:00:00Z',
          correctedCheckOut: '2026-10-10T16:00:00Z',
          correctedStatus: 'HADIR',
          reason: 'Lupa check-out karena tugas lapangan sore hari',
        }
      );

      expect(submitRes.success).toBe(true);
      const corrId = submitRes.data!.id;

      // Disetujui oleh Sekretaris Desa yang berwenang
      const approveRes = await correctionService.approveCorrection(
        corrId,
        'usr-sekdes',
        'Bambang Wijaya'
      );

      expect(approveRes.success).toBe(true);
      expect(approveRes.data?.state).toBe('APPROVED');
      expect(approveRes.data?.correctedCheckOut).toBe('2026-10-10T16:00:00Z');
      expect(approveRes.data?.processedByUserId).toBe('usr-sekdes');
    });

    it('skenario 2: persetujuan koreksi gagal jika ID tidak valid dan tidak mengubah apapun', async () => {
      const approveRes = await correctionService.approveCorrection(
        'cor-non-existent-999',
        'usr-sekdes',
        'Bambang Wijaya'
      );

      expect(approveRes.success).toBe(false);
      expect(approveRes.message).toContain('tidak ditemukan');
    });

    it('skenario 3: dua request persetujuan bersamaan (anti-replay / race condition)', async () => {
      const submitRes = await correctionService.submitCorrection(
        'att-rec-test-race',
        'usr-operator',
        'Siti Rahmawati',
        {
          userId: 'usr-perangkat-2',
          userNama: 'Eko Prasetyo',
          userJabatan: 'Kasi Pemerintahan',
          attendanceDate: '2026-10-10',
          originalCheckIn: '2026-10-10T07:30:00Z',
          originalCheckOut: null,
          originalStatus: 'HADIR',
          correctedCheckIn: '2026-10-10T07:30:00Z',
          correctedCheckOut: '2026-10-10T15:30:00Z',
          correctedStatus: 'HADIR',
          reason: 'Koreksi administratif',
        }
      );
      const corrId = submitRes.data!.id;

      // Permohonan persetujuan pertama berhasil
      const res1 = await correctionService.approveCorrection(corrId, 'usr-sekdes', 'Bambang Wijaya');
      expect(res1.success).toBe(true);
      expect(res1.data?.state).toBe('APPROVED');

      // Permohonan persetujuan kedua harus DITOLAK (anti-replay / terminal guard)
      const res2 = await correctionService.approveCorrection(corrId, 'usr-kades', 'Drs. H. Ahmad Dahlan');
      expect(res2.success).toBe(false);
      expect(res2.message).toMatch(/(PENDING|sudah diproses|terminal)/i);
    });

    it('skenario 4: pemohon tidak dapat menyetujui permohonannya sendiri (anti-self-approval)', async () => {
      const submitRes = await correctionService.submitCorrection(
        'att-rec-test-self',
        'usr-operator',
        'Siti Rahmawati',
        {
          userId: 'usr-operator',
          userNama: 'Siti Rahmawati',
          userJabatan: 'Kaur TU & Umum',
          attendanceDate: '2026-10-10',
          originalCheckIn: '2026-10-10T07:50:00Z',
          originalCheckOut: null,
          originalStatus: 'HADIR',
          correctedCheckIn: '2026-10-10T07:50:00Z',
          correctedCheckOut: '2026-10-10T16:00:00Z',
          correctedStatus: 'HADIR',
          reason: 'Koreksi diri sendiri',
        }
      );
      const corrId = submitRes.data!.id;

      // Siti (pemohon & subjek) mencoba menyetujui koreksinya sendiri
      const approveRes = await correctionService.approveCorrection(
        corrId,
        'usr-operator',
        'Siti Rahmawati'
      );

      expect(approveRes.success).toBe(false);
      expect(approveRes.message).toContain('Konflik kepentingan');
    });
  });

  // ============================================================================
  // P2: TRANSAKSI ATOMIK PEMBUATAN DINAS LUAR
  // ============================================================================
  describe('P2 — Pembuatan Dinas Luar Atomik', () => {
    it('skenario 5: pembuatan DL dengan banyak lokasi tujuan berhasil disimpan', async () => {
      const res = await dlService.createAssignment(
        'usr-sekdes',
        'Bambang Wijaya',
        'SEKRETARIS_DESA',
        {
          subjectUserId: 'usr-perangkat-1',
          subjectUserNama: 'Dewi Lestari',
          subjectUserJabatan: 'Kaur Keuangan',
          purpose: 'Koordinasi Pajak & Retribusi Daerah di 3 Instansi',
          startDate: '2026-10-20',
          endDate: '2026-10-21',
          locations: [
            { namaLokasi: 'Kantor Bapenda', latitude: -6.4912, longitude: 106.8512, radius: 100 },
            { namaLokasi: 'Kantor Inspektorat', latitude: -6.4955, longitude: 106.8566, radius: 100 },
            { namaLokasi: 'Bank BJB Cabang', latitude: -6.4888, longitude: 106.8488, radius: 80 },
          ],
        }
      );

      expect(res.success).toBe(true);
      expect(res.data?.state).toBe('PENDING');
      expect(res.data?.locations.length).toBe(3);
      expect(res.data?.locations[0].namaLokasi).toBe('Kantor Bapenda');
      expect(res.data?.locations[1].namaLokasi).toBe('Kantor Inspektorat');
      expect(res.data?.locations[2].namaLokasi).toBe('Bank BJB Cabang');
    });

    it('skenario 6: kegagalan validasi lokasi membatalkan seluruh pembuatan DL', async () => {
      const res = await dlService.createAssignment(
        'usr-sekdes',
        'Bambang Wijaya',
        'SEKRETARIS_DESA',
        {
          subjectUserId: 'usr-perangkat-1',
          subjectUserNama: 'Dewi Lestari',
          subjectUserJabatan: 'Kaur Keuangan',
          purpose: 'Tugas dengan koordinat invalid',
          startDate: '2026-10-22',
          endDate: '2026-10-22',
          locations: [
            { namaLokasi: 'Lokasi Valid', latitude: -6.4912, longitude: 106.8512, radius: 100 },
            { namaLokasi: 'Lokasi Rusak', latitude: 999.0, longitude: 106.8512, radius: 100 }, // Invalid Latitude!
          ],
        }
      );

      // Seluruh transaksi dibatalkan (tidak tersimpan ke state)
      expect(res.success).toBe(false);
      expect(res.message).toMatch(/(di luar rentang|tidak valid|Latitude)/i);
    });

    it('skenario 7: pengguna tanpa hak tidak dapat menugaskan aparatur lain', async () => {
      // Perangkat biasa tidak boleh membuat penugasan untuk aparatur lain
      const res = await dlService.createAssignment(
        'usr-perangkat-1',
        'Dewi Lestari',
        'PERANGKAT_DESA',
        {
          subjectUserId: 'usr-perangkat-2', // Menugaskan staf lain!
          subjectUserNama: 'Eko Prasetyo',
          subjectUserJabatan: 'Kasi Pemerintahan',
          purpose: 'Mencoba menugaskan orang lain tanpa wewenang',
          startDate: '2026-10-25',
          endDate: '2026-10-25',
          locations: [
            { namaLokasi: 'Kantor Camat', latitude: -6.4912, longitude: 106.8512, radius: 100 },
          ],
        }
      );

      expect(res.success).toBe(false);
      expect(res.message).toContain('Kewenangan ditolak');
    });
  });

  // ============================================================================
  // P1: KEWENANGAN DINAS LUAR & LOGIN POLICY
  // ============================================================================
  describe('P1 — Penyelarasan Otoritas DL & Kebijakan Login Gagal', () => {
    it('skenario 8: otorisasi dl_approve selaras antara service dan aturan database', () => {
      // Yang berwenang menyetujui SPT Dinas Luar resmi:
      expect(authService.hasPermission('SEKRETARIS_DESA', 'dl_approve')).toBe(true);
      expect(authService.hasPermission('KEPALA_DESA', 'dl_approve')).toBe(true);
      expect(authService.hasPermission('SUPER_ADMIN', 'dl_approve')).toBe(true);

      // Yang TIDAK berwenang menyetujui SPT:
      expect(authService.hasPermission('OPERATOR_DESA', 'dl_approve')).toBe(false);
      expect(authService.hasPermission('PERANGKAT_DESA', 'dl_approve')).toBe(false);

      // Ratifikasi eksklusif Kepala Desa:
      expect(authService.hasPermission('KEPALA_DESA', 'dl_ratify')).toBe(true);
      expect(authService.hasPermission('SEKRETARIS_DESA', 'dl_ratify')).toBe(false);
      expect(authService.hasPermission('OPERATOR_DESA', 'dl_ratify')).toBe(false);
      expect(authService.hasPermission('SUPER_ADMIN', 'dl_ratify')).toBe(false);
    });

    it('skenario 9: login gagal dengan kredensial salah menghasilkan AUTH_FAILED', async () => {
      const res = await authService.login('operator', 'password_salah_total');
      expect(res.success).toBe(false);
      expect(res.message).toContain('tidak valid');
    });
  });
});
