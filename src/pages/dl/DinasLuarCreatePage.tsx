import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dlService } from '../../services/dlService';
import { masterService } from '../../services/masterService';
import { User } from '../../types/auth';
import { LocationPickerMap } from '../../components/common/LocationPickerMap';
import { useToast } from '../../context/ToastContext';
import { ArrowLeft, Plus, Trash2, MapPin, Save, Briefcase } from 'lucide-react';

interface LocationInput {
  namaLokasi: string;
  latitude: number;
  longitude: number;
  radius: number;
}

export const DinasLuarCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [apparatusList, setApparatusList] = useState<User[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [purpose, setPurpose] = useState<string>('');
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const [locations, setLocations] = useState<LocationInput[]>([
    {
      namaLokasi: 'Kantor Kecamatan Cibinong',
      latitude: -6.495,
      longitude: 106.852,
      radius: 100,
    },
  ]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const canAssignOthers = hasPermission('dl_assign');

  useEffect(() => {
    masterService.getApparatusList().then((res) => {
      if (res.data) {
        setApparatusList(res.data.filter((u) => u.active));
        if (currentUser) {
          setSelectedSubjectId(currentUser.id);
        }
      }
    });
  }, [currentUser]);

  const handleAddLocation = () => {
    setLocations([
      ...locations,
      {
        namaLokasi: '',
        latitude: -6.48,
        longitude: 106.84,
        radius: 100,
      },
    ]);
  };

  const handleRemoveLocation = (index: number) => {
    if (locations.length <= 1) {
      showToast('Minimal harus ada satu lokasi penugasan', 'warning');
      return;
    }
    setLocations(locations.filter((_, idx) => idx !== index));
  };

  const handleLocationChange = (index: number, field: keyof LocationInput, value: string | number) => {
    const updated = [...locations];
    updated[index] = { ...updated[index], [field]: value };
    setLocations(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (!purpose.trim()) {
      showToast('Tujuan dan rincian penugasan wajib diisi', 'warning');
      return;
    }

    if (locations.some((l) => !l.namaLokasi.trim())) {
      showToast('Seluruh nama lokasi penugasan wajib diisi', 'warning');
      return;
    }

    for (const loc of locations) {
      if (loc.latitude < -90 || loc.latitude > 90) {
        showToast(`Latitude pada "${loc.namaLokasi}" tidak valid (-90 s/d 90)`, 'warning');
        return;
      }
      if (loc.longitude < -180 || loc.longitude > 180) {
        showToast(`Longitude pada "${loc.namaLokasi}" tidak valid (-180 s/d 180)`, 'warning');
        return;
      }
      if (loc.radius < 10 || loc.radius > 5000) {
        showToast(`Radius geofence pada "${loc.namaLokasi}" harus antara 10 - 5000 meter`, 'warning');
        return;
      }
    }

    const subjectUser = apparatusList.find((u) => u.id === selectedSubjectId) || currentUser;

    setIsSubmitting(true);
    const res = await dlService.createAssignment(
      currentUser.id,
      currentUser.nama,
      currentUser.role,
      {
        subjectUserId: subjectUser.id,
        subjectUserNama: subjectUser.nama,
        subjectUserJabatan: subjectUser.jabatanNama,
        purpose,
        startDate,
        endDate,
        locations,
      }
    );
    setIsSubmitting(false);

    if (res.success && res.data) {
      showToast(res.message || 'Surat penugasan DL berhasil diajukan!', 'success');
      navigate(`/dl/${res.data.id}`);
    } else {
      showToast(res.message || 'Gagal mengajukan DL.', 'error');
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
          <h1>Form Pembuatan Surat Tugas Dinas Luar (DL)</h1>
          <p>Daftarkan penugasan luar kantor beserta lokasi dan radius geofence</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="responsive-grid-2">
          {/* Main Info */}
          <div className="card">
            <h3 className="card-title" style={{ marginBottom: '1.25rem' }}>
              <Briefcase size={18} color="var(--color-primary-600)" />
              Informasi Tugas & Aparatur
            </h3>

            {/* Subject Selector */}
            <div className="form-group">
              <label className="form-label">
                Aparatur yang Ditugaskan: <span className="required">*</span>
              </label>
              {canAssignOthers ? (
                <select
                  className="form-select"
                  value={selectedSubjectId}
                  onChange={(e) => setSelectedSubjectId(e.target.value)}
                >
                  {apparatusList.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nama} — {u.jabatanNama} ({u.role.replace('_', ' ')})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  disabled
                  value={`${currentUser?.nama} — ${currentUser?.jabatanNama}`}
                />
              )}
              <span className="form-hint">
                {canAssignOthers
                  ? 'Anda memiliki hak untuk menugaskan aparatur lain.'
                  : 'Anda mengajukan tugas mandiri untuk diri sendiri.'}
              </span>
            </div>

            {/* Dates */}
            <div className="form-grid-2">
              <div className="form-group">
                <label className="form-label">
                  Tanggal Mulai: <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Tanggal Selesai: <span className="required">*</span>
                </label>
                <input
                  type="date"
                  className="form-input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">
                Maksud & Tujuan Penugasan: <span className="required">*</span>
              </label>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Jelaskan agenda dinas luar, dasar undangan, atau keperluan resmi kantor desa..."
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>

          {/* Locations Panel */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <MapPin size={18} color="var(--color-primary-600)" />
                Titik Lokasi Dinas Luar ({locations.length})
              </h3>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleAddLocation}
              >
                <Plus size={14} /> Tambah Titik
              </button>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Satu surat tugas dinas luar dapat memiliki beberapa titik lokasi tujuan. Aparatur dapat melakukan presensi di salah satu lokasi yang ditentukan.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {locations.map((loc, idx) => (
                <div
                  key={idx}
                  style={{
                    padding: '1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.875rem' }}>Lokasi #{idx + 1}</strong>
                    {locations.length > 1 && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ color: 'var(--color-accent-rose)', padding: '0.2rem' }}
                        onClick={() => handleRemoveLocation(idx)}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                    <label className="form-label" style={{ fontSize: '0.75rem' }}>Nama Lokasi/Instansi</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Kantor Kecamatan Cibinong"
                      value={loc.namaLokasi}
                      onChange={(e) => handleLocationChange(idx, 'namaLokasi', e.target.value)}
                    />
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <LocationPickerMap
                      latitude={loc.latitude}
                      longitude={loc.longitude}
                      radiusMeters={loc.radius}
                      onChange={(coords) => {
                        handleLocationChange(idx, 'latitude', coords.latitude);
                        handleLocationChange(idx, 'longitude', coords.longitude);
                      }}
                      onRadiusChange={(radius) => {
                        handleLocationChange(idx, 'radius', radius);
                      }}
                      height={220}
                      showManualInputs={true}
                      showSearch={true}
                      showGpsButton={true}
                      title={`Peta Lokasi ${idx + 1}: ${loc.namaLokasi || 'Titik Tugas'}`}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <Link to="/dl" className="btn btn-secondary">
                Batal
              </Link>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                <Save size={16} /> {isSubmitting ? 'Menyimpan...' : 'Kirim Pengajuan Dinas Luar'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
