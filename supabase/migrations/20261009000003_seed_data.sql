-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 003
-- File: 20261009000003_seed_data.sql
-- Deskripsi: Data Baseline Awal (Seed Data) Desa Sukamaju
-- PERINGATAN AUDIT:
-- 1. Data di bawah ini bersifat CONTOH SIMULASI PENGEMBANGAN (Development Sandbox).
-- 2. Koordinat kantor desa di bawah ini adalah CONTOH dan MEMERLUKAN KONFIRMASI LAPANGAN
--    sebelum diaktifkan untuk geofence presensi produksi.
-- 3. Akun pengguna di bawah ini TIDAK MEMUAT password publik yang dapat disalahgunakan.
--    Akun administratif resmi wajib dibuat melalui prosedur Bootstrap Supabase Auth.
-- ==============================================================================

-- 0. Penyelarasan Fungsi Proteksi untuk Konteks Migrasi Administratif Tervalidasi Eksplisit
-- Memungkinkan sesi migrasi Supabase CLI melakukan bootstrap akun awal secara aman
-- tanpa membuka celah bagi request API PostgREST (anon/authenticated).
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_user_tampering()
RETURNS TRIGGER AS $$
DECLARE
    v_current_role user_role_enum;
    current_user_row_id VARCHAR(50);
BEGIN
    -- Konteks administratif database internal langsung / migrasi tervalidasi eksplisit:
    -- HANYA berlaku jika sesi migrasi menyetel parameter kadesa.migration_context = 'active'
    -- DAN auth.uid() adalah NULL (bukan request melalui API PostgREST).
    IF (
        session_user IN ('postgres', 'supabase_admin')
        OR current_setting('kadesa.migration_context', true) = 'active'
    ) AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Tolak mutlak seluruh request API PostgREST tanpa sesi autentikasi pengguna yang sah (mencegah bypass anonim)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
    END IF;

    v_current_role := public.get_current_user_role();
    SELECT id INTO current_user_row_id FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;

    -- Super Admin memiliki hak penuh untuk pembuatan dan pembaruan yang sah
    IF v_current_role = 'SUPER_ADMIN' THEN
        RETURN NEW;
    END IF;

    -- =========================================================================
    -- OPERASI INSERT: Penegakan Hak Pembuatan Akun Baru
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN
        -- a. Siapa pun selain Super Admin dilarang menyetel keterkaitan auth_user_id pada saat INSERT
        IF NEW.auth_user_id IS NOT NULL THEN
            RAISE EXCEPTION 'Hanya Super Admin yang berwenang mengaitkan auth_user_id pada pembuatan akun baru.';
        END IF;

        -- b. Siapa pun selain Super Admin dilarang membuat akun dengan peran SUPER_ADMIN atau OPERATOR_DESA
        IF NEW.role IN ('SUPER_ADMIN', 'OPERATOR_DESA') THEN
            RAISE EXCEPTION 'Hanya Super Admin yang berwenang membuat akun dengan peran Super Admin atau Operator Desa.';
        END IF;

        RETURN NEW;
    END IF;

    -- =========================================================================
    -- OPERASI UPDATE: Penegakan Hak Pembaruan Akun Eksisting
    -- =========================================================================

    -- 1. Perlindungan auth_user_id:
    -- Siapa pun selain Super Admin dilarang menyetel atau mengubah keterkaitan auth_user_id
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'Hanya Super Admin yang berwenang mengaitkan atau mengubah auth_user_id akun pengguna.';
    END IF;

    -- 2. Perlindungan Akun Super Admin:
    -- Non-SuperAdmin dilarang mengubah data akun Super Admin dengan cara apa pun
    IF OLD.role = 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Akun Super Admin dilindungi sistem dan tidak dapat diubah oleh peran lain.';
    END IF;

    -- 3. Aturan Mutlak Penetapan / Pencabutan Peran OPERATOR_DESA:
    -- Hanya Super Admin yang berhak memberikan ATAU mencabut peran OPERATOR_DESA
    IF (NEW.role = 'OPERATOR_DESA' OR OLD.role = 'OPERATOR_DESA') AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Hanya Super Admin yang berwenang memberikan atau mencabut peran Operator Desa.';
    END IF;

    -- 4. Pembatasan Ketat Operator Desa:
    IF v_current_role = 'OPERATOR_DESA' THEN
        -- a. Operator dilarang mengubah role akun miliknya sendiri
        IF OLD.id = current_user_row_id AND NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin mengubah peran akunnya sendiri.';
        END IF;

        -- b. Operator dilarang menetapkan role SUPER_ADMIN kepada pengguna mana pun
        IF NEW.role = 'SUPER_ADMIN' AND NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin menetapkan peran Super Admin.';
        END IF;

        -- c. Operator dilarang mengubah atau menonaktifkan akun Operator Desa lain
        IF OLD.role = 'OPERATOR_DESA' AND OLD.id != current_user_row_id THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin mengubah data atau status sesama Operator Desa.';
        END IF;
    ELSE
        -- 5. Pengguna Biasa (PERANGKAT_DESA, KEPALA_DESA, SEKRETARIS_DESA):
        -- Hanya boleh mengubah data profil kontak miliknya sendiri
        IF OLD.id != current_user_row_id THEN
            RAISE EXCEPTION 'Pengguna hanya berwenang memperbarui profil akun miliknya sendiri.';
        END IF;

        IF NEW.role IS DISTINCT FROM OLD.role 
           OR NEW.jabatan_id IS DISTINCT FROM OLD.jabatan_id 
           OR NEW.active IS DISTINCT FROM OLD.active 
           OR NEW.nik IS DISTINCT FROM OLD.nik
           OR NEW.nipd IS DISTINCT FROM OLD.nipd
           OR NEW.username IS DISTINCT FROM OLD.username THEN
            RAISE EXCEPTION 'Pengguna biasa tidak berwenang mengubah peran, jabatan, identitas, atau status akun.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- Aktifkan konteks migrasi transaksi lokal
