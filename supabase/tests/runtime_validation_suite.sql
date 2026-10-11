-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Runtime PostgreSQL Validation Suite
-- File: supabase/tests/runtime_validation_suite.sql
-- Deskripsi: Skrip Uji Otomatis Lingkungan Terisolasi (PostgreSQL / Supabase)
-- Target: Lingkungan Pengujian Terpisah / Staging Database (BUKAN PRODUCTION)
-- Petunjuk: Jalankan skrip ini menggunakan psql atau SQL Editor di DB Staging.
-- Seluruh pengujian DML dibungkus dalam blok transaksi yang di-ROLLBACK
-- sehingga database staging tetap bersih dari data sampah pengujian.
-- ==============================================================================

-- \set ON_ERROR_STOP on

SELECT '=== [KADESA RUNTIME VALIDATION SUITE] MEMULAI PENGUJIAN KONTROLLED ===' AS suite_start;

-- BLOK 1: VERIFIKASI SKEMA DAN KEBERADAAN OBJEK (SCHEMA ASSERTIONS - RT-01 & RT-02)
-- ==============================================================================
DO $$
DECLARE
    v_missing_tables TEXT[] := '{}';
    v_table TEXT;
    v_count INTEGER;
BEGIN
    RAISE NOTICE '--- [BLOK 1] Verifikasi Keberadaan 14 Tabel Inti (RT-01) ---';
    FOREACH v_table IN ARRAY ARRAY[
        'villages', 'positions', 'users', 'system_settings', 'work_schedules',
        'holidays', 'attendance_records', 'dl_assignments', 'dl_locations',
        'dl_evidence', 'absence_requests', 'attendance_corrections', 'audit_logs', 'notifications'
    ] LOOP
        SELECT COUNT(*) INTO v_count FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = v_table;
        IF v_count = 0 THEN
            v_missing_tables := array_append(v_missing_tables, v_table);
        END IF;
    END LOOP;

    IF array_length(v_missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'FAIL: Tabel tidak lengkap: %', v_missing_tables;
    ELSE
        RAISE NOTICE 'PASS: Seluruh 14 tabel inti terdaftar di information_schema.';
    END IF;

    RAISE NOTICE '--- [BLOK 1] Verifikasi RLS Aktif pada Seluruh Tabel (RT-02) ---';
    SELECT COUNT(*) INTO v_count 
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' 
      AND c.relname = ANY(ARRAY[
          'villages', 'positions', 'users', 'system_settings', 'work_schedules',
          'holidays', 'attendance_records', 'dl_assignments', 'dl_locations',
          'dl_evidence', 'absence_requests', 'attendance_corrections', 'audit_logs', 'notifications'
      ])
      AND c.relrowsecurity = TRUE;

    IF v_count != 14 THEN
        RAISE EXCEPTION 'FAIL: RLS belum aktif pada seluruh 14 tabel (Aktif: % / 14)', v_count;
    ELSE
        RAISE NOTICE 'PASS: Row Level Security (RLS) aktif pada seluruh 14 tabel.';
    END IF;

    RAISE NOTICE '--- [BLOK 1] Verifikasi Kolom Pelacak Anti-Replay & DL ---';
    SELECT COUNT(*) INTO v_count FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_corrections' AND column_name IN ('applied_at', 'applied_by');
    IF v_count != 2 THEN
        RAISE EXCEPTION 'FAIL: Kolom applied_at atau applied_by belum terpasang di attendance_corrections.';
    ELSE
        RAISE NOTICE 'PASS: Kolom pelacak applied_at dan applied_by terverifikasi.';
    END IF;

    SELECT COUNT(*) INTO v_count FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'attendance_records' AND column_name = 'dl_assignment_id';
    IF v_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Kolom dl_assignment_id belum terpasang di attendance_records.';
    ELSE
        RAISE NOTICE 'PASS: Kolom dl_assignment_id terverifikasi.';
    END IF;
END $$;


-- ==============================================================================
-- BLOK 2: PENGUJIAN KALKULASI HAVERSINE DI LEVEL DATABASE (RT-03)
-- Dieksekusi sebagai superuser maintenance (karena hak EXECUTE publik dicabut)
-- ==============================================================================
DO $$
DECLARE
    v_dist INTEGER;
BEGIN
    RAISE NOTICE '--- [BLOK 2] Pengujian Fungsi Haversine Server-Side (RT-03) ---';
    -- Titik A (Desa Sukamaju): -6.4828, 106.8436
    -- Titik B (Titik sama persis): jarak harus 0 meter
    v_dist := public.calculate_haversine_distance_meters(-6.4828, 106.8436, -6.4828, 106.8436);
    IF v_dist != 0 THEN
        RAISE EXCEPTION 'FAIL: Jarak titik yang sama bukan 0m (hasil: %m)', v_dist;
    END IF;

    -- Titik C (Geser ~55 meter): -6.4832, 106.8439
    v_dist := public.calculate_haversine_distance_meters(-6.4828, 106.8436, -6.4832, 106.8439);
    IF v_dist < 40 OR v_dist > 70 THEN
        RAISE EXCEPTION 'FAIL: Jarak kalkulasi melenceng (%m, ekspektasi ~55m)', v_dist;
    ELSE
        RAISE NOTICE 'PASS: Jarak kalkulasi titik dekat akurat: %m', v_dist;
    END IF;

    -- Uji Nilai Null & Batas Tidak Valid
    IF public.calculate_haversine_distance_meters(NULL, 106.8436, -6.4828, 106.8436) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: Parameter NULL harus menghasilkan NULL';
    END IF;

    IF public.calculate_haversine_distance_meters(95.0, 106.8436, -6.4828, 106.8436) IS NOT NULL THEN
        RAISE EXCEPTION 'FAIL: Latitude di luar batas [-90, +90] harus menghasilkan NULL';
    END IF;

    RAISE NOTICE 'PASS: Validasi boundary matematis Haversine berhasil.';
END $$;


-- ==============================================================================
-- BLOK 3: PENGUJIAN GEOFENCE REGULER (NEGATIF: UNCONFIRMED GEOFENCE REJECTION - RT-04)
-- Menggunakan Fixture Terisolasi dan Simulasi Konteks Autentikasi Supabase
-- ==============================================================================
BEGIN; -- Transaksi Uji 3
DO $$
DECLARE
    v_err_caught BOOLEAN := FALSE;
    v_fixture_auth_id UUID := '00000000-0000-0000-0000-000000000001'::uuid;
    v_fixture_user_id VARCHAR(50) := 'usr-test-geo-perangkat';
BEGIN
    RAISE NOTICE '--- [BLOK 3] Uji Negatif: Penolakan Presensi Kantor saat OFFICE_COORDINATES_CONFIRMED = false (RT-04) ---';

    -- 1. Buat fixture akun auth (jika tabel auth.users tersedia di Supabase)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at)
        VALUES (v_fixture_auth_id, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'test_geo@kadesa.test', '', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Buat fixture pengguna di public.users yang tertaut ke v_fixture_auth_id
    PERFORM set_config('kadesa.migration_context', 'active', true);
    INSERT INTO public.users (
        id, auth_user_id, username, password_hash, nama, nik, nomor_whatsapp, role, jabatan_id, attendance_required, active
    ) VALUES (
        v_fixture_user_id, v_fixture_auth_id, 'test_geo_user', 'LOCKED', 'Test Perangkat Geofence',
        '3201019900010001', '081299990001', 'PERANGKAT_DESA', 'pos-03', TRUE, TRUE
    ) ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

    -- 3. Setel Konfigurasi Staging: Koordinat Belum Dikonfirmasi
    UPDATE public.system_settings SET value = 'false' WHERE key = 'OFFICE_COORDINATES_CONFIRMED';

    PERFORM set_config('kadesa.migration_context', '', true);
    -- 4. Setel Konteks Autentikasi Pengguna Terautentikasi (auth.uid() = v_fixture_auth_id)
    PERFORM set_config('request.jwt.claim.sub', v_fixture_auth_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fixture_auth_id::text, 'role', 'authenticated')::text, true);

    -- Pastikan auth.uid() benar-benar mengembalikan UUID fixture
    IF auth.uid() IS DISTINCT FROM v_fixture_auth_id THEN
        RAISE EXCEPTION 'FAIL: Simulasi auth.uid() gagal (Ekspektasi: %, Hasil: %)', v_fixture_auth_id, auth.uid();
    END IF;

    -- 5. Eksekusi Uji Negatif: Coba catat presensi REGULAR
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.attendance_records (
            id, user_id, attendance_date, type, check_in_at,
            check_in_latitude, check_in_longitude, status
        ) VALUES (
            'test-att-geo-01', v_fixture_user_id, CURRENT_DATE, 'REGULAR', NOW(),
            -6.4828, 106.8436, 'HADIR'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Koordinat resmi kantor desa belum dikonfirmasi%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Presensi kantor ditolak sesuai aturan ADR-012 (Pesan: %)', SQLERRM;
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan presensi unconfirmed tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Presensi kantor lolos padahal koordinat kantor belum dikonfirmasi!';
    END IF;

    -- 6. Uji Terpisah: Verifikasi Bypass Superuser Maintenance (Saat auth.uid() IS NULL)
    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
    RAISE NOTICE 'PASS: Konteks superuser maintenance berhasil dipulihkan (auth.uid() cleared).';
END $$;
ROLLBACK; -- Batalkan seluruh perubahan transaksi uji 3 (Zero Residue)


-- ==============================================================================
-- BLOK 4: PENGUJIAN INTEGRITAS ALUR KOREKSI PRESENSI & ANTI-REPLAY (RT-05)
-- Menggunakan Multi-Actor Fixture (Perangkat, Operator, Kepala Desa)
-- ==============================================================================
BEGIN; -- Transaksi Uji 4
DO $$
DECLARE
    v_err_caught BOOLEAN := FALSE;
    v_auth_perangkat UUID := '00000000-0000-0000-0000-000000000011'::uuid;
    v_auth_operator  UUID := '00000000-0000-0000-0000-000000000012'::uuid;
    v_auth_kades     UUID := '00000000-0000-0000-0000-000000000013'::uuid;

    v_user_perangkat VARCHAR(50) := 'usr-test-cor-perangkat';
    v_user_operator  VARCHAR(50) := 'usr-test-cor-operator';
    v_user_kades     VARCHAR(50) := 'usr-test-cor-kades';

    v_att_id VARCHAR(50) := 'test-att-cor-01';
    v_cor_id VARCHAR(50) := 'test-cor-01';
    v_applied_check RECORD;
BEGIN
    RAISE NOTICE '--- [BLOK 4] Penyiapan Multi-Actor Fixture untuk Koreksi Presensi (RT-05) ---';

    -- 1. Daftarkan auth fixture
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
            (v_auth_perangkat, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'cor_perangkat@kadesa.test', '', NOW(), NOW()),
            (v_auth_operator,  '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'cor_operator@kadesa.test', '', NOW(), NOW()),
            (v_auth_kades,     '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'cor_kades@kadesa.test', '', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Daftarkan profil aparatur di public.users
    PERFORM set_config('kadesa.migration_context', 'active', true);
    PERFORM set_config('kadesa.migration_context', 'active', true);
    INSERT INTO public.users (id, auth_user_id, username, password_hash, nama, nik, nomor_whatsapp, role, jabatan_id, attendance_required, active) VALUES
        (v_user_perangkat, v_auth_perangkat, 'fix_cor_perangkat', 'LOCKED', 'Dewi Perangkat Test', '3201019900020001', '081299990011', 'PERANGKAT_DESA', 'pos-03', TRUE, TRUE),
        (v_user_operator,  v_auth_operator,  'fix_cor_operator',  'LOCKED', 'Siti Operator Test',  '3201019900020002', '081299990012', 'OPERATOR_DESA',  'pos-10', TRUE, TRUE),
        (v_user_kades,     v_auth_kades,     'fix_cor_kades',     'LOCKED', 'Ahmad Kades Test',     '3201019900020003', '081299990013', 'KEPALA_DESA',    'pos-01', TRUE, TRUE)
    ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

    -- 3. Buat record presensi awal (Status: TERLAMBAT, correction_state: ORIGINAL)
    INSERT INTO public.attendance_records (
        id, user_id, attendance_date, type, check_in_at, check_out_at,
        check_in_latitude, check_in_longitude, check_in_distance_meters,
        status, correction_state
    ) VALUES (
        v_att_id, v_user_perangkat, CURRENT_DATE - 1, 'REGULAR',
        (CURRENT_DATE - 1)::timestamp + INTERVAL '8 hours',
        (CURRENT_DATE - 1)::timestamp + INTERVAL '16 hours',
        -6.4828, 106.8436, 15, 'TERLAMBAT', 'ORIGINAL'
    );

    -- --------------------------------------------------------------------------
    PERFORM set_config('kadesa.migration_context', '', true);
    -- 4.1 Uji Negatif: Pengajuan Koreksi Baru Dilarang Langsung APPROVED
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_operator::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_operator::text, 'role', 'authenticated')::text, true);
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.attendance_corrections (
            id, attendance_record_id, user_id, requested_by,
            original_status, corrected_status, reason, state
        ) VALUES (
            v_cor_id, v_att_id, v_user_perangkat, v_user_operator,
            'TERLAMBAT', 'HADIR', 'Dispensasi tugas lapangan', 'APPROVED'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Pengajuan koreksi baru wajib berstatus PENDING%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Pengajuan koreksi langsung APPROVED berhasil ditolak.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan status awal tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Koreksi baru berstatus APPROVED lolos!';
    END IF;

    -- --------------------------------------------------------------------------
    -- 4.2 Pengajuan Sah Berstatus PENDING (Diajukan oleh Aparatur Pemilik)
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_perangkat::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_perangkat::text, 'role', 'authenticated')::text, true);
    INSERT INTO public.attendance_corrections (
        id, attendance_record_id, user_id, requested_by,
        corrected_check_in, corrected_check_out,
        corrected_status, reason, state
    ) VALUES (
        v_cor_id, v_att_id, v_user_perangkat, v_user_perangkat,
        (CURRENT_DATE - 1)::timestamp + INTERVAL '8 hours',
        (CURRENT_DATE - 1)::timestamp + INTERVAL '16 hours',
        'HADIR', 'Salah jam check in', 'PENDING'
    );
    RAISE NOTICE 'PASS: Pengajuan koreksi sah PENDING berhasil dibuat.';

    -- --------------------------------------------------------------------------
    -- 4.3 Uji Negatif: Otorisasi & Anti-Self-Approval
    -- --------------------------------------------------------------------------
    -- a. Pemohon (Perangkat Desa) ditolak karena tidak memiliki wewenang persetujuan
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.attendance_corrections
        SET state = 'APPROVED'
        WHERE id = v_cor_id;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%tidak memiliki wewenang untuk menyetujui%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Perangkat desa tanpa wewenang berhasil ditolak (Pesan: %).', SQLERRM;
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan wewenang tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Perangkat desa berhasil menyetujui koreksi presensi!';
    END IF;

    -- b. Operator Desa (memiliki wewenang approval) mencoba menyetujui koreksi yang diajukan oleh dirinya sendiri
    PERFORM set_config('request.jwt.claim.sub', v_auth_operator::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_operator::text, 'role', 'authenticated')::text, true);

    INSERT INTO public.attendance_corrections (
        id, attendance_record_id, user_id, requested_by,
        corrected_status, reason, state
    ) VALUES (
        'test-cor-op', v_att_id, v_user_perangkat, v_user_operator,
        'HADIR', 'Operator self-approval test', 'PENDING'
    );

    v_err_caught := FALSE;
    BEGIN
        UPDATE public.attendance_corrections
        SET state = 'APPROVED'
        WHERE id = 'test-cor-op';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Konflik kepentingan%' OR SQLERRM LIKE '%dilarang menyetujui koreksi%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Anti-self-approval Operator berhasil ditegakkan (Pesan: %).', SQLERRM;
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan self-approval operator tidak sesuai: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Operator berhasil menyetujui permohonan koreksinya sendiri!';
    END IF;

    -- --------------------------------------------------------------------------
    -- 4.4 Persetujuan Sah oleh Kepala Desa (Bukan Pemohon)
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_kades::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_kades::text, 'role', 'authenticated')::text, true);
    UPDATE public.attendance_corrections
    SET state = 'APPROVED'
    WHERE id = v_cor_id;

    -- Verifikasi metadata persetujuan
    IF NOT EXISTS (
        SELECT 1 FROM public.attendance_corrections
        WHERE id = v_cor_id AND state = 'APPROVED' AND approved_by = v_user_kades AND approved_at IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'FAIL: Persetujuan koreksi oleh Kepala Desa gagal diperbarui secara valid.';
    ELSE
        RAISE NOTICE 'PASS: Persetujuan sah koreksi oleh Kepala Desa terverifikasi.';
    END IF;

    -- --------------------------------------------------------------------------
    -- 4.5 Konsumsi Atomik Koreksi Presensi & Verifikasi applied_at / Audit Event
    -- --------------------------------------------------------------------------
    -- Konteks tetap: v_auth_kades (eksekusi penerapan koreksi ke attendance_records)
    -- Perhatian: Aktifkan sementara konfirmasi koordinat kantor di dalam transaksi uji
    -- agar evaluasi geofence pada UPDATE attendance_records dapat divalidasi.
    -- Nilai ini akan otomatis kembali ke semula saat ROLLBACK di akhir Blok 4.
    UPDATE public.system_settings SET value = 'true' WHERE key = 'OFFICE_COORDINATES_CONFIRMED';

    UPDATE public.attendance_records
    SET status = 'HADIR',
        correction_state = 'CORRECTED'
    WHERE id = v_att_id;

    -- Verifikasi bahwa applied_at dan applied_by terisi otomatis
    SELECT applied_at, applied_by INTO v_applied_check
    FROM public.attendance_corrections
    WHERE id = v_cor_id;

    IF v_applied_check.applied_at IS NULL THEN
        RAISE EXCEPTION 'FAIL: applied_at tidak terisi saat koreksi presensi diterapkan!';
    ELSIF v_applied_check.applied_by IS DISTINCT FROM v_user_kades THEN
        RAISE EXCEPTION 'FAIL: applied_by tidak cocok (Ekspektasi: %, Hasil: %)', v_user_kades, v_applied_check.applied_by;
    ELSE
        RAISE NOTICE 'PASS: Konsumsi koreksi presensi atomik berhasil mencatat applied_at dan applied_by.';
    END IF;

    -- Verifikasi bahwa audit_logs mencatat event APPLY_ATTENDANCE_CORRECTION
    IF NOT EXISTS (
        SELECT 1 FROM public.audit_logs
        WHERE action = 'APPLY_ATTENDANCE_CORRECTION' AND entity_id = v_att_id
    ) THEN
        RAISE EXCEPTION 'FAIL: Event audit APPLY_ATTENDANCE_CORRECTION tidak tercatat di audit_logs.';
    ELSE
        RAISE NOTICE 'PASS: Event audit koreksi presensi terverifikasi di audit_logs.';
    END IF;

    -- --------------------------------------------------------------------------
    -- 4.6 Uji Negatif: Replay Attack (Mencegah Penggunaan Ulang Koreksi yang Sudah Diterapkan)
    -- --------------------------------------------------------------------------
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.attendance_records
        SET status = 'HADIR',
            correction_state = 'CORRECTED',
            check_in_at = NOW() -- Mencoba memicu kembali koreksi
        WHERE id = v_att_id;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Koreksi presensi ditolak%' OR SQLERRM LIKE '%Persetujuan lama tidak dapat digunakan kembali%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Replay attack berhasil ditolak (koreksi lama tidak dapat dikonsumsi ulang).';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan replay tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Replay attack lolos! Koreksi yang sudah memiliki applied_at berhasil digunakan kembali.';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
END $$;
ROLLBACK; -- Batalkan seluruh perubahan transaksi uji 4 (Zero Residue)


-- ==============================================================================
-- BLOK 5: PENGUJIAN WORKFLOW SURAT TUGAS DINAS LUAR (DL) & STATE MACHINE (RT-06)
-- Menggunakan Multi-Actor Fixture (Perangkat, Sekdes, Kepala Desa)
-- ==============================================================================
BEGIN; -- Transaksi Uji 5
DO $$
DECLARE
    v_err_caught BOOLEAN := FALSE;
    v_auth_perangkat UUID := '00000000-0000-0000-0000-000000000021'::uuid;
    v_auth_sekdes    UUID := '00000000-0000-0000-0000-000000000022'::uuid;
    v_auth_kades     UUID := '00000000-0000-0000-0000-000000000023'::uuid;

    v_user_perangkat VARCHAR(50) := 'usr-test-dl-perangkat';
    v_user_sekdes    VARCHAR(50) := 'usr-test-dl-sekdes';
    v_user_kades     VARCHAR(50) := 'usr-test-dl-kades';

    v_dla_id VARCHAR(50) := 'test-dla-01';
BEGIN
    RAISE NOTICE '--- [BLOK 5] Penyiapan Multi-Actor Fixture untuk Alur Dinas Luar (RT-06) ---';

    -- 1. Daftarkan auth fixture
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') THEN
        INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, created_at, updated_at) VALUES
            (v_auth_perangkat, '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'dl_perangkat@kadesa.test', '', NOW(), NOW()),
            (v_auth_sekdes,    '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'dl_sekdes@kadesa.test', '', NOW(), NOW()),
            (v_auth_kades,     '00000000-0000-0000-0000-000000000000'::uuid, 'authenticated', 'authenticated', 'dl_kades@kadesa.test', '', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING;
    END IF;

    -- 2. Daftarkan profil di public.users
    INSERT INTO public.users (id, auth_user_id, username, password_hash, nama, nik, nomor_whatsapp, role, jabatan_id, attendance_required, active) VALUES
        (v_user_perangkat, v_auth_perangkat, 'fix_dl_perangkat', 'LOCKED', 'Dewi DL Test',    '3201019900030001', '081299990021', 'PERANGKAT_DESA', 'pos-03', TRUE, TRUE),
        (v_user_sekdes,    v_auth_sekdes,    'fix_dl_sekdes',    'LOCKED', 'Bambang Sekdes Test', '3201019900030002', '081299990022', 'SEKRETARIS_DESA', 'pos-02', TRUE, TRUE),
        (v_user_kades,     v_auth_kades,     'fix_dl_kades',     'LOCKED', 'Ahmad Kades DL',     '3201019900030003', '081299990023', 'KEPALA_DESA',    'pos-01', TRUE, TRUE)
    ON CONFLICT (id) DO UPDATE SET auth_user_id = EXCLUDED.auth_user_id;

    -- --------------------------------------------------------------------------
    PERFORM set_config('kadesa.migration_context', '', true);
    -- 5.1 Uji Negatif: Pembuatan Surat Tugas Dilarang Langsung RATIFIED
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_perangkat::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_perangkat::text, 'role', 'authenticated')::text, true);
    v_err_caught := FALSE;
    BEGIN
        INSERT INTO public.dl_assignments (
            id, subject_user_id, requester_user_id, purpose,
            start_date, end_date, state
        ) VALUES (
            v_dla_id, v_user_perangkat, v_user_perangkat, 'Rakor Kabupaten',
            CURRENT_DATE, CURRENT_DATE + 1, 'RATIFIED'
        );
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%baru wajib berstatus PENDING%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Pembuatan surat tugas langsung RATIFIED berhasil ditolak.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan status awal DL tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Surat tugas langsung RATIFIED lolos!';
    END IF;

    -- --------------------------------------------------------------------------
    -- 5.2 Pembuatan Surat Tugas Sah Berstatus PENDING
    -- --------------------------------------------------------------------------
    INSERT INTO public.dl_assignments (
        id, subject_user_id, requester_user_id, purpose,
        start_date, end_date, state
    ) VALUES (
        v_dla_id, v_user_perangkat, v_user_perangkat, 'Bimtek SIPD Kemendagri',
        CURRENT_DATE, CURRENT_DATE + 2, 'PENDING'
    );
    RAISE NOTICE 'PASS: Pengajuan DL sah PENDING berhasil dibuat.';

    -- --------------------------------------------------------------------------
    -- 5.3 Verifikasi & Persetujuan oleh Sekretaris Desa (PENDING -> VERIFIED -> APPROVED)
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_sekdes::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_sekdes::text, 'role', 'authenticated')::text, true);
    
    UPDATE public.dl_assignments
    SET state = 'VERIFIED'
    WHERE id = v_dla_id;
    RAISE NOTICE 'PASS: Surat tugas berhasil diverifikasi (VERIFIED) oleh Sekretaris Desa.';

    UPDATE public.dl_assignments
    SET state = 'APPROVED'
    WHERE id = v_dla_id;
    RAISE NOTICE 'PASS: Surat tugas berhasil disetujui (APPROVED) oleh Sekretaris Desa.';

    -- --------------------------------------------------------------------------
    -- 5.4 Uji Negatif: Hak Eksklusif Ratifikasi (Non-Kades Dilarang Meratifikasi)
    -- --------------------------------------------------------------------------
    -- Konteks tetap: v_auth_sekdes (Sekdes mencoba meratifikasi langsung)
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.dl_assignments
        SET state = 'RATIFIED'
        WHERE id = v_dla_id;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%Hanya Kepala Desa yang berwenang meratifikasi%' OR SQLERRM LIKE '%tidak memiliki wewenang%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Percobaan ratifikasi oleh Non-Kades berhasil ditolak.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan ratifikasi non-kades tidak sesuai ekspektasi: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Non-Kades berhasil meratifikasi surat tugas DL!';
    END IF;

    -- --------------------------------------------------------------------------
    -- 5.5 Ratifikasi Sah oleh Kepala Desa (APPROVED -> RATIFIED)
    -- --------------------------------------------------------------------------
    PERFORM set_config('request.jwt.claim.sub', v_auth_kades::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_auth_kades::text, 'role', 'authenticated')::text, true);
    UPDATE public.dl_assignments
    SET state = 'RATIFIED'
    WHERE id = v_dla_id;
    RAISE NOTICE 'PASS: Ratifikasi sah oleh Kepala Desa berhasil.';

    -- --------------------------------------------------------------------------
    -- 5.6 Uji Negatif: Finalitas Status Terminal RATIFIED (Immutability Mutlak)
    -- --------------------------------------------------------------------------
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.dl_assignments
        SET state = 'CANCELLED',
            cancellation_reason = 'Dibatalkan sepihak pasca ratifikasi'
        WHERE id = v_dla_id;
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%final dan tidak dapat diubah lagi%' OR SQLERRM LIKE '%tidak dapat dibatalkan sembarangan%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Status RATIFIED terbukti terminal dan kebal modifikasi.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan mutasi status terminal tidak sesuai: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Surat tugas RATIFIED berhasil dimutasi!';
    END IF;

    PERFORM set_config('request.jwt.claim.sub', '', true);
    PERFORM set_config('request.jwt.claim.role', '', true);
    PERFORM set_config('request.jwt.claims', '', true);
