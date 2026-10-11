import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { dlService } from '../../services/dlService';
import { DLAssignment, DLState } from '../../types/dl';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  Plus,
  Eye,
  Camera,
  MapPin,
  Calendar,
  AlertTriangle,
  Clock,
} from 'lucide-react';

export const DinasLuarListPage: React.FC = () => {
  const { currentUser } = useAuth();
  const [assignments, setAssignments] = useState<DLAssignment[]>([]);
  const [filterState, setFilterState] = useState<DLState | 'ALL'>('ALL');
  const [myOnly, setMyOnly] = useState<boolean>(false);

  useEffect(() => {
    dlService.getAssignments().then((res) => {
      if (res.data) setAssignments(res.data);
    });
  }, []);

  const filtered = assignments.filter((dl) => {
    if (filterState !== 'ALL' && dl.state !== filterState) return false;
    if (myOnly && currentUser && dl.subjectUserId !== currentUser.id && dl.requesterUserId !== currentUser.id) {
      return false;
    }
    return true;
  });

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Daftar Tugas Dinas Luar (DL)</h1>
          <p>Pengelolaan penugasan luar kantor aparatur desa, verifikasi, approval, dan ratifikasi</p>
        </div>
        <div className="page-actions">
          <Link to="/dl/create" className="btn btn-primary">
            <Plus size={16} /> Buat / Ajukan Dinas Luar
          </Link>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
            {(['ALL', 'PENDING', 'VERIFIED', 'APPROVED', 'RATIFIED', 'RATIFICATION_OVERDUE'] as const).map((st) => (
              <button
                key={st}
                type="button"
                className={`btn btn-sm ${filterState === st ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFilterState(st)}
              >
                {st === 'ALL' ? 'Semua' : st.replace('_', ' ')}
              </button>
            ))}
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={myOnly}
              onChange={(e) => setMyOnly(e.target.checked)}
            />
            <span>Hanya tugas saya</span>
          </label>
        </div>
      </div>

      {/* DL Cards Grid */}
      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          Tidak ada data penugasan Dinas Luar pada status yang dipilih.
        </div>
      ) : (
        <div className="responsive-grid-cards">
          {filtered.map((dl) => (
            <div key={dl.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      #{dl.nomorSuratTugas}
                    </span>
                    <h3 style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 2 }}>
                      {dl.subjectUserNama}
                    </h3>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-primary-700)', fontWeight: 600 }}>
                      {dl.subjectUserJabatan}
                    </div>
                  </div>
                  <StatusBadge status={dl.state} size="sm" />
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-700)', marginBottom: '1rem', lineHeight: 1.4 }}>
                  {dl.purpose}
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <Calendar size={14} />
                    <span>Periode: <strong>{dl.startDate}</strong> s/d <strong>{dl.endDate}</strong></span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                    <MapPin size={14} />
                    <span>{dl.locations.length} Titik Lokasi ({dl.locations.map((l) => l.namaLokasi).join(', ')})</span>
                  </div>
                  {dl.ratificationDeadline && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', color: dl.state === 'RATIFICATION_OVERDUE' ? '#b91c1c' : '#b45309' }}>
                      <Clock size={14} />
                      <span>Batas Ratifikasi: {new Date(dl.ratificationDeadline).toLocaleDateString('id-ID')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Actions */}
              <div
                style={{
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Link to={`/dl/${dl.id}`} className="btn btn-secondary btn-sm">
                  <Eye size={14} /> Rincian & Timeline
                </Link>

                {/* DL Check-In / Out action if approved and user is the subject */}
                {(dl.state === 'APPROVED' || dl.state === 'RATIFIED' || dl.state === 'RATIFICATION_OVERDUE') &&
                  currentUser?.id === dl.subjectUserId && (
                    <Link
                      to={`/dl/presensi/${dl.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ backgroundColor: 'var(--color-accent-purple)', borderColor: 'var(--color-accent-purple)' }}
                    >
                      <Camera size={14} /> Presensi DL Selfie
                    </Link>
                  )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
