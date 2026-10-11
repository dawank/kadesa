import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dlService } from '../../services/dlService';
import { DLAssignment } from '../../types/dl';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LocationPickerMap } from '../../components/common/LocationPickerMap';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Briefcase,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  FileCheck,
  Shield,
} from 'lucide-react';

const EvidenceThumbnail: React.FC<{ storageReference: string; alt: string }> = ({ storageReference, alt }) => {
  const [url, setUrl] = useState<string>(storageReference);

  useEffect(() => {
    let mounted = true;
    if (storageReference && !storageReference.startsWith('data:') && !storageReference.startsWith('http')) {
      dlService.getEvidenceSignedUrl(storageReference).then((signed) => {
        if (mounted && signed) setUrl(signed);
      });
    } else {
      setUrl(storageReference);
    }
    return () => {
      mounted = false;
    };
  }, [storageReference]);

  return <img src={url} alt={alt} style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />;
};

export const DinasLuarDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [dl, setDl] = useState<DLAssignment | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isConfirmRatifyOpen, setIsConfirmRatifyOpen] = useState(false);
  const [isConfirmCancelOpen, setIsConfirmCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [selectedEvidenceIndex, setSelectedEvidenceIndex] = useState<number | null>(null);

  const loadDL = async () => {
    if (!id) return;
    setIsLoading(true);
    const res = await dlService.getAssignmentById(id);
    if (res.data) setDl(res.data);
    setIsLoading(false);
  };

  useEffect(() => {
    loadDL();
  }, [id]);

  if (isLoading) {
    return <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>Memuat rincian Dinas Luar...</div>;
  }

  if (!dl) {
    return (
      <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
        <h3>Dinas Luar Tidak Ditemukan</h3>
        <Link to="/dl" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Kembali ke Daftar DL
        </Link>
      </div>
    );
  }

  const role = currentUser?.role;
  const isSubject = currentUser?.id === dl.subjectUserId;
  const isRequester = currentUser?.id === dl.requesterUserId;

  // Permissions based on state
  const canVerify = hasPermission('dl_verify') && dl.state === 'PENDING';
  const canApprove = hasPermission('dl_approve') && dl.state === 'VERIFIED';
  const canRatify = hasPermission('dl_ratify') && (dl.state === 'APPROVED' || dl.state === 'RATIFICATION_OVERDUE');
  const canDirectRatify = hasPermission('dl_ratify') && (dl.state === 'PENDING' || dl.state === 'VERIFIED');
  const canCancel = (isRequester || hasPermission('dl_assign')) && !dl.hasCheckedIn && dl.state !== 'CANCELLED' && dl.state !== 'REJECTED';

  // Actions
  const handleVerify = async () => {
    if (!currentUser) return;
    const res = await dlService.verifyAssignment(
      dl.id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'Diverifikasi lengkap'
    );
    if (res.success && res.data) {
      showToast('Dinas Luar berhasil diverifikasi', 'success');
      setDl(res.data);
    } else {
      showToast(res.message || 'Gagal memverifikasi', 'error');
    }
  };

  const handleApprove = async () => {
    if (!currentUser) return;
    const res = await dlService.approveAssignment(
      dl.id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'Disetujui. Menunggu ratifikasi Kepala Desa (Batas 72 jam)'
    );
    if (res.success && res.data) {
      showToast('Dinas Luar disetujui. Batas ratifikasi 72 jam aktif.', 'success');
      setDl(res.data);
    } else {
      showToast(res.message || 'Gagal approve', 'error');
    }
  };

  const handleRatify = async () => {
    if (!currentUser) return;
    const res = await dlService.ratifyAssignment(
      dl.id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      'Diratifikasi secara sah oleh Kepala Desa'
    );
    setIsConfirmRatifyOpen(false);
    if (res.success && res.data) {
      showToast('Dinas Luar berhasil diratifikasi oleh Kepala Desa', 'success');
      setDl(res.data);
    } else {
      showToast(res.message || 'Gagal ratifikasi', 'error');
    }
  };

  const handleReject = async () => {
    if (!currentUser) return;
    if (!rejectReason.trim()) {
      showToast('Alasan penolakan wajib diisi', 'warning');
      return;
    }
    const res = await dlService.rejectAssignment(
      dl.id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      rejectReason
    );
    setIsRejectModalOpen(false);
    if (res.success && res.data) {
      showToast('Dinas Luar telah ditolak', 'info');
      setDl(res.data);
    } else {
      showToast(res.message || 'Gagal menolak', 'error');
    }
  };

  const handleCancel = async () => {
    if (!currentUser) return;
    const res = await dlService.cancelAssignment(
      dl.id,
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      cancelReason || 'Dibatalkan oleh pemohon'
    );
    setIsConfirmCancelOpen(false);
    if (res.success && res.data) {
      showToast('Dinas Luar berhasil dibatalkan', 'info');
      setDl(res.data);
    } else {
      showToast(res.message || 'Gagal membatalkan', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <Link
            to="/dl"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.375rem',
              fontSize: '0.8125rem',
              color: 'var(--color-primary-700)',
              marginBottom: '0.5rem',
              fontWeight: 600,
            }}
          >
            <ArrowLeft size={16} /> Kembali ke Daftar Dinas Luar
          </Link>
          <h1>Detail Penugasan #{dl.nomorSuratTugas}</h1>
          <p>Status alur kerja verifikasi, persetujuan, dan bukti kehadiran Dinas Luar</p>
        </div>

        <div className="page-actions">
          <StatusBadge status={dl.state} size="md" />
        </div>
      </div>

      {/* Ratification Overdue Banner if applicable */}
      {dl.state === 'RATIFICATION_OVERDUE' && (
        <div
          style={{
            padding: '1rem 1.25rem',
            backgroundColor: '#fff1f2',
            border: '1px solid #fecdd3',
            borderRadius: 'var(--radius-lg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <AlertTriangle size={20} color="#be123c" />
            <div>
              <strong style={{ color: '#9f1239', fontSize: '0.875rem' }}>
                Batas Waktu Ratifikasi Telah Melebihi 72 Jam
              </strong>
              <div style={{ fontSize: '0.75rem', color: '#be123c' }}>
                Kepala Desa tetap dapat melakukan ratifikasi pengesahan surat tugas.
              </div>
            </div>
          </div>
          {canRatify && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setIsConfirmRatifyOpen(true)}
            >
              Ratifikasi Sekarang
            </button>
          )}
        </div>
      )}

      {/* Grid: DL Details & Locations */}
      <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Main Details Card */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            <Briefcase size={18} color="var(--color-primary-600)" />
            Informasi Surat Tugas
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Aparatur Penerima Tugas</span>
              <strong>{dl.subjectUserNama} ({dl.subjectUserJabatan})</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Pemohon / Penugasan Oleh</span>
              <span>{dl.requesterUserNama} ({dl.requesterUserRole.replace('_', ' ')})</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Periode Pelaksanaan</span>
              <strong>{dl.startDate} s/d {dl.endDate}</strong>
            </div>

            <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Maksud & Tujuan:</span>
              <p style={{ color: 'var(--color-slate-800)', lineHeight: 1.5 }}>{dl.purpose}</p>
            </div>

            {dl.rejectionReason && (
              <div style={{ padding: '0.75rem', backgroundColor: '#fee2e2', borderRadius: 'var(--radius-md)', color: '#991b1b' }}>
                <strong>Alasan Penolakan:</strong>
                <p style={{ marginTop: 2 }}>{dl.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Workflow Action Buttons */}
          <div
            style={{
              marginTop: '1.5rem',
              paddingTop: '1rem',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              gap: '0.5rem',
              flexWrap: 'wrap',
            }}
          >
            {/* Sekdes / Operator Verify */}
            {canVerify && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleVerify}>
                <CheckCircle2 size={14} /> Verifikasi Surat Tugas
              </button>
            )}

            {/* Sekdes / Operator Approve */}
            {canApprove && (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleApprove}>
                <CheckCircle2 size={14} /> Setujui DL (Aktifkan 72h Ratifikasi)
              </button>
            )}

            {/* Kades Direct Ratify */}
            {canDirectRatify && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsConfirmRatifyOpen(true)}
              >
                <FileCheck size={14} /> Direct Ratifikasi (Kepala Desa)
              </button>
            )}

            {/* Kades Normal Ratify */}
            {canRatify && dl.state !== 'RATIFICATION_OVERDUE' && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => setIsConfirmRatifyOpen(true)}
              >
                <FileCheck size={14} /> Ratifikasi Resmi (Kepala Desa)
              </button>
            )}

            {/* Rejection */}
            {(canVerify || canApprove || canRatify) && (
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => setIsRejectModalOpen(true)}
              >
                <XCircle size={14} /> Tolak Penugasan
              </button>
            )}

            {/* Cancellation */}
            {canCancel && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setIsConfirmCancelOpen(true)}
              >
                Batalkan DL
              </button>
            )}

            {/* Presensi Selfie Trigger for subject */}
            {(dl.state === 'APPROVED' || dl.state === 'RATIFIED' || dl.state === 'RATIFICATION_OVERDUE') && isSubject && (
              <Link
                to={`/dl/presensi/${dl.id}`}
                className="btn btn-primary btn-sm"
                style={{ backgroundColor: 'var(--color-accent-purple)', borderColor: 'var(--color-accent-purple)' }}
              >
                <Camera size={14} /> Buka Presensi DL (Selfie & GPS)
              </Link>
            )}
          </div>
        </div>

        {/* Locations List Card */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            <MapPin size={18} color="var(--color-primary-600)" />
            Titik Lokasi Geofence Penugasan ({dl.locations.length})
          </h3>

          {dl.locations.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <LocationPickerMap
                latitude={dl.locations[0].latitude}
                longitude={dl.locations[0].longitude}
                radiusMeters={dl.locations[0].radius}
                title={dl.locations[0].namaLokasi}
                locations={dl.locations.map((loc) => ({
                  id: loc.id,
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                  label: loc.namaLokasi,
                  radiusMeters: loc.radius,
                }))}
                readOnly={true}
                showManualInputs={false}
                showSearch={false}
                showGpsButton={false}
                height={260}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {dl.locations.map((loc, idx) => (
              <div
                key={loc.id || idx}
                style={{
                  padding: '0.875rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#f8fafc',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong>{loc.namaLokasi}</strong>
                  <span className="badge badge-hadir">Radius {loc.radius}m</span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Koordinat: {loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: '1.25rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <strong>Petunjuk Presensi:</strong> Aparatur wajib berada di salah satu radius lokasi di atas untuk Check-In. Check-Out dapat dilakukan di lokasi dinas luar atau di kantor desa.
          </div>
        </div>
      </div>

      {/* Selfie Evidence Section */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <h3 className="card-title">
            <Camera size={18} color="var(--color-accent-purple)" />
            Bukti Foto Selfie & Lokasi Presensi ({dl.evidence?.length || 0})
          </h3>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Shield size={12} color="#059669" /> Terverifikasi Aman
          </span>
        </div>

        {!dl.evidence || dl.evidence.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Belum ada bukti selfie presensi yang diunggah untuk surat tugas ini.
          </div>
        ) : (
          <div className="responsive-grid-cards">
            {dl.evidence.map((ev, idx) => (
              <div
                key={ev.id}
                style={{
                  padding: '1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: '#ffffff',
                }}
              >
                <div style={{ height: 180, overflow: 'hidden', borderRadius: 'var(--radius-sm)', marginBottom: '0.75rem', backgroundColor: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <EvidenceThumbnail
                    storageReference={ev.storageReference}
                    alt={`Selfie ${ev.type}`}
                  />
                </div>
                <div style={{ fontSize: '0.8125rem' }}>
                  <strong>Presensi {ev.type === 'CHECK_IN' ? 'Masuk' : 'Pulang'}</strong>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    Waktu: {ev.serverTimestamp.replace('T', ' ').slice(0, 19)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Koordinat: {ev.latitude.toFixed(4)}, {ev.longitude.toFixed(4)} (±{Math.round(ev.accuracy)}m)
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Approval Timeline Section */}
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
          <Clock size={18} color="var(--color-primary-600)" />
          Riwayat Alur Kerja & Timeline Otoritas
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', position: 'relative', paddingLeft: '1.5rem' }}>
          <div
            style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              left: 6,
              width: 2,
              backgroundColor: 'var(--border-subtle)',
            }}
          />
          {dl.approvalHistory.map((item, idx) => (
            <div key={item.id || idx} style={{ position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: -22,
                  top: 2,
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-500)',
                  border: '2px solid #ffffff',
                }}
              />
              <div style={{ fontSize: '0.875rem' }}>
                <strong style={{ color: 'var(--color-slate-900)' }}>
                  {item.toState.replace('_', ' ')}
                </strong>{' '}
                — oleh {item.actorNama} ({item.actorRole.replace('_', ' ')})
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  {new Date(item.createdAt).toLocaleString('id-ID')}
                </div>
                {item.reason && (
                  <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: 4 }}>
                    Catatan: &ldquo;{item.reason}&rdquo;
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Rejection */}
      <Modal
        isOpen={isRejectModalOpen}
        onClose={() => setIsRejectModalOpen(false)}
        title="Tolak Surat Tugas Dinas Luar"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsRejectModalOpen(false)}>
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
            placeholder="Jelaskan alasan administratif atau substansial penolakan tugas..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Confirm Ratification */}
      <ConfirmDialog
        isOpen={isConfirmRatifyOpen}
        onClose={() => setIsConfirmRatifyOpen(false)}
        onConfirm={handleRatify}
        title="Konfirmasi Ratifikasi Kepala Desa"
        message="Apakah Anda sebagai Kepala Desa setuju meratifikasi secara resmi Surat Tugas Dinas Luar ini? Setelah diratifikasi, dokumen akan dikunci secara permanen."
        confirmLabel="Ratifikasi Surat Tugas"
      />

      {/* Confirm Cancellation */}
      <Modal
        isOpen={isConfirmCancelOpen}
        onClose={() => setIsConfirmCancelOpen(false)}
        title="Batalkan Dinas Luar"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsConfirmCancelOpen(false)}>
              Tutup
            </button>
            <button type="button" className="btn btn-danger" onClick={handleCancel}>
              Ya, Batalkan Tugas
            </button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">Alasan Pembatalan:</label>
          <textarea
            className="form-textarea"
            rows={2}
            placeholder="Contoh: Rapat eksternal dibatalkan oleh pihak pengundang"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
        </div>
      </Modal>
    </div>
  );
};
