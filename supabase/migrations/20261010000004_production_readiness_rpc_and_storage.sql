-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 008
-- File: 20261010000004_production_readiness_rpc_and_storage.sql
-- Deskripsi: Remediasi Kesiapan Produksi (PRD v1.3.0)
--            1. Official Server Time RPC (get_server_time)
--            2. Resilience Signature Stored Procedure (record_system_audit_event)
--            3. Private Storage Buckets (dl-evidence & absence-attachments)
--            4. RLS Storage Objects Policies
-- ==============================================================================

-- 1. Endpoint Waktu Otoritatif Server Database (PRD Section 1 & 46)
CREATE OR REPLACE FUNCTION public.get_server_time()
RETURNS TIMESTAMPTZ AS $$
BEGIN
    RETURN clock_timestamp();
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_server_time() TO authenticated, anon, service_role;

-- 2. Stored Procedure Rekam Audit dengan Parameter Fleksibel & Perlindungan WORM (PRD Section 20)
CREATE OR REPLACE FUNCTION public.record_system_audit_event(
    p_action VARCHAR(100),
    p_entity_type VARCHAR(100) DEFAULT 'SYSTEM',
    p_entity_id VARCHAR(100) DEFAULT 'SYSTEM',
    p_details JSONB DEFAULT '{}'::jsonb
)
RETURNS VARCHAR(50) AS $$
DECLARE
    v_actor_user_id VARCHAR(50);
    v_actor_nama VARCHAR(150);
    v_actor_role VARCHAR(50);
    v_log_id VARCHAR(50);
    v_clean_details JSONB;
BEGIN
    -- Konteks administrasi / internal superuser
    IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN
        v_actor_user_id := 'usr-admin';
        v_actor_nama := 'System Administrator';
        v_actor_role := 'SUPER_ADMIN';
    ELSE
        IF auth.uid() IS NULL THEN
            RAISE EXCEPTION 'Aksi audit ditolak: sesi autentikasi tidak valid atau anonim.';
        END IF;

        -- Ambil identitas pelaku secara tepercaya dari database
        SELECT id, nama, role::text INTO v_actor_user_id, v_actor_nama, v_actor_role
        FROM public.users
        WHERE auth_user_id = auth.uid()
        LIMIT 1;

        IF v_actor_user_id IS NULL THEN
            -- Fallback jika profil belum terhubung penuh
            v_actor_user_id := COALESCE((p_details->>'actorUserId'), 'auth-' || SUBSTRING(auth.uid()::text, 1, 8));
            v_actor_nama := COALESCE((p_details->>'actorNama'), 'Aparatur Desa');
            v_actor_role := COALESCE((p_details->>'actorRole'), 'PERANGKAT_DESA');
        END IF;
    END IF;

    -- Bersihkan details dari potensi secret/token/password
    v_clean_details := p_details - 'password' - 'password_hash' - 'token' - 'access_token' - 'refreshToken' - 'service_role_key' - 'secret';

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
        ip_address,
        user_agent,
        created_at
    ) VALUES (
        v_log_id,
        v_actor_user_id,
        v_actor_nama,
        v_actor_role,
        p_action,
        COALESCE(p_entity_type, 'SYSTEM'),
        COALESCE(p_entity_id, 'SYSTEM'),
        COALESCE(v_clean_details, '{}'::jsonb),
        (p_details->>'ipAddress'),
        (p_details->>'userAgent'),
        clock_timestamp()
    );

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.record_system_audit_event(VARCHAR, VARCHAR, VARCHAR, JSONB) TO authenticated, service_role;

-- 3. Inisialisasi Storage Bucket Privat untuk Evidence & Dokumen Lampiran (PRD Section 15 & 30.2)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
    ('dl-evidence', 'dl-evidence', false, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']),
    ('absence-attachments', 'absence-attachments', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET 
    public = false,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Kebijakan RLS Storage Objects
-- A. Bucket dl-evidence (Bukti Foto Selfie Dinas Luar)
DROP POLICY IF EXISTS "dl_evidence_insert_authenticated" ON storage.objects;
CREATE POLICY "dl_evidence_insert_authenticated" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'dl-evidence');

DROP POLICY IF EXISTS "dl_evidence_select_authenticated" ON storage.objects;
CREATE POLICY "dl_evidence_select_authenticated" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'dl-evidence');

-- B. Bucket absence-attachments (Surat Keterangan Dokter & Lampiran Izin/Cuti)
DROP POLICY IF EXISTS "absence_attachments_insert_authenticated" ON storage.objects;
CREATE POLICY "absence_attachments_insert_authenticated" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'absence-attachments');

DROP POLICY IF EXISTS "absence_attachments_select_authenticated" ON storage.objects;
CREATE POLICY "absence_attachments_select_authenticated" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'absence-attachments');
