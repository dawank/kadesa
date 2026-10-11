-- ==============================================================================
-- KADESA (Sistem Kehadiran Aparatur Desa) - Database Migration 001
-- File: 20261009000001_initial_schema.sql
-- Deskripsi: Skema Fondasi Relasional Lengkap 14 Tabel (PostgreSQL / Supabase)
-- Target: 1 Deployment = 1 Desa, 1 Supabase Project = 1 Desa
-- ==============================================================================

-- 1. Ekstensi Database
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Tipe Data Enum
DO $$ BEGIN
    CREATE TYPE user_role_enum AS ENUM (
        'SUPER_ADMIN',
        'OPERATOR_DESA',
        'KEPALA_DESA',
        'SEKRETARIS_DESA',
        'PERANGKAT_DESA'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE setting_category_enum AS ENUM (
        'WORK_SCHEDULE',
        'GEOFENCE',
        'WORKFLOW',
        'EVIDENCE',
        'SECURITY',
        'BRANDING',
        'LETTERHEAD'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_type_enum AS ENUM (
        'REGULAR',
        'DINAS_LUAR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status_enum AS ENUM (
        'HADIR',
        'TERLAMBAT',
        'ALPHA',
        'IZIN',
        'SAKIT',
        'DINAS_LUAR',
        'CUTI',
        'LIBUR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE dl_state_enum AS ENUM (
        'PENDING',
        'VERIFIED',
        'APPROVED',
        'RATIFIED',
        'REJECTED',
        'CANCELLED',
        'RATIFICATION_OVERDUE'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE absence_type_enum AS ENUM (
        'IZIN',
        'SAKIT',
        'CUTI_TAHUNAN',
        'CUTI_MELAHIRKAN',
        'CUTI_ALASAN_PENTING',
        'CUTI_BESAR'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE absence_state_enum AS ENUM (
        'SUBMITTED',
        'VERIFIED',
        'APPROVED',
        'REJECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE correction_state_enum AS ENUM (
        'ORIGINAL',
        'PENDING_CORRECTION',
        'CORRECTED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Fungsi Helper Timestamp Otomatis
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- TABEL 1: villages (Master Profil & Pusat Geofence Kantor Desa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS villages (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('vil-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    nama VARCHAR(150) NOT NULL,
    kecamatan VARCHAR(100) NOT NULL,
    kabupaten VARCHAR(100) NOT NULL,
    provinsi VARCHAR(100) NOT NULL,
    kode_pos VARCHAR(10) NOT NULL,
    alamat TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters >= 20 AND radius_meters <= 500),
    logo_desa TEXT NULL, -- Khusus media cetak / Kop Surat laporan resmi PDF (tidak menggantikan logo aplikasi /logo-kadesa.png)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_villages_updated_at
BEFORE UPDATE ON villages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 2: positions (Master Jabatan Organisasi Pemerintahan Desa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS positions (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('pos-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    nama VARCHAR(100) NOT NULL UNIQUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_positions_updated_at
BEFORE UPDATE ON positions
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 3: users (Akun Pengguna & Profil Aparatur Desa)
-- Pemisahan Prinsipil: role menentukan kewenangan aplikasi; jabatan_id menentukan struktur organisasi
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('usr-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    auth_user_id UUID UNIQUE NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    nama VARCHAR(150) NOT NULL,
    nik VARCHAR(16) NOT NULL UNIQUE CHECK (LENGTH(nik) = 16),
    nipd VARCHAR(30) NULL, -- Nullable untuk Kepala Desa
    nomor_whatsapp VARCHAR(20) NOT NULL,
    foto_reference TEXT NULL,
    role user_role_enum NOT NULL DEFAULT 'PERANGKAT_DESA',
    jabatan_id VARCHAR(50) NOT NULL REFERENCES positions(id) ON DELETE RESTRICT,
    attendance_required BOOLEAN NOT NULL DEFAULT TRUE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_jabatan ON users(jabatan_id);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(active);
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 4: system_settings (Konfigurasi Sistem Berbasis Tanggal Efektif)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('set-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    category setting_category_enum NOT NULL,
    key VARCHAR(100) NOT NULL,
    label VARCHAR(150) NOT NULL,
    value TEXT NOT NULL,
    value_type VARCHAR(20) NOT NULL CHECK (value_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT NOT NULL,
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    effective_to DATE NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    updated_by VARCHAR(150) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_settings_key_status ON system_settings(key, status);
CREATE INDEX IF NOT EXISTS idx_system_settings_effective ON system_settings(key, effective_from);

CREATE TRIGGER trg_system_settings_updated_at
BEFORE UPDATE ON system_settings
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 5: work_schedules (Jadwal Jam Kerja Mingguan)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS work_schedules (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('sch-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    day_of_week SMALLINT NOT NULL UNIQUE CHECK (day_of_week BETWEEN 1 AND 7),
    day_name VARCHAR(20) NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    tolerance_minutes INTEGER NOT NULL DEFAULT 15 CHECK (tolerance_minutes >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ==============================================================================
-- TABEL 6: holidays (Kalender Hari Libur Nasional & Libur Khusus Desa)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS holidays (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('hol-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    date DATE NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

-- ==============================================================================
-- TABEL 7: attendance_records (Transaksi Presensi Harian Aparatur)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('att-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    attendance_date DATE NOT NULL,
    type attendance_type_enum NOT NULL DEFAULT 'REGULAR',
    check_in_at TIMESTAMPTZ NULL,
    check_out_at TIMESTAMPTZ NULL,
    check_in_latitude DECIMAL(10, 8) NULL,
    check_in_longitude DECIMAL(11, 8) NULL,
    check_in_distance_meters INTEGER NULL,
    check_in_address TEXT NULL,
    check_in_selfie_url TEXT NULL, -- Wajib untuk Dinas Luar
    check_out_latitude DECIMAL(10, 8) NULL,
    check_out_longitude DECIMAL(11, 8) NULL,
    check_out_distance_meters INTEGER NULL,
    check_out_address TEXT NULL,
    check_out_selfie_url TEXT NULL,
    status attendance_status_enum NOT NULL,
    is_early_leave BOOLEAN NOT NULL DEFAULT FALSE,
    early_leave_reason TEXT NULL,
    early_leave_minutes INTEGER NULL CHECK (early_leave_minutes >= 0),
    correction_state correction_state_enum NOT NULL DEFAULT 'ORIGINAL',
    original_check_in TIMESTAMPTZ NULL,
    original_check_out TIMESTAMPTZ NULL,
    dl_assignment_id VARCHAR(50) NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_attendance_date UNIQUE(user_id, attendance_date)
);

CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance_records(user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_date_status ON attendance_records(attendance_date, status);

CREATE TRIGGER trg_attendance_records_updated_at
BEFORE UPDATE ON attendance_records
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 8: dl_assignments (Surat Tugas Dinas Luar & State Machine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dl_assignments (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('dla-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    nomor_surat VARCHAR(100) UNIQUE NULL,
    subject_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requester_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    purpose TEXT NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    state dl_state_enum NOT NULL DEFAULT 'PENDING',
    verified_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NULL,
    approved_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NULL,
    ratified_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    ratified_at TIMESTAMPTZ NULL,
    ratification_deadline TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    cancellation_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dl_subject_dates ON dl_assignments(subject_user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dl_state ON dl_assignments(state);

CREATE TRIGGER trg_dl_assignments_updated_at
BEFORE UPDATE ON dl_assignments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Relasi Foreign Key dl_assignment_id pada attendance_records
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_attendance_dl_assignment'
    ) THEN
        ALTER TABLE attendance_records
        ADD CONSTRAINT fk_attendance_dl_assignment
        FOREIGN KEY (dl_assignment_id) REFERENCES dl_assignments(id) ON DELETE RESTRICT;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_attendance_dl_assignment ON attendance_records(dl_assignment_id);

-- ==============================================================================
-- TABEL 9: dl_locations (Titik Koordinat Multi-Lokasi Tugas DL)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dl_locations (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('dll-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    dl_assignment_id VARCHAR(50) NOT NULL REFERENCES dl_assignments(id) ON DELETE CASCADE,
    nama_lokasi VARCHAR(200) NOT NULL,
    alamat TEXT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 100 CHECK (radius_meters >= 25 AND radius_meters <= 500),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dl_locations_assignment ON dl_locations(dl_assignment_id);

-- ==============================================================================
-- TABEL 10: dl_evidence (Bukti Foto Selfie Presensi Dinas Luar)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS dl_evidence (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('evi-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    dl_assignment_id VARCHAR(50) NOT NULL REFERENCES dl_assignments(id) ON DELETE RESTRICT,
    attendance_record_id VARCHAR(50) NOT NULL REFERENCES attendance_records(id) ON DELETE RESTRICT,
    type VARCHAR(20) NOT NULL CHECK (type IN ('CHECK_IN', 'CHECK_OUT')),
    storage_reference TEXT NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy_meters NUMERIC(6, 2) NULL,
    client_timestamp TIMESTAMPTZ NOT NULL,
    server_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dl_evidence_assignment ON dl_evidence(dl_assignment_id);
CREATE INDEX IF NOT EXISTS idx_dl_evidence_attendance ON dl_evidence(attendance_record_id);

-- ==============================================================================
-- TABEL 11: absence_requests (Pengajuan Izin & Cuti Aparatur)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS absence_requests (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('abs-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    type absence_type_enum NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL CHECK (end_date >= start_date),
    reason TEXT NOT NULL,
    attachment_url TEXT NULL,
    state absence_state_enum NOT NULL DEFAULT 'SUBMITTED',
    verified_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    verified_at TIMESTAMPTZ NULL,
    approved_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NULL,
    rejection_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_absence_user_dates ON absence_requests(user_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_absence_state ON absence_requests(state);

CREATE TRIGGER trg_absence_requests_updated_at
BEFORE UPDATE ON absence_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- TABEL 12: attendance_corrections (Koreksi Presensi Non-Destruktif)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS attendance_corrections (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('cor-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    attendance_record_id VARCHAR(50) NOT NULL REFERENCES attendance_records(id) ON DELETE RESTRICT,
    user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    requested_by VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    original_check_in TIMESTAMPTZ NULL,
    original_check_out TIMESTAMPTZ NULL,
    original_status attendance_status_enum NOT NULL,
    corrected_check_in TIMESTAMPTZ NULL,
    corrected_check_out TIMESTAMPTZ NULL,
    corrected_status attendance_status_enum NOT NULL,
    reason TEXT NOT NULL,
    approved_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    approved_at TIMESTAMPTZ NULL,
    applied_at TIMESTAMPTZ NULL,
    applied_by VARCHAR(50) NULL REFERENCES users(id) ON DELETE RESTRICT,
    state VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (state IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_corrections_attendance ON attendance_corrections(attendance_record_id);

-- ==============================================================================
-- TABEL 13: audit_logs (Rekam Jejak Audit & Keamanan Sistem - Immutable)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('aud-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    actor_user_id VARCHAR(50) NULL REFERENCES users(id) ON DELETE SET NULL,
    actor_name VARCHAR(150) NOT NULL,
    actor_role VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor ON audit_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ==============================================================================
-- TABEL 14: notifications (Notifikasi Sistem In-App)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(50) PRIMARY KEY DEFAULT ('notif-' || SUBSTRING(gen_random_uuid()::text, 1, 8)),
    recipient_user_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(200) NOT NULL,
    body TEXT NOT NULL,
    reference_type VARCHAR(50) NULL,
    reference_id VARCHAR(100) NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_read ON notifications(recipient_user_id, read);
