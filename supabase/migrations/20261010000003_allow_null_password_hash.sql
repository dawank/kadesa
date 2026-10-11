-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 009
-- File: 20261010000003_allow_null_password_hash.sql
-- Deskripsi: Setel default kosong dan izinkan NULL pada kolom password_hash
--            tabel public.users karena kredensial login dikelola oleh Supabase Auth.
-- ==============================================================================

ALTER TABLE public.users ALTER COLUMN password_hash SET DEFAULT '';
ALTER TABLE public.users ALTER COLUMN password_hash DROP NOT NULL;
