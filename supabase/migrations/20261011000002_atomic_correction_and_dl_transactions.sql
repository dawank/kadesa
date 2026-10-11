-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 013
-- File: 20261011000002_atomic_correction_and_dl_transactions.sql
-- Deskripsi: Remediasi Transaksi Atomik Database & Integritas Alur Kerja:
--            1. RPC Atomik Persetujuan Koreksi Absensi (apply_attendance_correction)
--               - Penguncian baris (row-level locking FOR UPDATE)
--               - Validasi server-side autoritas & anti-self-approval
--               - Pembaruan status koreksi & rekor presensi dalam 1 transaksi
--               - Verifikasi penanda konsumsi applied_at & applied_by via trigger
--               - Anti-replay & perlindungan konkurensi (double-approval guard)
--            2. RPC Atomik Pembuatan Penugasan Dinas Luar (create_dl_assignment_with_locations)
--               - Validasi payload & seluruh lokasi tujuan sebelum commit
--               - Insersi parent dl_assignments & seluruh dl_locations dalam 1 transaksi
--               - Rollback total jika salah satu lokasi tidak valid
--               - Pencegahan data lokasi yatim (orphan rows)
-- ==============================================================================

-- 1. RPC ATOMIK PERSETUJUAN KOREKSI ABSENSI
CREATE OR REPLACE FUNCTION public.apply_attendance_correction(p_correction_id VARCHAR(50))
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id VARCHAR(50);
  v_actor_name VARCHAR(150);
  v_actor_role public.user_role_enum;
  v_corr public.attendance_corrections%ROWTYPE;
  v_att public.attendance_records%ROWTYPE;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Bypass khusus konteks internal CLI superuser
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    v_actor_id := 'usr-admin';
    v_actor_name := 'System Administrator';
    v_actor_role := 'SUPER_ADMIN';
  ELSE
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'Sesi autentikasi tidak valid atau anonim.';
    END IF;

    SELECT id, nama, role INTO v_actor_id, v_actor_name, v_actor_role
    FROM public.users
    WHERE auth_user_id = auth.uid() AND active = TRUE
    LIMIT 1;

    IF v_actor_id IS NULL THEN
      RAISE EXCEPTION 'Pengguna aktif tidak terdaftar di sistem desa.';
    END IF;
  END IF;

  IF v_actor_role NOT IN ('SUPER_ADMIN','KEPALA_DESA','SEKRETARIS_DESA','OPERATOR_DESA') THEN
    RAISE EXCEPTION 'Role tidak berwenang menyetujui koreksi presensi.';
  END IF;

  SELECT * INTO v_corr
  FROM public.attendance_corrections
  WHERE id = p_correction_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Pengajuan koreksi tidak ditemukan.'; END IF;
  IF v_corr.state <> 'PENDING' OR v_corr.applied_at IS NOT NULL OR v_corr.applied_by IS NOT NULL THEN
    RAISE EXCEPTION 'Pengajuan koreksi sudah diproses atau diterapkan.';
  END IF;
  IF v_actor_id = v_corr.requested_by OR v_actor_id = v_corr.user_id THEN
    RAISE EXCEPTION 'Pemohon atau pemilik presensi tidak boleh menyetujui koreksinya sendiri.';
  END IF;

  SELECT * INTO v_att
  FROM public.attendance_records
  WHERE id = v_corr.attendance_record_id
  FOR UPDATE;

  IF NOT FOUND OR v_att.user_id <> v_corr.user_id THEN
    RAISE EXCEPTION 'Rekaman presensi tidak ditemukan atau pemiliknya tidak cocok.';
  END IF;

  -- Set status first; the existing attendance trigger then validates this approved
  -- correction, applies the one-time consumption marker, and enforces evidence immutability.
  UPDATE public.attendance_corrections
  SET state = 'APPROVED', approved_by = v_actor_id, approved_at = v_now
  WHERE id = v_corr.id AND state = 'PENDING' AND applied_at IS NULL;

  IF NOT FOUND THEN RAISE EXCEPTION 'Koreksi telah diproses oleh request lain.'; END IF;

  UPDATE public.attendance_records
  SET check_in_at = v_corr.corrected_check_in,
      check_out_at = v_corr.corrected_check_out,
      status = v_corr.corrected_status,
      correction_state = 'CORRECTED',
      updated_at = v_now
  WHERE id = v_corr.attendance_record_id
    AND user_id = v_corr.user_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'Penerapan koreksi gagal; transaksi dibatalkan.'; END IF;

  PERFORM public.record_system_audit_event(
    'ATTENDANCE_CORRECTION_APPROVED',
    'ATTENDANCE_CORRECTION',
    v_corr.id,
    jsonb_build_object(
      'actorUserId', v_actor_id, 'actorNama', v_actor_name, 'actorRole', v_actor_role::text,
      'attendanceRecordId', v_corr.attendance_record_id,
      'originalCheckIn', v_corr.original_check_in, 'originalCheckOut', v_corr.original_check_out,
      'originalStatus', v_corr.original_status::text,
      'correctedCheckIn', v_corr.corrected_check_in, 'correctedCheckOut', v_corr.corrected_check_out,
      'correctedStatus', v_corr.corrected_status::text, 'reason', v_corr.reason
    )
  );

  -- Return the persisted consumption fields so the caller can confirm it was applied.
  SELECT * INTO v_corr FROM public.attendance_corrections WHERE id = v_corr.id;
  IF v_corr.applied_at IS NULL OR v_corr.applied_by IS NULL THEN
    RAISE EXCEPTION 'Trigger integritas tidak menandai koreksi sebagai diterapkan.';
  END IF;

  RETURN jsonb_build_object(
    'success', true, 'correction_id', v_corr.id,
    'attendance_record_id', v_corr.attendance_record_id, 'state', v_corr.state,
    'approved_by', v_corr.approved_by, 'approved_at', v_corr.approved_at,
    'applied_by', v_corr.applied_by, 'applied_at', v_corr.applied_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_attendance_correction(VARCHAR) FROM PUBLIC, anon;
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
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor_id VARCHAR(50);
  v_actor_name VARCHAR(150);
  v_actor_role public.user_role_enum;
  v_subject public.users%ROWTYPE;
  v_dl_id VARCHAR(50);
  v_letter_no VARCHAR(100);
  v_loc JSONB;
  v_loc_id VARCHAR(50);
  v_name VARCHAR(200);
  v_lat NUMERIC;
  v_lng NUMERIC;
  v_radius INTEGER;
  v_locations JSONB := '[]'::jsonb;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Bypass khusus konteks internal CLI superuser
  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
    v_actor_id := 'usr-admin';
    v_actor_name := 'System Administrator';
    v_actor_role := 'SUPER_ADMIN';
  ELSE
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sesi autentikasi tidak valid atau anonim.'; END IF;

    SELECT id, nama, role INTO v_actor_id, v_actor_name, v_actor_role
    FROM public.users WHERE auth_user_id = auth.uid() AND active = TRUE LIMIT 1;
    IF v_actor_id IS NULL THEN RAISE EXCEPTION 'Pengguna aktif tidak terdaftar di sistem desa.'; END IF;
  END IF;

  SELECT * INTO v_subject FROM public.users WHERE id = p_subject_user_id AND active = TRUE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subjek penugasan tidak ditemukan atau tidak aktif.'; END IF;
  IF NOT v_subject.attendance_required OR v_subject.role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Subjek bukan aparatur yang wajib mengikuti presensi operasional.';
  END IF;

  IF v_actor_id <> p_subject_user_id
     AND v_actor_role NOT IN ('SUPER_ADMIN','OPERATOR_DESA','KEPALA_DESA','SEKRETARIS_DESA') THEN
    RAISE EXCEPTION 'Role tidak berwenang membuat penugasan untuk aparatur lain.';
  END IF;
  IF v_actor_id = p_subject_user_id AND v_actor_role = 'SUPER_ADMIN' THEN
    RAISE EXCEPTION 'Super Admin tidak dapat menjadi subjek penugasan operasional.';
  END IF;
  IF p_purpose IS NULL OR length(trim(p_purpose)) = 0 THEN RAISE EXCEPTION 'Tujuan Dinas Luar wajib diisi.'; END IF;
  IF p_start_date IS NULL OR p_end_date IS NULL OR p_end_date < p_start_date THEN
    RAISE EXCEPTION 'Rentang tanggal penugasan tidak valid.';
  END IF;
  IF jsonb_typeof(p_locations) IS DISTINCT FROM 'array' OR jsonb_array_length(p_locations) = 0 THEN
    RAISE EXCEPTION 'Minimal satu lokasi tujuan wajib diisi.';
  END IF;
  IF p_nomor_surat IS NULL OR length(trim(p_nomor_surat)) = 0 THEN
    RAISE EXCEPTION 'Nomor surat harus dibuat oleh alur penomoran aplikasi yang berwenang.';
  END IF;

  v_dl_id := COALESCE(NULLIF(trim(p_id), ''), 'dla-' || substr(gen_random_uuid()::text, 1, 8));
  v_letter_no := trim(p_nomor_surat);

  INSERT INTO public.dl_assignments (
    id, nomor_surat, subject_user_id, requester_user_id, purpose,
    start_date, end_date, state, created_at, updated_at
  ) VALUES (
    v_dl_id, v_letter_no, p_subject_user_id, v_actor_id, trim(p_purpose),
    p_start_date, p_end_date, 'PENDING', v_now, v_now
  );

  FOR v_loc IN SELECT value FROM jsonb_array_elements(p_locations)
  LOOP
    v_loc_id := COALESCE(NULLIF(trim(v_loc->>'id'), ''), 'dll-' || substr(gen_random_uuid()::text, 1, 8));
    v_name := trim(COALESCE(v_loc->>'namaLokasi', v_loc->>'nama_lokasi', ''));
    IF v_name = '' THEN RAISE EXCEPTION 'Nama lokasi tujuan wajib diisi.'; END IF;
    IF NULLIF(v_loc->>'latitude','') IS NULL OR NULLIF(v_loc->>'longitude','') IS NULL THEN
      RAISE EXCEPTION 'Koordinat lokasi % wajib lengkap.', v_name;
    END IF;
    v_lat := (v_loc->>'latitude')::NUMERIC;
    v_lng := (v_loc->>'longitude')::NUMERIC;
    IF v_lat NOT BETWEEN -90 AND 90 OR v_lng NOT BETWEEN -180 AND 180 THEN
      RAISE EXCEPTION 'Koordinat lokasi % di luar rentang geografis.', v_name;
    END IF;
    IF NULLIF(v_loc->>'radius','') IS NOT NULL THEN
      v_radius := (v_loc->>'radius')::INTEGER;
    ELSIF NULLIF(v_loc->>'radius_meters','') IS NOT NULL THEN
      v_radius := (v_loc->>'radius_meters')::INTEGER;
    ELSE
      RAISE EXCEPTION 'Radius lokasi % wajib ditentukan sesuai konfigurasi sistem.', v_name;
    END IF;
    -- Match the existing dl_locations schema constraint; do not silently clamp radius.
    IF v_radius NOT BETWEEN 25 AND 500 THEN RAISE EXCEPTION 'Radius lokasi % tidak sesuai batas schema (25–500 m).', v_name; END IF;

    INSERT INTO public.dl_locations (
      id, dl_assignment_id, nama_lokasi, alamat, latitude, longitude, radius_meters, active, created_at
    ) VALUES (
      v_loc_id, v_dl_id, v_name, NULLIF(v_loc->>'alamat',''), v_lat, v_lng, v_radius, TRUE, v_now
    );

    v_locations := v_locations || jsonb_build_array(jsonb_build_object(
      'id',v_loc_id,'namaLokasi',v_name,'alamat',NULLIF(v_loc->>'alamat',''),
      'latitude',v_lat,'longitude',v_lng,'radius',v_radius,'active',TRUE
    ));
  END LOOP;

  PERFORM public.record_system_audit_event(
    'DL_ASSIGNMENT_CREATED','DL_ASSIGNMENT',v_dl_id,
    jsonb_build_object('actorUserId',v_actor_id,'actorNama',v_actor_name,'actorRole',v_actor_role::text,
      'subjectUserId',p_subject_user_id,'nomorSurat',v_letter_no,'purpose',trim(p_purpose),
      'locationsCount',jsonb_array_length(p_locations))
  );

  RETURN jsonb_build_object('success',TRUE,'id',v_dl_id,'nomorSurat',v_letter_no,
    'subjectUserId',p_subject_user_id,'requesterUserId',v_actor_id,'purpose',trim(p_purpose),
    'startDate',p_start_date,'endDate',p_end_date,'state','PENDING','locations',v_locations,'createdAt',v_now);
END;
$$;

REVOKE ALL ON FUNCTION public.create_dl_assignment_with_locations(VARCHAR, TEXT, DATE, DATE, JSONB, VARCHAR, VARCHAR) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_dl_assignment_with_locations(VARCHAR, TEXT, DATE, DATE, JSONB, VARCHAR, VARCHAR) TO authenticated, service_role;
