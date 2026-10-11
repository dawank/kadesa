import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { correctionService } from '../../services/correctionService';
import { auditService } from '../../services/auditService';
import { AttendanceRecord, DailyAttendanceStatus } from '../../types/attendance';
import { CorrectionRequest } from '../../types/correction';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LocationPickerMap } from '../../components/common/LocationPickerMap';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Eye,
  Filter,
  Edit3,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardList,
} from 'lucide-react';

export const MonitoringPresensiPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'MONITORING' | 'CORRECTIONS'>('MONITORING');
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Corrections state
  const [corrections, setCorrections] = useState<CorrectionRequest[]>([]);
  const [pendingApprovalId, setPendingApprovalId] = useState<string | null>(null);
  const [approvalAction, setApprovalAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [isProcessingApproval, setIsProcessingApproval] = useState(false);

  // Modals
  const [detailRecord, setDetailRecord] = useState<AttendanceRecord | null>(null);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [isConfirmCorrectionOpen, setIsConfirmCorrectionOpen] = useState(false);

  // Correction Form State
  const [correctedCheckIn, setCorrectedCheckIn] = useState<string>('');
  const [correctedCheckOut, setCorrectedCheckOut] = useState<string>('');
  const [correctedStatus, setCorrectedStatus] = useState<DailyAttendanceStatus>('HADIR');
  const [correctionReason, setCorrectionReason] = useState<string>('');
  const [isSubmittingCorrection, setIsSubmittingCorrection] = useState(false);

  const canCorrect = hasPermission('attendance_correction');
  const canApprove =
    currentUser &&
    ['SUPER_ADMIN', 'KEPALA_DESA', 'SEKRETARIS_DESA', 'OPERATOR_DESA'].includes(currentUser.role);

  const loadAttendance = async () => {
    const res = await attendanceService.getAllAttendance(selectedDate, selectedStatus);
    if (res.data) setRecords(res.data);
  };

  const loadCorrections = async () => {
    const res = await correctionService.getCorrections();
    if (res.data) setCorrections(res.data);
  };

  useEffect(() => {
    loadAttendance();
  }, [selectedDate, selectedStatus]);

  useEffect(() => {
    loadCorrections();
  }, []);

  const openCorrectionModal = (record: AttendanceRecord) => {
    setCorrectionRecord(record);
    setCorrectedCheckIn(record.checkInAt ? record.checkInAt.split('T')[1].slice(0, 5) : '07:30');
    setCorrectedCheckOut(record.checkOutAt ? record.checkOutAt.split('T')[1].slice(0, 5) : '15:30');
    setCorrectedStatus(record.status);
    setCorrectionReason('');
  };

  const handleApplyCorrection = async () => {
    if (!correctionRecord || !currentUser) return;
    if (!correctionReason.trim()) {
      showToast('Alasan koreksi administratif wajib diisi!', 'warning');
      return;
    }

    setIsSubmittingCorrection(true);
    const date = correctionRecord.attendanceDate;
    const finalIn = correctedCheckIn ? `${date}T${correctedCheckIn}:00Z` : null;
    const finalOut = correctedCheckOut ? `${date}T${correctedCheckOut}:00Z` : null;

    const res = await correctionService.submitCorrection(
      correctionRecord.id,
      currentUser.id,
      currentUser.nama,
      {
        userId: correctionRecord.userId,
        userNama: correctionRecord.userNama,
        userJabatan: correctionRecord.userJabatan,
        attendanceDate: date,
        originalCheckIn: correctionRecord.checkInAt,
        originalCheckOut: correctionRecord.checkOutAt,
        originalStatus: correctionRecord.status,
        correctedCheckIn: finalIn,
        correctedCheckOut: finalOut,
        correctedStatus,
        reason: correctionReason,
      }
    );

    // Record audit event
    await auditService.recordAuditEvent({
      actorUserId: currentUser.id,
      actorNama: currentUser.nama,
      actorRole: currentUser.role,
      eventType: 'ATTENDANCE_CORRECTION',
      entityType: 'attendance_corrections',
      entityId: res.data?.id || correctionRecord.id,
      beforeData: {
        checkInAt: correctionRecord.checkInAt,
        checkOutAt: correctionRecord.checkOutAt,
        status: correctionRecord.status,
      },
      afterData: {
        checkInAt: finalIn,
        checkOutAt: finalOut,
        status: correctedStatus,
        state: 'PENDING',
      },
      reason: correctionReason,
    });

    setIsSubmittingCorrection(false);
    setIsConfirmCorrectionOpen(false);
    setCorrectionRecord(null);

    if (res.success) {
      showToast(
        'Pengajuan koreksi presensi berhasil dibuat (Status: PENDING) dan menunggu verifikasi pejabat berwenang.',
        'success'
      );
      loadAttendance();
      loadCorrections();
    } else {
      showToast(res.message || 'Gagal menyimpan pengajuan koreksi.', 'error');
    }
  };

  const handleProcessApproval = async () => {
    if (!pendingApprovalId || !approvalAction || !currentUser) return;
    setIsProcessingApproval(true);

    if (approvalAction === 'APPROVE') {
      const res = await correctionService.approveCorrection(
        pendingApprovalId,
        currentUser.id,
        currentUser.nama
      );
      if (res.success) {
        showToast('Koreksi presensi berhasil disetujui dan diterapkan.', 'success');
        loadAttendance();
        loadCorrections();
      } else {
        showToast(res.message || 'Gagal menyetujui koreksi.', 'error');
      }
    } else {
      const res = await correctionService.rejectCorrection(
        pendingApprovalId,
        currentUser.id,
        currentUser.nama
      );
      if (res.success) {
        showToast('Permohonan koreksi presensi ditolak.', 'info');
        loadCorrections();
      } else {
        showToast(res.message || 'Gagal menolak koreksi.', 'error');
      }
    }

    setIsProcessingApproval(false);
    setPendingApprovalId(null);
    setApprovalAction(null);
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Monitoring Kehadiran & Koreksi Presensi</h1>
          <p>Pemantauan data kehadiran harian dan alur persetujuan koreksi administratif aparatur desa</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'MONITORING' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setActiveTab('MONITORING')}
        >
          <Calendar size={14} style={{ marginRight: 6 }} />
          Data Kehadiran Harian
        </button>
        <button
          type="button"
          className={`btn ${activeTab === 'CORRECTIONS' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => {
            setActiveTab('CORRECTIONS');
            loadCorrections();
          }}
        >
          <ClipboardList size={14} style={{ marginRight: 6 }} />
          Daftar Pengajuan Koreksi ({corrections.filter((c) => c.state === 'PENDING').length} Menunggu)
        </button>
      </div>

      {activeTab === 'MONITORING' ? (
        <>
          {/* Filter Strip */}
          <div className="card" style={{ marginBottom: '1.25rem', padding: '0.875rem 1.25rem' }}>
            <div className="filter-bar-wrap">
              <div className="filter-controls-group">
                <div className="filter-control-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <Calendar size={16} color="var(--text-muted)" />
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Tanggal:</label>
                  </div>
                  <input
                    type="date"
                    className="form-input"
                    style={{ width: 'auto', minWidth: 140, padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>

                <div className="filter-control-item">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                    <Filter size={16} color="var(--text-muted)" />
                    <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Status Kehadiran:</label>
                  </div>
                  <select
                    className="form-select"
                    style={{ width: 'auto', minWidth: 140, padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value)}
                  >
                    <option value="ALL">Semua Status</option>
                    <option value="HADIR">Hadir</option>
                    <option value="TERLAMBAT">Terlambat</option>
                    <option value="DINAS_LUAR">Dinas Luar</option>
                    <option value="IZIN">Izin</option>
                    <option value="SAKIT">Sakit</option>
                    <option value="CUTI">Cuti</option>
                    <option value="ALPHA">Alpha</option>
                  </select>
                </div>
              </div>

              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Total Data: <strong>{records.length}</strong> Aparatur
              </div>
            </div>
          </div>

          {/* Main Monitoring Table */}
          <div className="card">
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Aparatur</th>
                    <th>Jabatan</th>
                    <th>Status</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Validasi Geofence</th>
                    <th>Koreksi</th>
                    <th style={{ textAlign: 'right' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {records.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                        Tidak ada data presensi yang sesuai kriteria filter tanggal dan status.
                      </td>
                    </tr>
                  ) : (
                    records.map((rec) => (
                      <tr key={rec.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                            {rec.userFoto ? (
                              <img
                                src={rec.userFoto}
                                alt={rec.userNama}
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
                                {rec.userNama.charAt(0)}
                              </div>
                            )}
                            <strong>{rec.userNama}</strong>
                          </div>
                        </td>
                        <td>{rec.userJabatan}</td>
                        <td>
                          <StatusBadge status={rec.status} size="sm" />
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {rec.checkInAt ? rec.checkInAt.split('T')[1].slice(0, 5) : '—'}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                            {rec.checkOutAt ? rec.checkOutAt.split('T')[1].slice(0, 5) : '—'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.15rem 0.5rem',
                              borderRadius: 4,
                              backgroundColor:
                                rec.validationResult === 'ACCEPT'
                                  ? '#dcfce7'
                                  : rec.validationResult === 'ACCEPT_WARNING'
                                  ? '#fef3c7'
                                  : '#fee2e2',
                              color:
                                rec.validationResult === 'ACCEPT'
                                  ? '#15803d'
                                  : rec.validationResult === 'ACCEPT_WARNING'
                                  ? '#b45309'
                                  : '#b91c1c',
                              fontWeight: 700,
                            }}
                          >
                            {rec.validationResult}
                          </span>
                        </td>
                        <td>
                          {rec.isCorrected ? (
                            <span style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>
                              Ya (Terkoreksi)
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Asli</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => setDetailRecord(rec)}
                            >
                              <Eye size={12} /> Detail
                            </button>

                            {/* Koreksi Presensi action only visible if role has attendance_correction permission */}
                            {canCorrect && (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: '0.75rem', borderColor: '#f59e0b', color: '#b45309' }}
                                onClick={() => openCorrectionModal(rec)}
                              >
                                <Edit3 size={12} /> Ajukan Koreksi
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Tab 2: Corrections Approval & History List */
        <div className="card">
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tanggal / Aparatur</th>
                  <th>Waktu Asli</th>
                  <th>Waktu Hasil Koreksi</th>
                  <th>Alasan Koreksi</th>
                  <th>Status Workflow</th>
                  <th style={{ textAlign: 'right' }}>Aksi Otorisasi</th>
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Belum ada riwayat pengajuan koreksi presensi.
                    </td>
                  </tr>
                ) : (
                  corrections.map((corr) => {
                    const isPending = corr.state === 'PENDING' || (corr.state as any) === 'REQUESTED';
                    const isSelf = currentUser && (currentUser.id === corr.userId || currentUser.id === corr.requestedByUserId);
                    const canAct = canApprove && isPending && !isSelf;

                    return (
                      <tr key={corr.id}>
                        <td>
                          <div>
                            <strong>{corr.userNama}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {corr.attendanceDate} • {corr.userJabatan}
                            </div>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8125rem' }}>
                            <div>Masuk: {corr.originalCheckIn ? corr.originalCheckIn.split('T')[1].slice(0, 5) : '—'}</div>
                            <div>Pulang: {corr.originalCheckOut ? corr.originalCheckOut.split('T')[1].slice(0, 5) : '—'}</div>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Status: {corr.originalStatus}</span>
                          </div>
                        </td>
                        <td>
                          <div style={{ fontSize: '0.8125rem', color: '#1e40af', fontWeight: 600 }}>
                            <div>Masuk: {corr.correctedCheckIn ? corr.correctedCheckIn.split('T')[1].slice(0, 5) : '—'}</div>
                            <div>Pulang: {corr.correctedCheckOut ? corr.correctedCheckOut.split('T')[1].slice(0, 5) : '—'}</div>
                            <span style={{ fontSize: '0.75rem' }}>Status: {corr.correctedStatus}</span>
                          </div>
                        </td>
                        <td style={{ maxWidth: 220 }}>
                          <span style={{ fontSize: '0.8125rem' }}>{corr.reason}</span>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                            Diajukan oleh: {corr.requestedByNama || 'Operator'}
                          </div>
                        </td>
                        <td>
                          {isPending ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', backgroundColor: '#fef3c7', color: '#92400e', fontWeight: 700 }}>
                              <Clock size={12} /> PENDING
                            </span>
                          ) : corr.state === 'APPROVED' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                              <CheckCircle2 size={12} /> APPROVED
                            </span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '0.2rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 700 }}>
                              <XCircle size={12} /> REJECTED
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {isPending ? (
                            canAct ? (
                              <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                                  onClick={() => {
                                    setPendingApprovalId(corr.id);
                                    setApprovalAction('APPROVE');
                                  }}
                                >
                                  Setujui
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', color: '#b91c1c', borderColor: '#fca5a5' }}
                                  onClick={() => {
                                    setPendingApprovalId(corr.id);
                                    setApprovalAction('REJECT');
                                  }}
                                >
                                  Tolak
                                </button>
                              </div>
                            ) : isSelf ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Anti-Self-Approval</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Menunggu Approval</span>
                            )
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              Selesai {corr.processedAt ? `(${corr.processedAt.split('T')[0]})` : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Detail Presensi */}
      {detailRecord && (
        <Modal
          isOpen={!!detailRecord}
          onClose={() => setDetailRecord(null)}
          title={`Detail Presensi — ${detailRecord.userNama}`}
          footer={
            <button type="button" className="btn btn-secondary" onClick={() => setDetailRecord(null)}>
              Tutup
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', fontSize: '0.875rem' }}>
            <div className="form-grid-2">
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Aparatur</span>
                <div style={{ fontWeight: 700 }}>{detailRecord.userNama}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Jabatan</span>
                <div style={{ fontWeight: 700 }}>{detailRecord.userJabatan}</div>
              </div>
            </div>

            <div className="form-grid-2">
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Tanggal Kehadiran</span>
                <div style={{ fontWeight: 700 }}>{detailRecord.attendanceDate}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Status Kehadiran</span>
                <div>
                  <StatusBadge status={detailRecord.status} size="sm" />
                </div>
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
              <strong>Log Waktu Resmi (Server Timestamps):</strong>
              <div className="form-grid-2" style={{ marginTop: '0.375rem', fontSize: '0.8125rem' }}>
                <div>Masuk (Check-In): {detailRecord.checkInAt || 'Belum'}</div>
                <div>Pulang (Check-Out): {detailRecord.checkOutAt || 'Belum'}</div>
              </div>
            </div>

            <div style={{ padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)' }}>
              <strong>Titik Lokasi & Koordinat Presensi:</strong>
              <div style={{ fontSize: '0.8125rem', marginTop: '0.25rem', color: 'var(--text-muted)' }}>
                {detailRecord.checkInLatitude !== null && detailRecord.checkInLongitude !== null ? (
                  <>
                    <div style={{ marginBottom: '0.5rem' }}>
                      Check-In: {detailRecord.checkInLatitude}, {detailRecord.checkInLongitude} (Akurasi: ±
                      {Math.round(detailRecord.checkInAccuracy || 0)}m)
                    </div>
                    <LocationPickerMap
                      latitude={detailRecord.checkInLatitude}
                      longitude={detailRecord.checkInLongitude}
                      radiusMeters={Math.round(detailRecord.checkInAccuracy || 15)}
                      readOnly={true}
                      showManualInputs={false}
                      showSearch={false}
                      showGpsButton={false}
                      height={200}
                      title={`Titik Presensi: ${detailRecord.userNama}`}
                    />
                  </>
                ) : (
                  <div>Tidak ada koordinat tercatat.</div>
                )}
              </div>
            </div>

            {detailRecord.isCorrected && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fef3c7', borderRadius: 'var(--radius-md)', color: '#92400e' }}>
                <strong>Catatan Koreksi Administratif:</strong>
                <p style={{ fontSize: '0.8125rem', marginTop: '0.25rem' }}>{detailRecord.correctionNote}</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Modal Pengajuan Koreksi Presensi */}
      {correctionRecord && (
        <Modal
          isOpen={!!correctionRecord}
          onClose={() => setCorrectionRecord(null)}
          title={`Pengajuan Koreksi Presensi — ${correctionRecord.userNama}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setCorrectionRecord(null)}
                disabled={isSubmittingCorrection}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsConfirmCorrectionOpen(true)}
                disabled={isSubmittingCorrection || !correctionReason.trim()}
              >
                Kirim Pengajuan Koreksi
              </button>
            </>
          }
        >
          <div>
            <div style={{ padding: '0.75rem', backgroundColor: '#eff6ff', borderRadius: 'var(--radius-md)', color: '#1e40af', fontSize: '0.8125rem', marginBottom: '1rem' }}>
              <strong>Alur Formal PRD v1.3.0:</strong> Pengajuan koreksi akan berstatus <strong>PENDING</strong> dan harus disetujui oleh pejabat berwenang (Kepala Desa / Sekretaris Desa / Operator) sebelum diterapkan ke data presensi.
            </div>

            <div className="form-grid-2" style={{ marginBottom: '1rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Jam Check-In Usulan (HH:mm)</label>
                <input
                  type="time"
                  className="form-input"
                  value={correctedCheckIn}
                  onChange={(e) => setCorrectedCheckIn(e.target.value)}
                />
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Jam Check-Out Usulan (HH:mm)</label>
                <input
                  type="time"
                  className="form-input"
                  value={correctedCheckOut}
                  onChange={(e) => setCorrectedCheckOut(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Status Hasil Koreksi</label>
              <select
                className="form-select"
                value={correctedStatus}
                onChange={(e) => setCorrectedStatus(e.target.value as DailyAttendanceStatus)}
              >
                <option value="HADIR">HADIR</option>
                <option value="TERLAMBAT">TERLAMBAT</option>
                <option value="DINAS_LUAR">DINAS LUAR</option>
                <option value="IZIN">IZIN</option>
                <option value="SAKIT">SAKIT</option>
                <option value="CUTI">CUTI</option>
                <option value="ALPHA">ALPHA</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">
                Alasan Koreksi Administratif: <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={3}
                placeholder="Contoh: Terkendala sinyal saat rapat koordinasi di kecamatan, disaksikan oleh Sekretaris Desa."
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      )}

      {/* Confirmation Dialog before submitting correction */}
      <ConfirmDialog
        isOpen={isConfirmCorrectionOpen}
        onClose={() => setIsConfirmCorrectionOpen(false)}
        onConfirm={handleApplyCorrection}
        title="Konfirmasi Pengajuan Koreksi"
        message={`Apakah Anda yakin ingin mengajukan koreksi presensi untuk ${correctionRecord?.userNama}? Pengajuan akan masuk dengan status PENDING untuk diverifikasi oleh pejabat desa.`}
        confirmLabel="Ya, Kirim Pengajuan"
        isLoading={isSubmittingCorrection}
      />

      {/* Confirmation Dialog for Approval / Rejection */}
      <ConfirmDialog
        isOpen={!!pendingApprovalId}
        onClose={() => {
          setPendingApprovalId(null);
          setApprovalAction(null);
        }}
        onConfirm={handleProcessApproval}
        title={approvalAction === 'APPROVE' ? 'Konfirmasi Persetujuan Koreksi' : 'Konfirmasi Penolakan Koreksi'}
        message={
          approvalAction === 'APPROVE'
            ? 'Apakah Anda yakin ingin menyetujui koreksi presensi ini? Perubahan akan langsung diterapkan ke catatan presensi aparatur secara permanen.'
            : 'Apakah Anda yakin ingin menolak permohonan koreksi presensi ini?'
        }
        confirmLabel={approvalAction === 'APPROVE' ? 'Ya, Setujui Koreksi' : 'Ya, Tolak Permohonan'}
        isLoading={isProcessingApproval}
      />
    </div>
  );
};
