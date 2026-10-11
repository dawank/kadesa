import { CorrectionRequest } from '../types/correction';
import { DailyAttendanceStatus } from '../types/attendance';
import { mockCorrectionRequests } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { attendanceService } from './attendanceService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class CorrectionService {
  private requests: CorrectionRequest[] = [...mockCorrectionRequests];

  async getCorrections(): Promise<ApiResponse<CorrectionRequest[]>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
          data: [],
        };
      }
      try {
        const { data, error } = await supabase
          .from('attendance_corrections')
          .select('*, users!attendance_corrections_user_id_fkey(nama, jabatan_id, positions(nama))')
          .order('created_at', { ascending: false });

        if (error) {
          return { success: false, message: `Gagal memuat permohonan koreksi: ${error.message}`, data: [] };
        }
        const list: CorrectionRequest[] = (data || []).map((c: any) => ({
          id: c.id,
          attendanceRecordId: c.attendance_record_id,
          userId: c.user_id,
          userNama: c.users?.nama || 'Aparatur',
          userJabatan: c.users?.positions?.nama || c.users?.jabatan_id || 'Aparatur',
          attendanceDate: c.original_check_in ? c.original_check_in.split('T')[0] : new Date().toISOString().split('T')[0],
          originalCheckIn: c.original_check_in,
          originalCheckOut: c.original_check_out,
          originalStatus: c.original_status,
          correctedCheckIn: c.corrected_check_in,
          correctedCheckOut: c.corrected_check_out,
          correctedStatus: c.corrected_status,
          reason: c.reason,
          requestedByUserId: c.requested_by,
          requestedByNama: 'Operator',
          processedByUserId: c.approved_by || '',
          processedByNama: c.approved_by ? 'Pejabat Pengesah' : '',
          processedAt: c.approved_at || '',
          appliedAt: c.applied_at,
          appliedByUserId: c.applied_by,
          state: c.state === 'APPROVED' ? 'APPROVED' : c.state === 'REJECTED' ? 'REJECTED' : 'PENDING',
          createdAt: c.created_at,
        }));
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat permohonan koreksi: ${err.message || err}`, data: [] };
      }
    }

    await simulateNetworkDelay(200);
    return { success: true, data: [...this.requests] };
  }

  async submitCorrection(
    attendanceRecordId: string,
    operatorUserId: string,
    operatorNama: string,
    data: {
      userId: string;
      userNama: string;
      userJabatan: string;
      attendanceDate: string;
      originalCheckIn: string | null;
      originalCheckOut: string | null;
      originalStatus: DailyAttendanceStatus;
      correctedCheckIn: string | null;
      correctedCheckOut: string | null;
      correctedStatus: DailyAttendanceStatus;
      reason: string;
    }
  ): Promise<ApiResponse<CorrectionRequest>> {
    if (!data.reason.trim()) {
      return { success: false, message: 'Alasan koreksi administratif wajib diisi' };
    }

    const now = new Date().toISOString();
    const id = `cor-${Date.now().toString().slice(-4)}`;

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data: inserted, error: insErr } = await supabase
          .from('attendance_corrections')
          .insert({
            id,
            attendance_record_id: attendanceRecordId,
            user_id: data.userId,
            requested_by: operatorUserId,
            original_check_in: data.originalCheckIn,
            original_check_out: data.originalCheckOut,
            original_status: data.originalStatus,
            corrected_check_in: data.correctedCheckIn,
            corrected_check_out: data.correctedCheckOut,
            corrected_status: data.correctedStatus,
            reason: data.reason,
            state: 'PENDING',
            created_at: now,
          })
          .select('*, users!attendance_corrections_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (insErr) {
          return {
            success: false,
            message: `Gagal mengajukan koreksi presensi ke database: ${insErr.message}`,
          };
        }

        if (inserted) {
          const req: CorrectionRequest = {
            id: inserted.id,
            attendanceRecordId: inserted.attendance_record_id,
            userId: inserted.user_id,
            userNama: inserted.users?.nama || data.userNama,
            userJabatan: inserted.users?.positions?.nama || inserted.users?.jabatan_id || data.userJabatan,
            attendanceDate: data.attendanceDate,
            originalCheckIn: inserted.original_check_in,
            originalCheckOut: inserted.original_check_out,
            originalStatus: inserted.original_status,
            correctedCheckIn: inserted.corrected_check_in,
            correctedCheckOut: inserted.corrected_check_out,
            correctedStatus: inserted.corrected_status,
            reason: inserted.reason,
            requestedByUserId: inserted.requested_by,
            requestedByNama: operatorNama,
            processedByUserId: '',
            processedByNama: '',
            processedAt: '',
            appliedAt: null,
            appliedByUserId: null,
            state: 'PENDING',
            createdAt: inserted.created_at,
          };
          return {
            success: true,
            data: req,
            message: 'Pengajuan koreksi presensi berhasil dibuat (Status: PENDING) dan menunggu persetujuan pejabat berwenang.',
          };
        }
        return { success: false, message: 'Gagal mengajukan koreksi presensi' };
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal mengajukan koreksi: ${err.message || err}`,
        };
      }
    }

    await simulateNetworkDelay(400);

    const newReq: CorrectionRequest = {
      id,
      attendanceRecordId,
      userId: data.userId,
      userNama: data.userNama,
      userJabatan: data.userJabatan,
      attendanceDate: data.attendanceDate,
      originalCheckIn: data.originalCheckIn,
      originalCheckOut: data.originalCheckOut,
      originalStatus: data.originalStatus,
      correctedCheckIn: data.correctedCheckIn,
      correctedCheckOut: data.correctedCheckOut,
      correctedStatus: data.correctedStatus,
      reason: data.reason,
      requestedByUserId: operatorUserId,
      requestedByNama: operatorNama,
      processedByUserId: '',
      processedByNama: '',
      processedAt: '',
      appliedAt: null,
      appliedByUserId: null,
      state: 'PENDING',
      createdAt: now,
    };

    this.requests.unshift(newReq);

    return {
      success: true,
      data: newReq,
      message: 'Pengajuan koreksi presensi berhasil dibuat (Status: PENDING) dan menunggu persetujuan pejabat berwenang.',
    };
  }

  async approveCorrection(
    correctionId: string,
    approverUserId: string,
    approverNama: string
  ): Promise<ApiResponse<CorrectionRequest>> {
    const now = new Date().toISOString();

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        // Eksekusi Persetujuan Koreksi & Penerapan Presensi Secara Atomik di Database via RPC
        const { data: rpcResult, error: appErr } = await supabase.rpc('apply_attendance_correction', {
          p_correction_id: correctionId,
        });

        if (appErr) {
          return { success: false, message: `Gagal menyetujui dan menerapkan koreksi: ${appErr.message}` };
        }
        if (!rpcResult?.success) {
          return { success: false, message: 'Database tidak mengonfirmasi penerapan koreksi.' };
        }

        // Ambil data hasil pembaruan untuk pemetaan objek dan sinkronisasi cache
        const { data: approvedCorr, error: fetchErr } = await supabase
          .from('attendance_corrections')
          .select('*, users!attendance_corrections_user_id_fkey(nama, jabatan_id, positions(nama))')
          .eq('id', correctionId)
          .single();

        if (fetchErr || !approvedCorr || !approvedCorr.applied_at || !approvedCorr.applied_by) {
          return { success: false, message: 'Koreksi belum terkonfirmasi diterapkan oleh database.' };
        }

        attendanceService.applyCorrection(approvedCorr.attendance_record_id, {
          checkInAt: approvedCorr.corrected_check_in,
          checkOutAt: approvedCorr.corrected_check_out,
          status: approvedCorr.corrected_status,
          correctionNote: `Disetujui oleh ${approverNama}: ${approvedCorr.reason}`,
        });

        const mapped: CorrectionRequest = {
          id: approvedCorr.id,
          attendanceRecordId: approvedCorr.attendance_record_id,
          userId: approvedCorr.user_id,
          userNama: approvedCorr.users?.nama || 'Aparatur',
          userJabatan: approvedCorr.users?.positions?.nama || approvedCorr.users?.jabatan_id || 'Aparatur',
          attendanceDate: approvedCorr.original_check_in ? approvedCorr.original_check_in.split('T')[0] : now.split('T')[0],
          originalCheckIn: approvedCorr.original_check_in,
          originalCheckOut: approvedCorr.original_check_out,
          originalStatus: approvedCorr.original_status,
          correctedCheckIn: approvedCorr.corrected_check_in,
          correctedCheckOut: approvedCorr.corrected_check_out,
          correctedStatus: approvedCorr.corrected_status,
          reason: approvedCorr.reason,
          requestedByUserId: approvedCorr.requested_by,
          requestedByNama: 'Operator',
          processedByUserId: approvedCorr.approved_by || approverUserId,
          processedByNama: approverNama,
          processedAt: approvedCorr.approved_at || now,
          appliedAt: approvedCorr.applied_at || now,
          appliedByUserId: approvedCorr.applied_by || approverUserId,
          state: 'APPROVED',
          createdAt: approvedCorr.created_at,
        };

        return { success: true, data: mapped, message: 'Koreksi presensi berhasil disetujui dan diterapkan secara atomik.' };
      } catch (err: any) {
        return { success: false, message: `Gagal menyetujui koreksi: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const item = this.requests.find((r) => r.id === correctionId);
    if (!item) return { success: false, message: 'Permohonan koreksi tidak ditemukan.' };

    if (item.state !== 'PENDING') {
      return { success: false, message: `Hanya permohonan berstatus PENDING yang dapat disetujui (Status saat ini: ${item.state}).` };
    }

    if (item.requestedByUserId === approverUserId || item.userId === approverUserId) {
      return {
        success: false,
        message: 'Konflik kepentingan: Pemohon atau aparatur terkait dilarang menyetujui koreksi presensinya sendiri.',
      };
    }

    item.state = 'APPROVED';
    item.processedByUserId = approverUserId;
    item.processedByNama = approverNama;
    item.processedAt = now;
    item.appliedAt = now;
    item.appliedByUserId = approverUserId;

    attendanceService.applyCorrection(item.attendanceRecordId, {
      checkInAt: item.correctedCheckIn,
      checkOutAt: item.correctedCheckOut,
      status: item.correctedStatus,
      correctionNote: `Disetujui oleh ${approverNama}: ${item.reason}`,
    });

    return { success: true, data: item, message: 'Koreksi presensi berhasil disetujui dan diterapkan.' };
  }

  async rejectCorrection(
    correctionId: string,
    rejectorUserId: string,
    rejectorNama: string,
    _rejectionReason?: string
  ): Promise<ApiResponse<CorrectionRequest>> {
    const now = new Date().toISOString();

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data: rejectedCorr, error: rejErr } = await supabase
          .from('attendance_corrections')
          .update({
            state: 'REJECTED',
            approved_by: rejectorUserId,
            approved_at: now,
          })
          .eq('id', correctionId)
          .select('*, users!attendance_corrections_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (rejErr) {
          return { success: false, message: `Gagal menolak koreksi: ${rejErr.message}` };
        }

        const mapped: CorrectionRequest = {
          id: rejectedCorr.id,
          attendanceRecordId: rejectedCorr.attendance_record_id,
          userId: rejectedCorr.user_id,
          userNama: rejectedCorr.users?.nama || 'Aparatur',
          userJabatan: rejectedCorr.users?.positions?.nama || rejectedCorr.users?.jabatan_id || 'Aparatur',
          attendanceDate: rejectedCorr.original_check_in ? rejectedCorr.original_check_in.split('T')[0] : now.split('T')[0],
          originalCheckIn: rejectedCorr.original_check_in,
          originalCheckOut: rejectedCorr.original_check_out,
          originalStatus: rejectedCorr.original_status,
          correctedCheckIn: rejectedCorr.corrected_check_in,
          correctedCheckOut: rejectedCorr.corrected_check_out,
          correctedStatus: rejectedCorr.corrected_status,
          reason: rejectedCorr.reason,
          requestedByUserId: rejectedCorr.requested_by,
          requestedByNama: 'Operator',
          processedByUserId: rejectorUserId,
          processedByNama: rejectorNama,
          processedAt: now,
          appliedAt: null,
          appliedByUserId: null,
          state: 'REJECTED',
          createdAt: rejectedCorr.created_at,
        };

        return { success: true, data: mapped, message: 'Permohonan koreksi presensi telah ditolak.' };
      } catch (err: any) {
        return { success: false, message: `Gagal menolak koreksi: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const item = this.requests.find((r) => r.id === correctionId);
    if (!item) return { success: false, message: 'Permohonan koreksi tidak ditemukan.' };
    item.state = 'REJECTED';
    item.processedByUserId = rejectorUserId;
    item.processedByNama = rejectorNama;
    item.processedAt = now;

    return { success: true, data: item, message: 'Permohonan koreksi presensi telah ditolak.' };
  }
}

export const correctionService = new CorrectionService();
