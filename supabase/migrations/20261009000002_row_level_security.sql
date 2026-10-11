-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 002
-- File: 20261009000002_row_level_security.sql
-- Deskripsi: Kebijakan Row Level Security (RLS) & Penegakan Otorisasi Backend
-- ==============================================================================

-- 1. Aktifkan RLS pada seluruh 14 tabel
ALTER TABLE villages ENABLE ROW LEVEL SECURITY;
ALTER TABLE positions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE dl_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE dl_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE dl_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE absence_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- 2. Security Helper Functions dengan Search Path Aman
CREATE OR REPLACE FUNCTION public.get_current_user_profile()
RETURNS users AS $$
    SELECT * FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.get_current_user_role()
RETURNS user_role_enum AS $$
    SELECT role FROM public.users WHERE auth_user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
    SELECT (public.get_current_user_role() = 'SUPER_ADMIN');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS BOOLEAN AS $$
    SELECT (public.get_current_user_role() = 'OPERATOR_DESA');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_admin_or_operator()
RETURNS BOOLEAN AS $$
    SELECT (public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA'));
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_kepala_desa()
RETURNS BOOLEAN AS $$
    SELECT (public.get_current_user_role() = 'KEPALA_DESA');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.is_sekretaris_desa()
RETURNS BOOLEAN AS $$
    SELECT (public.get_current_user_role() = 'SEKRETARIS_DESA');
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

-- ==============================================================================
-- KEBIJAKAN RLS: villages
-- ==============================================================================
CREATE POLICY "villages_select_authenticated" ON villages
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "villages_update_admin" ON villages
    FOR UPDATE TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ==============================================================================
-- KEBIJAKAN RLS: positions
-- ==============================================================================
CREATE POLICY "positions_select_authenticated" ON positions
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "positions_all_admin" ON positions
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ==============================================================================
-- KEBIJAKAN RLS: users
-- PENEGAKAN ATURAN RBAC MUTLAK KADESA:
-- 1. Operator dilarang mengubah role akun sendiri
-- 2. Operator dilarang memberikan role OPERATOR_DESA atau SUPER_ADMIN
-- 3. Operator dilarang membuat akun OPERATOR_DESA atau SUPER_ADMIN
-- 4. Operator dilarang mengubah/menonaktifkan akun SUPER_ADMIN
-- ==============================================================================
CREATE POLICY "users_select_authenticated" ON users
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_super_admin()
        OR (
            public.is_operator()
            AND role NOT IN ('SUPER_ADMIN', 'OPERATOR_DESA')
        )
    );

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE TO authenticated
    USING (
        public.is_super_admin()
        OR (
            public.is_operator()
            AND role != 'SUPER_ADMIN' -- Operator tidak boleh menyentuh akun Super Admin
        )
        OR (
            auth_user_id = auth.uid() -- Pengguna sendiri
        )
    )
    WITH CHECK (
        public.is_super_admin()
        OR (
            public.is_operator()
            AND role NOT IN ('SUPER_ADMIN', 'OPERATOR_DESA') -- Operator tidak boleh menaikkan role ke Operator/SuperAdmin
            AND (
                -- Jika mengedit akun sendiri, role tidak boleh berubah dari role semula
                id != (SELECT id FROM users WHERE auth_user_id = auth.uid())
                OR role = (SELECT role FROM users WHERE auth_user_id = auth.uid())
            )
        )
        OR (
            -- Pengguna biasa mengedit akun sendiri: tidak boleh mengubah role, jabatan, atau active status
            auth_user_id = auth.uid()
            AND role = (SELECT role FROM users WHERE auth_user_id = auth.uid())
            AND jabatan_id = (SELECT jabatan_id FROM users WHERE auth_user_id = auth.uid())
            AND active = (SELECT active FROM users WHERE auth_user_id = auth.uid())
        )
    );

CREATE POLICY "users_delete_super_admin" ON users
    FOR DELETE TO authenticated
    USING (public.is_super_admin());

-- Trigger pengaman anti-hijacking auth_user_id dan multi-column tampering
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_user_tampering()
RETURNS TRIGGER AS $$
DECLARE
    v_current_role user_role_enum;
    current_user_row_id VARCHAR(50);
BEGIN
    -- Konteks administratif database internal langsung (hanya via psql / CLI superuser session asli)
    -- PENTING: Gunakan session_user bukan current_user, karena current_user selalu berubah menjadi owner ('postgres') di dalam fungsi SECURITY DEFINER!
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
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