SELECT set_config('kadesa.migration_context', 'active', true);

-- 1. Master Profil Desa (CONTOH SIMULASI - BUTUH KONFIRMASI LOKASI AKTIF PRODUKSI)
INSERT INTO villages (id, nama, kecamatan, kabupaten, provinsi, kode_pos, alamat, latitude, longitude, radius_meters, logo_desa)
VALUES (
    'vil-001',
    'Desa Sukamaju',
    'Cibinong',
    'Bogor',
    'Jawa Barat',
    '16911',
    'Jl. Raya Sukamaju No. 12, Cibinong, Bogor',
    -6.4828,
    106.8436,
    100,
    '/logo-kadesa.png'
) ON CONFLICT (id) DO NOTHING;

-- 2. Master Jabatan Organisasi
INSERT INTO positions (id, nama, active, effective_from) VALUES
    ('pos-01', 'Kepala Desa', TRUE, '2025-01-01'),
    ('pos-02', 'Sekretaris Desa', TRUE, '2025-01-01'),
    ('pos-03', 'Kaur Keuangan', TRUE, '2025-01-01'),
    ('pos-04', 'Kaur Perencanaan', TRUE, '2025-01-01'),
    ('pos-05', 'Kaur Tata Usaha & Umum', TRUE, '2025-01-01'),
    ('pos-06', 'Kasi Pemerintahan', TRUE, '2025-01-01'),
    ('pos-07', 'Kasi Kesejahteraan', TRUE, '2025-01-01'),
    ('pos-08', 'Kasi Pelayanan', TRUE, '2025-01-01'),
    ('pos-09', 'Kepala Dusun I', TRUE, '2025-01-01'),
    ('pos-10', 'Operator Sistem Desa', TRUE, '2025-01-01'),
    ('pos-99', 'Administrator Sistem', TRUE, '2025-01-01')
ON CONFLICT (id) DO NOTHING;

-- 3. Jadwal Kerja Mingguan
INSERT INTO work_schedules (id, day_of_week, day_name, start_time, end_time, tolerance_minutes, active) VALUES
    ('sch-1', 1, 'Senin', '07:30:00', '15:30:00', 15, TRUE),
    ('sch-2', 2, 'Selasa', '07:30:00', '15:30:00', 15, TRUE),
    ('sch-3', 3, 'Rabu', '07:30:00', '15:30:00', 15, TRUE),
    ('sch-4', 4, 'Kamis', '07:30:00', '15:30:00', 15, TRUE),
    ('sch-5', 5, 'Jumat', '07:30:00', '14:00:00', 15, TRUE),
    ('sch-6', 6, 'Sabtu', '08:00:00', '12:00:00', 0, FALSE),
    ('sch-7', 7, 'Minggu', '08:00:00', '12:00:00', 0, FALSE)
