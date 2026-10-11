export type DailyAttendanceStatus =
  | 'HADIR'
  | 'TERLAMBAT'
  | 'IZIN'
  | 'SAKIT'
  | 'DINAS_LUAR'
  | 'CUTI'
  | 'ALPHA'
  | 'LIBUR';

export type GeofenceValidationResult = 'ACCEPT' | 'REJECT' | 'FLAG_REVIEW' | 'ACCEPT_WARNING';

export interface AttendanceRecord {
  id: string;
  userId: string;
  userNama: string;
  userJabatan: string;
  userFoto?: string;
  attendanceDate: string; // YYYY-MM-DD
  checkInAt: string | null; // ISO timestamp
  checkOutAt: string | null; // ISO timestamp
  checkInLatitude: number | null;
  checkInLongitude: number | null;
  checkInAccuracy: number | null; // meters
  checkInClientTimestamp: string | null;
  checkOutLatitude: number | null;
  checkOutLongitude: number | null;
  checkOutAccuracy: number | null;
  checkOutClientTimestamp: string | null;
  status: DailyAttendanceStatus;
  statusReason?: string;
  validationResult: GeofenceValidationResult;
  warningCode?: string | null;
  isCorrected: boolean;
  correctionNote?: string;
  isEarlyLeave?: boolean;
  earlyLeaveReason?: string | null;
  earlyLeaveMinutes?: number | null;
  attendanceType?: 'REGULAR' | 'DINAS_LUAR';
  dlAssignmentId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GeofenceCheckParams {
  latitude: number;
  longitude: number;
  accuracy: number;
  targetLatitude: number;
  targetLongitude: number;
  allowedRadiusMeters: number;
}

export interface GeofenceCheckResult {
  isValid: boolean;
  distanceMeters: number;
  allowedRadiusMeters: number;
  validationResult: GeofenceValidationResult;
  warning?: string;
}
