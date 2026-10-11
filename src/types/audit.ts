export type AuditEventType =
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'ATTENDANCE_CHECK_IN'
  | 'ATTENDANCE_CHECK_OUT'
  | 'ATTENDANCE_CORRECTION'
  | 'DL_SUBMITTED'
  | 'DL_VERIFIED'
  | 'DL_APPROVED'
  | 'DL_RATIFIED'
  | 'DL_REJECTED'
  | 'LEAVE_SUBMITTED'
  | 'LEAVE_VERIFIED'
  | 'LEAVE_APPROVED'
  | 'MASTER_UPDATED'
  | 'SETTINGS_CHANGED';

export interface AuditLogItem {
  id: string;
  actorUserId: string;
  actorNama: string;
  actorRole: string;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

export interface SecurityEventItem {
  id: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  eventType: string;
  actorNama: string;
  metadata: Record<string, unknown>;
  state: 'NEW' | 'REVIEWED' | 'DISMISSED';
  createdAt: string;
}
