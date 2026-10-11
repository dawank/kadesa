import { DailyAttendanceStatus } from './attendance';

export type CorrectionState = 'PENDING' | 'REQUESTED' | 'APPROVED' | 'REJECTED';

export interface CorrectionRequest {
  id: string;
  attendanceRecordId: string;
  userId: string;
  userNama: string;
  userJabatan: string;
  attendanceDate: string;
  originalCheckIn: string | null;
  originalCheckOut: string | null;
  originalStatus: DailyAttendanceStatus;
  correctedCheckIn: string | null;
  correctedCheckOut: string | null;
  correctedStatus: DailyAttendanceStatus;
  reason: string;
  requestedByUserId: string;
  requestedByNama: string;
  processedByUserId: string;
  processedByNama: string;
  processedAt: string;
  appliedAt?: string | null;
  appliedByUserId?: string | null;
  state: CorrectionState;
  createdAt: string;
}
