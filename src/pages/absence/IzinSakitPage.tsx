import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { absenceService } from '../../services/absenceService';
import { AbsenceRequest, AbsenceType, AbsenceState } from '../../types/absence';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import {
  FileText,
  Plus,
  Calendar,
  CheckCircle2,
  XCircle,
  Paperclip,
} from 'lucide-react';

export const IzinSakitPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [absences, setAbsences] = useState<AbsenceRequest[]>([]);
  const [filterType, setFilterType] = useState<AbsenceType | 'ALL'>('ALL');
  const [filterState, setFilterState] = useState<AbsenceState | 'ALL'>('ALL');

  // Submit Modal
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [newType, setNewType] = useState<AbsenceType>('IZIN');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [attachmentName, setAttachmentName] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reject Modal
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const canApprove = hasPermission('approve_izin_sakit');

  const loadData = async () => {
    const res = await absenceService.getAbsences();
    if (res.data) setAbsences(res.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = absences.filter((a) => {
    if (filterType !== 'ALL' && a.type !== filterType) return false;
    if (filterState !== 'ALL' && a.state !== filterState) return false;
    return true;
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!reason.trim()) {
      showToast('Alasan pengajuan wajib diisi', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await absenceService.submitAbsence(
      currentUser.id,
      currentUser.nama,
      currentUser.jabatanNama,
      newType,
      startDate,
      endDate,
      reason,
      attachmentName
    );
    setIsSubmitting(false);

    if (res.success) {
      showToast(res.message || 'Pengajuan berhasil dikirim!', 'success');
      setIsSubmitModalOpen(false);
      setReason('');
      setAttachmentName('');
      loadData();
    } else {
      showToast(res.message || 'Gagal mengajukan', 'error');
    }
  };

  const handleApprove = async (id: string) => {
    if (!currentUser) return;
    const res = await absenceService.processAbsence(
      id,
      'APPROVED',
      currentUser.id,
      currentUser.nama
    );
    if (res.success) {
      showToast(res.message || 'Permohonan disetujui', 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal memproses', 'error');
    }
  };

  const handleReject = async () => {
    if (!currentUser || !rejectingId) return;
    if (!rejectionReason.trim()) {
      showToast('Alasan penolakan wajib diisi', 'warning');
      return;
    }
    const res = await absenceService.processAbsence(
      rejectingId,
      'REJECTED',
      currentUser.id,
      currentUser.nama,
      rejectionReason
    );
    setRejectingId(null);
    setRejectionReason('');
    if (res.success) {
      showToast('Permohonan ditolak', 'info');
      loadData();
    } else {
      showToast(res.message || 'Gagal memproses', 'error');
    }
  };

  const handleCancel = async (id: string) => {
    if (!currentUser) return;
    const res = await absenceService.cancelAbsence(id, currentUser.id);
    if (res.success) {
      showToast('Permohonan berhasil dibatalkan', 'info');
      loadData();
    } else {
      showToast(res.message || 'Gagal membatalkan', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Pengajuan & Persetujuan Izin / Sakit</h1>
          <p>Alur pengajuan ketidakhadiran dengan alasan izin atau sakit aparatur desa</p>
        </div>
        <div className="page-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setIsSubmitModalOpen(true)}
          >
            <Plus size={16} /> Ajukan Izin / Sakit Baru
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Tipe:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as AbsenceType | 'ALL')}
              >
                <option value="ALL">Semua Tipe</option>
                <option value="IZIN">Izin</option>
                <option value="SAKIT">Sakit</option>
              </select>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Status:</span>
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                value={filterState}
                onChange={(e) => setFilterState(e.target.value as AbsenceState | 'ALL')}
              >
                <option value="ALL">Semua Status</option>
                <option value="PENDING">Menunggu Persetujuan</option>
                <option value="APPROVED">Disetujui</option>
                <option value="REJECTED">Ditolak</option>
                <option value="CANCELLED">Dibatalkan</option>
              </select>
            </div>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Menampilkan {filtered.length} permohonan
          </div>
        </div>
      </div>

      {/* List Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Aparatur</th>
                <th>Jabatan</th>
                <th>Jenis</th>
                <th>Periode Tanggal</th>
                <th>Alasan</th>
                <th>Lampiran</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi Otoritas</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    Tidak ada pengajuan izin atau sakit yang ditemukan.
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.userNama}</strong></td>
                    <td>{item.userJabatan}</td>
                    <td>
                      <span className={`badge ${item.type === 'IZIN' ? 'badge-izin' : 'badge-sakit'}`}>
                        {item.type}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8125rem' }}>
                        <Calendar size={14} color="var(--text-muted)" />
                        <span>{item.startDate} s/d {item.endDate}</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem' }}>{item.reason}</span>
                    </td>
                    <td>
                      {item.attachmentName ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
                          <Paperclip size={12} /> {item.attachmentName}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <StatusBadge status={item.state} size="sm" />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                        {/* Approval buttons for authority */}
                        {canApprove && item.state === 'PENDING' && (
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

                        {/* Cancel for requester */}
                        {item.userId === currentUser?.id && item.state === 'PENDING' && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => handleCancel(item.id)}
                          >
                            Batal
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

      {/* Modal Pengajuan Baru */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Form Pengajuan Izin / Sakit"
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
              {isSubmitting ? 'Mengirim...' : 'Kirim Permohonan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Tipe Pengajuan</label>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="absenceType"
                  value="IZIN"
                  checked={newType === 'IZIN'}
                  onChange={() => setNewType('IZIN')}
                />
                <span>Izin (Urusan Pribadi / Keluarga)</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="absenceType"
                  value="SAKIT"
                  checked={newType === 'SAKIT'}
                  onChange={() => setNewType('SAKIT')}
                />
                <span>Sakit</span>
              </label>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Tanggal Mulai <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Tanggal Selesai <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alasan Ketidakhadiran <span className="required">*</span></label>
            <textarea
              className="form-textarea"
              rows={3}
              placeholder="Berikan alasan yang jelas mengenai permohonan izin/sakit..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Lampiran Bukti (Opsional / Surat Dokter)</label>
            <input
              type="file"
              className="form-input"
              onChange={(e) => setAttachmentName(e.target.files?.[0]?.name || '')}
            />
            <span className="form-hint">Format PDF atau Foto (Maksimal 5MB)</span>
          </div>
        </form>
      </Modal>

      {/* Modal Rejection */}
      <Modal
        isOpen={!!rejectingId}
        onClose={() => setRejectingId(null)}
        title="Tolak Permohonan Izin / Sakit"
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
          <label className="form-label">
            Alasan Penolakan: <span className="required">*</span>
          </label>
          <textarea
            className="form-textarea"
            rows={3}
            placeholder="Jelaskan alasan permohonan tidak disetujui..."
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
