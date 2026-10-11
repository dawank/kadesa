-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 007
-- File: 20261010000001_audit_rls_policy.sql
-- Deskripsi: Perluasan hak baca audit_logs untuk Kepala Desa dan Sekretaris Desa
-- ==============================================================================

DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;

CREATE POLICY "audit_logs_select_admin" ON audit_logs
    FOR SELECT TO authenticated
    USING (public.get_current_user_role() IN ('SUPER_ADMIN', 'OPERATOR_DESA', 'KEPALA_DESA', 'SEKRETARIS_DESA'));
