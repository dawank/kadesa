import { DailyAttendanceStatus } from './attendance';

export interface DailyReportItem {
  id: string;
  userId: string;
  nama: string;
  jabatan: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: DailyAttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  isEarlyLeave?: boolean;
  earlyLeaveMinutes?: number | null;
  earlyLeaveReason?: string | null;
  note?: string;
}

export interface MonthlyReportItem {
  userId: string;
  nama: string;
  jabatan: string;
  totalWorkdays: number;
  hadir: number;
  terlambat: number;
  izin: number;
  sakit: number;
  dinasLuar: number;
  cuti: number;
  alpha: number;
  attendancePercentage: number;
}
