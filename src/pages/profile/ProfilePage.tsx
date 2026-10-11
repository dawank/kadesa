import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/authService';
import { useToast } from '../../context/ToastContext';
import {
  User,
  Lock,
  Phone,
  Shield,
  Save,
  CheckCircle2,
  Calendar,
  Camera,
  Trash2,
  Eye,
  EyeOff,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { currentUser, switchUser } = useAuth();
  const { showToast } = useToast();

  const [nomorWhatsapp, setNomorWhatsapp] = useState(currentUser?.nomorWhatsapp || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format file harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 2 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setIsUploadingPhoto(true);
      const res = await authService.updateProfile(currentUser.id, { fotoReference: result });
      setIsUploadingPhoto(false);
      if (res.success) {
        showToast('Foto profil berhasil diperbarui', 'success');
        switchUser(currentUser.id);
      } else {
        showToast(res.message || 'Gagal memperbarui foto profil', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = async () => {
    if (!currentUser) return;
    setIsUploadingPhoto(true);
    const res = await authService.updateProfile(currentUser.id, { fotoReference: undefined });
    setIsUploadingPhoto(false);
    if (res.success) {
      showToast('Foto profil berhasil dihapus', 'info');
      switchUser(currentUser.id);
    } else {
      showToast(res.message || 'Gagal menghapus foto profil', 'error');
    }
  };

  // Password State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleUpdateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!nomorWhatsapp.trim()) {
      showToast('Nomor WhatsApp wajib diisi', 'warning');
      return;
    }

    setIsUpdatingProfile(true);
    const res = await authService.updateProfile(currentUser.id, { nomorWhatsapp });
    setIsUpdatingProfile(false);

    if (res.success && res.data) {
      showToast('Kontak WhatsApp berhasil diperbarui', 'success');
      switchUser(currentUser.id);
    } else {
      showToast(res.message || 'Gagal memperbarui profil', 'error');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      showToast('Kata sandi baru minimal 8 karakter', 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Konfirmasi kata sandi tidak cocok', 'warning');
      return;
    }

    setIsChangingPassword(true);
    const res = await authService.changePassword(oldPassword, newPassword);
    setIsChangingPassword(false);

    if (res.success) {
      showToast('Kata sandi berhasil diperbarui', 'success');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(res.message || 'Gagal mengubah kata sandi', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Profil Akun Aparatur</h1>
          <p>Informasi kredensial, kontak resmi, dan hak akses pengguna</p>
        </div>
      </div>

      <div className="responsive-grid-2">
        {/* Profile Card */}
        <div className="card">
          <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative' }}>
              {currentUser?.fotoReference ? (
                <img
                  src={currentUser.fotoReference}
                  alt={currentUser.nama}
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '3px solid var(--color-primary-200)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: '50%',
                    backgroundColor: 'var(--color-primary-100)',
                    color: 'var(--color-primary-700)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 800,
                    fontSize: '1.75rem',
                    border: '3px solid var(--color-primary-200)',
                    boxShadow: 'var(--shadow-sm)',
                  }}
                >
                  {currentUser?.nama.charAt(0)}
                </div>
              )}
              {/* Photo Upload Overlay Button */}
              <label
                style={{
                  position: 'absolute',
                  bottom: -2,
                  right: -2,
                  backgroundColor: 'var(--color-primary-700)',
                  color: 'white',
                  borderRadius: '50%',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: isUploadingPhoto ? 'wait' : 'pointer',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  border: '2px solid white',
                  transition: 'background-color 0.2s',
                }}
                title="Ganti Foto Profil"
              >
                <Camera size={14} />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: 'none' }}
                  onChange={handlePhotoUpload}
                  disabled={isUploadingPhoto}
                />
              </label>
            </div>

            <div style={{ flex: 1, minWidth: 150 }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{currentUser?.nama}</h2>
              <div style={{ color: 'var(--color-primary-700)', fontWeight: 600, fontSize: '0.875rem', marginTop: 2 }}>
                {currentUser?.jabatanNama}
              </div>
              <div style={{ display: 'flex', gap: '0.375rem', marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="badge badge-hadir">Akun Aktif</span>
                <span className="badge badge-verified">{currentUser?.role.replace('_', ' ')}</span>
                {currentUser?.fotoReference && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    disabled={isUploadingPhoto}
                    style={{
                      border: 'none',
                      background: 'none',
                      color: 'var(--color-accent-rose)',
                      fontSize: '0.75rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      cursor: 'pointer',
                      padding: '0.2rem 0.4rem',
                      borderRadius: 'var(--radius-sm)',
                    }}
                    title="Hapus Foto Profil"
                  >
                    <Trash2 size={12} /> Hapus Foto
                  </button>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', fontSize: '0.875rem', marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Nomor Induk Kependudukan (NIK)</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentUser?.nik}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>NIPD (Nomor Induk Perangkat Desa)</span>
              <strong style={{ fontFamily: 'var(--font-mono)' }}>{currentUser?.nipd || '— (Tidak Memiliki NIPD)'}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Username Login</span>
              <strong>@{currentUser?.username}</strong>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.25rem' }}>
              <span style={{ color: 'var(--text-muted)' }}>Terdaftar Sejak (Effective From)</span>
              <strong>{currentUser?.effectiveFrom}</strong>
            </div>
          </div>

          {/* Edit WhatsApp Contact Form */}
          <form onSubmit={handleUpdateContact} style={{ paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="form-group">
              <label className="form-label">
                <Phone size={14} /> Nomor WhatsApp Terdaftar:
              </label>
              <input
                type="text"
                className="form-input"
                value={nomorWhatsapp}
                onChange={(e) => setNomorWhatsapp(e.target.value)}
              />
            </div>

            <button type="submit" className="btn btn-secondary btn-sm" disabled={isUpdatingProfile}>
              <Save size={14} /> {isUpdatingProfile ? 'Menyimpan...' : 'Perbarui Kontak WhatsApp'}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: '1rem' }}>
            <Lock size={18} color="var(--color-primary-600)" />
            Ganti Kata Sandi Akun
          </h3>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
            Pastikan kata sandi baru memiliki minimal 8 karakter dan kombinasi huruf serta angka demi keamanan data presensi.
          </p>

          <form onSubmit={handleChangePassword}>
            <div className="form-group">
              <label className="form-label">Kata Sandi Saat Ini</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showOldPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="••••••••"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowOldPassword(!showOldPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showOldPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  aria-label={showOldPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showOldPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Kata Sandi Baru</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Minimal 8 karakter"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showNewPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  aria-label={showNewPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Konfirmasi Kata Sandi Baru</label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Ketik ulang kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  title={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  aria-label={showConfirmPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              style={{ marginTop: '0.5rem' }}
              disabled={isChangingPassword}
            >
              <CheckCircle2 size={16} /> {isChangingPassword ? 'Menyimpan...' : 'Perbarui Kata Sandi'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
