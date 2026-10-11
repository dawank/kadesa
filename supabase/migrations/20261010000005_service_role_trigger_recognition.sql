-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 009
-- File: 20261010000005_service_role_trigger_recognition.sql
-- Deskripsi: Penyelarasan Pengenalan Service Role pada Trigger Keamanan PostgREST
--            - Mengizinkan panggilan server-side tepercaya (Supabase Edge Function)
--            - Mempertahankan penolakan mutlak untuk permintaan anonim / tanpa sesi
-- ==============================================================================

-- 1. Penyelarasan Trigger: prevent_unauthorized_user_tampering pada tabel users
CREATE OR REPLACE FUNCTION public.prevent_unauthorized_user_tampering()
RETURNS TRIGGER AS $$
DECLARE
    v_current_role user_role_enum;
    current_user_row_id VARCHAR(50);
    v_jwt_role TEXT;
BEGIN
    -- Konteks administratif database internal langsung (psql / CLI superuser session)
    -- ATAU panggilan server-side berprivilege resmi melalui service_role (Edge Function)
    v_jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), (auth.jwt()->>'role'));
    IF (session_user IN ('postgres', 'supabase_admin') OR v_jwt_role = 'service_role') THEN
        RETURN NEW;
    END IF;

    -- Tolak mutlak seluruh request API PostgREST tanpa sesi autentikasi pengguna yang sah
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
    IF NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id THEN
        RAISE EXCEPTION 'Hanya Super Admin yang berwenang mengaitkan atau mengubah auth_user_id akun pengguna.';
    END IF;

    -- 2. Perlindungan Akun Super Admin:
    IF OLD.role = 'SUPER_ADMIN' THEN
        RAISE EXCEPTION 'Akun Super Admin dilindungi sistem dan tidak dapat diubah oleh peran lain.';
    END IF;

    -- 3. Aturan Mutlak Penetapan / Pencabutan Peran OPERATOR_DESA:
    IF (NEW.role = 'OPERATOR_DESA' OR OLD.role = 'OPERATOR_DESA') AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Hanya Super Admin yang berwenang memberikan atau mencabut peran Operator Desa.';
    END IF;

    -- 4. Pembatasan Ketat Operator Desa:
    IF v_current_role = 'OPERATOR_DESA' THEN
        IF OLD.id = current_user_row_id AND NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin mengubah peran akunnya sendiri.';
        END IF;

        IF NEW.role = 'SUPER_ADMIN' AND NEW.role IS DISTINCT FROM OLD.role THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin menetapkan peran Super Admin.';
        END IF;

        IF OLD.role = 'OPERATOR_DESA' AND OLD.id != current_user_row_id THEN
            RAISE EXCEPTION 'Operator Desa tidak memiliki izin mengubah data atau status sesama Operator Desa.';
        END IF;
    ELSE
        -- 5. Pengguna Biasa:
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

-- 2. Penyelarasan Trigger: enforce_attendance_geofence_safety pada attendance_records
CREATE OR REPLACE FUNCTION public.enforce_attendance_geofence_safety()
RETURNS TRIGGER AS $$
DECLARE
    v_office_confirmed_str TEXT;
    v_office_lat DECIMAL(10, 8);
    v_office_lng DECIMAL(11, 8);
    v_office_radius INTEGER;
    v_dl_assignment RECORD;
    v_approved_corr RECORD;
    v_actor_user_id VARCHAR(50);
    v_jwt_role TEXT;