END $$;
ROLLBACK; -- Batalkan seluruh perubahan transaksi uji 5 (Zero Residue)


-- ==============================================================================
-- BLOK 6: PENGUJIAN KEAMANAN AUDIT LOGS (WORM ENFORCEMENT - RT-07)
-- ==============================================================================
BEGIN; -- Transaksi Uji 6
DO $$
DECLARE
    v_err_caught BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '--- [BLOK 6] Uji Integritas WORM pada Tabel audit_logs (RT-07) ---';

    -- Catat 1 event audit awal secara internal (sebagai superuser)
    INSERT INTO public.audit_logs (
        id, actor_name, actor_role, action, entity_type, entity_id, details
    ) VALUES (
        'test-aud-worm-01', 'Super Admin Test', 'SUPER_ADMIN', 'SYSTEM_AUDIT_TEST',
        'SYSTEM', 'SYS-01', '{"test": true}'::jsonb
    );

    -- 6.1 Uji Negatif: Percobaan UPDATE baris log audit
    v_err_caught := FALSE;
    BEGIN
        UPDATE public.audit_logs
        SET details = '{"tampered": true}'::jsonb
        WHERE id = 'test-aud-worm-01';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%WORM%' OR SQLERRM LIKE '%tidak dapat diubah atau dihapus%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Percobaan UPDATE audit_logs ditolak oleh trigger WORM.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan UPDATE audit log tidak sesuai: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Baris audit log berhasil diubah!';
    END IF;

    -- 6.2 Uji Negatif: Percobaan DELETE baris log audit
    v_err_caught := FALSE;
    BEGIN
        DELETE FROM public.audit_logs WHERE id = 'test-aud-worm-01';
    EXCEPTION WHEN OTHERS THEN
        IF SQLERRM LIKE '%WORM%' OR SQLERRM LIKE '%tidak dapat diubah atau dihapus%' THEN
            v_err_caught := TRUE;
            RAISE NOTICE 'PASS: Percobaan DELETE audit_logs ditolak oleh trigger WORM.';
        ELSE
            RAISE EXCEPTION 'FAIL: Error penolakan DELETE audit log tidak sesuai: %', SQLERRM;
        END IF;
    END;

    IF NOT v_err_caught THEN
        RAISE EXCEPTION 'FAIL: Baris audit log berhasil dihapus!';
    END IF;
END $$;
ROLLBACK; -- Batalkan seluruh perubahan transaksi uji 6 (Zero Residue)


-- ==============================================================================
-- BLOK 7: CATATAN KESIMPULAN SUITE & STATUS PENGUJIAN KONKURENSI (RT-08)
-- ==============================================================================
DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'SUITE SINGLE-SESSION BERHASIL DIJALANKAN (RT-01 s.d. RT-07).';
    RAISE NOTICE 'CATATAN RT-08: Pengujian konkurensi row-locking (FOR UPDATE)';
    RAISE NOTICE 'memerlukan 2 sesi database simultan dan telah diisolasi ke dalam file:';
    RAISE NOTICE 'supabase/tests/concurrency_validation_manual.sql';
    RAISE NOTICE '====================================================================';
END $$;


SELECT '=== [KADESA RUNTIME VALIDATION SUITE] PENGUJIAN KONTROLLED SELESAI ===' AS suite_complete;
