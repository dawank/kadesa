-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 006
-- File: 20261009000006_approval_workflow_integrity.sql
-- Deskripsi: Penegakan Integritas Alur Persetujuan (Approval Workflow Integrity)
--            - Perlindungan Koreksi Presensi Non-Destruktif & Anti-Replay
--            - Penegakan State Machine Surat Tugas Dinas Luar (Anti-Bypass & Anti-Self-Approval)
--            - Penyelarasan RLS dan Pencatatan Audit Trail Otomatis
-- ==============================================================================

-- 1. Penambahan Kolom Pelacak Konsumsi Koreksi (Anti-Replay Attack)
ALTER TABLE public.attendance_corrections
ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS applied_by VARCHAR(50) NULL REFERENCES public.users(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS idx_corrections_applied ON public.attendance_corrections(attendance_record_id, state, applied_at);

-- ==============================================================================
-- 2. TRIGGER STATE MACHINE & INTEGRITAS: attendance_corrections
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_attendance_correction_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_role public.user_role_enum;
    v_att_rec RECORD;
BEGIN
    -- Bypass khusus koneksi internal/CLI superuser (psql direct maintenance)
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Evaluasi konteks PostgREST
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: Sesi autentikasi tidak valid atau anonim.';
    END IF;

    SELECT id, role INTO v_actor_user_id, v_actor_role
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF v_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: Identitas pengguna aktif tidak terdaftar di sistem desa.';
    END IF;

    -- --------------------------------------------------------------------------
    -- A. OPERASI INSERT (Pengajuan Baru)
    -- --------------------------------------------------------------------------
    IF TG_OP = 'INSERT' THEN
        -- 1. Pengajuan baru WAJIB berstatus PENDING
        IF NEW.state IS DISTINCT FROM 'PENDING' THEN
            RAISE EXCEPTION 'Pengajuan koreksi baru wajib berstatus PENDING. Pemohon tidak dapat menetapkan status langsung APPROVED.';
        END IF;

        -- 2. Bidang persetujuan dan konsumsi wajib NULL saat pengajuan dibuat
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
        NEW.applied_at := NULL;
        NEW.applied_by := NULL;

        -- 3. Alasan wajib diisi
        IF NEW.reason IS NULL OR length(trim(NEW.reason)) = 0 THEN
            RAISE EXCEPTION 'Alasan permohonan koreksi administratif wajib diisi.';
        END IF;

        -- 4. Pengaju (requested_by) harus sesuai dengan identitas aktor aktif
        NEW.requested_by := v_actor_user_id;

        -- 5. Validasi relasi transaksi presensi
        SELECT * INTO v_att_rec
        FROM public.attendance_records
        WHERE id = NEW.attendance_record_id;

        IF v_att_rec.id IS NULL THEN
            RAISE EXCEPTION 'Transaksi presensi dengan ID % tidak ditemukan.', NEW.attendance_record_id;
        END IF;

        IF NEW.user_id IS DISTINCT FROM v_att_rec.user_id THEN
            RAISE EXCEPTION 'ID pemilik koreksi tidak sesuai dengan pemilik transaksi presensi.';
        END IF;

        -- Rekam nilai asli terkini secara otoritatif dari database
        NEW.original_check_in := v_att_rec.check_in_at;
        NEW.original_check_out := v_att_rec.check_out_at;
        NEW.original_status := v_att_rec.status;

        RETURN NEW;
    END IF;

    -- --------------------------------------------------------------------------
    -- B. OPERASI UPDATE (Persetujuan / Penolakan / Konsumsi Koreksi)
    -- --------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- 1. Snapshot nilai awal dan relasi bersifat immutable mutlak pada semua status
        IF NEW.requested_by IS DISTINCT FROM OLD.requested_by
           OR NEW.user_id IS DISTINCT FROM OLD.user_id
           OR NEW.attendance_record_id IS DISTINCT FROM OLD.attendance_record_id
           OR NEW.original_check_in IS DISTINCT FROM OLD.original_check_in
           OR NEW.original_check_out IS DISTINCT FROM OLD.original_check_out
           OR NEW.original_status IS DISTINCT FROM OLD.original_status THEN
            RAISE EXCEPTION 'Identitas, relasi presensi, dan data asli awal bersifat immutable pada permohonan koreksi.';
        END IF;

        -- 2. Jika koreksi sudah pernah diterapkan (applied_at IS NOT NULL), baris ini immutable mutlak
        IF OLD.applied_at IS NOT NULL THEN
            IF NEW.applied_at IS DISTINCT FROM OLD.applied_at
               OR NEW.applied_by IS DISTINCT FROM OLD.applied_by
               OR NEW.state IS DISTINCT FROM OLD.state
               OR NEW.corrected_check_in IS DISTINCT FROM OLD.corrected_check_in
               OR NEW.corrected_check_out IS DISTINCT FROM OLD.corrected_check_out
               OR NEW.corrected_status IS DISTINCT FROM OLD.corrected_status
               OR NEW.reason IS DISTINCT FROM OLD.reason THEN
                RAISE EXCEPTION 'Koreksi yang telah diterapkan bersifat permanen dan tidak dapat diubah atau digunakan ulang.';
            END IF;
            RETURN NEW;
        END IF;

        -- 3. Jalur Konsumsi Resmi (Pemberian applied_at & applied_by oleh sistem presensi)
        IF NEW.applied_at IS NOT NULL AND OLD.applied_at IS NULL THEN
            -- Wajib berstatus APPROVED
            IF OLD.state != 'APPROVED' THEN
                RAISE EXCEPTION 'Hanya koreksi berstatus APPROVED yang dapat diterapkan ke presensi.';
            END IF;

            -- Wajib dipicu melalui transaksi resmi penerapan presensi
            IF current_setting('kadesa.applying_correction_id', true) IS DISTINCT FROM OLD.id THEN
                RAISE EXCEPTION 'Pemberian tanda konsumsi koreksi (applied_at) hanya sah melalui alur presensi resmi.';
            END IF;

            -- Pastikan TIDAK ADA kolom usulan, data asli, atau metadata approval yang dimutasi
            IF NEW.state IS DISTINCT FROM OLD.state
               OR NEW.corrected_check_in IS DISTINCT FROM OLD.corrected_check_in
               OR NEW.corrected_check_out IS DISTINCT FROM OLD.corrected_check_out
               OR NEW.corrected_status IS DISTINCT FROM OLD.corrected_status
               OR NEW.reason IS DISTINCT FROM OLD.reason
               OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
               OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
                RAISE EXCEPTION 'Konsumsi koreksi dilarang memodifikasi data atau usulan koreksi.';
            END IF;

            RETURN NEW;
        END IF;

        -- 4. Jika bukan operasi konsumsi resmi, applied_at & applied_by dilarang diisi langsung oleh client
        IF NEW.applied_at IS NOT NULL OR NEW.applied_by IS NOT NULL THEN
            RAISE EXCEPTION 'Kolom applied_at dan applied_by hanya dapat ditetapkan oleh sistem saat presensi diperbarui.';
        END IF;

        -- 5. Mencegah modifikasi data jika sudah berstatus terminal (APPROVED / REJECTED)
        IF OLD.state IN ('APPROVED', 'REJECTED') THEN
            IF NEW.state IS DISTINCT FROM OLD.state THEN
                RAISE EXCEPTION 'Status koreksi % adalah status final (terminal) dan tidak dapat diubah lagi.', OLD.state;
            END IF;

            -- Data tidak boleh dimodifikasi
            IF NEW.corrected_check_in IS DISTINCT FROM OLD.corrected_check_in
               OR NEW.corrected_check_out IS DISTINCT FROM OLD.corrected_check_out
               OR NEW.corrected_status IS DISTINCT FROM OLD.corrected_status
               OR NEW.reason IS DISTINCT FROM OLD.reason
               OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
               OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
                RAISE EXCEPTION 'Dokumen koreksi yang telah berstatus % bersifat immutable dan tidak dapat diubah.', OLD.state;
            END IF;
            RETURN NEW;
        END IF;

        -- 6. Transisi Status Persetujuan (Hanya dari PENDING)
        IF NEW.state IS DISTINCT FROM OLD.state THEN
            IF OLD.state != 'PENDING' THEN
                RAISE EXCEPTION 'Hanya permohonan berstatus PENDING yang dapat disetujui atau ditolak (Status saat ini: %).', OLD.state;
            END IF;

            -- Transisi ke APPROVED
            IF NEW.state = 'APPROVED' THEN
                -- Nilai yang diusulkan tidak boleh dimodifikasi saat proses persetujuan
                IF NEW.corrected_check_in IS DISTINCT FROM OLD.corrected_check_in
                   OR NEW.corrected_check_out IS DISTINCT FROM OLD.corrected_check_out
                   OR NEW.corrected_status IS DISTINCT FROM OLD.corrected_status THEN
                    RAISE EXCEPTION 'Nilai usulan koreksi tidak boleh dimodifikasi saat proses persetujuan.';
                END IF;

                -- Hanya Super Admin, Kepala Desa, Sekretaris Desa, atau Operator yang berwenang
                IF v_actor_role NOT IN ('SUPER_ADMIN', 'KEPALA_DESA', 'SEKRETARIS_DESA', 'OPERATOR_DESA') THEN
                    RAISE EXCEPTION 'Pengguna tidak memiliki wewenang untuk menyetujui koreksi presensi.';
                END IF;

                -- PRINSIP ANTI-SELF-APPROVAL: Pemohon / pemilik presensi dilarang menyetujui permohonannya sendiri
                IF v_actor_user_id = OLD.requested_by OR v_actor_user_id = OLD.user_id THEN
                    RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur terkait dilarang menyetujui koreksi presensinya sendiri.';
                END IF;

                NEW.approved_by := v_actor_user_id;
                NEW.approved_at := NOW();

            -- Transisi ke REJECTED
            ELSIF NEW.state = 'REJECTED' THEN
                IF v_actor_role NOT IN ('SUPER_ADMIN', 'KEPALA_DESA', 'SEKRETARIS_DESA', 'OPERATOR_DESA') THEN
                    RAISE EXCEPTION 'Pengguna tidak memiliki wewenang untuk menolak koreksi presensi.';
                END IF;

                NEW.approved_by := v_actor_user_id;
                NEW.approved_at := NOW();
            ELSE
                RAISE EXCEPTION 'Transisi status koreksi dari % ke % tidak diizinkan.', OLD.state, NEW.state;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_attendance_correction_lifecycle ON public.attendance_corrections;
CREATE TRIGGER trg_enforce_attendance_correction_lifecycle
BEFORE INSERT OR UPDATE ON public.attendance_corrections
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_correction_lifecycle();


-- ==============================================================================
-- 3. TRIGGER STATE MACHINE & INTEGRITAS: dl_assignments
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_dl_assignment_lifecycle()
RETURNS TRIGGER AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_role public.user_role_enum;
BEGIN
    -- Bypass khusus koneksi internal/CLI superuser
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: Sesi autentikasi tidak valid atau anonim.';
    END IF;

    SELECT id, role INTO v_actor_user_id, v_actor_role
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    IF v_actor_user_id IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: Pengguna tidak terdaftar di sistem desa.';
    END IF;

    -- --------------------------------------------------------------------------
    -- A. OPERASI INSERT (Pengajuan Tugas DL Baru)
    -- --------------------------------------------------------------------------
    IF TG_OP = 'INSERT' THEN
        -- 1. Pengajuan baru wajib berstatus PENDING
        IF NEW.state IS DISTINCT FROM 'PENDING' THEN
            RAISE EXCEPTION 'Surat tugas Dinas Luar baru wajib berstatus PENDING. Tidak diizinkan membuat status langsung APPROVED atau RATIFIED.';
        END IF;

        -- 2. Seluruh kolom verifikasi, approval, dan ratifikasi wajib NULL saat INSERT
        NEW.verified_by := NULL;
        NEW.verified_at := NULL;
        NEW.approved_by := NULL;
        NEW.approved_at := NULL;
        NEW.ratified_by := NULL;
        NEW.ratified_at := NULL;
        NEW.ratification_deadline := NULL;

        -- 3. Maksud/tujuan dan tanggal tugas wajib valid
        IF NEW.purpose IS NULL OR length(trim(NEW.purpose)) = 0 THEN
            RAISE EXCEPTION 'Uraian maksud dan tujuan Dinas Luar wajib diisi.';
        END IF;

        IF NEW.end_date < NEW.start_date THEN
            RAISE EXCEPTION 'Tanggal selesai tugas tidak boleh mendahului tanggal mulai.';
        END IF;

        -- 4. Pengaju disesuaikan dengan aktor aktif
        NEW.requester_user_id := v_actor_user_id;

        RETURN NEW;
    END IF;

    -- --------------------------------------------------------------------------
    -- B. OPERASI UPDATE (State Machine Guards)
    -- --------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- 1. Identitas pemohon dan subjek bersifat immutable
        IF NEW.requester_user_id IS DISTINCT FROM OLD.requester_user_id THEN
            RAISE EXCEPTION 'Pengubahan pengaju (requester_user_id) dilarang oleh sistem.';
        END IF;

        IF NEW.subject_user_id IS DISTINCT FROM OLD.subject_user_id THEN
            RAISE EXCEPTION 'Pengubahan subjek penugasan (subject_user_id) dilarang oleh sistem.';
        END IF;

        -- 2. Finalitas Mutlak Status Terminal (RATIFIED, REJECTED, CANCELLED):
        IF OLD.state IN ('RATIFIED', 'REJECTED', 'CANCELLED') THEN
            IF NEW.state IS DISTINCT FROM OLD.state THEN
                RAISE EXCEPTION 'Surat tugas Dinas Luar berstatus % bersifat final dan tidak dapat diubah lagi.', OLD.state;
            END IF;

            -- Parameter penugasan dan pengesahan tidak boleh dimodifikasi pada status terminal
            IF NEW.purpose IS DISTINCT FROM OLD.purpose
               OR NEW.start_date IS DISTINCT FROM OLD.start_date
               OR NEW.end_date IS DISTINCT FROM OLD.end_date
               OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
               OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
               OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
               OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
               OR NEW.ratified_by IS DISTINCT FROM OLD.ratified_by
               OR NEW.ratified_at IS DISTINCT FROM OLD.ratified_at
               OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
               OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
                RAISE EXCEPTION 'Surat tugas berstatus % bersifat immutable dan tidak dapat diubah.', OLD.state;
            END IF;
            RETURN NEW;
        END IF;

        -- 3. Jika sudah APPROVED, tanggal dan tujuan tugas bersifat immutable
        IF OLD.state = 'APPROVED' THEN
            IF NEW.start_date IS DISTINCT FROM OLD.start_date
               OR NEW.end_date IS DISTINCT FROM OLD.end_date
               OR NEW.purpose IS DISTINCT FROM OLD.purpose THEN
                RAISE EXCEPTION 'Surat tugas yang telah berstatus APPROVED bersifat immutable dan tanggal/tujuan tidak dapat diubah.';
            END IF;
        END IF;

        -- Jika status berubah
        IF NEW.state IS DISTINCT FROM OLD.state THEN
            -- 1. PENDING -> VERIFIED
            IF NEW.state = 'VERIFIED' THEN
                IF OLD.state != 'PENDING' THEN
                    RAISE EXCEPTION 'Hanya surat tugas PENDING yang dapat diverifikasi (Status saat ini: %).', OLD.state;
                END IF;

                -- Hanya Sekretaris Desa atau Super Admin yang berwenang verifikasi
                IF v_actor_role NOT IN ('SEKRETARIS_DESA', 'SUPER_ADMIN') THEN
                    RAISE EXCEPTION 'Hanya Sekretaris Desa atau Super Admin yang berwenang memverifikasi surat tugas Dinas Luar.';
                END IF;

                -- Anti-self-approval
                IF v_actor_user_id = OLD.requester_user_id OR v_actor_user_id = OLD.subject_user_id THEN
                    RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur bersangkutan tidak boleh memverifikasi tugasnya sendiri.';
                END IF;

                NEW.verified_by := v_actor_user_id;
                NEW.verified_at := NOW();

            -- 2. (PENDING / VERIFIED) -> APPROVED
            ELSIF NEW.state = 'APPROVED' THEN
                -- Kades boleh menyetujui langsung dari PENDING atau VERIFIED. Sekdes/Admin memerlukan status VERIFIED terlebih dahulu.
                IF v_actor_role = 'KEPALA_DESA' THEN
                    IF OLD.state NOT IN ('PENDING', 'VERIFIED') THEN
                        RAISE EXCEPTION 'Kepala Desa hanya dapat menyetujui surat tugas yang berstatus PENDING atau VERIFIED.';
                    END IF;
                ELSE
                    IF OLD.state != 'VERIFIED' THEN
                        RAISE EXCEPTION 'Surat tugas harus berstatus VERIFIED sebelum dapat disetujui oleh %.', v_actor_role;
                    END IF;
                    IF v_actor_role NOT IN ('SEKRETARIS_DESA', 'SUPER_ADMIN') THEN
                        RAISE EXCEPTION 'Role % tidak memiliki wewenang untuk menyetujui Dinas Luar.', v_actor_role;
                    END IF;
                END IF;

                -- Anti-self-approval
                IF v_actor_user_id = OLD.requester_user_id OR v_actor_user_id = OLD.subject_user_id THEN
                    RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur bersangkutan tidak boleh menyetujui surat tugasnya sendiri.';
                END IF;

                NEW.approved_by := v_actor_user_id;
                NEW.approved_at := NOW();
                NEW.ratification_deadline := NOW() + INTERVAL '72 hours';

            -- 3. APPROVED -> RATIFIED (PRD 12.3: HANYA KEPALA DESA / SUPER_ADMIN)
            ELSIF NEW.state = 'RATIFIED' THEN
                IF OLD.state != 'APPROVED' THEN
                    RAISE EXCEPTION 'Hanya surat tugas berstatus APPROVED yang dapat diratifikasi (Status saat ini: %).', OLD.state;
                END IF;

                IF v_actor_role NOT IN ('KEPALA_DESA', 'SUPER_ADMIN') THEN
                    RAISE EXCEPTION 'Kewenangan ditolak: Hanya Kepala Desa yang berwenang meratifikasi surat tugas Dinas Luar.';
                END IF;

                NEW.ratified_by := v_actor_user_id;
                NEW.ratified_at := NOW();
                NEW.ratification_deadline := NULL;

            -- 4. REJECTED
            ELSIF NEW.state = 'REJECTED' THEN
                IF OLD.state IN ('RATIFIED') THEN
                    RAISE EXCEPTION 'Surat tugas yang telah diratifikasi tidak dapat ditolak.';
                END IF;

                IF v_actor_role NOT IN ('KEPALA_DESA', 'SEKRETARIS_DESA', 'SUPER_ADMIN') THEN
                    RAISE EXCEPTION 'Role % tidak berwenang menolak surat tugas.', v_actor_role;
                END IF;

                IF NEW.rejection_reason IS NULL OR length(trim(NEW.rejection_reason)) = 0 THEN
                    RAISE EXCEPTION 'Alasan penolakan surat tugas wajib diisi.';
                END IF;

            -- 5. CANCELLED
            ELSIF NEW.state = 'CANCELLED' THEN
                IF OLD.state IN ('RATIFIED') THEN
                    RAISE EXCEPTION 'Surat tugas yang telah diratifikasi tidak dapat dibatalkan sembarangan.';
                END IF;

                IF NEW.cancellation_reason IS NULL OR length(trim(NEW.cancellation_reason)) = 0 THEN
                    RAISE EXCEPTION 'Alasan pembatalan surat tugas wajib diisi.';
                END IF;

            ELSE
                RAISE EXCEPTION 'Transisi status Dinas Luar dari % ke % tidak diizinkan oleh sistem.', OLD.state, NEW.state;
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_dl_assignment_lifecycle ON public.dl_assignments;
CREATE TRIGGER trg_enforce_dl_assignment_lifecycle
BEFORE INSERT OR UPDATE ON public.dl_assignments
FOR EACH ROW EXECUTE FUNCTION public.enforce_dl_assignment_lifecycle();


-- ==============================================================================
-- 4. PENGUATAN TRIGGER enforce_attendance_geofence_safety PADA attendance_records
--    (Memverifikasi nilai koreksi yang disetujui & mencegah Replay Attack)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.enforce_attendance_geofence_safety()
RETURNS TRIGGER AS $$
DECLARE
    v_office_confirmed_str VARCHAR(10);
    v_office_lat DECIMAL(10, 8);
    v_office_lng DECIMAL(11, 8);
    v_office_radius INTEGER;

    v_dl_assignment RECORD;
    v_approved_corr RECORD;
    v_actor_user_id VARCHAR(50);
    v_actor_role public.user_role_enum;
BEGIN
    -- --------------------------------------------------------------------------
    -- 0. IDENTIFIKASI PEMANGGIL & PERLINDUNGAN TERHADAP BYPASS ANONIM
    -- --------------------------------------------------------------------------
    -- Bypass administratif HANYA diizinkan jika dieksekusi melalui sesi koneksi database
    -- langsung (psql, CLI, Supabase Dashboard SQL Editor) sebagai superuser 'postgres' / 'supabase_admin'.
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        RETURN NEW;
    END IF;

    -- Seluruh pemanggilan melalui PostgREST (session_user = 'authenticator') WAJIB memiliki auth.uid() yang valid
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi presensi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
    END IF;

    SELECT id, role INTO v_actor_user_id, v_actor_role
    FROM public.users
    WHERE auth_user_id = auth.uid()
    LIMIT 1;

    -- --------------------------------------------------------------------------
    -- A. PROTEKSI ANTI-TAMPERING DATA PRESENSI HISTORIS (OPERASI UPDATE)
    -- --------------------------------------------------------------------------
    IF TG_OP = 'UPDATE' THEN
        -- 1. Tipe Presensi (REGULAR vs DINAS_LUAR) bersifat IMMUTABLE setelah dibuat
        IF NEW.type IS DISTINCT FROM OLD.type THEN
            RAISE EXCEPTION 'Manipulasi tipe presensi dilarang: Tipe presensi tidak dapat diubah setelah dicatat.';
        END IF;

        -- 2. Aparatur pemilik data presensi tidak dapat dipindahkan ke aparatur lain
        IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
            RAISE EXCEPTION 'Manipulasi pemilik presensi dilarang: user_id tidak dapat diubah.';
        END IF;

        -- 3. Tanggal presensi bersifat IMMUTABLE
        IF NEW.attendance_date IS DISTINCT FROM OLD.attendance_date THEN
            RAISE EXCEPTION 'Manipulasi tanggal presensi dilarang: attendance_date tidak dapat diubah.';
        END IF;

        -- 4. Koordinat fisik Check-In dan Jarak GPS historis bersifat IMMUTABLE mutlak
        IF (NEW.check_in_latitude IS DISTINCT FROM OLD.check_in_latitude)
           OR (NEW.check_in_longitude IS DISTINCT FROM OLD.check_in_longitude)
           OR (NEW.check_in_distance_meters IS DISTINCT FROM OLD.check_in_distance_meters) THEN
            RAISE EXCEPTION 'Manipulasi koordinat dan jarak Check-In historis dilarang oleh sistem.';
        END IF;

        -- 5. Jika Check-Out sudah pernah dicatat, koordinat fisik dan jarak Check-Out juga IMMUTABLE mutlak
        IF OLD.check_out_at IS NOT NULL THEN
            IF (NEW.check_out_latitude IS DISTINCT FROM OLD.check_out_latitude)
               OR (NEW.check_out_longitude IS DISTINCT FROM OLD.check_out_longitude)
               OR (NEW.check_out_distance_meters IS DISTINCT FROM OLD.check_out_distance_meters) THEN
                RAISE EXCEPTION 'Manipulasi koordinat dan jarak Check-Out historis dilarang oleh sistem.';
            END IF;
        END IF;

        -- 6. PERUBAHAN WAKTU PRESENSI / STATUS: WAJIB MELALUI DOKUMEN KOREKSI RESMI SAH & BELUM TERPAKAI
        IF (NEW.check_in_at IS DISTINCT FROM OLD.check_in_at)
           OR (OLD.check_out_at IS NOT NULL AND NEW.check_out_at IS DISTINCT FROM OLD.check_out_at)
           OR (NEW.status IS DISTINCT FROM OLD.status AND OLD.status IS NOT NULL) THEN

            IF NEW.correction_state != 'CORRECTED' THEN
                RAISE EXCEPTION 'Perubahan waktu atau status presensi ditolak: Wajib melalui mekanisme koreksi resmi (correction_state = CORRECTED).';
            END IF;

            -- Cari dokumen koreksi yang berstatus APPROVED, BELUM PERNAH DITERAPKAN (applied_at IS NULL),
            -- dan cocok persis dengan nilai target, dengan row-level lock (FOR UPDATE) untuk mencegah race condition.
            SELECT * INTO v_approved_corr
            FROM public.attendance_corrections
            WHERE attendance_record_id = NEW.id
              AND state = 'APPROVED'
              AND applied_at IS NULL
              AND (corrected_check_in IS NOT DISTINCT FROM NEW.check_in_at)
              AND (corrected_check_out IS NOT DISTINCT FROM NEW.check_out_at)
              AND (corrected_status = NEW.status)
            ORDER BY approved_at DESC
            LIMIT 1
            FOR UPDATE;

            IF v_approved_corr.id IS NULL THEN
                RAISE EXCEPTION 'Koreksi presensi ditolak: Tidak ditemukan dokumen koreksi berstatus APPROVED yang sah, belum digunakan, dan sesuai persis dengan nilai waktu/status target. Persetujuan lama tidak dapat digunakan kembali.';
            END IF;

            -- Berikan konteks transaksi resmi untuk mengesahkan konsumsi oleh sistem presensi
            PERFORM set_config('kadesa.applying_correction_id', v_approved_corr.id, true);

            -- Tandai dokumen koreksi sebagai TELAH DITERAPKAN (Konsumsi 1-to-1 untuk menutup replay attack)
            UPDATE public.attendance_corrections
            SET applied_at = NOW(),
                applied_by = COALESCE(v_actor_user_id, v_approved_corr.approved_by)
            WHERE id = v_approved_corr.id;

            -- Bersihkan setting transaksi
            PERFORM set_config('kadesa.applying_correction_id', '', true);

            -- Pertahankan nilai awal sebelum koreksi
            NEW.original_check_in := COALESCE(OLD.original_check_in, OLD.check_in_at);
            NEW.original_check_out := COALESCE(OLD.original_check_out, OLD.check_out_at);

            -- Catat peristiwa audit secara atomik dalam satu transaksi
            PERFORM public.record_system_audit_event(
                'APPLY_ATTENDANCE_CORRECTION',
                'ATTENDANCE_RECORD',
                NEW.id,
                jsonb_build_object(
                    'correction_id', v_approved_corr.id,
                    'approved_by', v_approved_corr.approved_by,
                    'approved_at', v_approved_corr.approved_at,
                    'applied_by', COALESCE(v_actor_user_id, v_approved_corr.approved_by),
                    'reason', v_approved_corr.reason,
                    'before', jsonb_build_object(
                        'check_in_at', OLD.check_in_at,
                        'check_out_at', OLD.check_out_at,
                        'status', OLD.status
                    ),
                    'after', jsonb_build_object(
                        'check_in_at', NEW.check_in_at,
                        'check_out_at', NEW.check_out_at,
                        'status', NEW.status
                    )
                )
            );
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- B. VALIDASI RENTANG GEOGRAFIS & KELENGKAPAN PASANGAN KOORDINAT
    -- --------------------------------------------------------------------------
    IF (NEW.check_in_latitude IS NOT NULL AND NEW.check_in_longitude IS NULL)
       OR (NEW.check_in_latitude IS NULL AND NEW.check_in_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-In tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    IF (NEW.check_out_latitude IS NOT NULL AND NEW.check_out_longitude IS NULL)
       OR (NEW.check_out_latitude IS NULL AND NEW.check_out_longitude IS NOT NULL) THEN
        RAISE EXCEPTION 'Koordinat Check-Out tidak lengkap: Latitude dan Longitude wajib disertakan berpasangan.';
    END IF;

    IF NEW.check_in_latitude IS NOT NULL THEN
        IF NEW.check_in_latitude < -90.0 OR NEW.check_in_latitude > 90.0 THEN
            RAISE EXCEPTION 'Nilai latitude Check-In tidak valid (%): berada di luar rentang [-90, +90].', NEW.check_in_latitude;
        END IF;
        IF NEW.check_in_longitude < -180.0 OR NEW.check_in_longitude > 180.0 THEN
            RAISE EXCEPTION 'Nilai longitude Check-In tidak valid (%): berada di luar rentang [-180, +180].', NEW.check_in_longitude;
        END IF;
    END IF;

    IF NEW.check_out_latitude IS NOT NULL THEN
        IF NEW.check_out_latitude < -90.0 OR NEW.check_out_latitude > 90.0 THEN
            RAISE EXCEPTION 'Nilai latitude Check-Out tidak valid (%): berada di luar rentang [-90, +90].', NEW.check_out_latitude;
        END IF;
        IF NEW.check_out_longitude < -180.0 OR NEW.check_out_longitude > 180.0 THEN
            RAISE EXCEPTION 'Nilai longitude Check-Out tidak valid (%): berada di luar rentang [-180, +180].', NEW.check_out_longitude;
        END IF;
    END IF;

    -- --------------------------------------------------------------------------
    -- C. VALIDASI JALUR DINAS LUAR (DL_ASSIGNMENT VERIFICATION)
    -- --------------------------------------------------------------------------
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

        IF v_dl_assignment.subject_user_id IS DISTINCT FROM NEW.user_id THEN
            RAISE EXCEPTION 'Surat tugas Dinas Luar % diterbitkan untuk aparatur lain, bukan aparatur yang bersangkutan.', NEW.dl_assignment_id;
        END IF;

        IF NEW.attendance_date < v_dl_assignment.start_date OR NEW.attendance_date > v_dl_assignment.end_date THEN
            RAISE EXCEPTION 'Tanggal presensi (%) berada di luar masa tugas Dinas Luar (% s.d. %).',
                NEW.attendance_date, v_dl_assignment.start_date, v_dl_assignment.end_date;
        END IF;

        IF v_dl_assignment.state NOT IN ('APPROVED', 'RATIFIED') THEN
            RAISE EXCEPTION 'Surat tugas Dinas Luar % belum sah (status: %). Hanya tugas berstatus APPROVED atau RATIFIED yang berlaku.',
                NEW.dl_assignment_id, v_dl_assignment.state;
        END IF;

        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.check_in_at IS NULL AND NEW.check_in_at IS NOT NULL) THEN
            IF NEW.check_in_selfie_url IS NULL OR length(trim(NEW.check_in_selfie_url)) = 0 THEN
                RAISE EXCEPTION 'Presensi Dinas Luar wajib menyertakan foto selfie bukti kehadiran di lokasi penugasan.';
            END IF;
        END IF;

        RETURN NEW;
    END IF;

    -- --------------------------------------------------------------------------
    -- D. EVALUASI GEOFENCE PRESENSI KANTOR REGULER (REGULAR)
    -- --------------------------------------------------------------------------
    IF NEW.type = 'REGULAR' THEN
        -- 1. Validasi Status Konfirmasi Titik Koordinat Kantor (ADR-012)
        SELECT value INTO v_office_confirmed_str
        FROM public.system_settings
        WHERE key = 'OFFICE_COORDINATES_CONFIRMED'
        LIMIT 1;

        IF v_office_confirmed_str IS NULL OR LOWER(TRIM(v_office_confirmed_str)) != 'true' THEN
            RAISE EXCEPTION 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.';
        END IF;

        -- 2. Ambil Koordinat Pusat Kantor Desa dari Master Profil Desa (villages)
        SELECT latitude, longitude, radius_meters
        INTO v_office_lat, v_office_lng, v_office_radius
        FROM public.villages
        LIMIT 1;

        IF v_office_lat IS NULL OR v_office_lng IS NULL THEN
            RAISE EXCEPTION 'Presensi kantor ditolak: Data koordinat kantor desa belum dikonfigurasi dalam sistem.';
        END IF;

        -- 3. Ambil Radius Efektif Terpusat Deterministik Berbasis Tanggal Transaksi
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

            IF v_settings_radius IS NOT NULL AND v_settings_radius >= 20 AND v_settings_radius <= 500 THEN
                v_effective_radius := v_settings_radius;
            ELSIF v_office_radius IS NOT NULL AND v_office_radius >= 20 AND v_office_radius <= 500 THEN
                v_effective_radius := v_office_radius::integer;
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
                    v_office_lng::double precision
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
                    v_office_lng::double precision
                );

                IF v_check_out_dist IS NULL OR v_check_out_dist < 0 OR v_check_out_dist > v_effective_radius THEN
                    RAISE EXCEPTION 'Presensi Check-Out ditolak: Lokasi Anda berada %m dari kantor desa (Radius maksimal %m).',
                        COALESCE(v_check_out_dist, -1), v_effective_radius;
                END IF;

                -- Otoritatif: Set jarak pulang dari kalkulasi server database
                NEW.check_out_distance_meters := v_check_out_dist;
            END IF;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_enforce_attendance_geofence ON public.attendance_records;
