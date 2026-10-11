-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 013
-- File: 20261011000002_atomic_correction_and_dl_transactions.sql
-- Deskripsi: Remediasi Transaksi Atomik Database & Integritas Alur Kerja:
--            1. RPC Atomik Persetujuan Koreksi Absensi (apply_attendance_correction)
--               - Penguncian baris (row-level locking FOR UPDATE)
--               - Validasi server-side autoritas & anti-self-approval
--               - Pembaruan status koreksi & rekor presensi dalam 1 transaksi
--               - Rollback mutlak jika ada kegagalan parsial
--               - Anti-replay & perlindungan konkurensi (double-approval guard)
--            2. RPC Atomik Pembuatan Penugasan Dinas Luar (create_dl_assignment_with_locations)
--               - Validasi payload & seluruh lokasi tujuan sebelum commit
--               - Insersi parent dl_assignments & seluruh dl_locations dalam 1 transaksi
--               - Rollback total jika salah satu lokasi tidak valid
--               - Pencegahan data lokasi yatim (orphan rows)
-- ==============================================================================

-- 1. RPC ATOMIK PERSETUJUAN KOREKSI ABSENSI
CREATE OR REPLACE FUNCTION public.apply_attendance_correction(
    p_correction_id VARCHAR(50)
)
RETURNS JSONB AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_nama VARCHAR(150);
    v_actor_role public.user_role_enum;
    v_corr RECORD;
    v_att RECORD;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_result JSONB;
