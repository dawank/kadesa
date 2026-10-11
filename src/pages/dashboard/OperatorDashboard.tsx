import React, { useState, useEffect } from 'react';
import { attendanceService } from '../../services/attendanceService';
import { dlService } from '../../services/dlService';
import { absenceService } from '../../services/absenceService';
import { AttendanceRecord } from '../../types/attendance';
import { DLAssignment } from '../../types/dl';
import { AbsenceRequest, LeaveRequest } from '../../types/absence';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import {
  Users,
  CheckCircle2,
  Clock,
  Briefcase,
  AlertTriangle,
  Calendar,
  FileText,
  Building2,
  Settings,
  Filter,
} from 'lucide-react';

export const OperatorDashboard: React.FC = () => {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [pendingDLs, setPendingDLs] = useState<DLAssignment[]>([]);
  const [pendingAbsences, setPendingAbsences] = useState<AbsenceRequest[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<LeaveRequest[]>([]);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  useEffect(() => {
    attendanceService.getAllAttendance().then((res) => {
      if (res.data) setRecords(res.data);
    });
    dlService.getAssignments('PENDING').then((res) => {
      if (res.data) setPendingDLs(res.data);
    });
    absenceService.getAbsences(undefined, 'PENDING').then((res) => {
      if (res.data) setPendingAbsences(res.data);
    });
    absenceService.getLeaves(undefined, 'SUBMITTED').then((res) => {
      if (res.data) setPendingLeaves(res.data);
    });
  }, []);

  // Compute status metrics
  const countHadir = records.filter((r) => r.status === 'HADIR').length;
  const countTerlambat = records.filter((r) => r.status === 'TERLAMBAT').length;
  const countDL = records.filter((r) => r.status === 'DINAS_LUAR').length;
  const countIzin = records.filter((r) => r.status === 'IZIN').length;
  const countSakit = records.filter((r) => r.status === 'SAKIT').length;
  const countCuti = records.filter((r) => r.status === 'CUTI').length;
  const countAlpha = records.filter((r) => r.status === 'ALPHA').length;

  const filteredRecords =
    filterStatus === 'ALL' ? records : records.filter((r) => r.status === filterStatus);

  const pendingItemsCount = pendingDLs.length + pendingAbsences.length + pendingLeaves.length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard Operator Desa (Admin)</h1>
          <p>Pusat Operasional Kehadiran Aparatur & Pengelolaan Administrasi Desa</p>
        </div>
        <div className="page-actions">
          <Link to="/attendance/monitoring" className="btn btn-primary">
            Monitoring Lengkap & Koreksi
          </Link>
        </div>
      </div>

      {/* Action Needed Banner if items pending */}
      {pendingItemsCount > 0 && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="#b45309" />
            <div>
              <strong style={{ color: '#92400e', fontSize: '0.875rem' }}>
                Terdapat {pendingItemsCount} Pengajuan Memerlukan Tindakan Operasional
              </strong>
              <div style={{ fontSize: '0.75rem', color: '#b45309' }}>
                {pendingDLs.length} Dinas Luar, {pendingAbsences.length} Izin/Sakit, {pendingLeaves.length} Cuti
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {pendingDLs.length > 0 && (
              <Link to="/dl" className="btn btn-secondary btn-sm">
                Proses DL
              </Link>
            )}
            {pendingAbsences.length > 0 && (
              <Link to="/absence/izin-sakit" className="btn btn-secondary btn-sm">
                Proses Izin
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid-cols-4" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Hadir Tepat Waktu</div>
            <div className="stat-value" style={{ color: '#047857' }}>
              {countHadir}
            </div>
            <div className="stat-subtext">Aparatur hadir sebelum toleransi</div>
          </div>
          <div className="stat-icon stat-icon-emerald">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Terlambat</div>
            <div className="stat-value" style={{ color: '#b45309' }}>
              {countTerlambat}
            </div>
            <div className="stat-subtext">Check-In lewat batas toleransi</div>
          </div>
          <div className="stat-icon stat-icon-amber">
            <Clock size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Dinas Luar</div>
            <div className="stat-value" style={{ color: '#7e22ce' }}>
              {countDL}
            </div>
            <div className="stat-subtext">Tugas luar desa terverifikasi</div>
          </div>
          <div className="stat-icon stat-icon-purple">
            <Briefcase size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Izin / Sakit / Cuti</div>
            <div className="stat-value" style={{ color: '#1d4ed8' }}>
              {countIzin + countSakit + countCuti}
            </div>
            <div className="stat-subtext">
              Izin: {countIzin} • Sakit: {countSakit} • Cuti: {countCuti}
            </div>
          </div>
          <div className="stat-icon stat-icon-blue">
            <Calendar size={24} />
          </div>
        </div>
      </div>

      {/* Live Monitoring Table with Filters */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <h3 className="card-title">
              <Users size={18} color="var(--color-primary-600)" />
              Monitoring Kehadiran Aparatur Hari Ini
            </h3>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              ({filteredRecords.length} aparatur)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Filter size={16} color="var(--text-muted)" />
            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.8125rem' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Semua Status</option>
              <option value="HADIR">Hadir</option>
              <option value="TERLAMBAT">Terlambat</option>
              <option value="DINAS_LUAR">Dinas Luar</option>
              <option value="IZIN">Izin</option>
              <option value="SAKIT">Sakit</option>
              <option value="ALPHA">Alpha</option>
            </select>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto & Nama Aparatur</th>
                <th>Jabatan</th>
                <th>Status</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Keterangan / Validasi</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((r) => (
                <tr key={r.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      {r.userFoto ? (
                        <img
                          src={r.userFoto}
                          alt={r.userNama}
                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }}
                        />
                      ) : (
                        <div
                          style={{
                            width: 34,
                            height: 34,
                            borderRadius: '50%',
                            backgroundColor: 'var(--color-primary-100)',
                            color: 'var(--color-primary-700)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                          }}
                        >
                          {r.userNama.charAt(0)}
                        </div>
                      )}
                      <div>
                        <strong>{r.userNama}</strong>
                        {r.isCorrected && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: '0.65rem',
                              backgroundColor: '#fef3c7',
                              color: '#b45309',
                              padding: '0.1rem 0.35rem',
                              borderRadius: 4,
                              fontWeight: 700,
                            }}
                          >
                            DIKOREKSI
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td>{r.userJabatan}</td>
                  <td>
                    <StatusBadge status={r.status} size="sm" />
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {r.checkInAt ? r.checkInAt.split('T')[1].slice(0, 5) : '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                      {r.checkOutAt ? r.checkOutAt.split('T')[1].slice(0, 5) : '—'}
                    </span>
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      {r.statusReason || (r.checkInAt ? 'Valid Geofence' : 'Belum presensi')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <Link
                      to="/attendance/monitoring"
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.75rem' }}
                    >
                      Koreksi / Detail
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Access Shortcuts to Master Data & Config */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
          Pintasan Manajemen Data & Pengaturan
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: '1rem' }}>
          <Link
            to="/master/desa"
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'inherit',
            }}
          >
            <Building2 size={24} color="var(--color-primary-600)" />
            <div>
              <strong>Profil & Lokasi Desa</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Koordinat & geofence kantor</div>
            </div>
          </Link>

          <Link
            to="/master/aparatur"
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'inherit',
            }}
          >
            <Users size={24} color="var(--color-accent-blue)" />
            <div>
              <strong>Master Perangkat Desa</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Kelola NIK, WhatsApp & akun</div>
            </div>
          </Link>

          <Link
            to="/settings"
            style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              color: 'inherit',
            }}
          >
            <Settings size={24} color="var(--color-accent-purple)" />
            <div>
              <strong>Pengaturan Jam Kerja</strong>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Jadwal, toleransi & kalender</div>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
};
