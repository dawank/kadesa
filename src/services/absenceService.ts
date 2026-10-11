import {
  AbsenceRequest,
  AbsenceType,
  AbsenceState,
  LeaveRequest,
  LeaveType,
  LeaveState,
} from '../types/absence';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class AbsenceService {
  private absences: AbsenceRequest[] = [];
  private leaves: LeaveRequest[] = [];

  /**
   * Khusus isolasi unit test offline
   */
  seedTestFixtures(fixtures: { absences?: AbsenceRequest[]; leaves?: LeaveRequest[] }): void {
    if (fixtures.absences) this.absences = [...fixtures.absences];
    if (fixtures.leaves) this.leaves = [...fixtures.leaves];
  }

  // --- IZIN & SAKIT ---
  async getAbsences(userId?: string, state?: AbsenceState | 'ALL'): Promise<ApiResponse<AbsenceRequest[]>> {
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
        let query = supabase
          .from('absence_requests')
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .in('type', ['IZIN', 'SAKIT'])
          .order('created_at', { ascending: false });

        if (userId) query = query.eq('user_id', userId);
        if (state && state !== 'ALL') {
          const dbState = state === 'PENDING' ? 'SUBMITTED' : state;
          query = query.eq('state', dbState);
        }

        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat data izin/sakit: ${error.message}`, data: [] };
        }
        const list: AbsenceRequest[] = (data || []).map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userNama: r.user?.nama || 'Aparatur',
          userJabatan: r.user?.positions?.nama || r.user?.jabatan_id || 'Aparatur',
          type: r.type as AbsenceType,
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          attachmentUrl: r.attachment_url,
          state: r.state === 'SUBMITTED' ? 'PENDING' : r.state,
          processedByUserId: r.approved_by || r.verified_by,
          processedAt: r.approved_at || r.verified_at,
          rejectionReason: r.rejection_reason,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat data izin/sakit: ${err.message || err}`, data: [] };
      }
    }

    await simulateNetworkDelay(200);
    let list = [...this.absences];
    if (userId) {
      list = list.filter((a) => a.userId === userId);
    }
    if (state && state !== 'ALL') {
      list = list.filter((a) => a.state === state);
    }
    return { success: true, data: list };
  }

  async submitAbsence(
    userId: string,
    userNama: string,
    userJabatan: string,
    type: AbsenceType,
    startDate: string,
    endDate: string,
    reason: string,
    attachmentName?: string
  ): Promise<ApiResponse<AbsenceRequest>> {
    if (!startDate || !endDate || !reason.trim()) {
      return { success: false, message: 'Tanggal dan alasan permohonan wajib diisi' };
    }

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const id = `abs-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase
          .from('absence_requests')
          .insert({
            id,
            user_id: userId,
            type,
            start_date: startDate,
            end_date: endDate,
            reason,
            attachment_url: attachmentName || null,
            state: 'SUBMITTED',
          })
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal mengirim permohonan: ${error.message}` };
        }
        if (data) {
          const newReq: AbsenceRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: data.user?.nama || userNama,
            userJabatan: data.user?.positions?.nama || userJabatan,
            type: data.type as AbsenceType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            attachmentName,
            state: 'PENDING',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          return { success: true, data: newReq, message: `Pengajuan ${type} berhasil dikirim (Menunggu Persetujuan)` };
        }
        return { success: false, message: 'Gagal mengirim permohonan' };
      } catch (err: any) {
        return { success: false, message: `Gagal mengirim permohonan: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(400);
    const newReq: AbsenceRequest = {
      id: `abs-${Date.now().toString().slice(-4)}`,
      userId,
      userNama,
      userJabatan,
      type,
      startDate,
      endDate,
      reason,
      attachmentName,
      state: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.absences.unshift(newReq);
    return { success: true, data: newReq, message: `Pengajuan ${type} berhasil dikirim (Menunggu Persetujuan)` };
  }

  async processAbsence(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    processedByUserId: string,
    processedByNama: string,
    rejectionReason?: string
  ): Promise<ApiResponse<AbsenceRequest>> {
    if (decision === 'REJECTED' && !rejectionReason?.trim()) {
      return { success: false, message: 'Alasan penolakan wajib diisi' };
    }

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data, error } = await supabase
          .from('absence_requests')
          .update({
            state: decision,
            approved_by: processedByUserId,
            approved_at: new Date().toISOString(),
            rejection_reason: rejectionReason || null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal memproses permohonan: ${error.message}` };
        }
        if (data) {
          const userObj = (data as any).user || (data as any).users;
          const item: AbsenceRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: userObj?.nama || '',
            userJabatan: userObj?.positions?.nama || userObj?.jabatan_id || '',
            type: data.type as AbsenceType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            attachmentUrl: data.attachment_url,
            state: decision,
            processedByUserId,
            processedByNama,
            processedAt: data.approved_at,
            rejectionReason,
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          return {
            success: true,
            data: item,
            message: `Permohonan ${item.type} berhasil di-${decision === 'APPROVED' ? 'setujui' : 'tolak'}`,
          };
        }
        return { success: false, message: 'Permohonan tidak ditemukan di database' };
      } catch (err: any) {
        return { success: false, message: `Gagal memproses permohonan: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const item = this.absences.find((a) => a.id === id);
    if (!item) return { success: false, message: 'Permohonan tidak ditemukan' };

    item.state = decision;
    item.processedByUserId = processedByUserId;
    item.processedByNama = processedByNama;
    item.processedAt = new Date().toISOString();
    item.rejectionReason = rejectionReason;
    item.updatedAt = new Date().toISOString();

    return {
      success: true,
      data: item,
      message: `Permohonan ${item.type} berhasil di-${decision === 'APPROVED' ? 'setujui' : 'tolak'}`,
    };
  }

  async cancelAbsence(id: string, userId: string): Promise<ApiResponse<AbsenceRequest>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data, error } = await supabase
          .from('absence_requests')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal membatalkan permohonan: ${error.message}` };
        }
        if (data) {
          const userObj = (data as any).user || (data as any).users;
          const item: AbsenceRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: userObj?.nama || '',
            userJabatan: userObj?.positions?.nama || userObj?.jabatan_id || '',
            type: data.type as AbsenceType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            attachmentUrl: data.attachment_url,
            state: 'CANCELLED',
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          return { success: true, data: item, message: 'Pengajuan berhasil dibatalkan' };
        }
        return { success: false, message: 'Permohonan tidak ditemukan di database' };
      } catch (err: any) {
        return { success: false, message: `Gagal membatalkan permohonan: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const item = this.absences.find((a) => a.id === id);
    if (!item) return { success: false, message: 'Permohonan tidak ditemukan' };
    if (item.userId !== userId) {
      return { success: false, message: 'Hanya pemohon yang dapat membatalkan pengajuan' };
    }
    if (item.state !== 'PENDING') {
      return { success: false, message: 'Pengajuan yang sudah diproses tidak dapat dibatalkan' };
    }

    item.state = 'CANCELLED';
    item.updatedAt = new Date().toISOString();
    return { success: true, data: item, message: 'Pengajuan berhasil dibatalkan' };
  }

  // --- CUTI ---
  async getLeaves(userId?: string, state?: LeaveState | 'ALL'): Promise<ApiResponse<LeaveRequest[]>> {
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
        let query = supabase
          .from('absence_requests')
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .in('type', ['CUTI_TAHUNAN', 'CUTI_MELAHIRKAN', 'CUTI_ALASAN_PENTING', 'CUTI_BESAR'])
          .order('created_at', { ascending: false });

        if (userId) query = query.eq('user_id', userId);
        if (state && state !== 'ALL') query = query.eq('state', state);

        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat data cuti: ${error.message}`, data: [] };
        }
        const list: LeaveRequest[] = (data || []).map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          userNama: r.user?.nama || 'Aparatur',
          userJabatan: r.user?.positions?.nama || r.user?.jabatan_id || 'Aparatur',
          leaveType: (r.type.replace('CUTI_', '') as LeaveType),
          startDate: r.start_date,
          endDate: r.end_date,
          reason: r.reason,
          attachmentUrl: r.attachment_url,
          state: r.state as LeaveState,
          verifiedByUserId: r.verified_by,
          verifiedAt: r.verified_at,
          approvedByUserId: r.approved_by,
          approvedAt: r.approved_at,
          rejectionReason: r.rejection_reason,
          timeline: [
            { status: 'SUBMITTED', actor: r.users?.nama || 'Pemohon', timestamp: r.created_at },
            ...(r.verified_at ? [{ status: 'VERIFIED' as LeaveState, actor: 'Verifikator', timestamp: r.verified_at }] : []),
            ...(r.approved_at ? [{ status: r.state as LeaveState, actor: 'Kepala Desa', timestamp: r.approved_at, note: r.rejection_reason }] : []),
          ],
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat data cuti: ${err.message || err}`, data: [] };
      }
    }

    await simulateNetworkDelay(200);
    let list = [...this.leaves];
    if (userId) {
      list = list.filter((l) => l.userId === userId);
    }
    if (state && state !== 'ALL') {
      list = list.filter((l) => l.state === state);
    }
    return { success: true, data: list };
  }

  async submitLeave(
    userId: string,
    userNama: string,
    userJabatan: string,
    leaveType: LeaveType,
    startDate: string,
    endDate: string,
    reason: string,
    attachmentName?: string
  ): Promise<ApiResponse<LeaveRequest>> {
    if (!startDate || !endDate || !reason.trim()) {
      return { success: false, message: 'Tanggal dan alasan cuti wajib diisi' };
    }

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const id = `lve-${Date.now().toString().slice(-4)}`;
        const dbType = `CUTI_${leaveType}`;
        const { data, error } = await supabase
          .from('absence_requests')
          .insert({
            id,
            user_id: userId,
            type: dbType,
            start_date: startDate,
            end_date: endDate,
            reason,
            attachment_url: attachmentName || null,
            state: 'SUBMITTED',
          })
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal mengajukan cuti: ${error.message}` };
        }
        if (data) {
          const newLeave: LeaveRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: data.user?.nama || userNama,
            userJabatan: data.user?.positions?.nama || userJabatan,
            leaveType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            attachmentName,
            state: 'SUBMITTED',
            timeline: [{ status: 'SUBMITTED', actor: userNama, timestamp: data.created_at, note: `Pengajuan cuti dibuat` }],
            createdAt: data.created_at,
            updatedAt: data.updated_at,
          };
          return { success: true, data: newLeave, message: 'Permohonan cuti berhasil diajukan (Menunggu Verifikasi)' };
        }
        return { success: false, message: 'Gagal mengajukan cuti' };
      } catch (err: any) {
        return { success: false, message: `Gagal mengajukan cuti: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(400);
    const now = new Date().toISOString();
    const newLeave: LeaveRequest = {
      id: `lve-${Date.now().toString().slice(-4)}`,
      userId,
      userNama,
      userJabatan,
      leaveType,
      startDate,
      endDate,
      reason,
      attachmentName,
      state: 'SUBMITTED',
      timeline: [
        {
          status: 'SUBMITTED',
          actor: userNama,
          timestamp: now,
          note: `Pengajuan cuti ${leaveType.toLowerCase().replace('_', ' ')} dibuat`,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    this.leaves.unshift(newLeave);
    return { success: true, data: newLeave, message: 'Permohonan cuti berhasil diajukan (Menunggu Verifikasi)' };
  }

  async verifyLeave(
    id: string,
    verifierUserId: string,
    verifierNama: string,
    notes?: string
  ): Promise<ApiResponse<LeaveRequest>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from('absence_requests')
          .update({
            state: 'VERIFIED',
            verified_by: verifierUserId,
            verified_at: now,
            updated_at: now,
          })
          .eq('id', id)
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal memverifikasi cuti: ${error.message}` };
        }
        if (data) {
          const userObj = (data as any).user || (data as any).users;
          const item: LeaveRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: userObj?.nama || '',
            userJabatan: userObj?.positions?.nama || userObj?.jabatan_id || '',
            leaveType: data.type.replace('CUTI_', '') as LeaveType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            state: 'VERIFIED',
            verifiedByUserId: verifierUserId,
            verifiedByNama: verifierNama,
            verifiedAt: now,
            timeline: [
              { status: 'SUBMITTED', actor: data.users?.nama || '', timestamp: data.created_at },
              { status: 'VERIFIED', actor: verifierNama, timestamp: now, note: notes || 'Diverifikasi' },
            ],
            createdAt: data.created_at,
            updatedAt: now,
          };
          return {
            success: true,
            data: item,
            message: 'Cuti berhasil diverifikasi. Diteruskan ke Kepala Desa untuk persetujuan akhir.',
          };
        }
        return { success: false, message: 'Permohonan cuti tidak ditemukan di database' };
      } catch (err: any) {
        return { success: false, message: `Gagal memverifikasi cuti: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(350);
    const item = this.leaves.find((l) => l.id === id);
    if (!item) return { success: false, message: 'Permohonan cuti tidak ditemukan' };
    if (item.state !== 'SUBMITTED') {
      return { success: false, message: 'Hanya cuti berstatus SUBMITTED yang dapat diverifikasi' };
    }

    const now = new Date().toISOString();
    item.state = 'VERIFIED';
    item.verifiedByUserId = verifierUserId;
    item.verifiedByNama = verifierNama;
    item.verifiedAt = now;
    item.timeline.push({
      status: 'VERIFIED',
      actor: verifierNama,
      timestamp: now,
      note: notes || 'Verifikasi kuota dan syarat cuti disetujui',
    });
    item.updatedAt = now;

    return {
      success: true,
      data: item,
      message: 'Cuti berhasil diverifikasi. Diteruskan ke Kepala Desa untuk persetujuan akhir.',
    };
  }

  async approveLeave(
    id: string,
    approverUserId: string,
    approverNama: string,
    approverRole: string,
    decision: 'APPROVED' | 'REJECTED',
    notes?: string
  ): Promise<ApiResponse<LeaveRequest>> {
    // STRICT PRD 19: Final approval must be KEPALA_DESA
    if (approverRole !== 'KEPALA_DESA') {
      return { success: false, message: 'Hanya Kepala Desa yang berwenang memberikan persetujuan final cuti.' };
    }

    if (decision === 'REJECTED' && !notes?.trim()) {
      return { success: false, message: 'Alasan penolakan cuti wajib diisi' };
    }

    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const now = new Date().toISOString();
        const updatePayload: any = {
          state: decision,
          updated_at: now,
        };
        if (decision === 'APPROVED') {
          updatePayload.approved_by = approverUserId;
          updatePayload.approved_at = now;
        } else {
          updatePayload.rejection_reason = notes;
        }

        const { data, error } = await supabase
          .from('absence_requests')
          .update(updatePayload)
          .eq('id', id)
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal memproses persetujuan cuti: ${error.message}` };
        }
        if (data) {
          const userObj = (data as any).user || (data as any).users;
          const item: LeaveRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: userObj?.nama || '',
            userJabatan: userObj?.positions?.nama || userObj?.jabatan_id || '',
            leaveType: data.type.replace('CUTI_', '') as LeaveType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            state: decision,
            approvedByUserId: decision === 'APPROVED' ? approverUserId : undefined,
            approvedByNama: decision === 'APPROVED' ? approverNama : undefined,
            approvedAt: decision === 'APPROVED' ? now : undefined,
            rejectionReason: decision === 'REJECTED' ? notes : undefined,
            timeline: [
              { status: 'SUBMITTED', actor: data.users?.nama || '', timestamp: data.created_at },
              { status: decision, actor: approverNama, timestamp: now, note: notes },
            ],
            createdAt: data.created_at,
            updatedAt: now,
          };
          return {
            success: true,
            data: item,
            message: `Permohonan cuti telah ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'} oleh Kepala Desa`,
          };
        }
        return { success: false, message: 'Permohonan cuti tidak ditemukan di database' };
      } catch (err: any) {
        return { success: false, message: `Gagal memproses persetujuan cuti: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(400);
    const item = this.leaves.find((l) => l.id === id);
    if (!item) return { success: false, message: 'Permohonan cuti tidak ditemukan' };

    const now = new Date().toISOString();
    item.state = decision;
    if (decision === 'APPROVED') {
      item.approvedByUserId = approverUserId;
      item.approvedByNama = approverNama;
      item.approvedAt = now;
    } else {
      item.rejectionReason = notes;
    }

    item.timeline.push({
      status: decision,
      actor: approverNama,
      timestamp: now,
      note: notes || (decision === 'APPROVED' ? 'Persetujuan cuti disahkan oleh Kepala Desa' : 'Ditolak'),
    });
    item.updatedAt = now;

    return {
      success: true,
      data: item,
      message: `Permohonan cuti telah ${decision === 'APPROVED' ? 'disetujui' : 'ditolak'} oleh Kepala Desa`,
    };
  }

  async cancelLeave(id: string, userId: string): Promise<ApiResponse<LeaveRequest>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Supabase belum terkonfigurasi untuk mode operasional.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { data, error } = await supabase
          .from('absence_requests')
          .delete()
          .eq('id', id)
          .eq('user_id', userId)
          .select('*, user:users!absence_requests_user_id_fkey(nama, jabatan_id, positions(nama))')
          .single();

        if (error) {
          return { success: false, message: `Gagal membatalkan cuti: ${error.message}` };
        }
        if (data) {
          const userObj = (data as any).user || (data as any).users;
          const item: LeaveRequest = {
            id: data.id,
            userId: data.user_id,
            userNama: userObj?.nama || '',
            userJabatan: userObj?.positions?.nama || userObj?.jabatan_id || '',
            leaveType: data.type.replace('CUTI_', '') as LeaveType,
            startDate: data.start_date,
            endDate: data.end_date,
            reason: data.reason,
            state: 'CANCELLED',
            timeline: [{ status: 'CANCELLED', actor: data.users?.nama || '', timestamp: new Date().toISOString() }],
            createdAt: data.created_at,
            updatedAt: new Date().toISOString(),
          };
          return { success: true, data: item, message: 'Pengajuan cuti berhasil dibatalkan' };
        }
        return { success: false, message: 'Permohonan cuti tidak ditemukan di database' };
      } catch (err: any) {
        return { success: false, message: `Gagal membatalkan cuti: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const item = this.leaves.find((l) => l.id === id);
    if (!item) return { success: false, message: 'Permohonan cuti tidak ditemukan' };
    if (item.userId !== userId) {
      return { success: false, message: 'Hanya pemohon yang dapat membatalkan pengajuan' };
    }
    if (item.state === 'APPROVED') {
      return { success: false, message: 'Cuti yang sudah disetujui tidak dapat dibatalkan sepihak' };
    }

    const now = new Date().toISOString();
    item.state = 'CANCELLED';
    item.timeline.push({
      status: 'CANCELLED',
      actor: item.userNama,
      timestamp: now,
      note: 'Dibatalkan oleh pemohon',
    });
    item.updatedAt = now;

    return { success: true, data: item, message: 'Pengajuan cuti berhasil dibatalkan' };
  }
}

export const absenceService = new AbsenceService();