DROP TRIGGER IF EXISTS trg_protect_auth_user_id ON users;
CREATE TRIGGER trg_protect_auth_user_id
BEFORE INSERT OR UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION public.prevent_unauthorized_user_tampering();

-- ==============================================================================
-- KEBIJAKAN RLS: system_settings
-- ==============================================================================
CREATE POLICY "system_settings_select_authenticated" ON system_settings
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "system_settings_modify_admin" ON system_settings
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ==============================================================================
-- KEBIJAKAN RLS: work_schedules & holidays
-- ==============================================================================
CREATE POLICY "schedules_select_authenticated" ON work_schedules
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "schedules_modify_admin" ON work_schedules
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

CREATE POLICY "holidays_select_authenticated" ON holidays
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "holidays_modify_admin" ON holidays
    FOR ALL TO authenticated
    USING (public.is_admin_or_operator())
    WITH CHECK (public.is_admin_or_operator());

-- ==============================================================================
-- KEBIJAKAN RLS: attendance_records
-- ==============================================================================
CREATE POLICY "attendance_select_policy" ON attendance_records
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

CREATE POLICY "attendance_insert_self" ON attendance_records
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "attendance_update_self_checkout" ON attendance_records
    FOR UPDATE TO authenticated
    USING (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.is_admin_or_operator() -- Operator diperbolehkan dalam konteks koreksi administratif
    )
    WITH CHECK (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.is_admin_or_operator()
    );

-- ==============================================================================
-- PENEGAKAN KEAMANAN GEOFENCE KANTOR DI LEVEL DATABASE (ADR-012)
-- Kalkulasi Jarak Haversine Otoritatif, Validasi Koordinat Check-In/Check-Out,
-- dan Proteksi Anti-Tampering Transaksi Presensi Reguler
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance_meters(
    p_lat1 DOUBLE PRECISION,
    p_lon1 DOUBLE PRECISION,
    p_lat2 DOUBLE PRECISION,
    p_lon2 DOUBLE PRECISION
)
RETURNS INTEGER AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 6371000.0;
    d_lat DOUBLE PRECISION;
    d_lon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    -- Batasi nilai koordinat agar matematis valid
    IF p_lat1 < -90.0 OR p_lat1 > 90.0 OR p_lat2 < -90.0 OR p_lat2 > 90.0
       OR p_lon1 < -180.0 OR p_lon1 > 180.0 OR p_lon2 < -180.0 OR p_lon2 > 180.0 THEN
        RETURN NULL;
    END IF;

    d_lat := RADIANS(p_lat2 - p_lat1);
    d_lon := RADIANS(p_lon2 - p_lon1);

    a := (SIN(d_lat / 2.0) * SIN(d_lat / 2.0)) +
         (COS(RADIANS(p_lat1)) * COS(RADIANS(p_lat2)) * SIN(d_lon / 2.0) * SIN(d_lon / 2.0));

    -- Batasi presisi floating point agar tidak melampaui 1.0 akibat pembulatan numerik
    IF a > 1.0 THEN
        a := 1.0;
    ELSIF a < 0.0 THEN
        a := 0.0;
    END IF;

    c := 2.0 * ATAN2(SQRT(a), SQRT(1.0 - a));

    RETURN ROUND(r * c)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path = public, pg_temp;

CREATE OR REPLACE FUNCTION public.enforce_attendance_geofence_safety()
RETURNS TRIGGER AS $$
DECLARE
    v_confirmed VARCHAR(50);
    v_office_lat DECIMAL(10, 8);
    v_office_lon DECIMAL(11, 8);
    v_office_radius INTEGER;
    v_settings_radius INTEGER;
    v_effective_radius INTEGER;
    v_check_in_dist INTEGER;
    v_check_out_dist INTEGER;
    v_dl_state dl_state_enum;
