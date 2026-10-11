import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { masterService } from '../../services/masterService';
import { Position } from '../../types/master';
import { Modal } from '../../components/common/Modal';
import { useToast } from '../../context/ToastContext';
import { Award, Plus, Edit2, Power, Save, Loader2 } from 'lucide-react';

export const MasterJabatanPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const { showToast } = useToast();

  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<Position | null>(null);
  const [posName, setPosName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const canManage = hasPermission('manage_master_jabatan');

  const loadPositions = async () => {
    if (positions.length === 0) setIsLoading(true);
    try {
      const res = await masterService.getPositions();
      if (res.data) setPositions(res.data);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPositions();
  }, []);

  const openAddModal = () => {
    setEditingPosition(null);
    setPosName('');
    setIsModalOpen(true);
  };

  const openEditModal = (pos: Position) => {
    setEditingPosition(pos);
    setPosName(pos.nama);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!posName.trim()) {
      showToast('Nama jabatan wajib diisi', 'warning');
      return;
    }

    setIsSaving(true);
    if (editingPosition) {
      const res = await masterService.updatePosition(editingPosition.id, posName, editingPosition.active);
      setIsSaving(false);
      if (res.success) {
        showToast('Jabatan berhasil diperbarui', 'success');
        setIsModalOpen(false);
        loadPositions();
      } else {
        showToast(res.message || 'Gagal mengubah jabatan', 'error');
      }
    } else {
      const res = await masterService.addPosition(posName);
      setIsSaving(false);
      if (res.success) {
        showToast('Jabatan baru berhasil ditambahkan', 'success');
        setIsModalOpen(false);
        loadPositions();
      } else {
        showToast(res.message || 'Gagal menambah jabatan', 'error');
      }
    }
  };

  const handleToggleActive = async (pos: Position) => {
    const newStatus = !pos.active;
    const res = await masterService.updatePosition(pos.id, pos.nama, newStatus);
    if (res.success) {
      showToast(res.message || 'Status jabatan berhasil diubah', 'success');
      loadPositions();
    } else {
      showToast(res.message || 'Gagal mengubah status', 'error');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Master Data Jabatan Organisasi</h1>
          <p>Daftar nomenklatur jabatan aparatur pemerintah desa</p>
        </div>
        {canManage && (
          <div className="page-actions">
            <button type="button" className="btn btn-primary" onClick={openAddModal}>
              <Plus size={16} /> Tambah Jabatan Baru
            </button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Nama Jabatan</th>
                <th>Tanggal Efektif</th>
                <th>Aparatur Aktif Terdaftar</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && positions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem' }}>
                      <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary-600)' }} />
                      <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>Memuat data master jabatan...</span>
                    </div>
                  </td>
                </tr>
              ) : positions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Belum ada data jabatan.
                  </td>
                </tr>
              ) : (
                positions.map((pos) => (
                  <tr key={pos.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={16} color="var(--color-primary-600)" />
                        <strong>{pos.nama}</strong>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                        {pos.effectiveFrom}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: pos.aparaturCount ? 'var(--color-primary-700)' : 'var(--text-muted)' }}>
                        {pos.aparaturCount || 0} Aparatur
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${pos.active ? 'badge-hadir' : 'badge-libur'}`}>
                        {pos.active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {canManage && (
                        <div style={{ display: 'inline-flex', gap: '0.375rem' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => openEditModal(pos)}
                          >
                            <Edit2 size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            style={{ fontSize: '0.75rem', color: pos.active ? 'var(--color-accent-rose)' : 'var(--color-primary-700)' }}
                            onClick={() => handleToggleActive(pos)}
                            title={pos.active ? 'Nonaktifkan Jabatan' : 'Aktifkan Jabatan'}
                          >
                            <Power size={14} />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPosition ? `Ubah Jabatan — ${editingPosition.nama}` : 'Tambah Jabatan Baru'}
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
              <Save size={16} /> {isSaving ? 'Menyimpan...' : 'Simpan Jabatan'}
            </button>
          </>
        }
      >
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label className="form-label">Nama Jabatan Organisasi <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Kaur Keuangan"
              value={posName}
              onChange={(e) => setPosName(e.target.value)}
              autoFocus
            />
            <span className="form-hint">Jabatan adalah struktur organisasi, terpisah dari role otoritas aplikasi.</span>
          </div>
        </form>
      </Modal>
    </div>
  );
};
