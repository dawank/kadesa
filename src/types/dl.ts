export type DLState =
  | 'PENDING'
  | 'VERIFIED'
  | 'APPROVED'
  | 'RATIFIED'
  | 'RATIFICATION_OVERDUE'
  | 'REJECTED'
  | 'CANCELLED';

export interface DLLocation {
  id: string;
  dlAssignmentId?: string;
  namaLokasi: string;
  alamat?: string;
  latitude: number;
  longitude: number;
  radius: number; // default 100m, min 25m, max 500m
  active: boolean;
}

export interface DLEvidence {
  id: string;
  dlAssignmentId: string;
  type: 'CHECK_IN' | 'CHECK_OUT';
  storageReference: string; // Base64 or signed URL preview
  latitude: number;
  longitude: number;
  accuracy: number;
  clientTimestamp: string;
  serverTimestamp: string;
  anomalyResult?: string;
  retentionUntil: string;
  createdAt: string;
}

export interface DLApprovalHistory {
  id: string;
  fromState: DLState;
  toState: DLState;
  actorUserId: string;
  actorNama: string;
  actorRole: string;
  reason?: string;
  createdAt: string;
}

export interface DLAssignment {
  id: string;
  nomorSuratTugas?: string;
  subjectUserId: string;
  subjectUserNama: string;
  subjectUserJabatan: string;
  requesterUserId: string;
  requesterUserNama: string;
  requesterUserRole: string;
  purpose: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  state: DLState;
  ratificationDeadline: string | null; // ISO string 72 hours from approval
  locations: DLLocation[];
  evidence?: DLEvidence[];
  approvalHistory: DLApprovalHistory[];
  hasCheckedIn?: boolean;
  hasCheckedOut?: boolean;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}
