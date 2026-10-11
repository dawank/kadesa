-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 005
-- File: 20261009000005_server_side_geofence_enforcement.sql
-- Deskripsi: Remediasi & Pengerasan Keamanan Geofence Sisi Server (PostgreSQL)
--            - Validasi Batas Geografis (-90..90, -180..180) & Penolakan Parsial
--            - Pencegahan Bypass Kolom NULL pada Check-In & Check-Out
--            - Kalkulasi Jarak Haversine Otoritatif di Server (Tanpa PostGIS)
--            - Resolusi Radius Efektif Deterministik Berbasis Tanggal Transaksi
--            - Proteksi Anti-Tampering Historis (GPS Immutability)
--            - Pembatasan Koreksi Check-In/Check-Out Hanya via Jalur Persetujuan Sah
--            - Validasi Relasi dan Keabsahan Surat Tugas DINAS_LUAR
--            - Pencabutan Hak Eksekusi Publik & Penutupan Permukaan Serangan RPC
-- Target: Idempoten & Berurutan (Offline / Pre-Live)
-- ==============================================================================

-- 1. Pastikan kolom dl_assignment_id tersedia pada attendance_records
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_records' 
          AND column_name = 'dl_assignment_id'
    ) THEN
        ALTER TABLE public.attendance_records 
        ADD COLUMN dl_assignment_id VARCHAR(50) NULL REFERENCES public.dl_assignments(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_dl_assignment ON public.attendance_records(dl_assignment_id);

-- 2. Validasi Batas Geografis pada Master Profil Desa
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_villages_latitude'
    ) THEN
        ALTER TABLE public.villages 
        ADD CONSTRAINT chk_villages_latitude CHECK (latitude BETWEEN -90.0 AND 90.0);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_villages_longitude'
    ) THEN
        ALTER TABLE public.villages 
        ADD CONSTRAINT chk_villages_longitude CHECK (longitude BETWEEN -180.0 AND 180.0);
    END IF;
END $$;

-- 3. Fungsi Helper Kalkulasi Jarak Haversine di Level Database (PostgreSQL)
-- Rumus Haversine murni untuk menghitung jarak lingkaran besar dalam satuan meter
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance_meters(
    p_lat1 DOUBLE PRECISION,
    p_lon1 DOUBLE PRECISION,
    p_lat2 DOUBLE PRECISION,
    p_lon2 DOUBLE PRECISION
)
RETURNS INTEGER AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 6371000.0; -- Radius bumi rata-rata (meter)
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

-- 4. Fungsi Trigger Penegakan Keamanan Geofence Otoritatif
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

-- 5. Pemasangan Ulang Trigger pada attendance_records
DROP TRIGGER IF EXISTS trg_enforce_attendance_geofence ON attendance_records;
CREATE TRIGGER trg_enforce_attendance_geofence
BEFORE INSERT OR UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_geofence_safety();

-- 6. Hak Akses Eksekusi (Privileges) - Pengerasan Ketat
-- Cabut hak eksekusi kalkulasi Haversine dari seluruh role client (PUBLIC, authenticated, anon)
-- Trigger dijalankan via SECURITY DEFINER (pemilik postgres) sehingga fungsi dapat berjalan internal tanpa membuka celah RPC
REVOKE EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, authenticated, anon;
GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO postgres, supabase_admin;

-- 7. Dokumentasi Komentar Skema
COMMENT ON FUNCTION public.calculate_haversine_distance_meters IS 
    'Fungsi internal kalkulasi jarak Haversine (meter) di level PostgreSQL. Akses publik/klien dicabut untuk mencegah penyalahgunaan RPC.';
COMMENT ON FUNCTION public.enforce_attendance_geofence_safety IS 
    'Trigger pengaman otoritatif geofence: penegakan batas koordinat, kalkulasi Haversine, proteksi anti-tampering, dan validasi relasi DL.';
