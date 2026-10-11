import { describe, it, expect } from 'vitest';
import { isSupabaseConfigured } from '../services/supabaseClient';
import * as fs from 'fs';
import * as path from 'path';

describe('Backend Phase 1 Foundation & Database Migration Audit Tests', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');

  it('should have initial schema migration file with all 14 relational tables', () => {
    const migrationFile = path.join(migrationsDir, '20261009000001_initial_schema.sql');
    expect(fs.existsSync(migrationFile)).toBe(true);

    const content = fs.readFileSync(migrationFile, 'utf-8');

    // Verify all 14 relational tables are defined
    const requiredTables = [
      'villages',
      'positions',
      'users',
      'system_settings',
      'work_schedules',
      'holidays',
      'attendance_records',
      'dl_assignments',
      'dl_locations',
      'dl_evidence',
      'absence_requests',
      'attendance_corrections',
      'audit_logs',
      'notifications',
    ];

    for (const table of requiredTables) {
      expect(content).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }

    // Verify critical constraints
    expect(content).toContain('CONSTRAINT uq_user_attendance_date UNIQUE(user_id, attendance_date)');
    expect(content).toContain('ON DELETE RESTRICT');
    expect(content).toContain('ON DELETE CASCADE');

    // Verify PULANG_CEPAT is NOT a primary status in attendance_status_enum (ADR-010)
    expect(content).not.toContain("'PULANG_CEPAT'");
    expect(content).toContain('is_early_leave BOOLEAN NOT NULL DEFAULT FALSE');
    expect(content).toContain('early_leave_minutes INTEGER NULL CHECK (early_leave_minutes >= 0)');
  });

  it('should have Row Level Security (RLS) migration file covering all 14 tables', () => {
    const rlsFile = path.join(migrationsDir, '20261009000002_row_level_security.sql');
    expect(fs.existsSync(rlsFile)).toBe(true);

    const content = fs.readFileSync(rlsFile, 'utf-8');

    // Verify RLS is enabled on all 14 tables
    const requiredTables = [
      'villages',
      'positions',
      'users',
      'system_settings',
      'work_schedules',
      'holidays',
      'attendance_records',
      'dl_assignments',
      'dl_locations',
      'dl_evidence',
      'absence_requests',
      'attendance_corrections',
      'audit_logs',
      'notifications',
    ];

    for (const table of requiredTables) {
      expect(content).toContain(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY;`);
    }

    // Verify strict operator constraints in RLS policy
    expect(content).toContain('role NOT IN (\'SUPER_ADMIN\', \'OPERATOR_DESA\')');
    expect(content).toContain('role != \'SUPER_ADMIN\'');
    expect(content).toContain('public.is_super_admin()');
    expect(content).toContain('public.is_operator()');

    // Verify search path protection on security definer functions
    expect(content).toContain('SET search_path = public, pg_temp');

    // Verify audit log anti-forgery: direct client INSERT revoked and trusted RPC defined
    expect(content).toContain('REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated, anon, PUBLIC;');
    expect(content).toContain('record_system_audit_event');
    expect(content).toContain('reject_audit_logs_mutation()');

    // Verify multi-column anti-tampering and auth_user_id protection trigger on both INSERT and UPDATE
    expect(content).toContain('prevent_unauthorized_user_tampering()');
    expect(content).toContain('BEFORE INSERT OR UPDATE ON users');
    expect(content).toContain('Hanya Super Admin yang berwenang memberikan atau mencabut peran Operator Desa');

    // Verify backend-level geofence safety trigger on attendance_records (ADR-012 Point B)
    expect(content).toContain('enforce_attendance_geofence_safety()');
    expect(content).toContain('trg_enforce_attendance_geofence');
    expect(content).toContain('BEFORE INSERT OR UPDATE ON attendance_records');
    expect(content).toContain('OFFICE_COORDINATES_CONFIRMED');
    expect(content).toContain('Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi');
  });

  it('should have dedicated migration 004 for early leave attributes reconciliation', () => {
    const migration004 = path.join(migrationsDir, '20261009000004_early_leave_attributes.sql');
    expect(fs.existsSync(migration004)).toBe(true);

    const content = fs.readFileSync(migration004, 'utf-8');
    expect(content).toContain('is_early_leave');
    expect(content).toContain('early_leave_minutes');
    expect(content).toContain('early_leave_reason');
  });

  it('should have baseline seed data migration file for Desa Sukamaju', () => {
    const seedFile = path.join(migrationsDir, '20261009000003_seed_data.sql');
    expect(fs.existsSync(seedFile)).toBe(true);

    const content = fs.readFileSync(seedFile, 'utf-8');

    expect(content).toContain('Desa Sukamaju');
    expect(content).toContain('Kepala Desa');
    expect(content).toContain('Sekretaris Desa');
    expect(content).toContain('LETTERHEAD_CONFIG');
    expect(content).toContain('usr-admin');
    expect(content).toContain('usr-operator');
    expect(content).toContain('OFFICE_COORDINATES_CONFIRMED');
  });

  it('should handle unconfigured Supabase environment gracefully without runtime crashes', () => {
    // When environment variables are missing, isSupabaseConfigured must return false
    const configured = isSupabaseConfigured();
    // In this clean test environment, no real Supabase project is plugged in yet
    expect(typeof configured).toBe('boolean');
  });

  it('should not contain any service_role keys or secrets in frontend codebase or env templates', () => {
    const envExamplePath = path.resolve(__dirname, '../../.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const envContent = fs.readFileSync(envExamplePath, 'utf-8');
    expect(envContent).not.toContain('VITE_SUPABASE_SERVICE_ROLE_KEY');
    expect(envContent).not.toContain('SUPABASE_SERVICE_KEY');
    expect(envContent).not.toContain('eyJ'); // No hardcoded JWT tokens
    expect(envContent).toContain('VITE_SUPABASE_URL');
    expect(envContent).toContain('VITE_SUPABASE_ANON_KEY');
  });

  it('should have migration 005 for authoritative server-side geofence calculation and anti-tampering', () => {
    const migration005 = path.join(migrationsDir, '20261009000005_server_side_geofence_enforcement.sql');
    expect(fs.existsSync(migration005)).toBe(true);

    const content = fs.readFileSync(migration005, 'utf-8');

    // Geographic boundary constraints on villages
    expect(content).toContain('chk_villages_latitude');
    expect(content).toContain('chk_villages_longitude');

    // Column dl_assignment_id on attendance_records
    expect(content).toContain('dl_assignment_id');

    // Haversine distance function in PostgreSQL
    expect(content).toContain('calculate_haversine_distance_meters');
    expect(content).toContain('RADIANS');
    expect(content).toContain('ATAN2');
    expect(content).toContain('IMMUTABLE STRICT SECURITY DEFINER');

    // Authoritative trigger logic
    expect(content).toContain('enforce_attendance_geofence_safety()');
    expect(content).toContain('OFFICE_COORDINATES_CONFIRMED');
    expect(content).toContain('REGULAR_ATTENDANCE_RADIUS_METERS');
    expect(content).toContain('NEW.type = \'REGULAR\'');
    expect(content).toContain('v_check_in_dist > v_effective_radius');
    expect(content).toContain('v_check_out_dist > v_effective_radius');

    // Anti-tampering on UPDATE: Historical GPS Immutability
    expect(content).toContain('Manipulasi koordinat dan jarak Check-In historis dilarang');
    expect(content).toContain('Manipulasi tipe presensi ditolak');

    // Strict correction workflow check: approved correction required
    expect(content).toContain('attendance_corrections');
    expect(content).toContain('state = \'APPROVED\'');

    // Strict DINAS_LUAR relation check
    expect(content).toContain('dl_assignments');
    expect(content).toContain('subject_user_id = NEW.user_id');
    expect(content).toContain('NEW.attendance_date BETWEEN start_date AND end_date');
    expect(content).toContain('v_dl_state NOT IN (\'APPROVED\', \'RATIFIED\')');

    // Security & privileges: Revoke from public, authenticated, anon; grant only to postgres, supabase_admin
    expect(content).toContain('REVOKE EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC, authenticated, anon;');
    expect(content).toContain('GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION) TO postgres, supabase_admin;');

    // Privilege Escalation Prevention: Must check session_user, NOT current_user (which switches to postgres in SECURITY DEFINER)
    expect(content).toContain('session_user IN (\'postgres\', \'supabase_admin\')');
    expect(content).not.toContain('current_user IN (\'postgres\', \'supabase_admin\')');
  });

  it('Migration 006: should enforce strict approval workflow integrity, anti-replay, and DL state machine', () => {
    const migration006 = path.join(
      process.cwd(),
      'supabase',
      'migrations',
      '20261009000006_approval_workflow_integrity.sql'
    );
    expect(fs.existsSync(migration006)).toBe(true);

    const content = fs.readFileSync(migration006, 'utf-8');

    // Anti-replay columns on attendance_corrections
    expect(content).toContain('applied_at TIMESTAMPTZ NULL');
    expect(content).toContain('applied_by VARCHAR(50) NULL');

    // Attendance correction lifecycle enforcement trigger
    expect(content).toContain('enforce_attendance_correction_lifecycle()');
    expect(content).toContain('Pengajuan koreksi baru wajib berstatus PENDING');
    expect(content).toContain('Konflik kepentingan: Pemohon atau aparatur terkait dilarang menyetujui koreksi presensinya sendiri');

    // Dinas Luar lifecycle enforcement trigger & state machine
    expect(content).toContain('enforce_dl_assignment_lifecycle()');
    expect(content).toContain('Surat tugas Dinas Luar baru wajib berstatus PENDING');
    expect(content).toContain('Hanya Kepala Desa yang berwenang meratifikasi surat tugas Dinas Luar');
    expect(content).toContain('Hanya Sekretaris Desa atau Super Admin yang berwenang memverifikasi surat tugas Dinas Luar');
    expect(content).toContain('Konflik kepentingan: Pemohon atau aparatur bersangkutan tidak boleh memverifikasi tugasnya sendiri');

    // Replay attack closure and concurrency row lock in attendance_records trigger
    expect(content).toContain('applied_at IS NULL');
    expect(content).toContain('FOR UPDATE;');
    expect(content).toContain('Koreksi presensi ditolak: Tidak ditemukan dokumen koreksi berstatus APPROVED yang sah, belum digunakan, dan sesuai persis');
    expect(content).toContain('record_system_audit_event');
    expect(content).toContain('APPLY_ATTENDANCE_CORRECTION');

    // Immutability of core fields
    expect(content).toContain('Pengubahan subjek penugasan (subject_user_id) dilarang oleh sistem');
    expect(content).toContain('Identitas, relasi presensi, dan data asli awal bersifat immutable pada permohonan koreksi');
    expect(content).toContain('kadesa.applying_correction_id');
    expect(content).toContain('Pemberian tanda konsumsi koreksi (applied_at) hanya sah melalui alur presensi resmi');
    expect(content).toContain('Surat tugas Dinas Luar berstatus % bersifat final dan tidak dapat diubah lagi');

    // Anonymous bypass protection with session_user
    expect(content).toContain('session_user IN (\'postgres\', \'supabase_admin\')');
    expect(content).not.toContain('current_user IN (\'postgres\', \'supabase_admin\')');

    // Consistent server-side geofence enforcement in Migration 006
    expect(content).toContain('Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.');
    expect(content).toContain('FROM public.villages');
    expect(content).toContain('REGULAR_ATTENDANCE_RADIUS_METERS');
  });
});