BEGIN
    -- Bypass khusus konteks internal CLI superuser
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        v_actor_user_id := 'usr-admin';
        v_actor_nama := 'System Administrator';
        v_actor_role := 'SUPER_ADMIN';
    ELSE
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Aksi ditolak: Sesi autentikasi tidak valid atau anonim.';
        END IF;

        SELECT id, nama, role INTO v_actor_user_id, v_actor_nama, v_actor_role
        FROM public.users
        WHERE auth_user_id = auth.uid()
        LIMIT 1;

        IF v_actor_user_id IS NULL THEN
            RAISE EXCEPTION 'Aksi ditolak: Pengguna aktif tidak terdaftar di sistem desa.';
        END IF;
    END IF;

    -- Validasi hak otoritas penyetuju (Super Admin, Kades, Sekdes, Operator)
    IF v_actor_role NOT IN ('SUPER_ADMIN', 'KEPALA_DESA', 'SEKRETARIS_DESA', 'OPERATOR_DESA') THEN
        RAISE EXCEPTION 'Kewenangan ditolak: Role % tidak berwenang menyetujui koreksi presensi.', v_actor_role;
    END IF;

    -- Penguncian baris eksklusif untuk mencegah race condition / double-approval
    SELECT * INTO v_corr
    FROM public.attendance_corrections
    WHERE id = p_correction_id
    FOR UPDATE;

    IF v_corr.id IS NULL THEN
        RAISE EXCEPTION 'Pengajuan koreksi presensi dengan ID % tidak ditemukan.', p_correction_id;
    END IF;

    -- Anti-replay guard
    IF v_corr.state != 'PENDING' THEN
        RAISE EXCEPTION 'Pengajuan koreksi presensi sudah diproses sebelumnya (Status saat ini: %).', v_corr.state;
    END IF;

    IF v_corr.applied_at IS NOT NULL THEN
        RAISE EXCEPTION 'Koreksi presensi sudah pernah diterapkan ke database.';
    END IF;

    -- Prinsip Anti-Self-Approval
    IF v_actor_user_id = v_corr.requested_by OR v_actor_user_id = v_corr.user_id THEN
        RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur terkait dilarang menyetujui koreksi presensinya sendiri.';
    END IF;

    -- Penguncian baris presensi terkait
    SELECT * INTO v_att
    FROM public.attendance_records
    WHERE id = v_corr.attendance_record_id
    FOR UPDATE;

    IF v_att.id IS NULL THEN
        RAISE EXCEPTION 'Catatan presensi transaksi % tidak ditemukan di database.', v_corr.attendance_record_id;
    END IF;

    -- Langkah 1: Update status pengajuan koreksi ke APPROVED
    UPDATE public.attendance_corrections
    SET state = 'APPROVED',
        approved_by = v_actor_user_id,
        approved_at = v_now
    WHERE id = v_corr.id;

    -- Langkah 2: Terapkan perubahan ke catatan presensi dengan trigger context
    PERFORM set_config('kadesa.applying_correction_id', v_corr.id, true);

    UPDATE public.attendance_records
    SET check_in_at = v_corr.corrected_check_in,
        check_out_at = v_corr.corrected_check_out,
        status = v_corr.corrected_status,
        correction_state = 'CORRECTED',
        updated_at = v_now
    WHERE id = v_corr.attendance_record_id;

    PERFORM set_config('kadesa.applying_correction_id', '', true);

    -- Langkah 3: Catat jejak audit dalam transaksi yang sama
    PERFORM public.record_system_audit_event(
        'ATTENDANCE_CORRECTION_APPROVED',
        'ATTENDANCE_CORRECTION',
        v_corr.id,
        jsonb_build_object(
            'actorUserId', v_actor_user_id,
            'actorNama', v_actor_nama,
            'actorRole', v_actor_role::text,
            'attendanceRecordId', v_corr.attendance_record_id,
            'originalCheckIn', v_corr.original_check_in,
            'originalCheckOut', v_corr.original_check_out,
            'originalStatus', v_corr.original_status::text,
            'correctedCheckIn', v_corr.corrected_check_in,
            'correctedCheckOut', v_corr.corrected_check_out,
            'correctedStatus', v_corr.corrected_status::text,
            'reason', v_corr.reason
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'correction_id', v_corr.id,
        'attendance_record_id', v_corr.attendance_record_id,
        'state', 'APPROVED',
        'approved_by', v_actor_user_id,
        'approved_at', v_now
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.apply_attendance_correction(VARCHAR) TO authenticated, service_role;


-- 2. RPC ATOMIK PEMBUATAN PENUGASAN DINAS LUAR DENGAN MULTI-LOKASI
CREATE OR REPLACE FUNCTION public.create_dl_assignment_with_locations(
    p_subject_user_id VARCHAR(50),
    p_purpose TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_locations JSONB,
    p_id VARCHAR(50) DEFAULT NULL,
    p_nomor_surat VARCHAR(100) DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_nama VARCHAR(150);
    v_actor_role public.user_role_enum;
    v_dl_id VARCHAR(50);
    v_nomor_surat VARCHAR(100);
    v_loc_element JSONB;
    v_loc_id VARCHAR(50);
    v_loc_nama VARCHAR(200);
    v_loc_alamat TEXT;
    v_loc_lat NUMERIC;
    v_loc_lng NUMERIC;
    v_loc_radius INTEGER;
    v_now TIMESTAMPTZ := clock_timestamp();
    v_inserted_locs JSONB := '[]'::jsonb;
    v_result JSONB;
BEGIN
    -- Bypass khusus CLI superuser
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        v_actor_user_id := 'usr-admin';
        v_actor_nama := 'System Administrator';
        v_actor_role := 'SUPER_ADMIN';
    ELSE
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Aksi ditolak: Sesi autentikasi tidak valid atau anonim.';
        END IF;

        SELECT id, nama, role INTO v_actor_user_id, v_actor_nama, v_actor_role
        FROM public.users
        WHERE auth_user_id = auth.uid()
        LIMIT 1;

        IF v_actor_user_id IS NULL THEN
            RAISE EXCEPTION 'Aksi ditolak: Pengguna aktif tidak terdaftar di sistem desa.';
        END IF;
    END IF;

    -- Validasi kewenangan pembuatan tugas
    IF v_actor_user_id != p_subject_user_id THEN
        IF v_actor_role NOT IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA') THEN
            RAISE EXCEPTION 'Kewenangan ditolak: Hanya Administrator, Operator, Sekdes, atau Kades yang dapat menugaskan aparatur lain.';
        END IF;
    ELSE
        -- Self-submit diperbolehkan untuk seluruh aparatur desa non-Super Admin
        IF v_actor_role = 'SUPER_ADMIN' THEN
            RAISE EXCEPTION 'Super Admin adalah administrator sistem dan bukan subjek penugasan operasional.';
        END IF;
    END IF;

    -- Validasi parameter penugasan
    IF p_purpose IS NULL OR length(trim(p_purpose)) = 0 THEN
        RAISE EXCEPTION 'Uraian maksud dan tujuan Dinas Luar wajib diisi.';
    END IF;

    IF p_end_date < p_start_date THEN
        RAISE EXCEPTION 'Tanggal selesai tugas tidak boleh mendahului tanggal mulai.';
    END IF;

    IF p_locations IS NULL OR jsonb_typeof(p_locations) != 'array' OR jsonb_array_length(p_locations) = 0 THEN
        RAISE EXCEPTION 'Penugasan Dinas Luar wajib menyertakan minimal 1 lokasi tujuan.';
    END IF;

    -- Generate identitas DL
    v_dl_id := COALESCE(p_id, 'dla-' || SUBSTRING(gen_random_uuid()::text, 1, 8));
    v_nomor_surat := COALESCE(
        p_nomor_surat,
        floor(100 + random() * 900)::text || '/ST-DL/SKM/' || to_char(v_now, 'MM/YYYY')
    );

    -- Langkah 1: Simpan parent DL Assignment
    INSERT INTO public.dl_assignments (
        id,
        nomor_surat,
        subject_user_id,
        requester_user_id,
        purpose,
        start_date,
        end_date,
        state,
        created_at,
        updated_at
    ) VALUES (
        v_dl_id,
        v_nomor_surat,
        p_subject_user_id,
        v_actor_user_id,
        p_purpose,
        p_start_date,
        p_end_date,
        'PENDING',
        v_now,
        v_now
    );

    -- Langkah 2: Simpan seluruh lokasi tujuan dalam transaksi yang sama
    FOR v_loc_element IN SELECT * FROM jsonb_array_elements(p_locations)
    LOOP
        v_loc_id := COALESCE(v_loc_element->>'id', 'dll-' || SUBSTRING(gen_random_uuid()::text, 1, 8));
        v_loc_nama := trim(COALESCE(v_loc_element->>'namaLokasi', v_loc_element->>'nama_lokasi', ''));
        v_loc_alamat := v_loc_element->>'alamat';
        v_loc_lat := (v_loc_element->>'latitude')::NUMERIC;
        v_loc_lng := (v_loc_element->>'longitude')::NUMERIC;
        v_loc_radius := COALESCE((v_loc_element->>'radius')::INTEGER, (v_loc_element->>'radius_meters')::INTEGER, 100);

        IF v_loc_nama = '' THEN
            RAISE EXCEPTION 'Nama lokasi tujuan Dinas Luar wajib diisi.';
        END IF;

        IF v_loc_lat IS NULL OR v_loc_lng IS NULL THEN
            RAISE EXCEPTION 'Koordinat lokasi % tidak lengkap.', v_loc_nama;
        END IF;

        IF v_loc_lat < -90 OR v_loc_lat > 90 OR v_loc_lng < -180 OR v_loc_lng > 180 THEN
            RAISE EXCEPTION 'Koordinat geografis lokasi % di luar rentang valid.', v_loc_nama;
        END IF;

        IF v_loc_radius < 25 OR v_loc_radius > 500 THEN
            RAISE EXCEPTION 'Radius geofence lokasi % harus di antara 25 dan 500 meter (Nilai: % meter).', v_loc_nama, v_loc_radius;
        END IF;

        INSERT INTO public.dl_locations (
            id,
            dl_assignment_id,
            nama_lokasi,
            alamat,
            latitude,
            longitude,
            radius_meters,
            active,
            created_at
        ) VALUES (
            v_loc_id,
            v_dl_id,
            v_loc_nama,
            v_loc_alamat,
            v_loc_lat,
            v_loc_lng,
            v_loc_radius,
            true,
            v_now
        );

        v_inserted_locs := v_inserted_locs || jsonb_build_object(
            'id', v_loc_id,
            'namaLokasi', v_loc_nama,
            'latitude', v_loc_lat,
            'longitude', v_loc_lng,
            'radius', v_loc_radius
        );
    END LOOP;

    -- Langkah 3: Catat jejak audit pembuatan penugasan DL
    PERFORM public.record_system_audit_event(
        'DL_ASSIGNMENT_CREATED',
        'DL_ASSIGNMENT',
        v_dl_id,
        jsonb_build_object(
            'actorUserId', v_actor_user_id,
            'actorNama', v_actor_nama,
            'actorRole', v_actor_role::text,
            'subjectUserId', p_subject_user_id,
            'nomorSurat', v_nomor_surat,
            'purpose', p_purpose,
            'locationsCount', jsonb_array_length(p_locations)
        )
    );

    v_result := jsonb_build_object(
        'success', true,
        'id', v_dl_id,
        'nomorSurat', v_nomor_surat,
        'subjectUserId', p_subject_user_id,
        'requesterUserId', v_actor_user_id,
        'purpose', p_purpose,
        'startDate', p_start_date,
        'endDate', p_end_date,
        'state', 'PENDING',
        'locations', v_inserted_locs,
        'createdAt', v_now
    );

    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.create_dl_assignment_with_locations(VARCHAR, TEXT, DATE, DATE, JSONB, VARCHAR, VARCHAR) TO authenticated, service_role;
