import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { masterService } from '../../services/masterService';
import {
  User,
  UserRole,
  PASSWORD_PLACEHOLDER,
  PASSWORD_INITIAL_PLACEHOLDER,
  PASSWORD_CONFIRM_MISMATCH_MESSAGE,
  validatePasswordLength,
} from '../../types/auth';
import { Position } from '../../types/master';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { useToast } from '../../context/ToastContext';
import {
  Users,
  Plus,
  Search,
  Filter,
  Edit2,
  Power,
  Shield,
  Save,
  Camera,
  Upload,
  X,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
} from 'lucide-react';

export const MasterAparaturPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [apparatusList, setApparatusList] = useState<User[]>(() => masterService.getCachedApparatusList());
  const [positions, setPositions] = useState<Position[]>(() => masterService.getCachedPositions());
  const [isLoading, setIsLoading] = useState(apparatusList.length === 0);
  const [search, setSearch] = useState('');
  const [filterJabatan, setFilterJabatan] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [formData, setFormData] = useState<Partial<User>>({
    nama: '',
    nik: '',
    nipd: '',
    nomorWhatsapp: '',
    username: '',
    role: 'PERANGKAT_DESA',
    jabatanId: '',
    jabatanNama: '',
    active: true,
    attendanceRequired: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Initial Password for New User
  const [initialPassword, setInitialPassword] = useState('');
  const [showInitialPassword, setShowInitialPassword] = useState(false);

  // Reset Password State
  const [resetPasswordUser, setResetPasswordUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  // Deactivate Confirm
  const [togglingUser, setTogglingUser] = useState<User | null>(null);

  const canManage = hasPermission('manage_master_aparatur');

  const loadData = async () => {
    if (apparatusList.length === 0) setIsLoading(true);
    try {
      const [appRes, posRes] = await Promise.all([
        masterService.getApparatusList(),
        masterService.getPositions(),
      ]);
      if (appRes.data) setApparatusList(appRes.data);
      if (posRes.data) setPositions(posRes.data.filter((p) => p.active));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = apparatusList.filter((a) => {
    if (search) {
      const q = search.toLowerCase();
      const match = a.nama.toLowerCase().includes(q) || a.nik.includes(q) || (a.nipd && a.nipd.includes(q));
      if (!match) return false;
    }
    if (filterJabatan && a.jabatanId !== filterJabatan) return false;
    if (filterStatus === 'ACTIVE' && !a.active) return false;
    if (filterStatus === 'INACTIVE' && a.active) return false;
    return true;
  });

  const openAddModal = () => {
    setEditingUser(null);
    setInitialPassword('');
    setShowInitialPassword(false);
    setFormData({
      nama: '',
      nik: '',
      nipd: '',
      nomorWhatsapp: '',
      username: '',
      role: 'PERANGKAT_DESA',
      jabatanId: positions[0]?.id || '',
      jabatanNama: positions[0]?.nama || '',
      active: true,
      attendanceRequired: true,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (user: User) => {
    setEditingUser(user);
    setFormData({ ...user });
    setIsModalOpen(true);
  };

  const handleJabatanChange = (posId: string) => {
    const pos = positions.find((p) => p.id === posId);
    setFormData({
      ...formData,
      jabatanId: posId,
      jabatanNama: pos ? pos.nama : '',
    });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format file harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 2 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      setFormData((prev) => ({ ...prev, fotoReference: result }));
      showToast('Foto profil berhasil diunggah', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setFormData((prev) => ({ ...prev, fotoReference: undefined }));
    showToast('Foto profil dihapus', 'info');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nama || !formData.nik || !formData.nomorWhatsapp || !formData.username) {
      showToast('Nama, NIK, No. WhatsApp, dan Username wajib diisi', 'warning');
      return;
    }

    // Password validation for new apparatus
    if (!editingUser) {
      const val = validatePasswordLength(initialPassword, 'Password awal');
      if (!val.isValid) {
        showToast(val.message!, 'warning');
        return;
      }
    }

    // STRICT: Operator cannot edit Super Admin
    if (currentUser?.role === 'OPERATOR_DESA' && editingUser?.role === 'SUPER_ADMIN') {
      showToast('Operator tidak memiliki izin mengubah data Super Admin', 'error');
      return;
    }

    // STRICT: Operator cannot change own role
    if (currentUser?.role === 'OPERATOR_DESA' && editingUser?.id === currentUser?.id && formData.role !== editingUser.role) {
      showToast('Operator tidak memiliki izin mengubah peran akun sendiri', 'error');
      return;
    }

    // STRICT: Operator cannot grant OPERATOR_DESA role to any user
    if (currentUser?.role === 'OPERATOR_DESA' && formData.role === 'OPERATOR_DESA' && editingUser?.role !== 'OPERATOR_DESA') {
      showToast('Operator tidak memiliki izin menetapkan peran Operator Desa', 'error');
      return;
    }

    // STRICT: Operator cannot grant SUPER_ADMIN role
    if (currentUser?.role === 'OPERATOR_DESA' && formData.role === 'SUPER_ADMIN') {
      showToast('Operator tidak memiliki izin menetapkan peran Super Admin', 'error');
      return;
    }

    setIsSaving(true);
    if (editingUser) {
      const res = await masterService.updateApparatus(editingUser.id, formData, currentUser?.role, currentUser?.id);
      setIsSaving(false);
      if (res.success) {
        showToast('Data aparatur berhasil diperbarui', 'success');
        setIsModalOpen(false);
        loadData();
      } else {
        showToast(res.message || 'Gagal menyimpan', 'error');
      }
    } else {
      const res = await masterService.addApparatus(
        formData as Omit<User, 'id' | 'authUserId'>,
        currentUser?.role,
        initialPassword.trim()
      );
      setIsSaving(false);
      if (res.success) {
        showToast('Aparatur baru berhasil didaftarkan dengan kata sandi awal', 'success');
        setIsModalOpen(false);
        loadData();
      } else {
        showToast(res.message || 'Gagal menyimpan', 'error');
      }
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;

    const val = validatePasswordLength(newPassword, 'Kata sandi baru');
    if (!val.isValid) {
      showToast(val.message!, 'warning');
      return;
    }

    if (newPassword !== confirmPassword) {
      showToast(PASSWORD_CONFIRM_MISMATCH_MESSAGE, 'warning');
      return;
    }

    setIsResettingPassword(true);
    const res = await masterService.resetApparatusPassword(
      resetPasswordUser.id,
      newPassword.trim(),
      currentUser?.role,
      currentUser?.id,
      currentUser?.nama
    );
    setIsResettingPassword(false);

    if (res.success) {
      showToast(res.message || `Kata sandi untuk ${resetPasswordUser.nama} berhasil direset!`, 'success');
      setResetPasswordUser(null);
      setNewPassword('');
      setConfirmPassword('');
    } else {
      showToast(res.message || 'Gagal mereset kata sandi', 'error');
    }
  };

  const handleToggleStatus = async () => {
    if (!togglingUser) return;
    if (currentUser?.role === 'OPERATOR_DESA' && togglingUser.role === 'SUPER_ADMIN') {
      showToast('Operator tidak memiliki izin mengubah status Super Admin', 'error');
      setTogglingUser(null);
      return;
    }
    const res = await masterService.toggleApparatusStatus(togglingUser.id, currentUser?.role);
    setTogglingUser(null);
    if (res.success) {
      showToast(res.message || 'Status aparatur berhasil diubah', 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal mengubah status', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Master Data Perangkat Desa</h1>
          <p>Pengelolaan akun, data pokok NIK/NIPD, posisi jabatan, dan peran aparatur</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} /> Tambah Aparatur Baru
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', flex: 1, maxWidth: 720 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1, minWidth: 200 }}>
              <Search size={16} color="var(--text-muted)" />
              <input
                type="text"
                className="form-input"
                placeholder="Cari nama, NIK, atau NIPD..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                className="form-select"
                style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                value={filterJabatan}
                onChange={(e) => setFilterJabatan(e.target.value)}
              >
                <option value="">Semua Jabatan</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <select
              className="form-select"
              style={{ width: 'auto', padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="ALL">Semua Status Akun</option>
              <option value="ACTIVE">Aktif Saja</option>
              <option value="INACTIVE">Nonaktif Saja</option>
            </select>
          </div>

          <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Total: <strong>{filtered.length}</strong> Aparatur
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Foto & Nama Lengkap</th>
                <th>NIK</th>
                <th>NIPD</th>
                <th>Jabatan</th>
                <th>Peran</th>
                <th>WhatsApp</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && apparatusList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary-600)' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat data aparatur desa...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Belum ada data aparatur desa yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => (
                  <tr key={user.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                      {user.fotoReference ? (
                        <img
                          src={user.fotoReference}
                          alt={user.nama}
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
                          {user.nama.charAt(0)}
                        </div>
                      )}
                      <div>
                        <strong>{user.nama}</strong>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>@{user.username}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{user.nik}</span>
                  </td>
                  <td>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: user.nipd ? 'inherit' : 'var(--text-muted)' }}>
                      {user.nipd || '— (Null)'}
                    </span>
                  </td>
                  <td>{user.jabatanNama}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 700,
                        backgroundColor: 'var(--color-primary-50)',
                        color: 'var(--color-primary-700)',
                        padding: '0.15rem 0.45rem',
                        borderRadius: 4,
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td>{user.nomorWhatsapp}</td>
                  <td>
                    <span className={`badge ${user.active ? 'badge-hadir' : 'badge-libur'}`}>
                      {user.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    {canManage && (
                      currentUser?.role === 'OPERATOR_DESA' && user.role === 'SUPER_ADMIN' ? (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            color: 'var(--text-muted)',
                            fontStyle: 'italic',
                            padding: '0.2rem 0.5rem',
                            backgroundColor: '#f1f5f9',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          Terkunci (Super Admin)
                        </span>
                      ) : (
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => openEditModal(user)}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)' }}
                            onClick={() => {
                              setResetPasswordUser(user);
                              setNewPassword('');
                              setConfirmPassword('');
                              setShowNewPassword(false);
                              setShowConfirmPassword(false);
                            }}
                            title="Reset Kata Sandi"
                          >
                            <KeyRound size={14} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: user.active ? 'var(--color-accent-rose)' : 'var(--color-primary-700)' }}
                            onClick={() => setTogglingUser(user)}
                            title={user.active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      )
                    )}
                  </td>
                </tr>
              )))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingUser ? `Ubah Data Aparatur — ${editingUser.nama}` : 'Tambah Aparatur Baru'}
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsModalOpen(false)}
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
              <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Data Aparatur'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          {/* Foto Profil Aparatur */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1.25rem',
              padding: '1rem',
              marginBottom: '1rem',
              backgroundColor: 'var(--color-bg-page, #f8fafc)',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--border-color)',
            }}
          >
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                overflow: 'hidden',
                backgroundColor: 'var(--color-primary-100)',
                color: 'var(--color-primary-700)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '1.5rem',
                flexShrink: 0,
                border: '2px solid white',
                boxShadow: 'var(--shadow-sm)',
              }}
            >
              {formData.fotoReference ? (
                <img
                  src={formData.fotoReference}
                  alt="Foto Aparatur"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : formData.nama ? (
                formData.nama.charAt(0)
              ) : (
                <Camera size={24} />
              )}
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.25rem' }}>
                Foto Profil Aparatur
              </label>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Format JPG, PNG, atau WebP (Maks. 2 MB)
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}
                >
                  <Upload size={14} />
                  <span>Pilih Foto</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: 'none' }}
                    onChange={handlePhotoUpload}
                  />
                </label>
                {formData.fotoReference && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ color: 'var(--color-accent-rose)' }}
                    onClick={handleRemovePhoto}
                  >
                    <X size={14} /> Hapus Foto
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nama Lengkap & Gelar <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Dewi Lestari, S.E."
                value={formData.nama || ''}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Username Login <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: dewi"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">NIK (Nomor Induk Kependudukan) <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="16 digit NIK"
                value={formData.nik || ''}
                onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">
                NIPD (Nomor Induk Perangkat Desa){' '}
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>(Opsional)</span>
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Kosongkan jika tidak ada"
                value={formData.nipd || ''}
                onChange={(e) => setFormData({ ...formData, nipd: e.target.value || null })}
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Jabatan Organisasi <span className="required">*</span></label>
              <select
                className="form-select"
                value={formData.jabatanId || ''}
                onChange={(e) => handleJabatanChange(e.target.value)}
              >
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Peran Aplikasi <span className="required">*</span></label>
              <select
                className="form-select"
                value={formData.role || 'PERANGKAT_DESA'}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                disabled={currentUser?.role === 'OPERATOR_DESA' && editingUser?.id === currentUser?.id}
              >
                <option value="PERANGKAT_DESA">Perangkat Desa</option>
                {/* Operator cannot assign OPERATOR_DESA role to others or new accounts; only Super Admin can */}
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <option value="OPERATOR_DESA">Operator Desa (Admin)</option>
                )}
                {/* When Operator views their own account, show current role as disabled/locked */}
                {currentUser?.role === 'OPERATOR_DESA' && editingUser?.role === 'OPERATOR_DESA' && (
                  <option value="OPERATOR_DESA">Operator Desa (Admin - Terkunci)</option>
                )}
                <option value="SEKRETARIS_DESA">Sekretaris Desa</option>
                <option value="KEPALA_DESA">Kepala Desa</option>
                {currentUser?.role === 'SUPER_ADMIN' && (
                  <option value="SUPER_ADMIN">Super Admin</option>
                )}
              </select>
              <span className="form-hint">
                {currentUser?.role === 'OPERATOR_DESA' && editingUser?.id === currentUser?.id
                  ? 'Operator tidak dapat mengubah peran akun sendiri.'
                  : currentUser?.role === 'OPERATOR_DESA'
                    ? 'Operator dapat mengelola peran Perangkat Desa, Sekdes, & Kades (tidak dapat mengangkat Operator / Super Admin).'
                    : 'Role menentukan hak akses aplikasi, terpisah dari struktur jabatan organisasi.'}
              </span>
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label className="form-label">Nomor WhatsApp Aktif <span className="required">*</span></label>
              <input
                type="text"
                className="form-input"
                placeholder="08xxxxxxxxxx"
                value={formData.nomorWhatsapp || ''}
                onChange={(e) => setFormData({ ...formData, nomorWhatsapp: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Wajib Presensi?</label>
              <select
                className="form-select"
                value={formData.attendanceRequired ? 'YES' : 'NO'}
                onChange={(e) => setFormData({ ...formData, attendanceRequired: e.target.value === 'YES' })}
              >
                <option value="YES">Ya (Wajib Presensi)</option>
                <option value="NO">Tidak (Bebas Presensi)</option>
              </select>
            </div>
          </div>

          {/* Initial Password (Only when adding new user) */}
          {!editingUser && (
            <div className="form-group" style={{ marginTop: '0.5rem' }}>
              <label className="form-label">
                Kata Sandi Awal (Password Login) <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showInitialPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={PASSWORD_INITIAL_PLACEHOLDER}
                  value={initialPassword}
                  onChange={(e) => setInitialPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowInitialPassword(!showInitialPassword)}
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
                  title={showInitialPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showInitialPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <span className="form-hint">
                Kata sandi awal untuk login aparatur. Aparatur dapat mengubahnya secara mandiri pada menu Profil Saya setelah berhasil login.
              </span>
            </div>
          )}
        </form>
      </Modal>

      {/* Reset Password Modal */}
      {resetPasswordUser && (
        <Modal
          isOpen={!!resetPasswordUser}
          onClose={() => setResetPasswordUser(null)}
          title={`Reset Kata Sandi — ${resetPasswordUser.nama}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setResetPasswordUser(null)}
                disabled={isResettingPassword}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleResetPasswordSubmit}
                disabled={isResettingPassword}
              >
                <KeyRound size={16} /> {isResettingPassword ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              </button>
            </>
          }
        >
          <form onSubmit={handleResetPasswordSubmit}>
            {/* Target Aparatur Info Card */}
            <div
              style={{
                padding: '0.875rem 1rem',
                backgroundColor: '#f8fafc',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                marginBottom: '1.25rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-primary-100)',
                  color: 'var(--color-primary-700)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '1.125rem',
                  flexShrink: 0,
                  overflow: 'hidden',
                }}
              >
                {resetPasswordUser.fotoReference ? (
                  <img
                    src={resetPasswordUser.fotoReference}
                    alt={resetPasswordUser.nama}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  resetPasswordUser.nama.charAt(0)
                )}
              </div>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
                  {resetPasswordUser.nama}
                </strong>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Username: <span style={{ fontFamily: 'var(--font-mono)' }}>@{resetPasswordUser.username}</span> • Peran: {resetPasswordUser.role} • Jabatan: {resetPasswordUser.jabatanNama}
                </div>
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Fitur reset kata sandi digunakan jika aparatur lupa kata sandi akunnya. Masukkan kata sandi baru untuk akun aparatur di bawah ini:
            </p>

            <div className="form-group">
              <label className="form-label">
                Kata Sandi Baru <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder={PASSWORD_PLACEHOLDER}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
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
                  title={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Konfirmasi Kata Sandi Baru <span className="required">*</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Ulangi kata sandi baru"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{ paddingRight: '2.5rem' }}
                  required
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
                  title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Deactivate Confirm */}
      <ConfirmDialog
        isOpen={!!togglingUser}
        onClose={() => setTogglingUser(null)}
        onConfirm={handleToggleStatus}
        title={`Konfirmasi Ubah Status Akun — ${togglingUser?.nama}`}
        message={`Apakah Anda yakin ingin ${togglingUser?.active ? 'menonaktifkan' : 'mengaktifkan kembali'} akun aparatur ${togglingUser?.nama}? Seluruh riwayat presensi dan transaksi yang bersangkutan tetap tersimpan dengan aman.`}
        confirmLabel={togglingUser?.active ? 'Nonaktifkan Akun' : 'Aktifkan Akun'}
        isDestructive={togglingUser?.active}
      />
    </div>
  );
};
