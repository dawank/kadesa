import React from 'react';
import {
  CheckCircle,
  Clock,
  AlertCircle,
  Calendar,
  Briefcase,
  FileText,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, size = 'md' }) => {
  const norm = status.toUpperCase().replace(/\s+/g, '_');

  let badgeClass = 'badge-libur';
  let label = status;
  let Icon = HelpCircle;

  switch (norm) {
    case 'HADIR':
      badgeClass = 'badge-hadir';
      label = 'Hadir';
      Icon = CheckCircle;
      break;
    case 'TERLAMBAT':
      badgeClass = 'badge-terlambat';
      label = 'Terlambat';
      Icon = Clock;
      break;
    case 'IZIN':
      badgeClass = 'badge-izin';
      label = 'Izin';
      Icon = FileText;
      break;
    case 'SAKIT':
      badgeClass = 'badge-sakit';
      label = 'Sakit';
      Icon = AlertCircle;
      break;
    case 'DINAS_LUAR':
      badgeClass = 'badge-dl';
      label = 'Dinas Luar';
      Icon = Briefcase;
      break;
    case 'CUTI':
      badgeClass = 'badge-cuti';
      label = 'Cuti';
      Icon = Calendar;
      break;
    case 'ALPHA':
      badgeClass = 'badge-alpha';
      label = 'Alpha';
      Icon = XCircle;
      break;
    case 'LIBUR':
      badgeClass = 'badge-libur';
      label = 'Libur';
      Icon = Calendar;
      break;
    // DL & Absence States
    case 'PENDING':
    case 'SUBMITTED':
      badgeClass = 'badge-pending';
      label = 'Pending';
      Icon = Clock;
      break;
    case 'VERIFIED':
      badgeClass = 'badge-verified';
      label = 'Verified';
      Icon = CheckCircle;
      break;
    case 'APPROVED':
      badgeClass = 'badge-approved';
      label = 'Approved';
      Icon = CheckCircle;
      break;
    case 'RATIFIED':
      badgeClass = 'badge-ratified';
      label = 'Ratified';
      Icon = CheckCircle;
      break;
    case 'RATIFICATION_OVERDUE':
      badgeClass = 'badge-overdue';
      label = 'Overdue Ratifikasi';
      Icon = AlertCircle;
      break;
    case 'REJECTED':
      badgeClass = 'badge-rejected';
      label = 'Ditolak';
      Icon = XCircle;
      break;
    case 'CANCELLED':
      badgeClass = 'badge-cancelled';
      label = 'Dibatalkan';
      Icon = XCircle;
      break;
    default:
      label = status;
      break;
  }

  const iconSize = size === 'sm' ? 12 : 14;

  return (
    <span className={`badge ${badgeClass} ${size === 'sm' ? 'btn-sm' : ''}`}>
      <Icon size={iconSize} />
      <span>{label}</span>
    </span>
  );
};