ON CONFLICT (id) DO NOTHING;

-- 4. Kalender Hari Libur Nasional 2026
INSERT INTO holidays (id, date, name, active) VALUES
    ('hol-01', '2026-01-01', 'Tahun Baru 2026 Masehi', TRUE),
    ('hol-02', '2026-03-20', 'Hari Raya Idul Fitri 1447 H (Hari 1)', TRUE),
    ('hol-03', '2026-03-21', 'Hari Raya Idul Fitri 1447 H (Hari 2)', TRUE),
    ('hol-04', '2026-05-01', 'Hari Buruh Internasional', TRUE),
    ('hol-05', '2026-05-27', 'Hari Raya Idul Adha 1447 H', TRUE),
    ('hol-06', '2026-08-17', 'Hari Kemerdekaan Republik Indonesia ke-81', TRUE),
    ('hol-07', '2026-12-25', 'Hari Raya Natal', TRUE)
ON CONFLICT (id) DO NOTHING;

-- 5. System Settings Terpusat (Baku Hardcoded Keys)
INSERT INTO system_settings (id, category, key, label, value, value_type, description, effective_from, status, updated_by) VALUES
    ('set-01', 'WORK_SCHEDULE', 'WORK_SCHEDULE_START', 'Jam Masuk Kantor', '07:30', 'string', 'Jam operasional wajib mulai tugas', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-02', 'WORK_SCHEDULE', 'WORK_SCHEDULE_END', 'Jam Pulang Kantor', '15:30', 'string', 'Jam operasional selesai pelayanan kantor', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-03', 'WORK_SCHEDULE', 'TOLERANCE_LATE_MINUTES', 'Toleransi Keterlambatan (Menit)', '15', 'number', 'Batas dispensasi menit sebelum terhitung TERLAMBAT', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-04', 'WORK_SCHEDULE', 'TIMEZONE', 'Zona Waktu Resmi Desa', 'Asia/Jakarta', 'string', 'Standar waktu database & operasional kantor desa', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-05', 'GEOFENCE', 'LOCATION_NAME', 'Titik Koordinat Utama Kantor Desa', 'Kantor Desa Sukamaju', 'string', 'Nama penanda pusat radius kantor', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-06', 'GEOFENCE', 'REGULAR_ATTENDANCE_RADIUS_METERS', 'Radius Presensi Kantor (Meter)', '100', 'number', 'Radius toleransi geofence kantor desa', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-07', 'GEOFENCE', 'DL_MIN_RADIUS_METERS', 'Radius Minimum Dinas Luar (Meter)', '25', 'number', 'Batas bawah radius lokasi penugasan dinas luar', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-08', 'GEOFENCE', 'DL_MAX_RADIUS_METERS', 'Radius Maksimum Dinas Luar (Meter)', '500', 'number', 'Batas atas radius lokasi penugasan dinas luar', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-09', 'WORKFLOW', 'DL_RATIFICATION_DEADLINE_HOURS', 'Batas Waktu Ratifikasi DL (Jam)', '72', 'number', 'Batas waktu Kepala Desa mengesahkan DL', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-10', 'EVIDENCE', 'MAX_SELFIE_FILE_SIZE_MB', 'Maksimal Ukuran Foto Selfie (MB)', '5', 'number', 'Batas kapasitas file bukti foto selfie presensi', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-11', 'EVIDENCE', 'ALLOWED_SELFIE_FORMATS', 'Format Foto yang Diizinkan', 'image/jpeg,image/png,image/webp', 'string', 'Format gambar yang diterima', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-12', 'SECURITY', 'SESSION_TIMEOUT_MINUTES', 'Batas Waktu Sesi Login (Menit)', '120', 'number', 'Durasi inaktivitas sebelum logout otomatis', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-13', 'SECURITY', 'MAX_LOGIN_ATTEMPTS', 'Batas Percobaan Login Gagal', '5', 'number', 'Maksimal kegagalan sebelum akun dikunci sementara', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-14', 'BRANDING', 'LOGIN_BACKGROUND_IMAGE', 'Foto Latar Belakang Login', 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80', 'string', 'Foto pemandangan kantor desa untuk halaman login', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-15', 'BRANDING', 'VILLAGE_LOGO', 'Logo Resmi Desa Media Cetak', '/logo-kadesa.png', 'string', 'Lambang desa khusus untuk naskah cetak & PDF', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-16', 'LETTERHEAD', 'LETTERHEAD_CONFIG', 'Format Kop Surat Resmi Naskah Dinas', '{"templateId":"standard_pemda","fontFamily":"Times New Roman, serif","layout":"left_logo_center_text","logoSize":72,"showLogo":true,"borderStyle":"double","borderColor":"#000000","borderThickness":3,"paddingBottom":10,"defaultOrientation":"portrait","line1":{"text":"PEMERINTAH KABUPATEN BOGOR","fontSize":14,"fontWeight":"bold","fontStyle":"normal","textTransform":"uppercase"},"line2":{"text":"KECAMATAN CIBINONG","fontSize":16,"fontWeight":"800","fontStyle":"normal","textTransform":"uppercase"},"line3":{"text":"DESA SUKAMAJU","fontSize":18,"fontWeight":"800","fontStyle":"normal","textTransform":"uppercase"},"line4":{"text":"Jl. Raya Sukamaju No. 12, Cibinong, Bogor 16911 Telp. (021) 87654321","fontSize":9.5,"fontWeight":"normal","fontStyle":"italic","textTransform":"none"}}', 'json', 'Konfigurasi tipografi & garis naskah dinas resmi', '2026-01-01', 'ACTIVE', 'Sistem KADESA'),
    ('set-17', 'GEOFENCE', 'OFFICE_COORDINATES_CONFIRMED', 'Status Konfirmasi Lokasi Kantor', 'false', 'boolean', 'Konfirmasi bahwa koordinat kantor desa telah diverifikasi resmi untuk operasional produksi (ADR-012)', '2026-01-01', 'ACTIVE', 'Sistem KADESA')
