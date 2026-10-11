import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dlService } from '../../services/dlService';
import { settingsService } from '../../services/settingsService';
import { DLAssignment } from '../../types/dl';
import { CameraCapture } from '../../components/common/CameraCapture';
import { GeofencePreview } from '../../components/common/GeofencePreview';
import { useToast } from '../../context/ToastContext';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock,
  MapPin,
  AlertTriangle,
  Navigation,
} from 'lucide-react';

export const DinasLuarPresensiPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [dl, setDl] = useState<DLAssignment | null>(null);
  const [activeTab, setActiveTab] = useState<'CHECK_IN' | 'CHECK_OUT'>('CHECK_IN');
  const [selfiePhoto, setSelfiePhoto] = useState<string | null>(null);
  const [earlyReason, setEarlyReason] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Device Geolocation
  const [coords, setCoords] = useState<{ lat: number; lng: number; accuracy: number }>({
    lat: -6.495,
    lng: 106.852,
    accuracy: 12,
  });
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [maxFileSizeMb, setMaxFileSizeMb] = useState<number>(5);

  useEffect(() => {
    if (id) {
      dlService.getAssignmentById(id).then((res) => {
        if (res.data) {
          setDl(res.data);
          if (res.data.hasCheckedIn && !res.data.hasCheckedOut) {
            setActiveTab('CHECK_OUT');
          }
          if (res.data.locations.length > 0) {
            setCoords({
              lat: res.data.locations[0].latitude,
              lng: res.data.locations[0].longitude,
              accuracy: 12,
            });
          }
        }
      });
    }

    settingsService.getNumberSetting('MAX_SELFIE_FILE_SIZE_MB', 5).then((mb) => {
      setMaxFileSizeMb(mb);
    });

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
          });
        },
        (err) => {
          setGpsError(`Gagal mendeteksi lokasi GPS: ${err.message}. Pastikan izin lokasi aktif pada peramban/perangkat Anda.`);
        }
      );
    }
  }, [id]);

  if (!dl) {
    return <div style={{ padding: '3rem', textAlign: 'center' }}>Memuat data Dinas Luar...</div>;
  }

  const primaryLoc = dl.locations[0] || { latitude: -6.495, longitude: 106.852, radius: 100, namaLokasi: 'Lokasi DL' };

  const handleSubmit = async () => {
    if (!selfiePhoto) {
      showToast('Wajib mengambil foto selfie sebelum submit presensi DL!', 'warning');
      return;
    }

    setIsSubmitting(true);
    const res = await dlService.submitDLAttendance(
      dl.id,
      activeTab,
      { latitude: coords.lat, longitude: coords.lng, accuracy: coords.accuracy },
      selfiePhoto,
      earlyReason
    );
    setIsSubmitting(false);

    if (res.success && res.data) {
      showToast(res.message || 'Presensi DL berhasil dicatat!', 'success');
      navigate(`/dl/${dl.id}`);
    } else {
      showToast(res.message || 'Presensi DL ditolak.', 'error');
    }
  };

  const handleSimulateAtLocation = (lat: number, lng: number) => {
    setCoords({ lat, lng, accuracy: 10 });
    showToast(`Posisi diset tepat di titik lokasi DL: ${lat}, ${lng}`, 'info');
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <Link
            to={`/dl/${dl.id}`}
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
            <ArrowLeft size={16} /> Kembali ke Rincian DL
          </Link>
          <h1>Presensi Kehadiran Dinas Luar (Selfie & GPS)</h1>
          <p>
            Surat Tugas #{dl.nomorSuratTugas} • {dl.subjectUserNama}
          </p>
        </div>
      </div>

      {/* State Guard Alert */}
      {dl.state !== 'APPROVED' && dl.state !== 'RATIFIED' && dl.state !== 'RATIFICATION_OVERDUE' && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#fee2e2',
            borderRadius: 'var(--radius-lg)',
            color: '#991b1b',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            marginBottom: '1.5rem',
          }}
        >
          <AlertTriangle size={20} />
          <div>
            <strong>Presensi Terkunci:</strong> Dinas Luar ini belum berstatus APPROVED atau RATIFIED. Presensi hanya dapat dilakukan setelah surat tugas disetujui secara sah.
          </div>
        </div>
      )}

      {/* Tab Switcher: Check-In vs Check-Out */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <button
          type="button"
          className={`btn ${activeTab === 'CHECK_IN' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('CHECK_IN')}
          disabled={dl.hasCheckedIn}
        >
          <CheckCircle2 size={16} />
          {dl.hasCheckedIn ? 'Check-In Telah Selesai' : 'Presensi Masuk (Check-In DL)'}
        </button>

        <button
          type="button"
          className={`btn ${activeTab === 'CHECK_OUT' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('CHECK_OUT')}
          disabled={!dl.hasCheckedIn || dl.hasCheckedOut}
        >
          <Clock size={16} />
          {dl.hasCheckedOut ? 'Check-Out Telah Selesai' : 'Presensi Pulang (Check-Out DL)'}
        </button>
      </div>

      <div className="responsive-grid-2">
        {/* Camera Selfie Component */}
        <div className="card">
          <CameraCapture
            onCapture={(base64) => setSelfiePhoto(base64)}
            maxSizeMb={maxFileSizeMb}
          />

          {activeTab === 'CHECK_OUT' && (
            <div className="form-group" style={{ marginTop: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.8125rem' }}>
                Keterangan Kepulangan / Alasan Selesai Tugas:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Rapat dinas selesai pukul 14:30"
                value={earlyReason}
                onChange={(e) => setEarlyReason(e.target.value)}
              />
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary btn-lg"
            style={{ width: '100%', marginTop: '1.5rem' }}
            onClick={handleSubmit}
            disabled={
              isSubmitting ||
              !selfiePhoto ||
              (activeTab === 'CHECK_IN' && dl.hasCheckedIn) ||
              (activeTab === 'CHECK_OUT' && dl.hasCheckedOut)
            }
          >
            <Camera size={18} />
            {isSubmitting
              ? 'Memverifikasi Bukti & Mengirim...'
              : `Kirim Presensi ${activeTab === 'CHECK_IN' ? 'Masuk' : 'Pulang'} DL`}
          </button>
        </div>

        {/* Location & Geofence Verification Component */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <MapPin size={18} color="var(--color-primary-600)" />
              Validasi Titik Lokasi DL
            </h3>
          </div>

          <div style={{ marginBottom: '1rem', fontSize: '0.8125rem' }}>
            <strong>Lokasi Penugasan DL Aktif:</strong>
            <ul style={{ paddingLeft: '1.25rem', marginTop: '0.375rem', color: 'var(--color-slate-700)' }}>
              {dl.locations.map((loc, idx) => (
                <li key={idx} style={{ marginBottom: 4 }}>
                  {loc.namaLokasi} — Radius {loc.radius} meter ({loc.latitude.toFixed(4)}, {loc.longitude.toFixed(4)})
                </li>
              ))}
            </ul>
          </div>

          <GeofencePreview
            targetLat={primaryLoc.latitude}
            targetLng={primaryLoc.longitude}
            targetRadiusMeters={primaryLoc.radius}
            userLat={coords.lat}
            userLng={coords.lng}
            distanceMeters={15}
            isValid={true}
            locations={dl.locations.map((loc) => ({
              id: loc.id,
              latitude: loc.latitude,
              longitude: loc.longitude,
              label: loc.namaLokasi,
              radiusMeters: loc.radius,
            }))}
            title={`Geofence DL: ${primaryLoc.namaLokasi}`}
            onSimulateCoords={handleSimulateAtLocation}
          />
        </div>
      </div>
    </div>
  );
};
