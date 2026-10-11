import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { masterService } from '../../services/masterService';
import { Village } from '../../types/master';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Building2, Edit, MapPin, Save, Camera, Trash2, Upload, ExternalLink, ShieldCheck } from 'lucide-react';

export const MasterDesaPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  const [village, setVillage] = useState<Village | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<Village>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const canManage = hasPermission('manage_master_desa');

  const loadVillage = async () => {
    const res = await masterService.getVillage();
    if (res.data) {
      setVillage(res.data);
      setFormData(res.data);
    }
  };

  useEffect(() => {
    loadVillage();
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format file logo harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file logo maksimal 2 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setIsUploadingLogo(true);
      const res = await masterService.updateVillageLogo(result);
      setIsUploadingLogo(false);
      if (res.success) {
        showToast('Logo resmi desa berhasil diperbarui (di-overwrite)', 'success');
        setVillage((prev) => (prev ? { ...prev, logo: result } : null));
        setFormData((prev) => ({ ...prev, logo: result }));
      } else {
        showToast(res.message || 'Gagal memperbarui logo desa', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = async () => {
    setIsUploadingLogo(true);
    const res = await masterService.removeVillageLogo();
    setIsUploadingLogo(false);
    if (res.success && res.data) {
      showToast('Logo desa direset ke logo bawaan', 'info');
      setVillage((prev) => (prev ? { ...prev, logo: res.data } : null));
      setFormData((prev) => ({ ...prev, logo: res.data }));
    } else {
      showToast(res.message || 'Gagal mereset logo desa', 'error');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.kecamatan || !formData.kabupaten) {
      showToast('Nama desa, kecamatan, dan kabupaten wajib diisi', 'warning');
      return;
    }

    setIsSaving(true);
    const res = await masterService.updateVillage(formData);
    setIsSaving(false);

    if (res.success && res.data) {
      showToast('Profil identitas desa berhasil diperbarui', 'success');
      setVillage(res.data);
      setIsEditModalOpen(false);
    } else {
      showToast(res.message || 'Gagal menyimpan profil desa', 'error');
    }
  };

  if (!village) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Memuat profil desa...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Profil Resmi Instansi Desa</h1>
          <p>Pengelolaan identitas administratif resmi dan lambang (logo) pemerintahan desa</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setFormData(village);
                setIsEditModalOpen(true);
              }}
            >
              <Edit size={16} /> Ubah Identitas Desa
            </button>
          </div>
        )}
      </div>

      <div className="responsive-grid-2">
        {/* Village Profile Details Card */}
        <div className="card">
          <div className="card-header" style={{ marginBottom: '1.25rem' }}>
            <h3 className="card-title">
              <Building2 size={18} color="var(--color-primary-600)" />
              Identitas Administratif Desa
            </h3>
          </div>

          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              <div
                style={{
                  width: 84,
                  height: 84,
                  borderRadius: 'var(--radius-lg)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: '2px solid var(--color-primary-200)',
                  boxShadow: 'var(--shadow-sm)',
                  overflow: 'hidden',
                  padding: 4,
                }}
              >
                <img
                  src={village.logo || '/logo-kadesa.png'}
                  alt={`Logo Resmi ${village.nama}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {canManage && (
                <label
                  style={{
                    position: 'absolute',
                    bottom: -4,
                    right: -4,
                    backgroundColor: 'var(--color-primary-700)',
                    color: 'white',
                    borderRadius: '50%',
                    width: 28,
                    height: 28,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: isUploadingLogo ? 'wait' : 'pointer',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.25)',
                    border: '2px solid white',
                    transition: 'transform 0.15s ease',
                  }}
                  title="Upload / Ganti Logo Desa (Overwrite)"
                  aria-label="Upload Logo Desa"
                >
                  <Camera size={14} />
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                </label>
              )}
            </div>

            <div style={{ flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h2 style={{ fontSize: '1.375rem', fontWeight: 800, margin: 0 }}>{village.nama}</h2>
                {canManage && village.logo && village.logo !== '/logo-kadesa.png' && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={isUploadingLogo}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-accent-rose)',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      padding: '0.15rem 0.35rem',
                    }}
                    title="Reset ke Logo Bawaan"
                  >
                    <Trash2 size={12} /> Reset Logo
                  </button>
                )}
              </div>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 2 }}>
                Kecamatan {village.kecamatan}, Kabupaten {village.kabupaten}
              </p>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 4, flexWrap: 'wrap' }}>
                <span className="badge badge-hadir">Provinsi {village.provinsi}</span>
                <span className="badge badge-verified">Logo Desa Resmi</span>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nama Instansi Desa</span>
              <strong>{village.nama}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kecamatan</span>
              <strong>{village.kecamatan}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kabupaten / Kota</span>
              <strong>{village.kabupaten}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Provinsi</span>
              <strong>{village.provinsi}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Kode Pos</span>
              <strong>{village.kodePos || '-'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Alamat Lengkap Kantor</span>
              <strong style={{ maxWidth: 280, textAlign: 'right' }}>{village.alamat || '-'}</strong>
            </div>
          </div>
        </div>

        {/* Canonical Navigation Guide Card (Zero Duplication Notice) */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h3 className="card-title">
                <MapPin size={18} color="var(--color-primary-600)" />
                Konfigurasi Geofence & Koordinat
              </h3>
              <span className="badge badge-hadir">Terpusat (Single Source of Truth)</span>
            </div>

            <div
              style={{
                padding: '1rem',
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <ShieldCheck size={16} color="var(--color-primary-600)" />
                <strong style={{ fontSize: '0.875rem' }}>Pemisahan Tanggung Jawab Modul</strong>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 }}>
                Sesuai prinsip arsitektur sistem, <strong>Halaman Profil Desa</strong> khusus mengelola identitas administratif desa dan lambang instansi.
                Pengaturan titik koordinat GPS kantor, batas toleransi radius presensi, dan konfirmasi geofence operasional dikelola secara terpusat pada menu <strong>Pengaturan &gt; Geofence &amp; Radius</strong>.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Penggunaan Logo Desa</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>Kop Surat &amp; Laporan Cetak PDF</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-muted)' }}>Identitas Aplikasi</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>Tetap Logo KADESA Sistem</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Pengaturan Geofence</span>
                <span style={{ textAlign: 'right', fontWeight: 600 }}>Tersedia di Pengaturan Sistem</span>
              </div>
            </div>
          </div>

          <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <Link to="/settings?tab=geofence" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
              <MapPin size={16} /> Buka Pengaturan Geofence &amp; Radius <ExternalLink size={14} />
            </Link>
          </div>
        </div>
      </div>

      {/* Edit Village Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Identitas Desa"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsEditModalOpen(false)}
              disabled={isSaving}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving}
            >
              <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group" style={{ marginBottom: '1.25rem' }}>
            <label className="form-label">Logo Resmi Desa</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  padding: 4,
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={formData.logo || '/logo-kadesa.png'}
                  alt="Preview Logo"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0 }}>
                  <Upload size={14} /> Ganti Logo (Overwrite)
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handleLogoUpload}
                    disabled={isUploadingLogo}
                  />
                </label>
                {formData.logo && formData.logo !== '/logo-kadesa.png' && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-accent-rose)' }}
                    onClick={handleRemoveLogo}
                    disabled={isUploadingLogo}
                  >
                    <Trash2 size={14} /> Reset
                  </button>
                )}
              </div>
            </div>
            <span className="form-hint">
              Format JPG, PNG, atau WebP (maks. 2 MB). Logo resmi desa digunakan pada kop surat dan berkas cetak PDF resmi desa.
            </span>
          </div>

          <div className="form-group">
            <label className="form-label">Nama Desa <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              value={formData.nama || ''}
              onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Kecamatan <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={formData.kecamatan || ''}
                onChange={(e) => setFormData({ ...formData, kecamatan: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kabupaten <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                value={formData.kabupaten || ''}
                onChange={(e) => setFormData({ ...formData, kabupaten: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Provinsi</label>
              <input
                type="text"
                className="form-input"
                value={formData.provinsi || ''}
                onChange={(e) => setFormData({ ...formData, provinsi: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Kode Pos</label>
              <input
                type="text"
                className="form-input"
                value={formData.kodePos || ''}
                onChange={(e) => setFormData({ ...formData, kodePos: e.target.value })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Alamat Kantor Desa</label>
            <textarea
              className="form-textarea"
              rows={2}
              value={formData.alamat || ''}
              onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
            />
          </div>
        </form>
      </Modal>
    </div>
  );
};
