import { Village, Position } from '../types/master';
import { User } from '../types/auth';
import { mockVillage, mockPositions, mockUsers } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { authService } from './authService';
import { auditService } from './auditService';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabaseClient';

class MasterService {
  private village: Village = {
    ...mockVillage,
    logo: (typeof window !== 'undefined' && localStorage.getItem('kadesa_village_logo')) || mockVillage.logo || '/logo-kadesa.png',
  };
  private positions: Position[] = [...mockPositions];
  private apparatusList: User[] = [...mockUsers];

  // Village
  async getVillage(): Promise<ApiResponse<Village>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('villages').select('*').limit(1).maybeSingle();
        if (error) {
          return { success: false, message: `Gagal memuat profil desa: ${error.message}` };
        }
        if (data) {
          const v: Village = {
            id: data.id,
            nama: data.nama,
            kecamatan: data.kecamatan,
            kabupaten: data.kabupaten,
            provinsi: data.provinsi,
            kodePos: data.kode_pos || '',
            alamat: data.alamat || '',
            latitude: Number(data.latitude),
            longitude: Number(data.longitude),
            logo: data.logo_desa || data.logo || this.village.logo,
            createdAt: data.created_at || this.village.createdAt,
            updatedAt: data.updated_at,
          };
          this.village = v;
          return { success: true, data: v };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat profil desa: ${err.message || err}` };
      }
    }
    await simulateNetworkDelay(200);
    return { success: true, data: { ...this.village } };
  }

  async updateVillage(data: Partial<Village>): Promise<ApiResponse<Village>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const dbPayload: any = {};
        if (data.nama !== undefined) dbPayload.nama = data.nama;
        if (data.latitude !== undefined) dbPayload.latitude = data.latitude;
        if (data.longitude !== undefined) dbPayload.longitude = data.longitude;
        if (data.alamat !== undefined) dbPayload.alamat = data.alamat;
        if (data.kodePos !== undefined) dbPayload.kode_pos = data.kodePos;
        if (data.kecamatan !== undefined) dbPayload.kecamatan = data.kecamatan;
        if (data.kabupaten !== undefined) dbPayload.kabupaten = data.kabupaten;
        if (data.provinsi !== undefined) dbPayload.provinsi = data.provinsi;
        if (data.logo !== undefined) {
          dbPayload.logo_desa = data.logo;
        }
        dbPayload.updated_at = new Date().toISOString();

        const { data: updated, error } = await supabase
          .from('villages')
          .update(dbPayload)
          .eq('id', this.village.id || 'vil-001')
          .select()
          .single();

        if (error) {
          return { success: false, message: `Gagal memperbarui profil desa: ${error.message}` };
        }
        if (updated) {
          const oldVillage = { ...this.village };
          this.village = {
            id: updated.id,
            nama: updated.nama,
            kecamatan: updated.kecamatan,
            kabupaten: updated.kabupaten,
            provinsi: updated.provinsi,
            kodePos: updated.kode_pos || '',
            alamat: updated.alamat || '',
            latitude: Number(updated.latitude),
            longitude: Number(updated.longitude),
            logo: updated.logo_desa || this.village.logo,
            createdAt: updated.created_at || this.village.createdAt,
            updatedAt: updated.updated_at,
          };

          if (typeof window !== 'undefined' && this.village.logo) {
            localStorage.setItem('kadesa_village_logo', this.village.logo);
            window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { logo: this.village.logo } }));
          }

          try {
            const currentUser = await authService.getCurrentUser();
            await auditService.recordAuditEvent({
              actorUserId: currentUser?.id || 'usr-admin',
              actorNama: currentUser?.nama || 'Administrator',
              actorRole: currentUser?.role || 'SUPER_ADMIN',
              eventType: 'MASTER_UPDATED',
              entityType: 'villages',
              entityId: this.village.id,
              beforeData: { latitude: oldVillage.latitude, longitude: oldVillage.longitude },
              afterData: { latitude: this.village.latitude, longitude: this.village.longitude },
              reason: 'Pembaruan profil desa dan titik koordinat pusat geofence',
            });
          } catch (auditErr) {
            console.warn('Audit record warning:', auditErr);
          }

          return { success: true, data: { ...this.village }, message: 'Data profil Desa berhasil disimpan' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui profil desa: ${err.message}` };
      }
    }
    await simulateNetworkDelay(400);
    const oldVillage = { ...this.village };
    this.village = {
      ...this.village,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    if (typeof window !== 'undefined' && this.village.logo) {
      localStorage.setItem('kadesa_village_logo', this.village.logo);
      window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { logo: this.village.logo } }));
    }

    const currentUser = await authService.getCurrentUser();
    await auditService.recordAuditEvent({
      actorUserId: currentUser?.id || 'usr-admin',
      actorNama: currentUser?.nama || 'Administrator',
      actorRole: currentUser?.role || 'SUPER_ADMIN',
      eventType: 'MASTER_UPDATED',
      entityType: 'villages',
      entityId: this.village.id,
      beforeData: { latitude: oldVillage.latitude, longitude: oldVillage.longitude },
      afterData: { latitude: this.village.latitude, longitude: this.village.longitude },
      reason: 'Pembaruan profil desa dan titik koordinat pusat geofence',
    });

    return { success: true, data: { ...this.village }, message: 'Data profil Desa berhasil disimpan' };
  }

  async updateVillageLogo(logoDataUrl: string): Promise<ApiResponse<string>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('villages')
          .update({
            logo_desa: logoDataUrl,
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.village.id || 'vil-001');

        if (error) {
          console.warn('Supabase updateVillageLogo warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase updateVillageLogo error:', err);
      }
    }

    await simulateNetworkDelay(300);
    this.village.logo = logoDataUrl;
    this.village.updatedAt = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.setItem('kadesa_village_logo', logoDataUrl);
      window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { logo: logoDataUrl } }));
    }
    return { success: true, data: logoDataUrl, message: 'Logo resmi desa berhasil diperbarui' };
  }

  async removeVillageLogo(): Promise<ApiResponse<string>> {
    const defaultLogo = '/logo-kadesa.png';
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { error } = await supabase
          .from('villages')
          .update({
            logo_desa: defaultLogo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', this.village.id || 'vil-001');

        if (error) {
          console.warn('Supabase removeVillageLogo warning:', error.message);
        }
      } catch (err) {
        console.warn('Supabase removeVillageLogo error:', err);
      }
    }

    await simulateNetworkDelay(300);
    this.village.logo = defaultLogo;
    this.village.updatedAt = new Date().toISOString();
    if (typeof window !== 'undefined') {
      localStorage.setItem('kadesa_village_logo', defaultLogo);
      window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { logo: defaultLogo } }));
    }
    return { success: true, data: defaultLogo, message: 'Logo desa berhasil direset ke logo bawaan' };
  }

  // Positions (Jabatan)
  getCachedPositions(): Position[] {
    return this.positions;
  }

  getCachedApparatusList(): User[] {
    return this.apparatusList;
  }

  async getPositions(): Promise<ApiResponse<Position[]>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const [{ data: posData, error: posError }, { data: usersData, error: uError }] = await Promise.all([
          supabase.from('positions').select('*').order('id'),
          supabase.from('users').select('jabatan_id, active'),
        ]);
        if (posError) {
          return { success: false, message: `Gagal memuat data jabatan: ${posError.message}` };
        }
        if (uError) {
          return { success: false, message: `Gagal memuat data pengguna: ${uError.message}` };
        }
        if (posData) {
          const list: Position[] = posData.map((p) => ({
            id: p.id,
            nama: p.nama,
            active: p.active,
            effectiveFrom: p.effective_from,
            aparaturCount: (usersData || []).filter((u) => u.jabatan_id === p.id && u.active).length,
          }));
          this.positions = list;
          return { success: true, data: list };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat data jabatan: ${err.message || err}` };
      }
    }
    await simulateNetworkDelay(200);
    // Count active apparatus for each position
    const withCounts = this.positions.map(p => ({
      ...p,
      aparaturCount: this.apparatusList.filter(a => a.jabatanId === p.id && a.active).length,
    }));
    return { success: true, data: withCounts };
  }

  async addPosition(nama: string): Promise<ApiResponse<Position>> {
    if (!nama.trim()) {
      return { success: false, message: 'Nama jabatan wajib diisi' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const id = `pos-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase.from('positions').insert({
          id,
          nama: nama.trim(),
          active: true,
          effective_from: new Date().toISOString().split('T')[0],
        }).select().single();

        if (error) {
          return { success: false, message: `Gagal menambah jabatan: ${error.message}` };
        }
        if (data) {
          const newPos: Position = {
            id: data.id,
            nama: data.nama,
            active: data.active,
            effectiveFrom: data.effective_from,
            aparaturCount: 0,
          };
          this.positions.push(newPos);
          return { success: true, data: newPos, message: 'Jabatan baru berhasil ditambahkan' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal menambah jabatan: ${err.message}` };
      }
    }

    await simulateNetworkDelay(300);
    const newPos: Position = {
      id: `pos-${Date.now().toString().slice(-4)}`,
      nama: nama.trim(),
      active: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
      aparaturCount: 0,
    };
    this.positions.push(newPos);
    return { success: true, data: newPos, message: 'Jabatan baru berhasil ditambahkan' };
  }

  async updatePosition(id: string, nama: string, active: boolean): Promise<ApiResponse<Position>> {
    // In-use check when deactivating
    if (!active) {
      const inUseCount = this.apparatusList.filter(a => a.jabatanId === id && a.active).length;
      if (inUseCount > 0) {
        return {
          success: false,
          message: `Jabatan tidak dapat dinonaktifkan karena sedang digunakan oleh ${inUseCount} aparatur aktif.`,
        };
      }
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data, error } = await supabase.from('positions').update({
          nama: nama.trim(),
          active,
          updated_at: new Date().toISOString(),
        }).eq('id', id).select().single();

        if (error) {
          return { success: false, message: `Gagal memperbarui jabatan: ${error.message}` };
        }
        if (data) {
          const idx = this.positions.findIndex(p => p.id === id);
          const updated: Position = {
            id: data.id,
            nama: data.nama,
            active: data.active,
            effectiveFrom: data.effective_from,
            aparaturCount: idx !== -1 ? this.positions[idx].aparaturCount : 0,
          };
          if (idx !== -1) this.positions[idx] = updated;
          return { success: true, data: updated, message: 'Jabatan berhasil diperbarui' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui: ${err.message}` };
      }
    }

    await simulateNetworkDelay(300);
    const idx = this.positions.findIndex(p => p.id === id);
    if (idx === -1) return { success: false, message: 'Jabatan tidak ditemukan' };

    this.positions[idx] = {
      ...this.positions[idx],
      nama: nama.trim(),
      active,
    };
    return { success: true, data: this.positions[idx], message: 'Jabatan berhasil diperbarui' };
  }

  // Apparatus (Perangkat Desa)
  async getApparatusList(search?: string, jabatanId?: string, activeOnly?: boolean): Promise<ApiResponse<User[]>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        let query = supabase.from('users').select('*, positions(nama)').order('created_at', { ascending: true });
        if (jabatanId) {
          query = query.eq('jabatan_id', jabatanId);
        }
        if (activeOnly) {
          query = query.eq('active', true);
        }
        const { data: uData, error: uError } = await query;
        if (uError) {
          return { success: false, message: `Gagal memuat data aparatur: ${uError.message}` };
        }
        if (uData) {
          let list: User[] = uData.map((u) => ({
            id: u.id,
            authUserId: u.auth_user_id,
            username: u.username,
            nama: u.nama,
            nik: u.nik,
            nipd: u.nipd,
            nomorWhatsapp: u.nomor_whatsapp,
            fotoReference: u.foto_reference,
            role: u.role,
            jabatanId: u.jabatan_id,
            jabatanNama: (u as any).positions?.nama || u.jabatan_id || 'Aparatur Desa',
            attendanceRequired: u.attendance_required,
            active: u.active,
            effectiveFrom: u.effective_from,
          }));
          if (search) {
            const q = search.toLowerCase();
            list = list.filter(a => a.nama.toLowerCase().includes(q) || a.nik.includes(q) || (a.nipd && a.nipd.includes(q)));
          }
          this.apparatusList = list;
          return { success: true, data: list };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memuat data aparatur: ${err.message || err}` };
      }
    }
    await simulateNetworkDelay(300);
    let list = [...this.apparatusList];

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(a => a.nama.toLowerCase().includes(q) || a.nik.includes(q) || (a.nipd && a.nipd.includes(q)));
    }
    if (jabatanId) {
      list = list.filter(a => a.jabatanId === jabatanId);
    }
    if (activeOnly) {
      list = list.filter(a => a.active);
    }

    return { success: true, data: list };
  }

  async addApparatus(
    data: Omit<User, 'id' | 'authUserId'>,
    actorRole?: string,
    initialPassword?: string
  ): Promise<ApiResponse<User>> {
    await simulateNetworkDelay(400);
    if (!data.nama || !data.nik || !data.nomorWhatsapp || !data.username) {
      return { success: false, message: 'Mohon lengkapi seluruh field wajib (Nama, NIK, No. WhatsApp, Username)' };
    }

    // Password validation if provided
    if (initialPassword && initialPassword.trim().length < 6) {
      return { success: false, message: 'Password awal minimal 6 karakter.' };
    }

    // STRICT: Operator cannot create accounts with OPERATOR_DESA or SUPER_ADMIN role
    if (actorRole === 'OPERATOR_DESA') {
      if (data.role === 'OPERATOR_DESA') {
        return {
          success: false,
          message: 'Operator tidak memiliki wewenang untuk membuat akun baru dengan peran Operator Desa.',
        };
      }
      if (data.role === 'SUPER_ADMIN') {
        return {
          success: false,
          message: 'Operator tidak memiliki wewenang untuk membuat akun baru dengan peran Super Admin.',
        };
      }
    }

    // Check duplicate NIK
    if (this.apparatusList.some(a => a.nik === data.nik)) {
      return { success: false, message: 'NIK sudah terdaftar dalam sistem' };
    }

    // Check duplicate Username
    if (this.apparatusList.some(a => a.username.toLowerCase() === data.username.toLowerCase())) {
      return { success: false, message: 'Username sudah digunakan oleh akun lain' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const payload = {
          username: data.username,
          password: initialPassword || 'password123',
          nama: data.nama,
          nik: data.nik,
          nipd: data.nipd || null,
          nomorWhatsapp: data.nomorWhatsapp,
          fotoReference: data.fotoReference || null,
          role: data.role,
          jabatanId: data.jabatanId,
          attendanceRequired: data.attendanceRequired ?? true,
          effectiveFrom: data.effectiveFrom || new Date().toISOString().split('T')[0],
        };

        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('create-apparatus-user', {
          body: payload,
        });

        if (edgeErr || !edgeRes?.success || !edgeRes?.data) {
          return {
            success: false,
            message: edgeRes?.message || edgeErr?.message || 'Gagal mendaftarkan aparatur melalui layanan server.',
          };
        }

        const inserted = edgeRes.data;

        if (inserted) {
          const u: User = {
            id: inserted.id,
            authUserId: inserted.auth_user_id,
            username: inserted.username,
            nama: inserted.nama,
            nik: inserted.nik,
            nipd: inserted.nipd,
            nomorWhatsapp: inserted.nomor_whatsapp,
            fotoReference: inserted.foto_reference,
            role: inserted.role,
            jabatanId: inserted.jabatan_id,
            jabatanNama: (inserted as any).positions?.nama || inserted.jabatan_id || 'Aparatur Desa',
            attendanceRequired: inserted.attendance_required,
            active: inserted.active,
            effectiveFrom: inserted.effective_from,
          };
          this.apparatusList.push(u);

          // Register user into in-memory auth for mock continuity
          const pass = initialPassword && initialPassword.trim() ? initialPassword.trim() : 'password123';
          authService.registerUser(u, pass);

          // Record audit log
          await auditService.recordAuditEvent({
            actorUserId: 'system',
            actorNama: 'Administrator',
            actorRole: actorRole || 'OPERATOR_DESA',
            eventType: 'MASTER_UPDATED',
            entityType: 'APPARATUS_CREATED',
            entityId: u.id,
            afterData: { username: u.username, nama: u.nama, role: u.role },
            reason: `Pendaftaran aparatur baru (@${u.username}) ke database`,
          });

          return { success: true, data: u, message: 'Data aparatur baru berhasil disimpan' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal menyimpan: ${err.message}` };
      }
    }

    const newUser: User = {
      ...data,
      id: `usr-${Date.now().toString().slice(-4)}`,
      authUserId: `auth-${Date.now().toString().slice(-4)}`,
    };

    this.apparatusList.push(newUser);

    // Register user and credentials with authService
    const pass = initialPassword && initialPassword.trim() ? initialPassword.trim() : 'password123';
    authService.registerUser(newUser, pass);

    await auditService.recordAuditEvent({
      actorUserId: 'system',
      actorNama: 'Administrator',
      actorRole: actorRole || 'OPERATOR_DESA',
      eventType: 'MASTER_UPDATED',
      entityType: 'APPARATUS_CREATED',
      entityId: newUser.id,
      afterData: { username: newUser.username, nama: newUser.nama, role: newUser.role },
      reason: `Pendaftaran aparatur baru (@${newUser.username}) dengan kata sandi awal`,
    });

    return { success: true, data: newUser, message: 'Data aparatur baru berhasil disimpan' };
  }

  async resetApparatusPassword(
    targetUserId: string,
    newPassword: string,
    actorRole?: string,
    actorId?: string,
    actorNama?: string
  ): Promise<ApiResponse<boolean>> {
    let targetUser = this.apparatusList.find((a) => a.id === targetUserId);
    if (!targetUser && !IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: dbUser } = await supabase.from('users').select('*').eq('id', targetUserId).maybeSingle();
        if (dbUser) {
          targetUser = {
            id: dbUser.id,
            authUserId: dbUser.auth_user_id,
            username: dbUser.username,
            nama: dbUser.nama,
            nik: dbUser.nik,
            nipd: dbUser.nipd,
            nomorWhatsapp: dbUser.nomor_whatsapp,
            fotoReference: dbUser.foto_reference,
            role: dbUser.role,
            jabatanId: dbUser.jabatan_id,
            jabatanNama: dbUser.jabatan_nama || dbUser.jabatan_id || '-',
            attendanceRequired: dbUser.attendance_required,
            active: dbUser.active,
            effectiveFrom: dbUser.effective_from,
          };
        }
      } catch (_fetchErr) {
        // Fallback to error below
      }
    }

    if (!targetUser) {
      return { success: false, message: 'Data aparatur tidak ditemukan' };
    }

    // STRICT: Operator cannot reset Super Admin password
    if (actorRole === 'OPERATOR_DESA' && targetUser.role === 'SUPER_ADMIN') {
      return {
        success: false,
        message: 'Operator tidak memiliki wewenang untuk mereset kata sandi akun Super Admin.',
      };
    }

    // STRICT: Operator cannot reset own password via admin reset
    if (actorRole === 'OPERATOR_DESA' && actorId === targetUserId) {
      return {
        success: false,
        message: 'Gunakan menu Profil Saya untuk memperbarui kata sandi akun Anda sendiri.',
      };
    }

    if (!newPassword || newPassword.trim().length < 6) {
      return {
        success: false,
        message: 'Kata sandi baru minimal 6 karakter.',
      };
    }

    // Jika terhubung ke Supabase Cloud (Production), jalankan melalui Edge Function tepercaya
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: edgeRes, error: edgeErr } = await supabase.functions.invoke('admin-reset-password', {
          body: {
            targetUserId,
            newPassword: newPassword.trim(),
          },
        });

        if (edgeErr) {
          let errDetail = edgeErr.message || 'Gagal mereset kata sandi melalui server autentikasi.';
          try {
            const rawAny = edgeErr as any;
            if (rawAny.context && typeof rawAny.context.json === 'function') {
              const errorBody = await rawAny.context.json();
              if (errorBody?.message) {
                errDetail = errorBody.message;
              }
            }
          } catch {
            // keep errDetail as is
          }
          return {
            success: false,
            message: errDetail,
          };
        }

        if (!edgeRes || !edgeRes.success) {
          return {
            success: false,
            message: edgeRes?.message || 'Gagal mereset kata sandi melalui server autentikasi.',
          };
        }

        // Sinkronisasi in-memory password store untuk sesi aktif
        authService.setUserPassword(targetUserId, newPassword.trim());

        return {
          success: true,
          data: true,
          message: edgeRes.message || `Kata sandi untuk ${targetUser.nama} berhasil direset.`,
        };
      } catch (err: any) {
        return {
          success: false,
          message: err.message || 'Terjadi kesalahan sistem saat menghubungi layanan reset kata sandi.',
        };
      }
    }

    await simulateNetworkDelay(400);

    // Update password in authService (Demo Mode)
    authService.setUserPassword(targetUserId, newPassword.trim());

    // Record Audit Log (Demo Mode)
    await auditService.recordAuditEvent({
      actorUserId: actorId || 'system',
      actorNama: actorNama || 'Administrator',
      actorRole: actorRole || 'OPERATOR_DESA',
      eventType: 'MASTER_UPDATED',
      entityType: 'USER_PASSWORD_RESET',
      entityId: targetUserId,
      reason: `Reset kata sandi aparatur: ${targetUser.nama} (@${targetUser.username})`,
    });

    return {
      success: true,
      data: true,
      message: `Kata sandi untuk ${targetUser.nama} berhasil direset.`,
    };
  }

  async updateApparatus(id: string, data: Partial<User>, actorRole?: string, actorId?: string): Promise<ApiResponse<User>> {
    const idx = this.apparatusList.findIndex(a => a.id === id);
    if (idx === -1) return { success: false, message: 'Data aparatur tidak ditemukan' };

    // STRICT: Operator cannot edit Super Admin account
    if (actorRole === 'OPERATOR_DESA' && this.apparatusList[idx].role === 'SUPER_ADMIN') {
      return {
        success: false,
        message: 'Operator tidak memiliki wewenang untuk mengubah data akun Super Admin.',
      };
    }

    // STRICT: Operator cannot change own role
    if (actorRole === 'OPERATOR_DESA' && actorId === id && data.role && data.role !== this.apparatusList[idx].role) {
      return {
        success: false,
        message: 'Operator tidak memiliki wewenang untuk mengubah peran akunnya sendiri.',
      };
    }

    // STRICT: Only Super Admin can grant or revoke OPERATOR_DESA role (ADR-011)
    if (actorRole !== 'SUPER_ADMIN') {
      if (data.role === 'OPERATOR_DESA' && this.apparatusList[idx].role !== 'OPERATOR_DESA') {
        return {
          success: false,
          message: 'Hanya Super Admin yang memiliki wewenang untuk menetapkan peran Operator Desa.',
        };
      }
      if (this.apparatusList[idx].role === 'OPERATOR_DESA' && data.role && data.role !== 'OPERATOR_DESA') {
        return {
          success: false,
          message: 'Hanya Super Admin yang memiliki wewenang untuk mencabut peran Operator Desa.',
        };
      }
    }

    // STRICT: Operator cannot promote any user to Super Admin
    if (actorRole === 'OPERATOR_DESA' && data.role === 'SUPER_ADMIN') {
      return {
        success: false,
        message: 'Operator tidak memiliki wewenang untuk menetapkan peran Super Admin.',
      };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const dbUpdate: any = {};
        if (data.nama !== undefined) dbUpdate.nama = data.nama;
        if (data.nik !== undefined) dbUpdate.nik = data.nik;
        if (data.nipd !== undefined) dbUpdate.nipd = data.nipd;
        if (data.nomorWhatsapp !== undefined) dbUpdate.nomor_whatsapp = data.nomorWhatsapp;
        if (data.role !== undefined) dbUpdate.role = data.role;
        if (data.jabatanId !== undefined) dbUpdate.jabatan_id = data.jabatanId;
        if (data.attendanceRequired !== undefined) dbUpdate.attendance_required = data.attendanceRequired;
        if (data.active !== undefined) dbUpdate.active = data.active;
        dbUpdate.updated_at = new Date().toISOString();

        const { data: updated, error: upErr } = await supabase
          .from('users')
          .update(dbUpdate)
          .eq('id', id)
          .select('*, positions(nama)')
          .single();

        if (upErr || !updated) {
          return { success: false, message: `Gagal memperbarui data aparatur: ${upErr?.message || 'Gagal menyimpan perubahan'}` };
        }
        const updatedData = updated;

        if (updatedData) {
          const u: User = {
            id: updatedData.id,
            authUserId: updatedData.auth_user_id,
            username: updatedData.username,
            nama: updatedData.nama,
            nik: updatedData.nik,
            nipd: updatedData.nipd,
            nomorWhatsapp: updatedData.nomor_whatsapp,
            fotoReference: updatedData.foto_reference,
            role: updatedData.role,
            jabatanId: updatedData.jabatan_id,
            jabatanNama: (updatedData as any).positions?.nama || updatedData.jabatan_id || 'Aparatur Desa',
            attendanceRequired: updatedData.attendance_required,
            active: updatedData.active,
            effectiveFrom: updatedData.effective_from,
          };
          this.apparatusList[idx] = u;
          return { success: true, data: u, message: 'Data aparatur berhasil diperbarui' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui data: ${err.message}` };
      }
    }

    await simulateNetworkDelay(400);
    this.apparatusList[idx] = {
      ...this.apparatusList[idx],
      ...data,
    };
    return { success: true, data: this.apparatusList[idx], message: 'Data aparatur berhasil diperbarui' };
  }

  async toggleApparatusStatus(id: string, actorRole?: string): Promise<ApiResponse<User>> {
    const idx = this.apparatusList.findIndex(a => a.id === id);
    if (idx === -1) return { success: false, message: 'Aparatur tidak ditemukan' };

    // STRICT: Operator cannot deactivate Super Admin account
    if (actorRole === 'OPERATOR_DESA' && this.apparatusList[idx].role === 'SUPER_ADMIN') {
      return {
        success: false,
        message: 'Operator tidak memiliki wewenang untuk mengubah status akun Super Admin.',
      };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const currentActive = this.apparatusList[idx]?.active;
        const newActive = !currentActive;
        const { data: updated, error: togErr } = await supabase
          .from('users')
          .update({ active: newActive, updated_at: new Date().toISOString() })
          .eq('id', id)
          .select('*, positions(nama)')
          .single();

        if (togErr || !updated) {
          return { success: false, message: `Gagal mengubah status aparatur: ${togErr?.message || 'Gagal menyimpan perubahan'}` };
        }
        const updatedData = updated;

        if (updatedData) {
          const u: User = {
            id: updatedData.id,
            authUserId: updatedData.auth_user_id,
            username: updatedData.username,
            nama: updatedData.nama,
            nik: updatedData.nik,
            nipd: updatedData.nipd,
            nomorWhatsapp: updatedData.nomor_whatsapp,
            fotoReference: updatedData.foto_reference,
            role: updatedData.role,
            jabatanId: updatedData.jabatan_id,
            jabatanNama: (updatedData as any).positions?.nama || updatedData.jabatan_id || 'Aparatur Desa',
            attendanceRequired: updatedData.attendance_required,
            active: updatedData.active,
            effectiveFrom: updatedData.effective_from,
          };
          this.apparatusList[idx] = u;
          const statusText = u.active ? 'diaktifkan' : 'dinonaktifkan';
          return { success: true, data: u, message: `Akun aparatur berhasil ${statusText}` };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal mengubah status: ${err.message}` };
      }
    }

    await simulateNetworkDelay(300);
    this.apparatusList[idx].active = !this.apparatusList[idx].active;
    const statusText = this.apparatusList[idx].active ? 'diaktifkan' : 'dinonaktifkan';
    return {
      success: true,
      data: this.apparatusList[idx],
      message: `Akun aparatur berhasil ${statusText}`,
    };
  }
}

export const masterService = new MasterService();