ON CONFLICT (id) DO NOTHING;

-- 6. Akun Profil Awal Aparatur Desa (Tanpa Password Plaintext / Tanpa Kredensial Publik)
-- Autentikasi live dikelola oleh Supabase Auth (auth.users). 
-- Password hash diisi placeholder locked string demi keamanan.
INSERT INTO users (id, username, password_hash, nama, nik, nipd, nomor_whatsapp, role, jabatan_id, attendance_required, active, effective_from) VALUES
    ('usr-admin', 'superadmin', 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP', 'Budi Santoso, M.Kom', '3201011204850001', NULL, '081299887766', 'SUPER_ADMIN', 'pos-99', FALSE, TRUE, '2025-01-01'),
    ('usr-operator', 'operator', 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP', 'Siti Rahmawati, S.AP', '3201015508900002', '199008152020012005', '081388776655', 'OPERATOR_DESA', 'pos-05', TRUE, TRUE, '2025-01-01'),
    ('usr-kades', 'kades', 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP', 'Drs. H. Ahmad Dahlan', '3201011005750003', NULL, '081122334455', 'KEPALA_DESA', 'pos-01', TRUE, TRUE, '2025-01-01'),
    ('usr-sekdes', 'sekdes', 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP', 'Bambang Wijaya, S.IP', '3201012209820004', '198209222010011002', '081233445566', 'SEKRETARIS_DESA', 'pos-02', TRUE, TRUE, '2025-01-01'),
    ('usr-perangkat1', 'dewi', 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP', 'Dewi Lestari, S.E', '3201016503920005', '199203252018022001', '081544556677', 'PERANGKAT_DESA', 'pos-03', TRUE, TRUE, '2025-01-01')
ON CONFLICT (id) DO NOTHING;

-- 7. Bersihkan Konteks Migrasi Transaksi Lokal
SELECT set_config('kadesa.migration_context', '', true);
