import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dlService } from '../../services/dlService';
import { absenceService } from '../../services/absenceService';
import { attendanceService } from '../../services/attendanceService';
import { DLAssignment } from '../../types/dl';
import { LeaveRequest } from '../../types/absence';
import { AttendanceRecord } from '../../types/attendance';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import { useToast } from '../../context/ToastContext';
import {
  CheckCircle2,
  Clock,
  Briefcase,
  AlertTriangle,
  Calendar,
  Eye,
  FileCheck,
} from 'lucide-react';

export const KadesSekdesDashboard: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const [dls, setDls] = useState<DLAssignment[]>([]);
  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  const isKades = currentUser?.role === 'KEPALA_DESA';

  useEffect(() => {
    dlService.getAssignments().then((res) => {
      if (res.data) setDls(res.data);
    });
    absenceService.getLeaves().then((res) => {
      if (res.data) setLeaves(res.data);
    });
    attendanceService.getAllAttendance().then((res) => {
      if (res.data) setRecords(res.data);
    });
  }, []);

  // Filter approval items depending on role
  // Kades needs to ratify APPROVED DLs and approve VERIFIED Cuti
  const dlToRatify = dls.filter((dl) => dl.state === 'APPROVED' || dl.state === 'RATIFICATION_OVERDUE');
  const cutiToApprove = leaves.filter((l) => l.state === 'VERIFIED');

  // Sekdes needs to verify PENDING DLs and verify SUBMITTED Cuti
  const dlToVerify = dls.filter((dl) => dl.state === 'PENDING');
  const dlToApprove = dls.filter((dl) => dl.state === 'VERIFIED');
  const cutiToVerify = leaves.filter((l) => l.state === 'SUBMITTED');

  // Quick Action: Kades Ratify DL
  const handleRatifyDL = async (dlId: string) => {
    if (!currentUser) return;
    const res = await dlService.ratifyAssignment(
      dlId,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'Diratifikasi dari dashboard pimpinan'
    );
    if (res.success && res.data) {
      showToast('Dinas Luar berhasil diratifikasi secara resmi', 'success');
      setDls((prev) => prev.map((item) => (item.id === dlId ? res.data! : item)));
    } else {
      showToast(res.message || 'Gagal meratifikasi DL', 'error');
    }
  };

  // Quick Action: Kades Final Approve Cuti
  const handleApproveCuti = async (leaveId: string) => {
    if (!currentUser) return;
    const res = await absenceService.approveLeave(
      leaveId,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'APPROVED',
      'Persetujuan cuti disahkan oleh Kepala Desa'
    );
    if (res.success && res.data) {
      showToast('Cuti berhasil disetujui secara final', 'success');
      setLeaves((prev) => prev.map((l) => (l.id === leaveId ? res.data! : l)));
    } else {
      showToast(res.message || 'Gagal menyetujui cuti', 'error');
    }
  };

  const countHadir = records.filter((r) => r.status === 'HADIR' || r.status === 'TERLAMBAT').length;
  const countDL = records.filter((r) => r.status === 'DINAS_LUAR').length;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Dashboard {isKades ? 'Kepala Desa' : 'Sekretaris Desa'}</h1>
          <p>
            {isKades
              ? 'Pusat Otoritas Ratifikasi & Pengawasan Kehadiran Aparatur Desa'
              : 'Pusat Verifikasi Dokumen & Administrasi Kehadiran Desa'}
          </p>
        </div>
        <div className="page-actions">
          <Link to="/reports" className="btn btn-secondary">
            <Eye size={16} /> Laporan & Rekap
          </Link>
          <Link to="/attendance/monitoring" className="btn btn-primary">
            Monitoring Aparatur Hari Ini
          </Link>
        </div>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid-cols-3" style={{ marginBottom: '1.5rem' }}>
        <div className="stat-card">
          <div>
            <div className="stat-label">Kehadiran Hari Ini</div>
            <div className="stat-value" style={{ color: '#047857' }}>
              {countHadir} Aparatur
            </div>
            <div className="stat-subtext">Hadir di kantor desa</div>
          </div>
          <div className="stat-icon stat-icon-emerald">
            <CheckCircle2 size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Aparatur Dinas Luar</div>
            <div className="stat-value" style={{ color: '#7e22ce' }}>
              {countDL} Aparatur
            </div>
            <div className="stat-subtext">Bertugas di luar kantor</div>
          </div>
          <div className="stat-icon stat-icon-purple">
            <Briefcase size={24} />
          </div>
        </div>

        <div className="stat-card">
          <div>
            <div className="stat-label">Menunggu Keputusan Anda</div>
            <div className="stat-value" style={{ color: '#b45309' }}>
              {isKades ? dlToRatify.length + cutiToApprove.length : dlToVerify.length + dlToApprove.length + cutiToVerify.length}
            </div>
            <div className="stat-subtext">Item dalam antrean persetujuan</div>
          </div>
          <div className="stat-icon stat-icon-amber">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* Role-Specific Approval Queue */}
      {isKades ? (
        /* KEPALA DESA QUEUE */
        <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
          {/* DL Ratification Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FileCheck size={18} color="var(--color-primary-600)" />
                Antrean Ratifikasi Dinas Luar ({dlToRatify.length})
              </h3>
              <Link to="/dl" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
                Semua DL
              </Link>
            </div>

            {dlToRatify.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Tidak ada Dinas Luar yang menunggu ratifikasi Anda saat ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {dlToRatify.map((dl) => (
                  <div
                    key={dl.id}
                    style={{
                      padding: '0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: dl.state === 'RATIFICATION_OVERDUE' ? '#fff1f2' : '#ffffff',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{dl.subjectUserNama}</strong> ({dl.subjectUserJabatan})
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {dl.purpose}
                        </div>
                      </div>
                      <StatusBadge status={dl.state} size="sm" />
                    </div>

                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Lokasi: {dl.locations.map((l) => l.namaLokasi).join(', ')}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <Link to={`/dl/${dl.id}`} className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                          Periksa
                        </Link>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => handleRatifyDL(dl.id)}
                        >
                          Ratifikasi Sekarang
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cuti Final Approval Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Calendar size={18} color="var(--color-accent-blue)" />
                Persetujuan Final Cuti Aparatur ({cutiToApprove.length})
              </h3>
              <Link to="/absence/cuti" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
                Semua Cuti
              </Link>
            </div>

            {cutiToApprove.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Tidak ada permohonan cuti yang menunggu keputusan akhir.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cutiToApprove.map((leave) => (
                  <div
                    key={leave.id}
                    style={{
                      padding: '0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{leave.userNama}</strong> ({leave.userJabatan})
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Cuti {leave.leaveType.toLowerCase().replace('_', ' ')} • {leave.startDate} s/d {leave.endDate}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', marginTop: 2 }}>
                          Telah diverifikasi oleh: {leave.verifiedByNama || 'Sekdes'}
                        </div>
                      </div>
                      <StatusBadge status={leave.state} size="sm" />
                    </div>

                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <Link to="/absence/cuti" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem' }}>
                        Detail
                      </Link>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: '0.75rem' }}
                        onClick={() => handleApproveCuti(leave.id)}
                      >
                        Setujui Cuti
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* SEKRETARIS DESA QUEUE */
        <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
          {/* DL Verification Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Briefcase size={18} color="var(--color-primary-600)" />
                Verifikasi & Approval Dinas Luar ({dlToVerify.length + dlToApprove.length})
              </h3>
              <Link to="/dl" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
                Buka Modul DL
              </Link>
            </div>

            {dlToVerify.length === 0 && dlToApprove.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Tidak ada pengajuan DL yang memerlukan penanganan Sekdes saat ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...dlToVerify, ...dlToApprove].map((dl) => (
                  <div
                    key={dl.id}
                    style={{
                      padding: '0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <strong>{dl.subjectUserNama}</strong> ({dl.subjectUserJabatan})
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {dl.purpose}
                        </div>
                      </div>
                      <StatusBadge status={dl.state} size="sm" />
                    </div>

                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                      <Link to={`/dl/${dl.id}`} className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>
                        Tinjau & Putuskan
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cuti Verification Queue */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Calendar size={18} color="var(--color-accent-blue)" />
                Verifikasi Cuti Masuk ({cutiToVerify.length})
              </h3>
              <Link to="/absence/cuti" style={{ fontSize: '0.8125rem', color: 'var(--color-primary-700)' }}>
                Buka Modul Cuti
              </Link>
            </div>

            {cutiToVerify.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Semua pengajuan cuti telah diverifikasi.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {cutiToVerify.map((leave) => (
                  <div
                    key={leave.id}
                    style={{
                      padding: '0.875rem',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>
                        <strong>{leave.userNama}</strong> ({leave.userJabatan})
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          Cuti {leave.leaveType.toLowerCase().replace('_', ' ')} • {leave.startDate} s/d {leave.endDate}
                        </div>
                      </div>
                      <StatusBadge status={leave.state} size="sm" />
                    </div>
                    <div style={{ marginTop: '0.75rem', display: 'flex', justifyContent: 'flex-end' }}>
                      <Link to="/absence/cuti" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem' }}>
                        Verifikasi Persyaratan
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
