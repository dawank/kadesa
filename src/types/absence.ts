export type AbsenceType = 'IZIN' | 'SAKIT';

export type AbsenceState = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface AbsenceRequest {
  id: string;
  userId: string;
  userNama: string;
  userJabatan: string;
  type: AbsenceType;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  reason: string;
  attachmentName?: string;
  attachmentUrl?: string;
  state: AbsenceState;
  processedByUserId?: string;
  processedByNama?: string;
  processedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export type LeaveType = 'TAHUNAN' | 'MELAHIRKAN' | 'ALASAN_PENTING' | 'BESAR';

export type LeaveState = 'SUBMITTED' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LeaveRequest {
  id: string;
  userId: string;
  userNama: string;
  userJabatan: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string;
  attachmentName?: string;
  attachmentUrl?: string;
  state: LeaveState;
  verifiedByUserId?: string;
  verifiedByNama?: string;
  verifiedAt?: string;
  approvedByUserId?: string;
  approvedByNama?: string;
  approvedAt?: string;
  rejectionReason?: string;
  timeline: {
    status: LeaveState;
    actor: string;
    timestamp: string;
    note?: string;
  }[];
  createdAt: string;
  updatedAt: string;
}
