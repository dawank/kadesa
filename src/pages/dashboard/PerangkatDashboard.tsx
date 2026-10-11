import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { dlService } from '../../services/dlService';
import { absenceService } from '../../services/absenceService';
import { AttendanceRecord } from '../../types/attendance';
import { DLAssignment } from '../../types/dl';
import { AbsenceRequest, LeaveRequest } from '../../types/absence';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import {
  Clock,
  ArrowRight,
  Briefcase,
  FileText,
  Calendar,
  CheckCircle2,
  AlertCircle,
  MapPin,
} from 'lucide-react';

export const PerangkatDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [myDLs, setMyDLs] = useState<DLAssignment[]>([]);
  const [myAbsences, setMyAbsences] = useState<AbsenceRequest[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRequest[]>([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (currentUser) {
      attendanceService.getTodayAttendanceForUser(currentUser.id).then((res) => {
        if (res.data) setTodayRecord(res.data);
      });
      dlService.getAssignments('ALL', currentUser.id).then((res) => {
        if (res.data) setMyDLs(res.data.slice(0, 3));
      });
      absenceService.getAbsences(currentUser.id).then((res) => {
        if (res.data) setMyAbsences(res.data.slice(0, 3));
      });
      absenceService.getLeaves(currentUser.id).then((res) => {
        if (res.data) setMyLeaves(res.data.slice(0, 3));
      });
    }
  }, [currentUser]);

  const todayStatus = todayRecord ? todayRecord.status : 'BELUM PRESENSI';
  const checkInTime = todayRecord?.checkInAt ? todayRecord.checkInAt.split('T')[1].slice(0, 5) : '-';
  const checkOutTime = todayRecord?.checkOutAt ? todayRecord.checkOutAt.split('T')[1].slice(0, 5) : '-';

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard Aparatur Desa</h1>
          <p>Selamat datang, {currentUser?.nama} ({currentUser?.jabatanNama})</p>
        </div>
        <div className="page-actions">
          <Link to="/attendance/regular" className="btn btn-primary">
            <Clock size={16} /> Buka Presensi Reguler
          </Link>
        </div>
      </div>

      {/* Official Time & Today's Attendance Highlight Card */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #ffffff, #f0fdf4)',
          borderColor: '#bbf7d0',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--color-primary-800)' }}>
                Waktu Resmi Server (Official Time)
              </span>
              <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: '#dcfce7', borderRadius: 4, color: '#15803d', fontWeight: 700 }}>
                SYNCED
              </span>
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '2.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
              {currentTime.toLocaleTimeString('id-ID')}
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              {currentTime.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>
              Status Kehadiran Hari Ini:
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <StatusBadge status={todayStatus} size="md" />
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', marginTop: '0.375rem' }}>
              Masuk: <strong>{checkInTime}</strong> • Pulang: <strong>{checkOutTime}</strong>
            </div>
          </div>
        </div>

        {/* Action Button Strip */}
        <div
          style={{
            marginTop: '1.25rem',
            paddingTop: '1rem',
            borderTop: '1px solid #dcfce7',
            display: 'flex',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          {!todayRecord?.checkInAt ? (
            <Link to="/attendance/regular" className="btn btn-primary btn-sm">
              <CheckCircle2 size={16} /> Lakukan Check-In Hari Ini
            </Link>
          ) : !todayRecord?.checkOutAt ? (
            <Link to="/attendance/regular" className="btn btn-secondary btn-sm" style={{ borderColor: 'var(--color-primary-500)', color: 'var(--color-primary-800)' }}>
              <Clock size={16} /> Lakukan Check-Out (Jam Kerja)
            </Link>
          ) : (
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <CheckCircle2 size={16} /> Presensi hari ini telah lengkap (Check-In & Check-Out tercatat).
            </div>
          )}
          <Link to="/dl/create" className="btn btn-secondary btn-sm">
            <Briefcase size={14} /> Ajukan Dinas Luar
          </Link>
          <Link to="/absence/izin-sakit" className="btn btn-secondary btn-sm">
            <FileText size={14} /> Ajukan Izin / Sakit
          </Link>
          <Link to="/absence/cuti" className="btn btn-secondary btn-sm">
            <Calendar size={14} /> Ajukan Cuti
          </Link>
        </div>
      </div>

      <div className="responsive-grid-2">
        {/* User Identity Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Identitas Aparatur</h3>
            <Link to="/profile" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
              Lihat Profil
            </Link>
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1.25rem' }}>
            {currentUser?.fotoReference ? (
              <img
                src={currentUser.fotoReference}
                alt={currentUser.nama}
                style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover' }}
              />
            ) : (
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-100)',
                  color: 'var(--color-primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.5rem',
                }}
              >
                {currentUser?.nama.charAt(0)}
              </div>
            )}
            <div>
              <h4 style={{ fontSize: '1.125rem', fontWeight: 800 }}>{currentUser?.nama}</h4>
              <p style={{ fontSize: '0.875rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                {currentUser?.jabatanNama}
              </p>
              <span className="badge badge-hadir" style={{ marginTop: 4 }}>
                Akun Aktif
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8125rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>NIK</span>
              <strong>{currentUser?.nik}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>NIPD</span>
              <strong>{currentUser?.nipd || '— (Tidak Memiliki NIPD)'}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.375rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>WhatsApp</span>
              <strong>{currentUser?.nomorWhatsapp}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-muted)' }}>Peran Aplikasi (Role)</span>
              <strong>{currentUser?.role.replace('_', ' ')}</strong>
            </div>
          </div>
        </div>

        {/* Active DL & Submissions Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Pengajuan & Tugas Anda</h3>
            <Link to="/dl" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
              Semua DL
            </Link>
          </div>

          {myDLs.length === 0 && myAbsences.length === 0 && myLeaves.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Belum ada permohonan atau tugas aktif saat ini.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {myDLs.map((dl) => (
                <div
                  key={dl.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Briefcase size={14} color="var(--color-primary-600)" />
                      <strong style={{ fontSize: '0.8125rem' }}>Dinas Luar #{dl.nomorSuratTugas?.slice(0, 15)}</strong>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {dl.purpose.slice(0, 40)}...
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <StatusBadge status={dl.state} size="sm" />
                    <Link to={`/dl/${dl.id}`} style={{ display: 'block', fontSize: '0.75rem', marginTop: 4 }}>
                      Detail
                    </Link>
                  </div>
                </div>
              ))}

              {myAbsences.map((abs) => (
                <div
                  key={abs.id}
                  style={{
                    padding: '0.75rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={14} color="var(--color-accent-blue)" />
                      <strong style={{ fontSize: '0.8125rem' }}>{abs.type}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        ({abs.startDate} s/d {abs.endDate})
                      </span>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                      {abs.reason.slice(0, 40)}...
                    </div>
                  </div>
                  <StatusBadge status={abs.state} size="sm" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
