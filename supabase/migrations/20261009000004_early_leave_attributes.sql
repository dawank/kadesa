-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 004
-- File: 20261009000004_early_leave_attributes.sql
-- Deskripsi: Transformasi PULANG_CEPAT Menjadi Atribut Transaksi Presensi Harian
--            (Penerapan Keputusan Bisnis Resmi ADR-010)
-- Target: Rekonsiliasi & Migrasi Berurutan (Offline / Pre-Live)
-- ==============================================================================

-- 1. Penambahan Kolom Atribut Pulang Lebih Awal pada attendance_records
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_records' 
          AND column_name = 'is_early_leave'
    ) THEN
        ALTER TABLE public.attendance_records 
        ADD COLUMN is_early_leave BOOLEAN NOT NULL DEFAULT FALSE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_records' 
          AND column_name = 'early_leave_minutes'
    ) THEN
        ALTER TABLE public.attendance_records 
        ADD COLUMN early_leave_minutes INTEGER NULL CHECK (early_leave_minutes >= 0);
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'attendance_records' 
          AND column_name = 'early_leave_reason'
    ) THEN
        ALTER TABLE public.attendance_records 
        ADD COLUMN early_leave_reason TEXT NULL;
    END IF;
END $$;

-- 2. Rekonsiliasi Data Historis (Jika Ada Database Eksisting yang Pernah Menggunakan Nilai PULANG_CEPAT)
-- Mengubah status harian menjadi HADIR dengan flag is_early_leave = TRUE tanpa menghapus fakta kehadiran
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_enum 
        WHERE enumtypid = 'public.attendance_status_enum'::regtype 
          AND enumlabel = 'PULANG_CEPAT'
    ) THEN
        UPDATE public.attendance_records
        SET is_early_leave = TRUE,
            early_leave_reason = COALESCE(early_leave_reason, 'Pulang lebih awal tercatat secara administratif'),
            status = 'HADIR'
        WHERE status::text = 'PULANG_CEPAT';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        NULL; -- Aman jika tipe enum baru sudah aktif tanpa nilai PULANG_CEPAT
END $$;

-- 3. Catatan Audit Skema
COMMENT ON COLUMN public.attendance_records.is_early_leave IS 
    'Flag penanda kepulangan lebih awal sebelum jam dinas berakhir (ADR-010). Bukan status primer.';
COMMENT ON COLUMN public.attendance_records.early_leave_minutes IS 
    'Jumlah menit kepulangan lebih awal relatif terhadap jam kerja efektif & zona waktu sistem (ADR-010).';
