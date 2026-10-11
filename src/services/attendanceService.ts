import {
  AttendanceRecord,
  GeofenceCheckParams,
  GeofenceCheckResult,
} from '../types/attendance';
import { mockAttendanceRecords, mockVillage } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { settingsService } from './settingsService';
import { masterService } from './masterService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export function mapDbRecordToAttendanceRecord(row: any): AttendanceRecord {
  const user = row.users;
  return {
    id: row.id,
    userId: row.user_id,
    userNama: user?.nama || row.user_nama || 'Aparatur Desa',
    userJabatan: user?.positions?.nama || user?.jabatan_id || row.user_jabatan || 'Aparatur Desa',
    userFoto: user?.foto_reference || row.check_in_selfie_url,
    attendanceDate: row.attendance_date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    checkInLatitude: row.check_in_latitude != null ? Number(row.check_in_latitude) : null,
    checkInLongitude: row.check_in_longitude != null ? Number(row.check_in_longitude) : null,
    checkInAccuracy: row.check_in_distance_meters,
    checkInClientTimestamp: row.check_in_at,
    checkOutLatitude: row.check_out_latitude != null ? Number(row.check_out_latitude) : null,
    checkOutLongitude: row.check_out_longitude != null ? Number(row.check_out_longitude) : null,
    checkOutAccuracy: row.check_out_distance_meters,
    checkOutClientTimestamp: row.check_out_at,
    status: row.status,
    statusReason: row.early_leave_reason || undefined,
    validationResult: 'ACCEPT',
    warningCode: row.status === 'TERLAMBAT' ? 'LATE' : null,
    isCorrected: row.correction_state === 'CORRECTED',
    correctionNote: row.correction_state === 'CORRECTED' ? 'Koreksi administratif' : undefined,
    isEarlyLeave: row.is_early_leave,
    earlyLeaveReason: row.early_leave_reason,
    earlyLeaveMinutes: row.early_leave_minutes,
    attendanceType: row.type || 'REGULAR',
    dlAssignmentId: row.dl_assignment_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Calculates Haversine distance between two coordinates in meters
 */
export function calculateHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

class AttendanceService {
  private records: AttendanceRecord[] = [...mockAttendanceRecords];
  private mockServerTime: Date | null = null;

  // Official Server Clock (as per PRD Section 1 & 46: Official time comes from server)
  getServerTime(): Date {
    return this.mockServerTime ? new Date(this.mockServerTime.getTime()) : new Date();
  }

  setMockServerTime(time: Date | null): void {
    this.mockServerTime = time;
  }

  formatDateInTimezone(date: Date, timezone: string): string {
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(date);
    } catch {
      return date.toISOString().split('T')[0];
    }
  }

  async fetchServerTime(): Promise<Date> {
    if (this.mockServerTime) {
      return new Date(this.mockServerTime.getTime());
    }
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.rpc('get_server_time');
        if (!error && data) {
          return new Date(data);
        }
        if (error) {
          throw new Error(`Gagal memperoleh waktu server otoritatif: ${error.message}`);
        }
      } catch (err: any) {
        throw new Error(err.message || 'Waktu server otoritatif tidak dapat diakses');
      }
    }
    return new Date();
  }

  validateGeofence(params: GeofenceCheckParams): GeofenceCheckResult {
    // Validasi rentang dan kelengkapan koordinat geografis
    if (
      params == null ||
      params.latitude == null ||
      params.longitude == null ||
      isNaN(params.latitude) ||
      isNaN(params.longitude) ||
      params.latitude < -90 ||
      params.latitude > 90 ||
      params.longitude < -180 ||
      params.longitude > 180
    ) {
      return {
        isValid: false,
        distanceMeters: -1,
        allowedRadiusMeters: params.allowedRadiusMeters,
        validationResult: 'REJECT',
        warning: 'Koordinat tidak valid atau tidak lengkap (Latitude [-90..90], Longitude [-180..180]).',
      };
    }

    const distance = calculateHaversineDistanceMeters(
      params.latitude,
      params.longitude,
      params.targetLatitude,
      params.targetLongitude
    );

    let warning: string | undefined;
    if (params.accuracy > 50) {
      warning = `Akurasi GPS rendah (±${Math.round(params.accuracy)}m). Mohon pastikan sinyal GPS optimal.`;
    }

    const isValid = distance <= params.allowedRadiusMeters;

    return {
      isValid,
      distanceMeters: distance,
      allowedRadiusMeters: params.allowedRadiusMeters,
      validationResult: isValid
        ? warning
          ? 'ACCEPT_WARNING'
          : 'ACCEPT'
        : 'REJECT',
      warning,
    };
  }

  async getTodayAttendanceForUser(userId: string): Promise<ApiResponse<AttendanceRecord | null>> {
    let today = new Date().toISOString().split('T')[0];
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const serverTime = await this.fetchServerTime();
        const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
        today = this.formatDateInTimezone(serverTime, timezone);

        const { data, error } = await supabase
          .from('attendance_records')
          .select('*, users(nama, foto_reference, jabatan_id, positions(nama))')
          .eq('user_id', userId)
          .eq('attendance_date', today)
          .maybeSingle();

        if (!error) {
          if (!data) return { success: true, data: null };
          const mapped = mapDbRecordToAttendanceRecord(data);
          return { success: true, data: mapped };
        }
      } catch (err) {
        console.warn('Supabase getTodayAttendanceForUser error:', err);
      }
    }

    await simulateNetworkDelay(200);
    const record = this.records.find(
      (r) => r.userId === userId && r.attendanceDate === today
    );
    return { success: true, data: record || null };
  }

  async getAllAttendance(date?: string, status?: string): Promise<ApiResponse<AttendanceRecord[]>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('attendance_records')
          .select('*, users(nama, foto_reference, jabatan_id, positions(nama))')
          .order('attendance_date', { ascending: false });

        if (date) {
          query = query.eq('attendance_date', date);
        }
        if (status && status !== 'ALL') {
          query = query.eq('status', status);
        }

        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat data presensi dari database: ${error.message}`, data: [] };
        }
        if (data) {
          const list = data.map(mapDbRecordToAttendanceRecord);
          return { success: true, data: list };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat data presensi: ${err.message || 'Kesalahan koneksi database'}`, data: [] };
      }
    }

    await simulateNetworkDelay(250);
    let list = [...this.records];
    if (date) {
      list = list.filter((r) => r.attendanceDate === date);
    }
    if (status && status !== 'ALL') {
      list = list.filter((r) => r.status === status);
    }
    return { success: true, data: list };
  }

  async checkIn(
    userId: string,
    userNama: string,
    userJabatan: string,
    userFoto: string | undefined,
    coords: { latitude: number; longitude: number; accuracy: number },
    attendanceType: 'REGULAR' | 'DINAS_LUAR' = 'REGULAR',
    dlAssignmentId?: string
  ): Promise<ApiResponse<AttendanceRecord>> {
    await simulateNetworkDelay(500);

    let serverTime: Date;
    try {
      serverTime = await this.fetchServerTime();
    } catch (err: any) {
      if (!IS_DEMO_MODE) {
        return {
          success: false,
          message: err.message || 'Waktu resmi server database tidak tersedia. Presensi ditolak demi keamanan data.',
          errorCode: 'SERVER_TIME_ERROR',
        };
      }
      serverTime = this.getServerTime();
    }

    const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    const today = this.formatDateInTimezone(serverTime, timezone);
    const serverTimestamp = serverTime.toISOString();

    // Validasi kelengkapan dan rentang koordinat geografis
    if (
      coords == null ||
      coords.latitude == null ||
      coords.longitude == null ||
      isNaN(coords.latitude) ||
      isNaN(coords.longitude) ||
      coords.latitude < -90 ||
      coords.latitude > 90 ||
      coords.longitude < -180 ||
      coords.longitude > 180
    ) {
      return {
        success: false,
        message: 'Koordinat lokasi tidak valid atau tidak lengkap. Latitude harus di antara -90 dan 90, Longitude harus di antara -180 dan 180.',
        errorCode: 'INVALID_COORDINATES',
      };
    }

    // Check duplicate check-in or check-in after check-out
    const existing = this.records.find(
      (r) => r.userId === userId && r.attendanceDate === today
    );
    if (existing && (existing.checkInAt || existing.checkOutAt)) {
      return {
        success: false,
        message: 'Presensi Check-In hari ini sudah tercatat atau sudah Check-Out. Tidak dapat melakukan Check-In kembali.',
        errorCode: 'DUPLICATE_CHECKIN',
      };
    }

    // Jalur DINAS_LUAR: Pengecualian dari geofence kantor desa, tapi wajib memiliki penugasan & selfie
    if (attendanceType === 'DINAS_LUAR') {
      if (!dlAssignmentId) {
        return {
          success: false,
          message: 'Presensi Dinas Luar ditolak: Surat Tugas (dl_assignment_id) wajib disertakan.',
          errorCode: 'DL_ASSIGNMENT_REQUIRED',
        };
      }

      if (!userFoto || !userFoto.trim()) {
        return {
          success: false,
          message: 'Presensi Dinas Luar ditolak: Foto bukti selfie wajib disertakan.',
          errorCode: 'SELFIE_REQUIRED',
        };
      }

      const newRecord: AttendanceRecord = {
        id: `att-${Date.now().toString().slice(-5)}`,
        userId,
        userNama,
        userJabatan,
        userFoto,
        attendanceDate: today,
        checkInAt: serverTimestamp,
        checkOutAt: null,
        checkInLatitude: coords.latitude,
        checkInLongitude: coords.longitude,
        checkInAccuracy: coords.accuracy,
        checkInClientTimestamp: new Date().toISOString(),
        checkOutLatitude: null,
        checkOutLongitude: null,
        checkOutAccuracy: null,
        checkOutClientTimestamp: null,
        status: 'DINAS_LUAR',
        statusReason: 'Presensi Dinas Luar terverifikasi penugasan resmi',
        validationResult: 'ACCEPT',
        warningCode: null,
        isCorrected: false,
        attendanceType: 'DINAS_LUAR',
        dlAssignmentId,
        createdAt: serverTimestamp,
        updatedAt: serverTimestamp,
      };

      if (existing) {
        const idx = this.records.findIndex((r) => r.id === existing.id);
        this.records[idx] = newRecord;
      } else {
        this.records.unshift(newRecord);
      }

      return {
        success: true,
        data: newRecord,
        message: 'Presensi Dinas Luar berhasil dicatat.',
      };
    }

    // Safe fail-safe guard if operating in production/non-demo and office location unconfirmed (ADR-012)
    if (!IS_DEMO_MODE) {
      const isConfirmed = await settingsService.isOfficeCoordinatesConfirmed();
      if (!isConfirmed) {
        return {
          success: false,
          message: 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.',
          errorCode: 'OFFICE_LOCATION_UNCONFIRMED',
        };
      }
    }

    // Geofence check against village office
    const vRes = await masterService.getVillage();
    const villageLat = vRes.data?.latitude ?? mockVillage.latitude;
    const villageLng = vRes.data?.longitude ?? mockVillage.longitude;

    const allowedRadius = await settingsService.getNumberSetting('REGULAR_ATTENDANCE_RADIUS_METERS', 100);
    const geofenceResult = this.validateGeofence({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      targetLatitude: villageLat,
      targetLongitude: villageLng,
      allowedRadiusMeters: allowedRadius,
    });

    if (!geofenceResult.isValid) {
      return {
        success: false,
        message: `Presensi ditolak. Lokasi Anda berada ${geofenceResult.distanceMeters}m dari kantor desa (Radius maksimal ${allowedRadius}m).`,
        errorCode: 'OUT_OF_GEOFENCE',
      };
    }

    // Determine status (HADIR vs TERLAMBAT based on dynamic day-of-week schedule & tolerance & timezone)
    const dayScheduleInfo = await settingsService.getScheduleForDate(serverTime, timezone);
    const daySchedule = dayScheduleInfo.schedule;
    const isWorkingDay = dayScheduleInfo.isWorkingDay;

    const effectiveStartTime = (daySchedule?.startTime && daySchedule.startTime !== '00:00')
      ? daySchedule.startTime
      : (await settingsService.getStringSetting('WORK_START_TIME', '07:30'));
    const lateTolerance = (daySchedule?.toleranceMinutes != null && daySchedule.toleranceMinutes > 0)
      ? daySchedule.toleranceMinutes
      : (await settingsService.getNumberSetting('LATE_TOLERANCE_MINUTES', 15));

    // Extract current hour and minute in the configured timezone
    const timeFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    });
    const parts = timeFormatter.formatToParts(serverTime);
    const curHour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const curMin = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const curMinutesFromMidnight = curHour * 60 + curMin;

    const [startH, startM] = effectiveStartTime.split(':').map(Number);
    const toleranceLimitMinutes = startH * 60 + startM + lateTolerance;

    // Lateness only applies on active working days that are not holidays
    const isLate = isWorkingDay && curMinutesFromMidnight > toleranceLimitMinutes;
    const status = isLate ? 'TERLAMBAT' : 'HADIR';
    const formattedNow = serverTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: timezone });
    const statusReason = !isWorkingDay
      ? `Presensi Hari Libur / Non-Kerja (${dayScheduleInfo.holidayName || 'Jadwal Libur'})`
      : isLate
      ? `Check-In pukul ${formattedNow} (Lewat batas toleransi ${effectiveStartTime} + ${lateTolerance}m)`
      : 'Check-In tepat waktu';

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: existingDb } = await supabase
          .from('attendance_records')
          .select('*')
          .eq('user_id', userId)
          .eq('attendance_date', today)
          .maybeSingle();

        if (existingDb && (existingDb.check_in_at || existingDb.check_out_at)) {
          return {
            success: false,
            message: 'Presensi Check-In hari ini sudah tercatat atau sudah Check-Out. Tidak dapat melakukan Check-In kembali.',
            errorCode: 'DUPLICATE_CHECKIN',
          };
        }

        const id = `att-${Date.now().toString().slice(-5)}`;
        const { data: inserted, error: insErr } = await supabase
          .from('attendance_records')
          .insert({
            id,
            user_id: userId,
            attendance_date: today,
            type: attendanceType,
            check_in_at: serverTimestamp,
            check_in_latitude: coords.latitude,
            check_in_longitude: coords.longitude,
            check_in_distance_meters: geofenceResult.distanceMeters || Math.round(coords.accuracy),
            check_in_selfie_url: userFoto || null,
            status,
            dl_assignment_id: dlAssignmentId || null,
            created_at: serverTimestamp,
            updated_at: serverTimestamp,
          })
          .select('*, users(nama, foto_reference, jabatan_id, positions(nama))')
          .single();

        if (insErr) {
          if (insErr.code === '23505') {
            return {
              success: false,
              message: 'Presensi Check-In hari ini sudah tercatat. Tidak dapat melakukan Check-In kembali.',
              errorCode: 'DUPLICATE_CHECKIN',
            };
          }
          return { success: false, message: `Gagal mencatat presensi: ${insErr.message}` };
        }
        if (inserted) {
          const mapped = mapDbRecordToAttendanceRecord(inserted);
          mapped.statusReason = statusReason;
          const idx = this.records.findIndex((r) => r.id === mapped.id || (r.userId === userId && r.attendanceDate === today));
          if (idx !== -1) this.records[idx] = mapped;
          else this.records.unshift(mapped);
          return { success: true, data: mapped, message: `Presensi Masuk berhasil dicatat (${status}).` };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal mencatat presensi: ${err.message}` };
      }
    }

    const newRecord: AttendanceRecord = {
      id: `att-${Date.now().toString().slice(-5)}`,
      userId,
      userNama,
      userJabatan,
      userFoto,
      attendanceDate: today,
      checkInAt: serverTimestamp,
      checkOutAt: null,
      checkInLatitude: coords.latitude,
      checkInLongitude: coords.longitude,
      checkInAccuracy: coords.accuracy,
      checkInClientTimestamp: new Date().toISOString(),
      checkOutLatitude: null,
      checkOutLongitude: null,
      checkOutAccuracy: null,
      checkOutClientTimestamp: null,
      status,
      statusReason,
      validationResult: geofenceResult.validationResult,
      warningCode: geofenceResult.warning ? 'LOW_ACCURACY' : isLate ? 'LATE' : null,
      isCorrected: false,
      attendanceType: 'REGULAR',
      dlAssignmentId: null,
      createdAt: serverTimestamp,
      updatedAt: serverTimestamp,
    };

    if (existing) {
      const idx = this.records.findIndex((r) => r.id === existing.id);
      this.records[idx] = newRecord;
    } else {
      this.records.unshift(newRecord);
    }

    return {
      success: true,
      data: newRecord,
      message: `Presensi Masuk berhasil dicatat (${status}).`,
    };
  }

  async checkOut(
    userId: string,
    coords: { latitude: number; longitude: number; accuracy: number },
    earlyLeaveReason?: string
  ): Promise<ApiResponse<AttendanceRecord>> {
    await simulateNetworkDelay(500);

    let serverTime: Date;
    try {
      serverTime = await this.fetchServerTime();
    } catch (err: any) {
      if (!IS_DEMO_MODE) {
        return {
          success: false,
          message: err.message || 'Waktu resmi server database tidak tersedia. Check-Out ditolak.',
          errorCode: 'SERVER_TIME_ERROR',
        };
      }
      serverTime = this.getServerTime();
    }

    const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    const today = this.formatDateInTimezone(serverTime, timezone);
    const serverTimestamp = serverTime.toISOString();

    // Validasi kelengkapan dan rentang koordinat geografis
    if (
      coords == null ||
      coords.latitude == null ||
      coords.longitude == null ||
      isNaN(coords.latitude) ||
      isNaN(coords.longitude) ||
      coords.latitude < -90 ||
      coords.latitude > 90 ||
      coords.longitude < -180 ||
      coords.longitude > 180
    ) {
      return {
        success: false,
        message: 'Koordinat lokasi tidak valid atau tidak lengkap. Latitude harus di antara -90 dan 90, Longitude harus di antara -180 dan 180.',
        errorCode: 'INVALID_COORDINATES',
      };
    }

    const record = this.records.find(
      (r) => r.userId === userId && r.attendanceDate === today
    );

    if (!record || !record.checkInAt) {
      return {
        success: false,
        message: 'Anda belum melakukan Check-In hari ini. Check-Out memerlukan Check-In yang sah.',
      };
    }

    if (record.checkOutAt) {
      return {
        success: false,
        message: 'Presensi Pulang (Check-Out) sudah tercatat sebelumnya.',
      };
    }

    const isDinasLuar = record.attendanceType === 'DINAS_LUAR' || record.status === 'DINAS_LUAR';

    // Safe fail-safe guard if operating in production/non-demo and office location unconfirmed (ADR-012)
    if (!IS_DEMO_MODE && !isDinasLuar) {
      const isConfirmed = await settingsService.isOfficeCoordinatesConfirmed();
      if (!isConfirmed) {
        return {
          success: false,
          message: 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.',
          errorCode: 'OFFICE_LOCATION_UNCONFIRMED',
        };
      }
    }

    // Geofence check (hanya untuk REGULAR, DINAS_LUAR dikecualikan dari geofence kantor desa)
    if (!isDinasLuar) {
      const vRes = await masterService.getVillage();
      const villageLat = vRes.data?.latitude ?? mockVillage.latitude;
      const villageLng = vRes.data?.longitude ?? mockVillage.longitude;

      const allowedRadius = await settingsService.getNumberSetting('REGULAR_ATTENDANCE_RADIUS_METERS', 100);
      const geofenceResult = this.validateGeofence({
        latitude: coords.latitude,
        longitude: coords.longitude,
        accuracy: coords.accuracy,
        targetLatitude: villageLat,
        targetLongitude: villageLng,
        allowedRadiusMeters: allowedRadius,
      });

      if (!geofenceResult.isValid) {
        return {
          success: false,
          message: `Check-Out ditolak. Lokasi Anda berada ${geofenceResult.distanceMeters}m dari kantor desa.`,
          errorCode: 'OUT_OF_GEOFENCE',
        };
      }
    }

    const dayScheduleInfo = await settingsService.getScheduleForDate(serverTime, timezone);
    const daySchedule = dayScheduleInfo.schedule;
    const isWorkingDay = dayScheduleInfo.isWorkingDay;
    const workEndTime = (daySchedule?.endTime && daySchedule.endTime !== '00:00')
      ? daySchedule.endTime
      : (await settingsService.getStringSetting('WORK_END_TIME', '15:30'));
    const [endH, endM] = workEndTime.split(':').map(Number);

    // Compute current time from authoritative serverTime in configured timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false,
    });
    const parts = formatter.formatToParts(serverTime);
    const curH = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
    const curM = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
    const curS = Number(parts.find((p) => p.type === 'second')?.value ?? 0);

    const nowTotalMinutes = curH * 60 + curM + curS / 60;
    const endTotalMinutes = endH * 60 + endM;

    // Check early leave against scheduled shift end time
    const isEarly = nowTotalMinutes < endTotalMinutes;
    const earlyLeaveMinutes = isEarly ? Math.floor(endTotalMinutes - nowTotalMinutes) : null;

    if (!isDinasLuar && isEarly && (!earlyLeaveReason || !earlyLeaveReason.trim())) {
      const tzLabel = timezone === 'Asia/Jakarta' ? 'WIB' : timezone === 'Asia/Makassar' ? 'WITA' : timezone === 'Asia/Jayapura' ? 'WIT' : timezone;
      return {
        success: false,
        message: `Jam kerja belum selesai (pukul ${workEndTime} ${tzLabel}). Alasan pulang awal wajib diisi.`,
        errorCode: 'EARLY_LEAVE_REASON_REQUIRED',
      };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: existingDb } = await supabase
          .from('attendance_records')
          .select('*, users(nama, foto_reference, jabatan_id, positions(nama))')
          .eq('user_id', userId)
          .eq('attendance_date', today)
          .maybeSingle();

        if (!existingDb || !existingDb.check_in_at) {
          return {
            success: false,
            message: 'Anda belum melakukan Check-In hari ini. Check-Out memerlukan Check-In yang sah.',
          };
        }

        if (existingDb.check_out_at) {
          return {
            success: false,
            message: 'Presensi Pulang (Check-Out) sudah tercatat sebelumnya.',
          };
        }

        // P0 ATOMIC CONDITIONAL UPDATE: Enforce check_out_at IS NULL on database level
        const { data: updatedRows, error: upErr } = await supabase
          .from('attendance_records')
          .update({
            check_out_at: serverTimestamp,
            check_out_latitude: coords.latitude,
            check_out_longitude: coords.longitude,
            check_out_distance_meters: Math.round(coords.accuracy),
            is_early_leave: isEarly,
            early_leave_reason: isEarly ? (earlyLeaveReason?.trim() || null) : null,
            early_leave_minutes: isEarly ? earlyLeaveMinutes : null,
            updated_at: serverTimestamp,
          })
          .eq('id', existingDb.id)
          .is('check_out_at', null)
          .select('*, users(nama, foto_reference, jabatan_id, positions(nama))');

        if (upErr) {
          return { success: false, message: `Gagal mencatat check-out: ${upErr.message}`, errorCode: 'CHECKOUT_FAILED' };
        }

        if (!updatedRows || updatedRows.length === 0) {
          return {
            success: false,
            message: 'Presensi Pulang (Check-Out) gagal: record sudah di-check-out sebelumnya oleh request lain atau tidak ditemukan.',
            errorCode: 'CHECKOUT_CONFLICT',
          };
        }

        const updated = updatedRows[0];
        const mapped = mapDbRecordToAttendanceRecord(updated);
        const idx = this.records.findIndex((r) => r.id === mapped.id || (r.userId === userId && r.attendanceDate === today));
        if (idx !== -1) this.records[idx] = mapped;
        else this.records.unshift(mapped);
        return {
          success: true,
          data: mapped,
          message: isEarly
            ? `Presensi Pulang dicatat (${earlyLeaveMinutes} menit pulang awal). Status harian tetap sah ${mapped.status}.`
            : 'Presensi Pulang (Check-Out) berhasil dicatat tepat waktu.',
        };
      } catch (err: any) {
        return { success: false, message: `Gagal mencatat check-out: ${err.message}` };
      }
    }

    record.checkOutAt = serverTimestamp;
    record.checkOutLatitude = coords.latitude;
    record.checkOutLongitude = coords.longitude;
    record.checkOutAccuracy = coords.accuracy;
    record.checkOutClientTimestamp = new Date().toISOString();
    record.isEarlyLeave = isEarly;
    record.earlyLeaveReason = isEarly ? (earlyLeaveReason?.trim() || null) : null;
    record.earlyLeaveMinutes = isEarly ? earlyLeaveMinutes : null;
    record.updatedAt = serverTimestamp;

    return {
      success: true,
      data: record,
      message: isEarly
        ? `Presensi Pulang dicatat (${earlyLeaveMinutes} menit pulang awal). Status harian tetap sah ${record.status}.`
        : 'Presensi Pulang (Check-Out) berhasil dicatat tepat waktu.',
    };
  }

  applyCorrection(
    attendanceRecordId: string,
    update: {
      checkInAt: string | null;
      checkOutAt: string | null;
      status: AttendanceRecord['status'];
      correctionNote: string;
    }
  ): boolean {
    const idx = this.records.findIndex((r) => r.id === attendanceRecordId);
    if (idx !== -1) {
      const serverTimestamp = this.getServerTime().toISOString();
      this.records[idx] = {
        ...this.records[idx],
        checkInAt: update.checkInAt,
        checkOutAt: update.checkOutAt,
        status: update.status,
        isCorrected: true,
        correctionNote: update.correctionNote,
        updatedAt: serverTimestamp,
      };
      return true;
    }
    return false;
  }
}

export const attendanceService = new AttendanceService();
