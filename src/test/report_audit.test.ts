import { describe, it, expect } from 'vitest';
import { reportService } from '../services/reportService';
import { settingsService } from '../services/settingsService';

describe('Report and Export Service Audit Tests', () => {
  it('should generate daily report and correctly label holidays/weekends without false ALPHA', async () => {
    // Test a known holiday date: 2026-08-17 (HUT RI from mockHolidays)
    const holidayDate = '2026-08-17';
    const reportRes = await reportService.getDailyReport(holidayDate);

    expect(reportRes.success).toBe(true);
    expect(reportRes.data).toBeDefined();
    expect(reportRes.data!.length).toBeGreaterThan(0);

    // Unattended apparatus on holiday should be marked LIBUR, not ALPHA
    const holidayItem = reportRes.data!.find((d) => d.status === 'LIBUR');
    expect(holidayItem).toBeDefined();
    expect(holidayItem?.status).toBe('LIBUR');
    expect(holidayItem?.checkOut).toBeNull();
  });

  it('should not fabricate checkout when check-in exists without check-out', async () => {
    const today = new Date().toISOString().split('T')[0];
    const reportRes = await reportService.getDailyReport(today);

    expect(reportRes.success).toBe(true);
    // Find an apparatus who checked in today but has not checked out yet (e.g. Kepala Desa / Operator)
    const activeCheckedIn = reportRes.data?.find((d) => d.checkIn !== null && d.checkOut === null);
    expect(activeCheckedIn).toBeDefined();
    expect(activeCheckedIn?.checkIn).not.toBeNull();
    expect(activeCheckedIn?.checkOut).toBeNull(); // Strictly null, NO fake check-out!
  });

  it('should generate monthly report with correct apparatus aggregations', async () => {
    const monthlyRes = await reportService.getMonthlyReport(10, 2026);
    expect(monthlyRes.success).toBe(true);
    expect(monthlyRes.data?.length).toBeGreaterThan(0);

    const firstAparatur = monthlyRes.data![0];
    expect(firstAparatur.totalWorkdays).toBe(22);
    expect(firstAparatur.attendancePercentage).toBeGreaterThanOrEqual(0);
    expect(firstAparatur.attendancePercentage).toBeLessThanOrEqual(100);
  });

  it('should support dynamic timezone configuration via settingsService', async () => {
    const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    expect(timezone).toBeDefined();
    expect(typeof timezone).toBe('string');
  });

  it('should include provenance bar with "Dicetak aplikasi Kadesa", print date, and in-body page number in exportToPDF', () => {
    let capturedHTML = '';
    const mockPrintWindow = {
      document: {
        open: () => {},
        write: (html: string) => {
          capturedHTML = html;
        },
        close: () => {},
      },
    };
    const originalOpen = window.open;
    window.open = (() => mockPrintWindow) as any;

    reportService.exportToPDF(
      'LAPORAN KEHADIRAN HARIAN',
      ['No', 'Nama', 'Jabatan', 'Status'],
      [['1', 'Budi Santoso', 'Kepala Desa', 'HADIR']],
      'Periode: 2026-10-09',
      '/logo-kadesa.png',
      'Desa Sukamaju'
    );

    window.open = originalOpen;

    expect(capturedHTML).toContain('Dicetak aplikasi Kadesa');
    expect(capturedHTML).toContain('pada tanggal');
    expect(capturedHTML).toContain('Halaman 1 dari');
    expect(capturedHTML).toContain('document-provenance-bar');
    expect(capturedHTML).toContain('No. Registrasi: KDS-LAP-');
  });

  it('should support paper orientation switching between portrait and landscape', () => {
    let portraitHTML = '';
    let landscapeHTML = '';

    const originalOpen = window.open;

    // Test Portrait
    window.open = (() => ({
      document: {
        open: () => {},
        write: (html: string) => {
          portraitHTML = html;
        },
        close: () => {},
      },
    })) as any;

    reportService.exportToPDF(
      'LAPORAN HARIAN',
      ['No', 'Nama'],
      [['1', 'Budi']],
      'Periode: 2026-10-09',
      '/logo.png',
      'Desa Sukamaju',
      undefined,
      'portrait'
    );

    // Test Landscape
    window.open = (() => ({
      document: {
        open: () => {},
        write: (html: string) => {
          landscapeHTML = html;
        },
        close: () => {},
      },
    })) as any;

    reportService.exportToPDF(
      'REKAP BULANAN',
      ['No', 'Nama', 'Hadir', 'Izin', 'Sakit', 'Alpha'],
      [['1', 'Budi', '20', '0', '0', '0']],
      'Bulan Oktober 2026',
      '/logo.png',
      'Desa Sukamaju',
      undefined,
      'landscape'
    );

    window.open = originalOpen;

    expect(portraitHTML).toContain('size: A4 portrait;');
    expect(portraitHTML).toContain('max-width: 900px;');

    expect(landscapeHTML).toContain('size: A4 landscape;');
    expect(landscapeHTML).toContain('max-width: 1200px;');
  });
});

