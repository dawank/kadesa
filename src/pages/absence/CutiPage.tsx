import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { absenceService } from '../../services/absenceService';
import { LeaveRequest, LeaveType, LeaveState } from '../../types/absence';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  Calendar,
  Plus,
  CheckCircle2,
  XCircle,
  FileCheck,
  Clock,
  Eye,
} from 'lucide-react';

export const CutiPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [leaves, setLeaves] = useState<LeaveRequest[]>([]);
  const [filterState, setFilterState] = useState<LeaveState | 'ALL'>('ALL');

  // New Leave Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [leaveType, setLeaveType] = useState<LeaveType>('TAHUNAN');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail Modal
  const [selectedLeave, setSelectedLeave] = useState<LeaveRequest | null>(null);

  // Rejection Modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const canVerify = hasPermission('verify_cuti');
  const canApprove = hasPermission('approve_cuti'); // Only KEPALA_DESA

  const loadLeaves = async () => {
    const res = await absenceService.getLeaves();
    if (res.data) setLeaves(res.data);
  };

  useEffect(() => {
    loadLeaves();
  }, []);

  const filtered = filterState === 'ALL' ? leaves : leaves.filter((l) => l.state === filterState);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!reason.trim()) {
      showToast('Alasan pengajuan cuti wajib diisi', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await absenceService.submitLeave(
      currentUser.id,
      currentUser.nama,
      currentUser.jabatanNama,
      leaveType,
      startDate,
      endDate,
      reason
    );
    setIsSubmitting(false);

    if (res.success) {
      showToast(res.message || 'Cuti berhasil diajukan!', 'success');
      setIsSubmitModalOpen(false);
      setReason('');
      loadLeaves();
    } else {
      showToast(res.message || 'Gagal mengajukan cuti', 'error');
    }
  };

  const handleVerify = async (id: string) => {
    if (!currentUser) return;
    const res = await absenceService.verifyLeave(
      id,
      currentUser.id,
      currentUser.nama,
      'Persyaratan administrasi & sisa kuota cuti terverifikasi sah'
    );
    if (res.success) {
      showToast(res.message || 'Cuti berhasil diverifikasi', 'success');
      loadLeaves();
      if (selectedLeave?.id === id) setSelectedLeave(res.data!);
    } else {
      showToast(res.message || 'Gagal memverifikasi', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    if (!currentUser) return;
    const res = await absenceService.approveLeave(
      id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'APPROVED',
      'Persetujuan cuti disahkan secara resmi oleh Kepala Desa'
    );
    if (res.success) {
      showToast(res.message || 'Cuti berhasil disetujui Kepala Desa', 'success');
      loadLeaves();
      if (selectedLeave?.id === id) setSelectedLeave(res.data!);
    } else {
      showToast(res.message || 'Gagal menyetujui', 'error');
    }
  };

  const handleReject = async () => {
    if (!currentUser || !rejectingId) return;
    if (!rejectionReason.trim()) {
      showToast('Alasan penolakan wajib diisi', 'warning');
      return;
    }
    const res = await absenceService.approveLeave(
      rejectingId,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'REJECTED',
      rejectionReason
    );
    setRejectingId(null);
    setRejectionReason('');
    if (res.success) {
      showToast('Permohonan cuti ditolak', 'info');
      loadLeaves();
    } else {
      showToast(res.message || 'Gagal menolak cuti', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Alur Kerja & Pengajuan Cuti Aparatur</h1>
          <p>
            Alur verifikasi berjenjang: Pengajuan → Verifikasi Sekdes/Operator → Persetujuan Final Kepala Desa
          </p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsSubmitModalOpen(true)}
          >
            <Plus size={16} /> Ajukan Cuti Baru
          </button>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
          {(['ALL', 'SUBMITTED', 'VERIFIED', 'APPROVED', 'REJECTED'] as const).map((st) => (
            <button
              key={st}
              type="button"
              className={`btn btn-sm ${filterState === st ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setFilterState(st)}
            >
              {st === 'ALL' ? 'Semua' : st === 'SUBMITTED' ? 'Menunggu Verifikasi' : st === 'VERIFIED' ? 'Menunggu Approval Kades' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aparatur</th>
                <th>Jabatan</th>
                <th>Jenis Cuti</th>
                <th>Rentang Tanggal</th>
                <th>Alasan</th>
                <th>Status Workflow</th>
                <th style={{ textAlign: 'right' }}>Aksi Otoritas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Tidak ada pengajuan cuti yang sesuai kriteria.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.userNama}</strong></td>
                    <td>{item.userJabatan}</td>
                    <td>
                      <span className="badge badge-cuti">
                        Cuti {item.leaveType.toLowerCase().replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.8125rem' }}>
                        {item.startDate} s/d {item.endDate}
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem' }}>{item.reason}</span>
                    </td>
                    <td>
                      <StatusBadge status={item.state} size="sm" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: '0.75rem' }}
                          onClick={() => setSelectedLeave(item)}
                        >
                          <Eye size={12} /> Detail & Timeline
                        </button>

                        {/* Step 1: Sekdes/Operator Verify */}
                        {canVerify && item.state === 'SUBMITTED' && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => handleVerify(item.id)}
                          >
                            <FileCheck size={12} /> Verifikasi
                          </button>
                        )}

                        {/* Step 2: Kepala Desa Final Approval */}
                        {canApprove && item.state === 'VERIFIED' && (
                          <>
                            <button
                              type="button"
                              className="btn btn-primary btn-sm"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => handleApprove(item.id)}
                            >
                              <CheckCircle2 size={12} /> Setujui
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              style={{ fontSize: '0.75rem' }}
                              onClick={() => setRejectingId(item.id)}
                            >
                              <XCircle size={12} /> Tolak
                            </button>
                          </>
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

      {/* Modal Detail & Approval Timeline */}
      {selectedLeave && (
        <Modal
          isOpen={!!selectedLeave}
          onClose={() => setSelectedLeave(null)}
          title={`Detail Permohonan Cuti — ${selectedLeave.userNama}`}
          footer={
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedLeave(null)}>
              Tutup
            </button>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', fontSize: '0.875rem' }}>
            <div className="form-grid-2">
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Jenis Cuti</span>
                <div style={{ fontWeight: 700 }}>Cuti {selectedLeave.leaveType.replace('_', ' ')}</div>
              </div>
              <div>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Status Saat Ini</span>
                <div>
                  <StatusBadge status={selectedLeave.state} size="sm" />
                </div>
              </div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Periode Tanggal</span>
              <div style={{ fontWeight: 600 }}>{selectedLeave.startDate} s/d {selectedLeave.endDate}</div>
            </div>

            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>Alasan / Keperluan</span>
              <p style={{ color: 'var(--color-slate-800)', marginTop: 2 }}>{selectedLeave.reason}</p>
            </div>

            {/* Multi-stage Timeline */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <strong style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', marginBottom: '0.75rem' }}>
                <Clock size={16} color="var(--color-primary-600)" /> Timeline Persetujuan Berjenjang:
              </strong>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingLeft: '1rem', borderLeft: '2px solid var(--color-primary-200)' }}>
                {selectedLeave.timeline.map((step, idx) => (
                  <div key={idx}>
                    <strong>{step.status}</strong> — {step.actor}
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {new Date(step.timestamp).toLocaleString('id-ID')}
                    </div>
                    {step.note && (
                      <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: 2 }}>
                        &ldquo;{step.note}&rdquo;
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal Pengajuan Baru */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Form Pengajuan Cuti Aparatur"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsSubmitModalOpen(false)}
              disabled={isSubmitting}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Mengirim...' : 'Kirim Permohonan Cuti'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipe Cuti: <span className="required">*</span></label>
            <select
              className="form-select"
              value={leaveType}
              onChange={(e) => setLeaveType(e.target.value as LeaveType)}
            >
              <option value="TAHUNAN">Cuti Tahunan</option>
              <option value="MELAHIRKAN">Cuti Melahirkan</option>
              <option value="ALASAN_PENTING">Cuti Alasan Penting</option>
              <option value="BESAR">Cuti Besar</option>
            </select>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Tanggal Mulai: <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Selesai: <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alasan Pengajuan Cuti: <span className="required">*</span></label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Berikan alasan detail keperluan cuti..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Modal Rejection */}
      <Modal
        isOpen={!!rejectingId}
        onClose={() => setRejectingId(null)}
        title="Tolak Permohonan Cuti"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setRejectingId(null)}>
              Batal
            </button>
            <button type="button" className="btn btn-danger" onClick={handleReject}>
              Konfirmasi Tolak
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Alasan Penolakan: <span className="required">*</span></label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Jelaskan alasan permohonan cuti tidak dapat disetujui..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
