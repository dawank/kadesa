import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { attendanceService } from '../../services/attendanceService';
import { settingsService } from '../../services/settingsService';
import { masterService } from '../../services/masterService';
import { AttendanceRecord } from '../../types/attendance';
import { TimezoneOption, INDONESIA_TIMEZONES } from '../../types/settings';
import { StatusBadge } from '../../components/common/StatusBadge';
import { GeofencePreview } from '../../components/common/GeofencePreview';
import { useToast } from '../../context/ToastContext';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  MapPin,
  RefreshCw,
  LogOut,
  Calendar,
} from 'lucide-react';

export const PresensiRegulerPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { showToast } = useToast();

  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [historyRecords, setHistoryRecords] = useState<AttendanceRecord[]>([]);
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Settings
  const [officeCoords, setOfficeCoords] = useState<{ lat: number; lng: number }>({ lat: -6.4828, lng: 106.8436 });
  const [allowedRadius, setAllowedRadius] = useState<number>(100);
  const [workStartTime, setWorkStartTime] = useState<string>('07:30');
  const [lateTolerance, setLateTolerance] = useState<number>(15);
  const [workEndTime, setWorkEndTime] = useState<string>('15:30');
  const [timezoneOption, setTimezoneOption] = useState<TimezoneOption>(INDONESIA_TIMEZONES[0]);
  const [todayScheduleInfo, setTodayScheduleInfo] = useState<{
    schedule: any;
    isHoliday: boolean;
    holidayName?: string;
    isWorkingDay: boolean;
    dayName: string;
    dateStr: string;
    timezone: string;
  } | null>(null);

  // Device Geolocation state
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number; accuracy: number }>({
    lat: -6.4828,
    lng: 106.8436,
    accuracy: 10,
  });
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [earlyLeaveReason, setEarlyLeaveReason] = useState<string>('');

  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const loadData = async () => {
    if (!currentUser) return;
    const todayRes = await attendanceService.getTodayAttendanceForUser(currentUser.id);
    if (todayRes.data) setTodayRecord(todayRes.data);

    const allRes = await attendanceService.getAllAttendance();
    if (allRes.data) {
      setHistoryRecords(allRes.data.filter((r) => r.userId === currentUser.id));
    }

    const rad = await settingsService.getNumberSetting('REGULAR_ATTENDANCE_RADIUS_METERS', 100);
    setAllowedRadius(rad);

    const tz = await settingsService.getTimezone();
    setTimezoneOption(tz);

    const schInfo = await settingsService.getScheduleForDate(new Date(), tz.code);
    setTodayScheduleInfo(schInfo);
    if (schInfo.schedule) {
      setWorkStartTime(schInfo.schedule.startTime);
      setWorkEndTime(schInfo.schedule.endTime);
      setLateTolerance(schInfo.schedule.toleranceMinutes);
    } else {
      setWorkStartTime('07:30');
      setLateTolerance(15);
      setWorkEndTime('15:30');
    }

    const villageRes = await masterService.getVillage();
    if (villageRes.data) {
      setOfficeCoords({ lat: villageRes.data.latitude, lng: villageRes.data.longitude });
    }
  };

  useEffect(() => {
    loadData();
    detectLocation();
  }, [currentUser]);

  const detectLocation = () => {
    if (!navigator.geolocation) {
      setGpsError('Browser tidak mendukung pendeteksian lokasi GPS.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentCoords({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setGpsError(null);
      },
      (err) => {
        setGpsError(`Gagal mendeteksi lokasi GPS: ${err.message}. Pastikan izin lokasi aktif pada peramban/perangkat Anda.`);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const geofenceValidation = attendanceService.validateGeofence({
    latitude: currentCoords.lat,
    longitude: currentCoords.lng,
    accuracy: currentCoords.accuracy,
    targetLatitude: officeCoords.lat,
    targetLongitude: officeCoords.lng,
    allowedRadiusMeters: allowedRadius,
  });

  const handleCheckIn = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    const res = await attendanceService.checkIn(
      currentUser.id,
      currentUser.nama,
      currentUser.jabatanNama,
      currentUser.fotoReference,
      {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        accuracy: currentCoords.accuracy,
      }
    );
    setIsSubmitting(false);

    if (res.success && res.data) {
      showToast(res.message || 'Check-In berhasil!', 'success');
      setTodayRecord(res.data);
      loadData();
    } else {
      showToast(res.message || 'Check-In gagal.', 'error');
    }
  };

  const handleCheckOut = async () => {
    if (!currentUser) return;
    setIsSubmitting(true);
    const res = await attendanceService.checkOut(
      currentUser.id,
      {
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        accuracy: currentCoords.accuracy,
      },
      earlyLeaveReason
    );
    setIsSubmitting(false);

    if (res.success && res.data) {
      showToast(res.message || 'Check-Out berhasil!', 'success');
      setTodayRecord(res.data);
      loadData();
    } else {
      showToast(res.message || 'Check-Out gagal.', 'error');
    }
  };

  const handleSimulateCoords = (lat: number, lng: number) => {
    setCurrentCoords({ lat, lng, accuracy: 12 });
    setGpsError(null);
    showToast(`Koordinat lokasi: ${lat.toFixed(4)}, ${lng.toFixed(4)}`, 'info');
  };

  const formattedTime = currentTime.toLocaleTimeString('id-ID', {
    timeZone: timezoneOption.code,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const formattedDate = currentTime.toLocaleDateString('id-ID', {
    timeZone: timezoneOption.code,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const nowHoursMinutes = currentTime.toLocaleTimeString('id-ID', {
    timeZone: timezoneOption.code,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const isAfterEndTime = nowHoursMinutes >= workEndTime;

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Presensi Reguler Kantor Desa</h1>
          <p>Pencatatan kehadiran harian berbasis waktu server resmi dan radius geofence kantor</p>
        </div>
      </div>

      {/* Official Server Clock Banner */}
      <div className="official-clock-banner">
        <div className="clock-banner-left">
          <div className="clock-live-indicator">
            <span className="pulse-dot-live"></span>
            <span>WAKTU RESMI SERVER KADESA ({timezoneOption.shortLabel})</span>
          </div>
          <div className="clock-digits-hero">
            {formattedTime} <span className="clock-tz-label">{timezoneOption.shortLabel}</span>
          </div>
          <div className="clock-date-line">
            <Calendar size={15} style={{ opacity: 0.85 }} />
            <span>{formattedDate}</span>
          </div>
        </div>

        <div className="clock-banner-right">
          <div className="clock-info-card">
            <div className="clock-info-icon-wrap">
              <Clock size={18} />
            </div>
            <div className="clock-info-text-group">
              <div className="clock-info-label">
                Jadwal Hari Ini ({todayScheduleInfo?.dayName || 'Hari Ini'})
              </div>
              <div className="clock-info-value">
                {todayScheduleInfo?.isWorkingDay
                  ? `${workStartTime} – ${workEndTime} ${timezoneOption.shortLabel}`
                  : 'Hari Libur'}
              </div>
              <div className="clock-info-subtext">
                {todayScheduleInfo?.holidayName
                  ? `Libur: ${todayScheduleInfo.holidayName}`
                  : todayScheduleInfo?.isWorkingDay
                  ? `Jadwal Operasional Aktif`
                  : 'Tidak ada kewajiban presensi'}
              </div>
            </div>
          </div>

          <div className="clock-info-card">
            <div className="clock-info-icon-wrap">
              <CheckCircle2 size={18} />
            </div>
            <div className="clock-info-text-group">
              <div className="clock-info-label">Toleransi Kehadiran</div>
              <div className="clock-info-value">{lateTolerance} Menit</div>
              <div className="clock-info-subtext">
                {todayScheduleInfo?.isWorkingDay
                  ? `Setelah ${workStartTime} dicatat terlambat`
                  : 'Bebas penalti keterlambatan'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Grid: Check-In/Check-Out Action Panel & Geofence Status */}
      <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
        {/* Presensi Action Panel */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Status Presensi Hari Ini</h3>
            <StatusBadge status={todayRecord?.status || 'BELUM PRESENSI'} size="md" />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div
              className="form-grid-2"
              style={{
                backgroundColor: 'var(--color-slate-50)',
                padding: '1rem',
                borderRadius: 'var(--radius-md)',
              }}
            >
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Waktu Check-In</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  {todayRecord?.checkInAt ? todayRecord.checkInAt.split('T')[1].slice(0, 5) : '— : —'}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Waktu Check-Out</span>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '1.25rem', fontWeight: 800, color: 'var(--color-slate-900)' }}>
                  {todayRecord?.checkOutAt ? todayRecord.checkOutAt.split('T')[1].slice(0, 5) : '— : —'}
                </div>
              </div>
            </div>

            {/* Jam kerja sebagai referensi jadwal */}
            <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', padding: '0.75rem', borderRadius: 'var(--radius-md)' }}>
              <strong>Catatan Sistem:</strong> Check-In terlambat tetap diperbolehkan dan tidak terkunci oleh jam kerja. Status otomatis disesuaikan menjadi TERLAMBAT jika lewat dari batas toleransi.
            </div>

            {/* Check-In / Check-Out Triggers */}
            {!todayRecord?.checkInAt ? (
              <button
                type="button"
                className="btn btn-primary btn-lg"
                onClick={handleCheckIn}
                disabled={isSubmitting}
                style={{ width: '100%' }}
              >
                <CheckCircle2 size={20} />
                {isSubmitting ? 'Mencatat Check-In...' : 'Lakukan Check-In Sekarang'}
              </button>
            ) : !todayRecord?.checkOutAt ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {!isAfterEndTime && (
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.8125rem' }}>
                      Alasan Pulang Lebih Awal (Sebelum {workEndTime}): <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Contoh: Izin urusan dinas mendesak"
                      value={earlyLeaveReason}
                      onChange={(e) => setEarlyLeaveReason(e.target.value)}
                    />
                  </div>
                )}
                <button
                  type="button"
                  className="btn btn-secondary btn-lg"
                  onClick={handleCheckOut}
                  disabled={isSubmitting || (!isAfterEndTime && !earlyLeaveReason.trim())}
                  style={{ width: '100%', borderColor: 'var(--color-primary-600)', color: 'var(--color-primary-700)' }}
                >
                  <LogOut size={20} />
                  {isSubmitting ? 'Mencatat Check-Out...' : 'Lakukan Check-Out (Presensi Pulang)'}
                </button>
              </div>
            ) : (
              <div
                style={{
                  padding: '1rem',
                  backgroundColor: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  borderRadius: 'var(--radius-md)',
                  color: '#065f46',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}
              >
                <CheckCircle2 size={20} />
                <span>Presensi Anda hari ini telah lengkap (Masuk & Pulang tercatat).</span>
              </div>
            )}
          </div>
        </div>

        {/* Geofence & Location Panel */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <MapPin size={18} color="var(--color-primary-600)" />
              Status Lokasi & Validasi Geofence
            </h3>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={detectLocation}
              title="Perbarui GPS"
            >
              <RefreshCw size={14} /> Refresh GPS
            </button>
          </div>

          {gpsError && (
            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: '#fffbeb',
                border: '1px solid #fef3c7',
                borderRadius: 'var(--radius-md)',
                color: '#92400e',
                fontSize: '0.8125rem',
                display: 'flex',
                gap: '0.5rem',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <AlertCircle size={16} />
              <span>{gpsError}</span>
            </div>
          )}


          <GeofencePreview
            targetLat={officeCoords.lat}
            targetLng={officeCoords.lng}
            targetRadiusMeters={allowedRadius}
            userLat={currentCoords.lat}
            userLng={currentCoords.lng}
            distanceMeters={geofenceValidation.distanceMeters}
            isValid={geofenceValidation.isValid}
            onSimulateCoords={handleSimulateCoords}
          />
        </div>
      </div>

      {/* Personal Attendance History Table */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">
            <Calendar size={18} color="var(--color-primary-600)" />
            Histori Presensi Pribadi Anda
          </h3>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Check-In</th>
                <th>Check-Out</th>
                <th>Status</th>
                <th>Akurasi GPS</th>
                <th>Keterangan / Audit Status</th>
              </tr>
            </thead>
            <tbody>
              {historyRecords.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                    Belum ada rekaman riwayat presensi
                  </td>
                </tr>
              ) : (
                historyRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <strong>{rec.attendanceDate}</strong>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {rec.checkInAt ? rec.checkInAt.split('T')[1].slice(0, 5) : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>
                        {rec.checkOutAt ? rec.checkOutAt.split('T')[1].slice(0, 5) : '—'}
                      </span>
                    </td>
                    <td>
                      <StatusBadge status={rec.status} size="sm" />
                    </td>
                    <td>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {rec.checkInAccuracy ? `±${Math.round(rec.checkInAccuracy)}m` : '—'}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        {rec.correctionNote || rec.statusReason || 'Presensi reguler sah'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
