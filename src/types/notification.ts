export type NotificationType =
  | 'DL_NEW'
  | 'DL_VERIFY_NEEDED'
  | 'DL_RATIFY_NEEDED'
  | 'DL_DEADLINE_APPROACHING'
  | 'DL_OVERDUE'
  | 'ABSENCE_NEEDS_ACTION'
  | 'LEAVE_NEEDS_VERIFY'
  | 'LEAVE_NEEDS_APPROVAL'
  | 'CORRECTION_PROCESSED'
  | 'SECURITY_EVENT';

export interface NotificationItem {
  id: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  body: string;
  referenceType?: 'DL' | 'ABSENCE' | 'LEAVE' | 'CORRECTION' | 'SECURITY';
  referenceId?: string;
  readAt: string | null;
  createdAt: string;
}