BEGIN
    -- Konteks administratif database internal langsung (hanya via psql / CLI superuser session asli)
    -- PENTING: Gunakan session_user bukan current_user, karena current_user selalu berubah menjadi owner ('postgres') di dalam fungsi SECURITY DEFINER!
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Tolak mutlak seluruh request API PostgREST tanpa sesi autentikasi pengguna yang sah (mencegah bypass anonim)
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi presensi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
    END IF;

    -- --------------------------------------------------------------------------
    -- A. PROTEKSI INTEGRITAS DATA & IMUTABILITAS BIDANG KRITIS SAAT UPDATE
    -- --------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- 1. Identitas pengguna dan tanggal presensi dilarang dimutasi
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Manipulasi ditolak: user_id tidak dapat diubah setelah dicatat.';
        END IF;

        IF NEW.attendance_date IS DISTINCT FROM OLD.attendance_date THEN
            RAISE EXCEPTION 'Manipulasi ditolak: attendance_date tidak dapat diubah setelah dicatat.';
        END IF;

        -- 2. Tipe presensi dilarang dimanipulasi (misal dari REGULAR ke DINAS_LUAR untuk bypass)
        IF NEW.type IS DISTINCT FROM OLD.type THEN
            RAISE EXCEPTION 'Manipulasi tipe presensi ditolak: Tipe presensi tidak dapat diubah setelah dicatat.';
        END IF;

        -- 3. Imutabilitas GPS Historis: Koordinat & jarak Check-In tidak boleh diubah oleh siapa pun
        IF NEW.check_in_latitude IS DISTINCT FROM OLD.check_in_latitude
           OR NEW.check_in_longitude IS DISTINCT FROM OLD.check_in_longitude
           OR NEW.check_in_distance_meters IS DISTINCT FROM OLD.check_in_distance_meters THEN
            RAISE EXCEPTION 'Manipulasi koordinat dan jarak Check-In historis dilarang oleh sistem.';
        END IF;

        -- 4. Imutabilitas GPS Historis Check-Out yang sudah tervalidasi
        IF OLD.check_out_at IS NOT NULL THEN
            IF NEW.check_out_latitude IS DISTINCT FROM OLD.check_out_latitude
               OR NEW.check_out_longitude IS DISTINCT FROM OLD.check_out_longitude
               OR NEW.check_out_distance_meters IS DISTINCT FROM OLD.check_out_distance_meters THEN
                RAISE EXCEPTION 'Manipulasi koordinat dan jarak Check-Out historis dilarang oleh sistem.';
            END IF;
        END IF;

        -- 5. Perubahan Waktu Check-In hanya sah melalui mekanisme koreksi resmi berstatus APPROVED
        IF NEW.check_in_at IS DISTINCT FROM OLD.check_in_at THEN
            IF NEW.correction_state != 'CORRECTED' OR NEW.original_check_in IS NULL THEN
                RAISE EXCEPTION 'Perubahan waktu Check-In ditolak: Wajib melalui mekanisme koreksi resmi (correction_state = CORRECTED).';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.attendance_corrections
                WHERE attendance_record_id = NEW.id
                  AND state = 'APPROVED'
            ) THEN
                RAISE EXCEPTION 'Koreksi waktu Check-In ditolak: Dokumen persetujuan koreksi resmi berstatus APPROVED tidak ditemukan.';
            END IF;
        END IF;

        -- 6. Perubahan Waktu Check-Out yang sudah ada hanya sah melalui mekanisme koreksi resmi
        IF OLD.check_out_at IS NOT NULL AND NEW.check_out_at IS DISTINCT FROM OLD.check_out_at THEN
            IF NEW.correction_state != 'CORRECTED' OR NEW.original_check_out IS NULL THEN
                RAISE EXCEPTION 'Perubahan waktu Check-Out ditolak: Wajib melalui mekanisme koreksi resmi.';
            END IF;

            IF NOT EXISTS (
                SELECT 1 FROM public.attendance_corrections
                WHERE attendance_record_id = NEW.id
                  AND state = 'APPROVED'
            ) THEN
                RAISE EXCEPTION 'Koreksi waktu Check-Out ditolak: Dokumen persetujuan koreksi resmi berstatus APPROVED tidak ditemukan.';
            END IF;
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- B. VALIDASI RENTANG GEOGRAFIS & KELENGKAPAN PASANGAN KOORDINAT
    -- --------------------------------------------------------------------------
    -- Tolak koordinat parsial (latitude ada tapi longitude kosong, atau sebaliknya)
    IF (NEW.check_in_latitude IS NOT NULL AND NEW.check_in_longitude IS NULL)
       OR (NEW.check_in_latitude IS NULL AND NEW.check_in_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-In tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    IF (NEW.check_out_latitude IS NOT NULL AND NEW.check_out_longitude IS NULL)
       OR (NEW.check_out_latitude IS NULL AND NEW.check_out_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-Out tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    -- Validasi rentang nilai koordinat bumi
    IF NEW.check_in_latitude IS NOT NULL THEN
        IF NEW.check_in_latitude < -90.0 OR NEW.check_in_latitude > 90.0 THEN
            RAISE EXCEPTION 'Latitude Check-In tidak valid: nilai harus berada di antara -90 dan 90.';
        END IF;
    END IF;

    IF NEW.check_in_longitude IS NOT NULL THEN
        IF NEW.check_in_longitude < -180.0 OR NEW.check_in_longitude > 180.0 THEN
            RAISE EXCEPTION 'Longitude Check-In tidak valid: nilai harus berada di antara -180 dan 180.';
        END IF;
    END IF;

    IF NEW.check_out_latitude IS NOT NULL THEN
        IF NEW.check_out_latitude < -90.0 OR NEW.check_out_latitude > 90.0 THEN
            RAISE EXCEPTION 'Latitude Check-Out tidak valid: nilai harus berada di antara -90 dan 90.';
        END IF;
    END IF;

    IF NEW.check_out_longitude IS NOT NULL THEN
        IF NEW.check_out_longitude < -180.0 OR NEW.check_out_longitude > 180.0 THEN
            RAISE EXCEPTION 'Longitude Check-Out tidak valid: nilai harus berada di antara -180 dan 180.';
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- C. EVALUASI JALUR DINAS LUAR (DINAS_LUAR)
    -- --------------------------------------------------------------------------
    IF NEW.type = 'DINAS_LUAR' THEN
        -- Wajib menyertakan id surat penugasan
        IF NEW.dl_assignment_id IS NULL THEN
            RAISE EXCEPTION 'Presensi Dinas Luar ditolak: Penugasan Surat Tugas (dl_assignment_id) wajib disertakan.';
        END IF;

        -- Validasi relasi penugasan: milik pengguna bersangkutan & sesuai masa tugas
        SELECT state INTO v_dl_state
        FROM public.dl_assignments
        WHERE id = NEW.dl_assignment_id
          AND subject_user_id = NEW.user_id
          AND NEW.attendance_date BETWEEN start_date AND end_date
        LIMIT 1;

        IF v_dl_state IS NULL THEN
            RAISE EXCEPTION 'Presensi Dinas Luar ditolak: Surat tugas tidak ditemukan, bukan atas nama aparatur bersangkutan, atau tanggal di luar masa tugas.';
        END IF;

        IF v_dl_state NOT IN ('APPROVED', 'RATIFIED') THEN
            RAISE EXCEPTION 'Presensi Dinas Luar ditolak: Surat tugas belum berstatus sah yang disetujui (Status saat ini: %).', v_dl_state;
        END IF;

        -- Presensi masuk dinas luar wajib menyertakan foto selfie bukti kehadiran
        IF (NEW.check_in_at IS NOT NULL OR TG_OP = 'INSERT') AND (NEW.check_in_selfie_url IS NULL OR TRIM(NEW.check_in_selfie_url) = '') THEN
            RAISE EXCEPTION 'Presensi Dinas Luar ditolak: Foto bukti selfie (check_in_selfie_url) wajib disertakan.';
        END IF;

        RETURN NEW;
    END IF;

    -- --------------------------------------------------------------------------
    -- D. EVALUASI GEOFENCE PRESENSI KANTOR REGULER (REGULAR)
    -- --------------------------------------------------------------------------
    IF NEW.type = 'REGULAR' THEN
        -- 1. Validasi Status Konfirmasi Titik Koordinat Kantor
        SELECT value INTO v_confirmed
        FROM public.system_settings
        WHERE key = 'OFFICE_COORDINATES_CONFIRMED'
        LIMIT 1;

        IF v_confirmed IS NULL OR LOWER(TRIM(v_confirmed)) != 'true' THEN
            RAISE EXCEPTION 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.';
        END IF;

        -- 2. Ambil Koordinat Pusat Kantor Desa
        SELECT latitude, longitude, radius_meters
        INTO v_office_lat, v_office_lon, v_office_radius
        FROM public.villages
        LIMIT 1;

        IF v_office_lat IS NULL OR v_office_lon IS NULL THEN
            RAISE EXCEPTION 'Presensi kantor ditolak: Data koordinat kantor desa belum dikonfigurasi dalam sistem.';
        END IF;

        -- 3. Ambil Radius Efektif Terpusat Deterministik Berbasis Tanggal Transaksi
        SELECT (CASE WHEN value ~ '^[0-9]+$' THEN value::integer ELSE NULL END)
        INTO v_settings_radius
        FROM public.system_settings
        WHERE key = 'REGULAR_ATTENDANCE_RADIUS_METERS'
          AND status = 'ACTIVE'
          AND effective_from <= NEW.attendance_date
          AND (effective_to IS NULL OR effective_to >= NEW.attendance_date)
        ORDER BY effective_from DESC, created_at DESC
        LIMIT 1;

        IF v_settings_radius IS NOT NULL AND v_settings_radius >= 20 AND v_settings_radius <= 500 THEN
            v_effective_radius := v_settings_radius;
        ELSIF v_office_radius IS NOT NULL AND v_office_radius >= 20 AND v_office_radius <= 500 THEN
            v_effective_radius := v_office_radius;
        ELSE
            v_effective_radius := 100; -- Safe fail-safe default 100 meter
        END IF;

        -- 4. Validasi Geofence Check-In
        IF NEW.check_in_at IS NOT NULL OR TG_OP = 'INSERT' THEN
            IF NEW.check_in_latitude IS NULL OR NEW.check_in_longitude IS NULL THEN
                RAISE EXCEPTION 'Koordinat Check-In wajib disertakan lengkap untuk presensi kantor reguler.';
            END IF;

            v_check_in_dist := public.calculate_haversine_distance_meters(
                NEW.check_in_latitude::double precision,
                NEW.check_in_longitude::double precision,
                v_office_lat::double precision,
                v_office_lon::double precision
            );

            IF v_check_in_dist IS NULL OR v_check_in_dist < 0 OR v_check_in_dist > v_effective_radius THEN
                RAISE EXCEPTION 'Presensi Check-In ditolak: Lokasi Anda berada %m dari kantor desa (Radius maksimal %m).',
                    COALESCE(v_check_in_dist, -1), v_effective_radius;
            END IF;

            -- Otoritatif: Set jarak dari kalkulasi server database
            NEW.check_in_distance_meters := v_check_in_dist;
        END IF;

        -- 5. Validasi Geofence Check-Out
        IF NEW.check_out_at IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.check_out_at IS NULL OR NEW.check_out_at IS DISTINCT FROM OLD.check_out_at) THEN
            IF NEW.check_out_latitude IS NULL OR NEW.check_out_longitude IS NULL THEN
                RAISE EXCEPTION 'Koordinat Check-Out wajib disertakan lengkap untuk presensi kantor reguler.';
            END IF;

            v_check_out_dist := public.calculate_haversine_distance_meters(
                NEW.check_out_latitude::double precision,
                NEW.check_out_longitude::double precision,
                v_office_lat::double precision,
                v_office_lon::double precision
            );

            IF v_check_out_dist IS NULL OR v_check_out_dist < 0 OR v_check_out_dist > v_effective_radius THEN
                RAISE EXCEPTION 'Presensi Check-Out ditolak: Lokasi Anda berada %m dari kantor desa (Radius maksimal %m).',
                    COALESCE(v_check_out_dist, -1), v_effective_radius;
            END IF;

            -- Otoritatif: Set jarak pulang dari kalkulasi server database
            NEW.check_out_distance_meters := v_check_out_dist;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_attendance_geofence ON attendance_records;
CREATE TRIGGER trg_enforce_attendance_geofence
BEFORE INSERT OR UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_geofence_safety();

REVOKE EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO postgres, supabase_admin;

-- ==============================================================================
-- KEBIJAKAN RLS: dl_assignments & dl_locations & dl_evidence
-- ==============================================================================
CREATE POLICY "dl_assignments_select_policy" ON dl_assignments
    FOR SELECT TO authenticated
    USING (
        subject_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR requester_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

CREATE POLICY "dl_assignments_insert_policy" ON dl_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
        OR (
            -- Sesuai PRD 12.2: Perangkat Desa dapat self-submit pengajuan DL
            requester_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
            AND subject_user_id = requester_user_id
            AND state = 'PENDING'
        )
    );

CREATE POLICY "dl_assignments_update_policy" ON dl_assignments
    FOR UPDATE TO authenticated
    USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

CREATE POLICY "dl_locations_select_authenticated" ON dl_locations
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "dl_locations_modify_admin" ON dl_locations
    FOR ALL TO authenticated
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA'));

CREATE POLICY "dl_evidence_select_policy" ON dl_evidence
    FOR SELECT TO authenticated
    USING (
        dl_assignment_id IN (
            SELECT id FROM dl_assignments
            WHERE subject_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

CREATE POLICY "dl_evidence_insert_self" ON dl_evidence
    FOR INSERT TO authenticated
    WITH CHECK (
        dl_assignment_id IN (
            SELECT id FROM dl_assignments
            WHERE subject_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        )
    );

-- ==============================================================================
-- KEBIJAKAN RLS: absence_requests (Izin & Cuti)
-- ==============================================================================
CREATE POLICY "absence_select_policy" ON absence_requests
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

CREATE POLICY "absence_insert_self" ON absence_requests
    FOR INSERT TO authenticated
    WITH CHECK (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
    );

CREATE POLICY "absence_update_approval" ON absence_requests
    FOR UPDATE TO authenticated
    USING (
        (user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()) AND state = 'SUBMITTED')
        OR public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );

-- ==============================================================================
-- KEBIJAKAN RLS: attendance_corrections (Koreksi Presensi Non-Destruktif)
-- ==============================================================================
CREATE POLICY "corrections_select_policy" ON attendance_corrections
    FOR SELECT TO authenticated
    USING (
        user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid())
        OR public.is_admin_or_operator()
    );

CREATE POLICY "corrections_insert_operator" ON attendance_corrections
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_operator()
    );

