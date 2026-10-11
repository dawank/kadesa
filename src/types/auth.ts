/**
 * KADESA Official User Roles
 * STRICT INVARIANT: Role menentukan kewenangan aplikasi; Jabatan adalah posisi organisasi.
 * Role tidak boleh diinferensikan dari Jabatan!
 */
export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'OPERATOR_DESA' 
  | 'KEPALA_DESA' 
  | 'SEKRETARIS_DESA' 
  | 'PERANGKAT_DESA';

export interface User {
  id: string;
  authUserId: string;
  username: string;
  nama: string;
  nik: string;
  nipd: string | null; // Optional/nullable: Kades might not have NIPD
  nomorWhatsapp: string;
  fotoReference?: string;
  role: UserRole;
  jabatanId: string;
  jabatanNama: string;
  attendanceRequired: boolean;
  active: boolean;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: string;
}

export type PermissionAction =
  | 'view_dashboard'
  | 'manage_master_desa'
  | 'view_master_desa'
  | 'manage_master_aparatur'
  | 'view_master_aparatur'
  | 'manage_master_jabatan'
  | 'view_master_jabatan'
  | 'regular_attendance'
  | 'monitor_attendance'
  | 'attendance_correction'
  | 'submit_izin_sakit'
  | 'approve_izin_sakit'
  | 'submit_cuti'
  | 'verify_cuti'
  | 'approve_cuti'
  | 'dl_self_submit'
  | 'dl_assign'
  | 'dl_verify'
  | 'dl_approve'
  | 'dl_ratify'
  | 'view_reports'
  | 'manage_settings'
  | 'view_audit_logs'
  | 'view_security_events';
