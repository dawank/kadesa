-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 008
-- File: 20261010000002_public_read_villages_settings.sql
-- Deskripsi: Izinkan pembacaan data branding publik (villages & system_settings)
--            oleh peran anon (pengunjung belum login / halaman login resmi).
-- ==============================================================================

DROP POLICY IF EXISTS "villages_select_anon" ON villages;
CREATE POLICY "villages_select_anon" ON villages
    FOR SELECT TO anon
    USING (true);

DROP POLICY IF EXISTS "system_settings_select_anon" ON system_settings;
CREATE POLICY "system_settings_select_anon" ON system_settings
    FOR SELECT TO anon
    USING (status = 'ACTIVE');