CREATE TRIGGER trg_enforce_attendance_geofence
BEFORE INSERT OR UPDATE ON public.attendance_records
FOR EACH ROW EXECUTE FUNCTION public.enforce_attendance_geofence_safety();


-- ==============================================================================
-- 5. PENYESUAIAN KEBIJAKAN RLS: attendance_corrections & dl_assignments
-- ==============================================================================
-- Kebijakan RLS attendance_corrections
DROP POLICY IF EXISTS "corrections_insert_operator" ON public.attendance_corrections;
CREATE POLICY "corrections_insert_operator" ON public.attendance_corrections
    FOR INSERT TO authenticated
    WITH CHECK (
        public.is_admin_or_operator()
        AND state = 'PENDING'
        AND approved_by IS NULL
        AND approved_at IS NULL
        AND applied_at IS NULL
    );

DROP POLICY IF EXISTS "corrections_update_authorized" ON public.attendance_corrections;
CREATE POLICY "corrections_update_authorized" ON public.attendance_corrections
    FOR UPDATE TO authenticated
    USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'KEPALA_DESA', 'SEKRETARIS_DESA', 'OPERATOR_DESA')
    );

-- Kebijakan RLS dl_assignments
DROP POLICY IF EXISTS "dl_assignments_insert_policy" ON public.dl_assignments;
CREATE POLICY "dl_assignments_insert_policy" ON public.dl_assignments
    FOR INSERT TO authenticated
    WITH CHECK (
        state = 'PENDING'
        AND verified_by IS NULL
        AND approved_by IS NULL
        AND ratified_by IS NULL
        AND (
            public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
            OR (
                requester_user_id = (SELECT id FROM public.users WHERE auth_user_id = auth.uid())
                AND subject_user_id = requester_user_id
            )
        )
    );

DROP POLICY IF EXISTS "dl_assignments_update_policy" ON public.dl_assignments;
CREATE POLICY "dl_assignments_update_policy" ON public.dl_assignments
    FOR UPDATE TO authenticated
    USING (
        public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA')
    );