BEGIN
    -- Konteks administrasi / internal superuser / service_role
    v_jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), (auth.jwt()->>'role'));
    IF (session_user IN ('postgres', 'supabase_admin') OR v_jwt_role = 'service_role') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi presensi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
    END IF;

    SELECT id INTO v_actor_user_id
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    -- Validasi kepemilikan transaksi presensi
    IF TG_OP = 'INSERT' AND NEW.user_id != v_actor_user_id AND public.get_current_user_role() NOT IN ('SUPER_ADMIN', 'OPERATOR_DESA') THEN
        RAISE EXCEPTION 'Pengguna hanya dapat mencatat presensi untuk akun dirinya sendiri.';
    END IF;

    -- =========================================================================
    -- A. PROTEKSI INTEGRITAS HISTORIS (GPS IMMUTABILITY & KOREKSI SAH)
    -- =========================================================================
    IF TG_OP = 'UPDATE' THEN
        IF (OLD.check_in_at IS NOT NULL AND NEW.check_in_at IS DISTINCT FROM OLD.check_in_at)
           OR (OLD.check_out_at IS NOT NULL AND NEW.check_out_at IS DISTINCT FROM OLD.check_out_at)
           OR (NEW.status IS DISTINCT FROM OLD.status) THEN

            -- Cari permohonan koreksi yang berstatus APPROVED dan belum dikonsumsi
            SELECT * INTO v_approved_corr
            FROM public.attendance_corrections
            WHERE attendance_record_id = OLD.id
              AND state = 'APPROVED'
              AND applied_at IS NULL
            ORDER BY approved_at DESC
            LIMIT 1;

            IF v_approved_corr.id IS NULL THEN
                RAISE EXCEPTION 'Data historis presensi terkunci. Perubahan jam atau status presensi hanya sah melalui persetujuan koreksi administratif.';
            END IF;

            -- Pastikan nilai yang diperbarui sesuai dengan koreksi yang disetujui
            IF NEW.check_in_at IS DISTINCT FROM v_approved_corr.corrected_check_in
               OR NEW.check_out_at IS DISTINCT FROM v_approved_corr.corrected_check_out
               OR NEW.status IS DISTINCT FROM v_approved_corr.corrected_status THEN
                RAISE EXCEPTION 'Pembaruan presensi tidak sesuai dengan data usulan koreksi yang telah disetujui.';
            END IF;

            -- Terapkan tanda konsumsi secara atomik
            PERFORM set_config('kadesa.applying_correction_id', v_approved_corr.id, true);

            UPDATE public.attendance_corrections
            SET applied_at = clock_timestamp(),
                applied_by = COALESCE(v_actor_user_id, v_approved_corr.approved_by)
            WHERE id = v_approved_corr.id;

            PERFORM set_config('kadesa.applying_correction_id', '', true);

            NEW.original_check_in := COALESCE(OLD.original_check_in, OLD.check_in_at);
            NEW.original_check_out := COALESCE(OLD.original_check_out, OLD.check_out_at);
            NEW.correction_state := 'CORRECTED';
        END IF;
    END IF;

    -- =========================================================================
    -- B. VALIDASI KOORDINAT GEOGRAFIS & GEOFENCE
    -- =========================================================================
    IF (NEW.check_in_latitude IS NOT NULL AND NEW.check_in_longitude IS NULL)
       OR (NEW.check_in_latitude IS NULL AND NEW.check_in_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-In tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    IF (NEW.check_out_latitude IS NOT NULL AND NEW.check_out_longitude IS NULL)
       OR (NEW.check_out_latitude IS NULL AND NEW.check_out_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-Out tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    -- Jalur DINAS_LUAR
    IF NEW.type = 'DINAS_LUAR' THEN
        IF NEW.dl_assignment_id IS NULL OR length(trim(NEW.dl_assignment_id)) = 0 THEN
            RAISE EXCEPTION 'Presensi Dinas Luar wajib menyertakan dl_assignment_id yang sah.';
        END IF;

        SELECT * INTO v_dl_assignment
        FROM public.dl_assignments
        WHERE id = NEW.dl_assignment_id;

        IF v_dl_assignment.id IS NULL THEN
            RAISE EXCEPTION 'Surat tugas Dinas Luar dengan ID % tidak ditemukan di sistem.', NEW.dl_assignment_id;
        END IF;

        IF v_dl_assignment.state NOT IN ('APPROVED', 'RATIFIED') THEN
            RAISE EXCEPTION 'Surat tugas Dinas Luar % belum sah (status: %). Hanya tugas berstatus APPROVED atau RATIFIED yang berlaku.',
                NEW.dl_assignment_id, v_dl_assignment.state;
        END IF;

        RETURN NEW;
    END IF;

    -- Jalur REGULAR
    IF NEW.type = 'REGULAR' THEN
        SELECT value INTO v_office_confirmed_str
        FROM public.system_settings
        WHERE key = 'OFFICE_COORDINATES_CONFIRMED'
        LIMIT 1;

        IF v_office_confirmed_str IS NULL OR LOWER(TRIM(v_office_confirmed_str)) != 'true' THEN
            RAISE EXCEPTION 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.';
        END IF;

        SELECT latitude, longitude, radius_meters
        INTO v_office_lat, v_office_lng, v_office_radius
        FROM public.villages
        LIMIT 1;

        DECLARE
            v_settings_radius INTEGER;
            v_effective_radius INTEGER;
            v_check_in_dist INTEGER;
            v_check_out_dist INTEGER;
        BEGIN
            SELECT (CASE WHEN value ~ '^[0-9]+$' THEN value::integer ELSE NULL END)
            INTO v_settings_radius
            FROM public.system_settings
            WHERE key = 'REGULAR_ATTENDANCE_RADIUS_METERS'
              AND status = 'ACTIVE'
              AND effective_from <= NEW.attendance_date
              AND (effective_to IS NULL OR effective_to >= NEW.attendance_date)
            ORDER BY effective_from DESC, created_at DESC
            LIMIT 1;

            v_effective_radius := COALESCE(v_settings_radius, v_office_radius, 100);

            -- Validasi Geofence Check-In
            IF NEW.check_in_at IS NOT NULL AND NEW.check_in_latitude IS NOT NULL THEN
                v_check_in_dist := public.calculate_haversine_distance_meters(
                    NEW.check_in_latitude::double precision,
                    NEW.check_in_longitude::double precision,
                    v_office_lat::double precision,
                    v_office_lng::double precision
                );
                IF v_check_in_dist IS NULL OR v_check_in_dist > v_effective_radius THEN
                    RAISE EXCEPTION 'Presensi Check-In ditolak: Lokasi Anda berada %m dari kantor desa (Radius maksimal %m).',
                        COALESCE(v_check_in_dist, -1), v_effective_radius;
                END IF;
                NEW.check_in_distance_meters := v_check_in_dist;
            END IF;

            -- Validasi Geofence Check-Out
            IF NEW.check_out_at IS NOT NULL AND NEW.check_out_latitude IS NOT NULL THEN
                v_check_out_dist := public.calculate_haversine_distance_meters(
                    NEW.check_out_latitude::double precision,
                    NEW.check_out_longitude::double precision,
                    v_office_lat::double precision,
                    v_office_lng::double precision
                );
                IF v_check_out_dist IS NULL OR v_check_out_dist > v_effective_radius THEN
                    RAISE EXCEPTION 'Presensi Check-Out ditolak: Lokasi Anda berada %m dari kantor desa (Radius maksimal %m).',
                        COALESCE(v_check_out_dist, -1), v_effective_radius;
                END IF;
                NEW.check_out_distance_meters := v_check_out_dist;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;
