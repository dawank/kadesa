-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Manual Concurrency Test (RT-08)
-- File: supabase/tests/concurrency_validation_manual.sql
-- Deskripsi: Prosedur Pengujian Konkurensi Row-Locking (FOR UPDATE) pada Konsumsi Koreksi
-- Target: Staging Database / PostgreSQL Test Environment (BUKAN PRODUCTION)
-- Prasyarat: Memerlukan DUA (2) KONEKSI/SESI SIMULTAN (misal 2 tab psql atau 2 jendela SQL Editor)
-- Status: MANUAL INTERACTIVE VALIDATION (Tidak dapat dijalankan dalam 1 skrip otomatis)
-- ==============================================================================

-- ==============================================================================
-- TAHAP 0: PERSIAPAN FIXTURE (Jalankan di SESI 1)
-- ==============================================================================
BEGIN;
-- Buat fixture aparatur & akun auth jika belum ada
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
VALUES 
    ('00000000-0000-0000-0000-000000000099'::uuid, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'cc_user@kadesa.test', '', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.users (id, auth_user_id, username, password_hash, nama, nik, nomor_whatsapp, role, jabatan_id, attendance_required, active)
VALUES 
    ('usr-test-conc-01', '00000000-0000-0000-0000-000000000099'::uuid, 'fix_conc_user', 'LOCKED', 'Aparatur Konkurensi', '3201019900090001', '081299990099', 'PERANGKAT_DESA', 'pos-03', TRUE, TRUE)
ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

-- Record presensi awal
INSERT INTO public.attendance_records (
    id, user_id, attendance_date, type, check_in_at, check_out_at,
    check_in_latitude, check_in_longitude, check_in_distance_meters, status, correction_state
) VALUES (
    'test-att-conc-01', 'usr-test-conc-01', CURRENT_DATE - 2, 'REGULAR',
    (CURRENT_DATE - 2)::timestamp + INTERVAL '8 hours',
    (CURRENT_DATE - 2)::timestamp + INTERVAL '16 hours',
    -6.4828, 106.8436, 15, 'TERLAMBAT', 'ORIGINAL'
) ON CONFLICT (id) DO NOTHING;

-- Dokumen koreksi sah berstatus APPROVED yang BELUM dikonsumsi (applied_at IS NULL)
INSERT INTO public.attendance_corrections (
    id, attendance_record_id, user_id, requested_by,
    original_status, corrected_status, reason, state, approved_by, approved_at, applied_at, applied_by
) VALUES (
    'test-cor-conc-01', 'test-att-conc-01', 'usr-test-conc-01', 'usr-test-conc-01',
    'TERLAMBAT', 'HADIR', 'Uji Konkurensi Konsumsi', 'APPROVED', 'usr-kades', NOW(), NULL, NULL
) ON CONFLICT (id) DO UPDATE SET applied_at = NULL, applied_by = NULL, state = 'APPROVED';

COMMIT;


-- ==============================================================================
-- TAHAP 1: EKSEKUSI SESI 1 (Transaksi Pertama Memperoleh Row Lock)
-- ==============================================================================
-- Di SESI 1:
BEGIN;
-- Setel konteks autentikasi
PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}', true);

-- Konsumsi koreksi presensi (akan mengunci baris attendance_corrections dengan FOR UPDATE di trigger)
UPDATE public.attendance_records
SET status = 'HADIR',
    correction_state = 'CORRECTED'
WHERE id = 'test-att-conc-01';

-- PERHATIAN: JANGAN JALANKAN COMMIT DI SESI 1 DAHULU! BIARKAN TRANSAKSI MENGGANTUNG.


-- ==============================================================================
-- TAHAP 2: EKSEKUSI SESI 2 (Transaksi Kedua Mencoba Konsumsi Bersamaan)
-- ==============================================================================
-- Di SESI 2 (Tab / Jendela Terpisah):
BEGIN;
-- Setel konteks autentikasi
PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000099', true);
PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
PERFORM set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000099","role":"authenticated"}', true);

-- Coba konsumsi koreksi presensi yang sama secara bersamaan:
UPDATE public.attendance_records
SET status = 'HADIR',
    correction_state = 'CORRECTED'
WHERE id = 'test-att-conc-01';

-- HASIL SEMENTARA DI SESI 2:
-- Query di SESI 2 akan TERHENTI / MENUNGGU (BLOCKING) karena baris dikunci oleh SESI 1.


-- ==============================================================================
-- TAHAP 3: PELEPASAN KUNCI DI SESI 1 (COMMIT)
-- ==============================================================================
-- Di SESI 1:
COMMIT; -- Sesi 1 berhasil mengonsumsi koreksi dan mengisi applied_at


-- ==============================================================================
-- TAHAP 4: EVALUASI HASIL DI SESI 2
-- ==============================================================================
-- Setelah Sesi 1 melakukan COMMIT, query di Sesi 2 otomatis melanjutkan eksekusi.
-- HASIL EKSPEKTASI DI SESI 2:
-- Sesi 2 GAGAL dan MELEMPAR EXCEPTION:
-- "ERROR: Koreksi presensi ditolak: Tidak ditemukan dokumen koreksi berstatus APPROVED
--  yang sah, belum digunakan, dan sesuai persis dengan nilai waktu/status target."
-- (SQLSTATE: P0001)

-- Bersihkan transaksi Sesi 2:
ROLLBACK;


-- ==============================================================================
-- TAHAP 5: TEARDOWN / PEMBERSIHAN DATA PENGUJIAN (Jalankan di SESI 1)
-- ==============================================================================
BEGIN;
DELETE FROM public.attendance_records WHERE id = 'test-att-conc-01';
DELETE FROM public.attendance_corrections WHERE id = 'test-cor-conc-01';
DELETE FROM public.audit_logs WHERE entity_id = 'test-att-conc-01';
DELETE FROM public.users WHERE id = 'usr-test-conc-01';
DELETE FROM auth.users WHERE id = '00000000-0000-0000-0000-0000099'::uuid;
COMMIT;

-- KESIMPULAN AUDIT RUNTIME:
-- Jika Sesi 2 terbukti tertahan dan melempar P0001 saat Sesi 1 commit,
-- maka mekanisme row-locking 'FOR UPDATE' pada migrasi 006 TERBUKTI AMAN terhadap Race Condition.