-- ==============================================================================
-- KEBIJAKAN RLS: audit_logs (Rekam Jejak Keamanan - IMMUTABLE & ANTI-FORGERY)
-- ==============================================================================
-- Seluruh pengguna admin/operator dapat membaca log audit
CREATE POLICY "audit_logs_select_admin" ON audit_logs
    FOR SELECT TO authenticated
    USING (public.is_admin_or_operator());

-- KEAMANAN MUTLAK AUDIT LOG:
-- 1. Cabut hak INSERT langsung dari REST API client untuk mencegah penempaan catatan audit palsu
REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated, anon, PUBLIC;

-- 2. Fungsi Stored Procedure Tepercaya untuk Pencatatan Audit Aplikasi
CREATE OR REPLACE FUNCTION public.record_system_audit_event(
    p_action VARCHAR(100),
    p_entity_type VARCHAR(100),
    p_entity_id VARCHAR(100),
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_nama VARCHAR(150);
    v_actor_role VARCHAR(50);
    v_log_id VARCHAR(50);
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi audit ditolak: sesi autentikasi tidak valid.';
    END IF;

    -- Ambil identitas pelaku secara tepercaya dari database (bukan dari klaim payload client)
    SELECT id, nama, role::text INTO v_actor_user_id, v_actor_nama, v_actor_role
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF v_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'Aksi audit ditolak: akun aparatur tidak ditemukan.';
    END IF;

    v_log_id := 'aud-' || SUBSTRING(gen_random_uuid()::text, 1, 8);

    INSERT INTO public.audit_logs (
        id,
        actor_user_id,
        actor_name,
        actor_role,
        action,
        entity_type,
        entity_id,
        details,
        created_at
    ) VALUES (
        v_log_id,
        v_actor_user_id,
        v_actor_nama,
        v_actor_role,
        p_action,
        p_entity_type,
        p_entity_id,
        p_details,
        NOW()
    );

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. Trigger WORM: Tolak UPDATE dan DELETE secara mutlak pada audit_logs
CREATE OR REPLACE FUNCTION public.reject_audit_logs_mutation()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs bersifat WORM (Write Once, Read Many) dan tidak dapat diubah atau dihapus.';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_deny_audit_logs_mutation ON audit_logs;
CREATE TRIGGER trg_deny_audit_logs_mutation
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION public.reject_audit_logs_mutation();

-- ==============================================================================
-- KEBIJAKAN RLS: notifications
-- ==============================================================================
CREATE POLICY "notifications_select_self" ON notifications
    FOR SELECT TO authenticated
    USING (recipient_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

CREATE POLICY "notifications_update_self" ON notifications
    FOR UPDATE TO authenticated
    USING (recipient_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()))
    WITH CHECK (recipient_user_id = (SELECT id FROM users WHERE auth_user_id = auth.uid()));

-- ==============================================================================
-- PEMBATASAN HAK EKSEKUSI (EXECUTE PRIVILEGES)
-- ==============================================================================
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_current_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_or_operator() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_kepala_desa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_sekretaris_desa() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_system_audit_event(VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated;
