-- ==============================================================================
-- KADESA MIGRATION: Konsolidasi Pengaturan Jam & Kalender
-- ==============================================================================
-- Menjadikan tabel `work_schedules` sebagai SATU-SATUNYA sumber kebenaran (Single Source of Truth)
-- untuk status hari kerja/libur, jam masuk, jam pulang, dan toleransi keterlambatan harian (Senin–Minggu).
--
-- Tabel `holidays` tetap menjadi sumber kebenaran hari libur nasional & desa.
-- Tabel `system_settings` hanya mempertahankan `TIMEZONE` sebagai konfigurasi global zona waktu resmi.
-- Parameter lama (WORK_SCHEDULE_START, WORK_SCHEDULE_END, TOLERANCE_LATE_MINUTES)
-- diarsipkan secara non-destruktif untuk menjaga integritas riwayat historis.
-- ==============================================================================

UPDATE system_settings
SET 
    status = 'ARCHIVED',
    effective_to = CURRENT_DATE,
    description = description || ' (Telah dikonsolidasi & digantikan secara dinamis oleh tabel work_schedules)'
WHERE key IN ('WORK_SCHEDULE_START', 'WORK_SCHEDULE_END', 'TOLERANCE_LATE_MINUTES')
  AND status = 'ACTIVE';
