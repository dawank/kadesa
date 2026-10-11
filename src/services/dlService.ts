import {
  DLAssignment,
  DLState,
  DLLocation,
  DLEvidence,
} from '../types/dl';
import { mockDLAssignments, mockVillage } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { calculateHaversineDistanceMeters } from './attendanceService';
import { settingsService } from './settingsService';
import { masterService } from './masterService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

export function mapDbRowToDLAssignment(row: any): DLAssignment {
  const locations: DLLocation[] = (row.dl_locations || []).map((l: any) => ({
    id: l.id,
    dlAssignmentId: l.dl_assignment_id,
    namaLokasi: l.nama_lokasi,
    latitude: Number(l.latitude),
    longitude: Number(l.longitude),
    radius: Number(l.radius_meters || 100),
    active: l.active ?? true,
  }));

  const evidence: DLEvidence[] = (row.dl_evidence || []).map((e: any) => ({
    id: e.id,
    dlAssignmentId: e.dl_assignment_id,
    type: e.type,
    storageReference: e.storage_reference,
    latitude: Number(e.latitude),
    longitude: Number(e.longitude),
    accuracy: Number(e.accuracy_meters || 0),
    clientTimestamp: e.client_timestamp,
    serverTimestamp: e.server_timestamp,
    retentionUntil: '',
    createdAt: e.created_at,
  }));

  const hasCheckIn = evidence.some((e) => e.type === 'CHECK_IN');
  const hasCheckOut = evidence.some((e) => e.type === 'CHECK_OUT');

  return {
    id: row.id,
    nomorSuratTugas: row.nomor_surat,
    subjectUserId: row.subject_user_id,
    subjectUserNama: row.subject?.nama || 'Aparatur',
    subjectUserJabatan: row.subject?.positions?.nama || row.subject?.jabatan_id || 'Aparatur',
    requesterUserId: row.requester_user_id,
    requesterUserNama: row.requester?.nama || 'Pemohon',
    requesterUserRole: row.requester?.role || 'PERANGKAT_DESA',
    purpose: row.purpose,
    startDate: row.start_date,
    endDate: row.end_date,
    state: row.state,
    ratificationDeadline: row.ratification_deadline,
    locations,
    evidence,
    approvalHistory: [],
    hasCheckedIn: hasCheckIn,
    hasCheckedOut: hasCheckOut,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

class DLService {
  private assignments: DLAssignment[] = [...mockDLAssignments];

  async getAssignments(status?: DLState | 'ALL', userId?: string): Promise<ApiResponse<DLAssignment[]>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('dl_assignments')
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .order('created_at', { ascending: false });

        if (userId) {
          query = query.or(`subject_user_id.eq.${userId},requester_user_id.eq.${userId}`);
        }
        if (status && status !== 'ALL') {
          query = query.eq('state', status);
        }

        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat tugas Dinas Luar: ${error.message}`, data: [] };
        }
        if (data) {
          const list = data.map(mapDbRowToDLAssignment);
          return { success: true, data: list };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat tugas Dinas Luar: ${err.message || err}`, data: [] };
      }
    }

    await simulateNetworkDelay(250);
    let list = [...this.assignments];

    if (userId) {
      list = list.filter((a) => a.subjectUserId === userId || a.requesterUserId === userId);
    }
    if (status && status !== 'ALL') {
      list = list.filter((a) => a.state === status);
    }

    return { success: true, data: list };
  }

  async getAssignmentById(id: string): Promise<ApiResponse<DLAssignment>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase
          .from('dl_assignments')
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .eq('id', id)
          .single();

        if (error) {
          return { success: false, message: `Gagal memuat detail Dinas Luar: ${error.message}` };
        }
        if (data) {
          return { success: true, data: mapDbRowToDLAssignment(data) };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat detail Dinas Luar: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(200);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'Surat tugas Dinas Luar tidak ditemukan' };
    return { success: true, data: item };
  }

  async createAssignment(
    requesterUserId: string,
    requesterUserNama: string,
    requesterUserRole: string,
    data: {
      subjectUserId: string;
      subjectUserNama: string;
      subjectUserJabatan: string;
      purpose: string;
      startDate: string;
      endDate: string;
      locations: Array<{ namaLokasi: string; latitude: number; longitude: number; radius: number }>;
    }
  ): Promise<ApiResponse<DLAssignment>> {
    if (!data.purpose.trim() || data.locations.length === 0) {
      return { success: false, message: 'Tujuan kegiatan dan minimal satu lokasi penugasan wajib diisi' };
    }

    const minRadius = await settingsService.getNumberSetting('DL_MIN_RADIUS_METERS', 25);
    const maxRadius = await settingsService.getNumberSetting('DL_MAX_RADIUS_METERS', 500);

    const validatedLocations: DLLocation[] = data.locations.map((loc, idx) => ({
      id: `loc-${Date.now()}-${idx}`,
      namaLokasi: loc.namaLokasi,
      latitude: loc.latitude,
      longitude: loc.longitude,
      radius: Math.max(minRadius, Math.min(maxRadius, loc.radius || 100)),
      active: true,
    }));

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const id = `dla-${Date.now().toString().slice(-6)}`;
        const nomorSurat = `${Math.floor(100 + Math.random() * 900)}/ST-DL/SKM/${new Date().getMonth() + 1}/${new Date().getFullYear()}`;
        const { data: newDlRow, error: dlErr } = await supabase
          .from('dl_assignments')
          .insert({
            id,
            nomor_surat: nomorSurat,
            subject_user_id: data.subjectUserId,
            requester_user_id: requesterUserId,
            purpose: data.purpose,
            start_date: data.startDate,
            end_date: data.endDate,
            state: 'PENDING',
          })
          .select(`
            *,
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (dlErr) {
          return { success: false, message: `Gagal membuat penugasan DL: ${dlErr.message}` };
        }

        if (newDlRow) {
          const locsToInsert = validatedLocations.map((loc) => ({
            id: loc.id,
            dl_assignment_id: id,
            nama_lokasi: loc.namaLokasi,
            latitude: loc.latitude,
            longitude: loc.longitude,
            radius_meters: loc.radius,
            active: true,
          }));
          await supabase.from('dl_locations').insert(locsToInsert);
          newDlRow.dl_locations = locsToInsert;
          const mapped = mapDbRowToDLAssignment(newDlRow);
          this.assignments.unshift(mapped);
          return { success: true, data: mapped, message: 'Pengajuan Dinas Luar berhasil dibuat (Menunggu Verifikasi)' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal membuat penugasan DL: ${err.message}` };
      }
    }

    await simulateNetworkDelay(400);
    const newDL: DLAssignment = {
      id: `dl-${Date.now().toString().slice(-4)}`,
      nomorSuratTugas: `${Math.floor(100 + Math.random() * 900)}/ST-DL/SKM/${new Date().getMonth() + 1}/${new Date().getFullYear()}`,
      subjectUserId: data.subjectUserId,
      subjectUserNama: data.subjectUserNama,
      subjectUserJabatan: data.subjectUserJabatan,
      requesterUserId,
      requesterUserNama,
      requesterUserRole,
      purpose: data.purpose,
      startDate: data.startDate,
      endDate: data.endDate,
      state: 'PENDING',
      ratificationDeadline: null,
      locations: validatedLocations,
      evidence: [],
      approvalHistory: [
        {
          id: `h-${Date.now()}`,
          fromState: 'PENDING',
          toState: 'PENDING',
          actorUserId: requesterUserId,
          actorNama: requesterUserNama,
          actorRole: requesterUserRole,
          reason: 'Pengajuan Dinas Luar dibuat',
          createdAt: new Date().toISOString(),
        },
      ],
      hasCheckedIn: false,
      hasCheckedOut: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.assignments.unshift(newDL);
    return { success: true, data: newDL, message: 'Pengajuan Dinas Luar berhasil dibuat (Menunggu Verifikasi)' };
  }

  async verifyAssignment(
    id: string,
    actorUserId: string,
    actorNama: string,
    actorRole: string,
    notes?: string
  ): Promise<ApiResponse<DLAssignment>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('dl_assignments')
          .update({
            state: 'VERIFIED',
            verified_by: actorUserId,
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (!error && updated) {
          const mapped = mapDbRowToDLAssignment(updated);
          const idx = this.assignments.findIndex((a) => a.id === id);
          if (idx !== -1) this.assignments[idx] = mapped;
          return { success: true, data: mapped, message: 'Dinas Luar berhasil diverifikasi' };
        }
      } catch (err) {
        console.warn('Supabase verifyAssignment error:', err);
      }
    }

    await simulateNetworkDelay(400);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };
    if (item.state !== 'PENDING') {
      return { success: false, message: `Hanya status PENDING yang dapat diverifikasi (Status saat ini: ${item.state})` };
    }

    item.state = 'VERIFIED';
    item.updatedAt = new Date().toISOString();
    item.approvalHistory.push({
      id: `h-${Date.now()}`,
      fromState: 'PENDING',
      toState: 'VERIFIED',
      actorUserId,
      actorNama,
      actorRole,
      reason: notes || 'Diverifikasi sesuai berkas tugas',
      createdAt: new Date().toISOString(),
    });

    return { success: true, data: item, message: 'Dinas Luar berhasil diverifikasi' };
  }

  async approveAssignment(
    id: string,
    actorUserId: string,
    actorNama: string,
    actorRole: string,
    notes?: string
  ): Promise<ApiResponse<DLAssignment>> {
    const deadlineHours = await settingsService.getNumberSetting('DL_RATIFICATION_DEADLINE_HOURS', 72);
    const deadline = new Date(Date.now() + deadlineHours * 3600 * 1000).toISOString();

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('dl_assignments')
          .update({
            state: 'APPROVED',
            approved_by: actorUserId,
            approved_at: new Date().toISOString(),
            ratification_deadline: deadline,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (!error && updated) {
          const mapped = mapDbRowToDLAssignment(updated);
          const idx = this.assignments.findIndex((a) => a.id === id);
          if (idx !== -1) this.assignments[idx] = mapped;
          return { success: true, data: mapped, message: `Dinas Luar disetujui (Batas ratifikasi ${deadlineHours} jam)` };
        }
      } catch (err) {
        console.warn('Supabase approveAssignment error:', err);
      }
    }

    await simulateNetworkDelay(400);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };

    if (item.state === 'REJECTED' || item.state === 'CANCELLED' || item.state === 'RATIFIED') {
      return {
        success: false,
        message: `Surat tugas Dinas Luar dengan status ${item.state} tidak dapat disetujui.`,
      };
    }

    // Sekdes or Operator requires VERIFIED. Kepala Desa can approve directly from PENDING or VERIFIED.
    if (actorRole !== 'KEPALA_DESA' && item.state !== 'VERIFIED') {
      return {
        success: false,
        message: `Dinas Luar harus berstatus VERIFIED sebelum dapat disetujui oleh ${actorRole}.`,
      };
    }

    const fromState = item.state;
    item.state = 'APPROVED';
    item.ratificationDeadline = deadline;
    item.updatedAt = new Date().toISOString();

    item.approvalHistory.push({
      id: `h-${Date.now()}`,
      fromState,
      toState: 'APPROVED',
      actorUserId,
      actorNama,
      actorRole,
      reason: notes || `Disetujui. Batas waktu ratifikasi Kades: ${deadlineHours} jam.`,
      createdAt: new Date().toISOString(),
    });

    return { success: true, data: item, message: `Dinas Luar disetujui (Batas ratifikasi ${deadlineHours} jam)` };
  }

  async ratifyAssignment(
    id: string,
    actorUserId: string,
    actorNama: string,
    actorRole: string,
    notes?: string
  ): Promise<ApiResponse<DLAssignment>> {
    // STRICT PRD 12.3: Only KEPALA_DESA can ratify
    if (actorRole !== 'KEPALA_DESA') {
      return { success: false, message: 'Hanya Kepala Desa yang berwenang meratifikasi Dinas Luar.' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('dl_assignments')
          .update({
            state: 'RATIFIED',
            ratified_by: actorUserId,
            ratified_at: new Date().toISOString(),
            ratification_deadline: null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (!error && updated) {
          const mapped = mapDbRowToDLAssignment(updated);
          const idx = this.assignments.findIndex((a) => a.id === id);
          if (idx !== -1) this.assignments[idx] = mapped;
          return { success: true, data: mapped, message: 'Dinas Luar berhasil diratifikasi oleh Kepala Desa' };
        }
      } catch (err) {
        console.warn('Supabase ratifyAssignment error:', err);
      }
    }

    await simulateNetworkDelay(400);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };

    if (item.state === 'REJECTED' || item.state === 'CANCELLED') {
      return {
        success: false,
        message: `Surat tugas Dinas Luar dengan status ${item.state} tidak dapat diratifikasi.`,
      };
    }

    const fromState = item.state;
    item.state = 'RATIFIED';
    item.ratificationDeadline = null;
    item.updatedAt = new Date().toISOString();

    item.approvalHistory.push({
      id: `h-${Date.now()}`,
      fromState,
      toState: 'RATIFIED',
      actorUserId,
      actorNama,
      actorRole,
      reason: notes || 'Diratifikasi secara sah oleh Kepala Desa',
      createdAt: new Date().toISOString(),
    });

    return { success: true, data: item, message: 'Dinas Luar berhasil diratifikasi oleh Kepala Desa' };
  }

  async rejectAssignment(
    id: string,
    actorUserId: string,
    actorNama: string,
    actorRole: string,
    reason: string
  ): Promise<ApiResponse<DLAssignment>> {
    if (!reason || !reason.trim()) {
      return { success: false, message: 'Alasan penolakan wajib diisi' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('dl_assignments')
          .update({
            state: 'REJECTED',
            rejection_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (!error && updated) {
          const mapped = mapDbRowToDLAssignment(updated);
          const idx = this.assignments.findIndex((a) => a.id === id);
          if (idx !== -1) this.assignments[idx] = mapped;
          return { success: true, data: mapped, message: 'Pengajuan Dinas Luar telah ditolak' };
        }
      } catch (err) {
        console.warn('Supabase rejectAssignment error:', err);
      }
    }

    await simulateNetworkDelay(400);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };

    if (item.state === 'CANCELLED' || item.state === 'RATIFIED') {
      return {
        success: false,
        message: `Surat tugas Dinas Luar dengan status ${item.state} tidak dapat ditolak.`,
      };
    }

    if (item.hasCheckedIn) {
      return {
        success: false,
        message: 'Surat tugas tidak dapat ditolak karena presensi kehadiran telah dicatat.',
      };
    }

    const fromState = item.state;
    item.state = 'REJECTED';
    item.rejectionReason = reason;
    item.updatedAt = new Date().toISOString();

    item.approvalHistory.push({
      id: `h-${Date.now()}`,
      fromState,
      toState: 'REJECTED',
      actorUserId,
      actorNama,
      actorRole,
      reason,
      createdAt: new Date().toISOString(),
    });

    return { success: true, data: item, message: 'Pengajuan Dinas Luar telah ditolak' };
  }

  async cancelAssignment(
    id: string,
    actorUserId: string,
    actorNama: string,
    actorRole: string,
    reason: string
  ): Promise<ApiResponse<DLAssignment>> {
    if (!reason || !reason.trim()) {
      return { success: false, message: 'Alasan pembatalan wajib diisi' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('dl_assignments')
          .update({
            state: 'CANCELLED',
            cancellation_reason: reason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select(`
            *,
            dl_locations(*),
            dl_evidence(*),
            subject:users!dl_assignments_subject_user_id_fkey(nama, jabatan_id, positions(nama)),
            requester:users!dl_assignments_requester_user_id_fkey(nama, role)
          `)
          .single();

        if (!error && updated) {
          const mapped = mapDbRowToDLAssignment(updated);
          const idx = this.assignments.findIndex((a) => a.id === id);
          if (idx !== -1) this.assignments[idx] = mapped;
          return { success: true, data: mapped, message: 'Dinas Luar berhasil dibatalkan' };
        }
      } catch (err) {
        console.warn('Supabase cancelAssignment error:', err);
      }
    }

    await simulateNetworkDelay(400);
    const item = this.assignments.find((a) => a.id === id);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };

    if (item.state === 'CANCELLED' || item.state === 'REJECTED') {
      return {
        success: false,
        message: `Surat tugas Dinas Luar sudah berstatus ${item.state}.`,
      };
    }

    if (item.hasCheckedIn) {
      return {
        success: false,
        message: 'Dinas Luar tidak dapat dibatalkan karena presensi kehadiran telah dicatat.',
      };
    }

    const fromState = item.state;
    item.state = 'CANCELLED';
    item.updatedAt = new Date().toISOString();

    item.approvalHistory.push({
      id: `h-${Date.now()}`,
      fromState,
      toState: 'CANCELLED',
      actorUserId,
      actorNama,
      actorRole,
      reason,
      createdAt: new Date().toISOString(),
    });

    return { success: true, data: item, message: 'Dinas Luar berhasil dibatalkan' };
  }

  /**
   * DL Attendance Check-In with mandatory GPS & Selfie Evidence
   */
  async submitDLAttendance(
    dlId: string,
    type: 'CHECK_IN' | 'CHECK_OUT',
    coords: { latitude: number; longitude: number; accuracy: number },
    selfieBase64: string,
    earlyReason?: string
  ): Promise<ApiResponse<DLAssignment>> {
    await simulateNetworkDelay(600);
    const item = this.assignments.find((a) => a.id === dlId);
    if (!item) return { success: false, message: 'DL tidak ditemukan' };

    if (item.state !== 'APPROVED' && item.state !== 'RATIFIED' && item.state !== 'RATIFICATION_OVERDUE') {
      return { success: false, message: 'Dinas Luar belum disetujui (Status harus APPROVED atau RATIFIED)' };
    }

    // STRICT PRD 14.1: Mandatory selfie evidence for DL attendance
    if (!selfieBase64 || !selfieBase64.trim()) {
      return {
        success: false,
        message: 'Presensi Dinas Luar mewajibkan bukti foto selfie.',
        errorCode: 'SELFIE_REQUIRED',
      };
    }

    if (type === 'CHECK_IN' && item.hasCheckedIn) {
      return { success: false, message: 'Check-In Dinas Luar sudah dilakukan' };
    }
    if (type === 'CHECK_OUT' && !item.hasCheckedIn) {
      return { success: false, message: 'Check-Out memerlukan Check-In yang sah terlebih dahulu' };
    }
    if (type === 'CHECK_OUT' && item.hasCheckedOut) {
      return { success: false, message: 'Check-Out Dinas Luar sudah tercatat' };
    }

    // File size constraint validation (default 5MB)
    const maxMb = await settingsService.getNumberSetting('MAX_SELFIE_FILE_SIZE_MB', 5);
    const approxBytes = (selfieBase64.length * 3) / 4;
    if (approxBytes > maxMb * 1024 * 1024) {
      return {
        success: false,
        message: `Ukuran foto selfie melebihi batas maksimal ${maxMb}MB.`,
        errorCode: 'FILE_SIZE_EXCEEDED',
      };
    }

    // Check early leave for DL checkout before standard shift ends
    let isEarly = false;
    if (type === 'CHECK_OUT') {
      const workEndTime = await settingsService.getStringSetting('WORK_END_TIME', '15:30');
      const [endH, endM] = workEndTime.split(':').map(Number);
      const nowTime = new Date();
      const endShift = new Date();
      endShift.setHours(endH, endM, 0, 0);

      isEarly = nowTime < endShift;
      if (isEarly && (!earlyReason || !earlyReason.trim())) {
        return {
          success: false,
          message: `Jam kerja belum selesai (pukul ${workEndTime}). Alasan kepulangan awal tugas DL wajib diisi.`,
          errorCode: 'EARLY_LEAVE_REASON_REQUIRED',
        };
      }
    }

    // Geofence verification against any active DL location (or village office if check-out)
    let isInsideAnyLocation = false;
    let closestDistance = Infinity;

    for (const loc of item.locations.filter((l) => l.active)) {
      const d = calculateHaversineDistanceMeters(coords.latitude, coords.longitude, loc.latitude, loc.longitude);
      if (d < closestDistance) closestDistance = d;
      if (d <= loc.radius) {
        isInsideAnyLocation = true;
        break;
      }
    }

    // Check-out may also be done at the village office (PRD Section 14.2)
    if (type === 'CHECK_OUT' && !isInsideAnyLocation) {
      const officeDist = calculateHaversineDistanceMeters(
        coords.latitude,
        coords.longitude,
        mockVillage.latitude,
        mockVillage.longitude
      );
      if (officeDist <= 100) {
        isInsideAnyLocation = true;
      }
    }

    if (!isInsideAnyLocation) {
      return {
        success: false,
        message: `Lokasi Anda berada ${closestDistance}m dari titik lokasi tugas DL terdekat. Di luar radius yang diizinkan.`,
      };
    }

    let serverTimestamp = new Date().toISOString();
    let today = serverTimestamp.split('T')[0];

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: stData } = await supabase.rpc('get_server_time');
        if (stData) {
          serverTimestamp = new Date(stData).toISOString();
        }
      } catch (e) {
        // fallback to serverTimestamp
      }

      const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
      try {
        today = new Intl.DateTimeFormat('en-CA', {
          timeZone: timezone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        }).format(new Date(serverTimestamp));
      } catch {
        today = serverTimestamp.split('T')[0];
      }

      // 1. Upload selfie image to Supabase Private Storage bucket 'dl-evidence'
      const filePath = `${dlId}/${type.toLowerCase()}_${Date.now()}.jpg`;
      const blob = this.base64ToBlob(selfieBase64, 'image/jpeg');

      const { error: uploadError } = await supabase.storage
        .from('dl-evidence')
        .upload(filePath, blob, { contentType: 'image/jpeg', upsert: false });

      if (uploadError) {
        return {
          success: false,
          message: `Gagal mengunggah foto bukti selfie ke private storage: ${uploadError.message}`,
          errorCode: 'STORAGE_UPLOAD_FAILED',
        };
      }

      let attRecordId: string;

      if (type === 'CHECK_IN') {
        attRecordId = `att-dl-${Date.now().toString().slice(-5)}`;
        const { error: attErr } = await supabase
          .from('attendance_records')
          .insert({
            id: attRecordId,
            user_id: item.subjectUserId,
            attendance_date: today,
            type: 'DINAS_LUAR',
            check_in_at: serverTimestamp,
            check_in_latitude: coords.latitude,
            check_in_longitude: coords.longitude,
            check_in_distance_meters: Math.round(coords.accuracy),
            check_in_selfie_url: filePath,
            status: 'DINAS_LUAR',
            dl_assignment_id: dlId,
            created_at: serverTimestamp,
            updated_at: serverTimestamp,
          });

        if (attErr) {
          await supabase.storage.from('dl-evidence').remove([filePath]);
          return {
            success: false,
            message: `Gagal mencatat transaksi presensi DL di database: ${attErr.message}`,
            errorCode: 'DB_INSERT_FAILED',
          };
        }
      } else {
        // CHECK_OUT
        const { data: updatedAtt, error: attUpErr } = await supabase
          .from('attendance_records')
          .update({
            check_out_at: serverTimestamp,
            check_out_latitude: coords.latitude,
            check_out_longitude: coords.longitude,
            check_out_distance_meters: Math.round(coords.accuracy),
            check_out_selfie_url: filePath,
            is_early_leave: isEarly,
            early_leave_reason: isEarly ? (earlyReason?.trim() || null) : null,
            updated_at: serverTimestamp,
          })
          .eq('dl_assignment_id', dlId)
          .is('check_out_at', null)
          .select('id');

        if (attUpErr || !updatedAtt || updatedAtt.length === 0) {
          await supabase.storage.from('dl-evidence').remove([filePath]);
          return {
            success: false,
            message: 'Gagal mencatat check-out DL: Rekam presensi masuk tidak ditemukan atau sudah check-out.',
            errorCode: 'CHECKOUT_CONFLICT',
          };
        }
        attRecordId = updatedAtt[0].id;
      }

      // Record to dl_evidence
      const evId = `ev-${Date.now().toString().slice(-5)}`;
      const { error: evErr } = await supabase
        .from('dl_evidence')
        .insert({
          id: evId,
          dl_assignment_id: dlId,
          attendance_record_id: attRecordId,
          type,
          storage_reference: filePath,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: Math.round(coords.accuracy),
          client_timestamp: new Date().toISOString(),
          server_timestamp: serverTimestamp,
          created_at: serverTimestamp,
        });

      if (evErr) {
        console.warn('Gagal mencatat dl_evidence row:', evErr.message);
      }

      // Re-fetch updated assignment from Supabase
      const freshRes = await this.getAssignmentById(dlId);
      if (freshRes.success && freshRes.data) {
        const idx = this.assignments.findIndex((a) => a.id === dlId);
        if (idx !== -1) this.assignments[idx] = freshRes.data;
        return {
          success: true,
          data: freshRes.data,
          message: `Presensi ${type === 'CHECK_IN' ? 'Masuk' : 'Pulang'} Dinas Luar berhasil dicatat beserta bukti foto selfie ke Storage.`,
        };
      }
    }

    const now = new Date().toISOString();
    const newEvidence: DLEvidence = {
      id: `ev-${Date.now()}`,
      dlAssignmentId: item.id,
      type,
      storageReference: selfieBase64,
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      clientTimestamp: now,
      serverTimestamp: now,
      retentionUntil: new Date(Date.now() + 2 * 365 * 24 * 3600 * 1000).toISOString(),
      createdAt: now,
    };

    if (!item.evidence) item.evidence = [];
    item.evidence.push(newEvidence);

    if (type === 'CHECK_IN') {
      item.hasCheckedIn = true;
      item.checkInTime = now;
    } else {
      item.hasCheckedOut = true;
      item.checkOutTime = now;
    }

    item.updatedAt = now;

    return {
      success: true,
      data: item,
      message: `Presensi ${type === 'CHECK_IN' ? 'Masuk' : 'Pulang'} Dinas Luar berhasil dicatat beserta bukti foto selfie.`,
    };
  }

  base64ToBlob(base64Data: string, contentType = 'image/jpeg'): Blob {
    const parts = base64Data.split(';base64,');
    const raw = parts.length > 1 ? parts[1] : parts[0];
    const byteCharacters = atob(raw);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }

  async getEvidenceSignedUrl(storageReference: string, expiresInSeconds = 3600): Promise<string> {
    if (!storageReference) return '';
    if (
      storageReference.startsWith('data:') ||
      storageReference.startsWith('http://') ||
      storageReference.startsWith('https://')
    ) {
      return storageReference;
    }
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.storage
          .from('dl-evidence')
          .createSignedUrl(storageReference, expiresInSeconds);
        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err) {
        console.warn('Gagal membuat signed URL untuk evidence:', err);
      }
    }
    return storageReference;
  }
}

export const dlService = new DLService();
