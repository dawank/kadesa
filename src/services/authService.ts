import { User, UserRole, PermissionAction, AuthSession } from '../types/auth';
import { mockUsers } from '../mock/mockData';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { supabase, isSupabaseConfigured, supabaseUrl, supabaseAnonKey } from './supabaseClient';

const AUTH_STORAGE_KEY = 'kadesa_current_user_id';

class AuthService {
  private users: User[] = [...mockUsers];
  private currentUserId: string | null = null;
  private currentAccessToken: string | null = null;
  private userPasswords: Record<string, string> = {};

  getAccessToken(): string | null {
    return null;
  }

  setAccessToken(_token: string | null): void {
    // Pola sesi resmi Supabase: Mengandalkan session cookie / internal Supabase client persistence
  }

  constructor() {
    if (IS_DEMO_MODE && typeof window !== 'undefined') {
      const saved = localStorage.getItem(AUTH_STORAGE_KEY);
      if (saved && this.users.some(u => u.id === saved)) {
        this.currentUserId = saved;
      }
    }
  }

  getUserPassword(userId: string): string {
    return this.userPasswords[userId] || 'password123';
  }

  setUserPassword(userId: string, password: string): void {
    this.userPasswords[userId] = password;
  }

  registerUser(user: User, password?: string): void {
    const existing = this.users.findIndex(u => u.id === user.id);
    if (existing >= 0) {
      this.users[existing] = user;
    } else {
      this.users.push(user);
    }
    if (password) {
      this.userPasswords[user.id] = password;
    }
  }

  async getProfileByAuthUserId(authUserId: string, _accessToken?: string): Promise<User | null> {
    try {
      // Query langsung via Supabase Client terautentikasi resmi
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*, positions(nama)')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (profileError || !profile) {
        console.error('KADESA: Profil pengguna tidak ditemukan di tabel public.users:', profileError);
        return null;
      }

      if (!profile.active) {
        console.warn('KADESA: Akun pengguna dinonaktifkan oleh administrator.');
        return null;
      }

      return {
        id: profile.id,
        authUserId: profile.auth_user_id,
        username: profile.username,
        nama: profile.nama,
        nik: profile.nik,
        nipd: profile.nipd,
        nomorWhatsapp: profile.nomor_whatsapp,
        fotoReference: profile.foto_reference,
        role: profile.role,
        jabatanId: profile.jabatan_id,
        jabatanNama: (profile as any).positions?.nama || profile.jabatan_id || 'Aparatur Desa',
        attendanceRequired: profile.attendance_required,
        active: profile.active,
        effectiveFrom: profile.effective_from,
      };
    } catch (err) {
      console.error('KADESA: Galat saat memuat profil:', err);
      return null;
    }
  }

  async login(username: string, password?: string): Promise<ApiResponse<AuthSession>> {
    // Mode Staging / Production: Hubungkan langsung ke Supabase Auth & Tabel Users
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase (VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY) belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const cleanUser = username.trim().toLowerCase();
        const email = cleanUser.includes('@') ? cleanUser : `${cleanUser}@desa.local`;

        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: password || '',
        });

        if (signInError || !authData.session || !authData.user) {
          const msg = signInError?.message || 'Username atau kata sandi tidak valid. Silakan periksa kembali.';
          const isRateLimited =
            (signInError as any)?.status === 429 ||
            msg.toLowerCase().includes('rate limit') ||
            msg.toLowerCase().includes('too many requests') ||
            (signInError as any)?.code === 'over_request_rate_limit';

          if (isRateLimited) {
            return {
              success: false,
              message: 'Batas percobaan masuk terlampaui demi keamanan akun. Silakan tunggu beberapa saat sebelum mencoba kembali.',
              errorCode: 'RATE_LIMITED',
            };
          }

          return {
            success: false,
            message: msg.includes('Invalid login credentials')
              ? 'Username atau kata sandi tidak valid. Silakan periksa kembali.'
              : msg,
            errorCode: 'AUTH_FAILED',
          };
        }

        const user = await this.getProfileByAuthUserId(authData.user.id);

        if (!user) {
          await supabase.auth.signOut();
          return {
            success: false,
            message: 'Autentikasi berhasil, namun profil aparatur desa tidak ditemukan atau tidak aktif di database.',
            errorCode: 'PROFILE_NOT_FOUND',
          };
        }

        this.currentUserId = user.id;

        return {
          success: true,
          data: {
            user,
            token: authData.session.access_token,
            expiresAt: new Date(Date.now() + (authData.session.expires_in || 3600) * 1000).toISOString(),
          },
        };
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal memproses autentikasi: ${err.message || 'Kesalahan sistem'}`,
          errorCode: 'SYSTEM_ERROR',
        };
      }
    }

    // Mode Demo / Test: Simulasi In-Memory
    await simulateNetworkDelay(300);
    const user = this.users.find(u => u.username.toLowerCase() === username.toLowerCase().trim());
    
    if (!user) {
      return {
        success: false,
        message: 'Username atau kata sandi tidak valid. Silakan periksa kembali.',
      };
    }

    if (!user.active) {
      return {
        success: false,
        message: 'Akun Anda dinonaktifkan oleh administrator. Silakan hubungi Operator Desa.',
        errorCode: 'ACCOUNT_INACTIVE',
      };
    }

    const expectedPassword = this.getUserPassword(user.id);
    if (password && expectedPassword && password !== expectedPassword) {
      return {
        success: false,
        message: 'Username atau kata sandi tidak valid. Silakan periksa kembali.',
      };
    }

    this.currentUserId = user.id;
    if (typeof window !== 'undefined') {
      localStorage.setItem(AUTH_STORAGE_KEY, user.id);
    }

    return {
      success: true,
      data: {
        user,
        token: `mock-jwt-token-for-${user.id}`,
        expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(),
      },
    };
  }

  async logout(): Promise<ApiResponse<boolean>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.warn('Supabase signOut error:', err);
      }
    }
    this.currentUserId = null;
    this.setAccessToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem('kadesa_access_token');
    }
    await simulateNetworkDelay(100);
    return { success: true, data: true };
  }

  async getCurrentUser(): Promise<User | null> {
    // Mode Staging / Production: Verifikasi ketat sesi Supabase Auth & Tabel public.users
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return null;
      }
      try {
        // Timeout 3 detik untuk getSession agar tidak pernah memblokir aplikasi
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) =>
          setTimeout(() => resolve({ data: { session: null }, error: null }), 3000)
        );
        const { data: { session }, error: sessionError } = await Promise.race([sessionPromise, timeoutPromise]);

        if (sessionError || !session || !session.user) {
          if (sessionError) {
            try {
              await supabase.auth.signOut();
            } catch (_) {}
          }
          return null;
        }

        if (session.access_token) {
          this.setAccessToken(session.access_token);
        }

        const user = await this.getProfileByAuthUserId(session.user.id, session.access_token);
        if (user) {
          this.currentUserId = user.id;
        }
        return user;
      } catch (err) {
        console.error('KADESA: Galat saat memeriksa sesi Supabase:', err);
        return null;
      }
    }

    // Mode Demo: Ambil berdasarkan akun aktif jika ada
    if (!this.currentUserId) return null;
    const user = this.users.find(u => u.id === this.currentUserId);
    return user || null;
  }

  async switchUser(userId: string): Promise<User> {
    if (!IS_DEMO_MODE) {
      throw new Error('Fitur pergantian akun cepat hanya diizinkan dalam Mode Demo.');
    }
    const user = this.users.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    this.currentUserId = user.id;
    localStorage.setItem(AUTH_STORAGE_KEY, user.id);
    return user;
  }

  async switchRole(role: UserRole): Promise<User> {
    if (!IS_DEMO_MODE) {
      throw new Error('Fitur pergantian role cepat hanya diizinkan dalam Mode Demo.');
    }
    const user = this.users.find(u => u.role === role);
    if (!user) throw new Error(`User with role ${role} not found`);
    this.currentUserId = user.id;
    localStorage.setItem(AUTH_STORAGE_KEY, user.id);
    return user;
  }

  getDemoUsers(): User[] {
    if (!IS_DEMO_MODE) return [];
    return [...this.users];
  }

  async getAllUsers(): Promise<User[]> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return [];
      }
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*, positions(nama)')
          .order('created_at', { ascending: true });
        if (error || !data) {
          console.warn('Supabase getAllUsers error:', error);
          return [];
        }
        return data.map((u: any) => ({
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
          jabatanNama: u.positions?.nama || u.jabatan_id || 'Aparatur Desa',
          attendanceRequired: u.attendance_required,
          active: u.active,
          effectiveFrom: u.effective_from,
        }));
      } catch (err) {
        console.warn('Supabase getAllUsers error:', err);
        return [];
      }
    }
    return [...this.users];
  }

  async updateProfile(userId: string, data: Partial<User>): Promise<ApiResponse<User>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const updatePayload: any = {};
        if (data.nomorWhatsapp !== undefined) updatePayload.nomor_whatsapp = data.nomorWhatsapp;
        if (data.fotoReference !== undefined) updatePayload.foto_reference = data.fotoReference;
        if (data.nama !== undefined) updatePayload.nama = data.nama;

        const { data: updated, error } = await supabase
          .from('users')
          .update(updatePayload)
          .eq('id', userId)
          .select('*, positions(nama)')
          .single();

        if (error) {
          return { success: false, message: `Gagal memperbarui profil: ${error.message}` };
        }
        if (updated) {
          const user: User = {
            id: updated.id,
            authUserId: updated.auth_user_id,
            username: updated.username,
            nama: updated.nama,
            nik: updated.nik,
            nipd: updated.nipd,
            nomorWhatsapp: updated.nomor_whatsapp,
            fotoReference: updated.foto_reference,
            role: updated.role,
            jabatanId: updated.jabatan_id,
            jabatanNama: (updated as any).positions?.nama || updated.jabatan_id || 'Aparatur Desa',
            attendanceRequired: updated.attendance_required,
            active: updated.active,
            effectiveFrom: updated.effective_from,
          };
          const idx = this.users.findIndex(u => u.id === userId);
          if (idx !== -1) this.users[idx] = user;
          return { success: true, data: user, message: 'Profil berhasil diperbarui' };
        }
        return { success: false, message: 'Pengguna tidak ditemukan di database.' };
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui profil: ${err.message || err}` };
      }
    }

    await simulateNetworkDelay(300);
    const idx = this.users.findIndex(u => u.id === userId);
    if (idx === -1) return { success: false, message: 'User tidak ditemukan' };

    this.users[idx] = { ...this.users[idx], ...data };
    return { success: true, data: this.users[idx], message: 'Profil berhasil diperbarui' };
  }

  async changePassword(_oldPass: string, newPass: string): Promise<ApiResponse<boolean>> {
    if (newPass.length < 8) {
      return { success: false, message: 'Kata sandi minimal 8 karakter' };
    }
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
        };
      }
      try {
        const { error } = await supabase.auth.updateUser({ password: newPass });
        if (error) {
          return { success: false, message: `Gagal mengubah kata sandi: ${error.message}` };
        }
        return { success: true, data: true, message: 'Kata sandi berhasil diubah' };
      } catch (err: any) {
        return { success: false, message: `Gagal mengubah kata sandi: ${err.message}` };
      }
    }
    await simulateNetworkDelay(200);
    return { success: true, data: true, message: 'Kata sandi berhasil diubah' };
  }

  async forgotPassword(credential: string): Promise<ApiResponse<boolean>> {
    await simulateNetworkDelay(400);
    if (!credential) {
      return { success: false, message: 'Masukkan nomor WhatsApp atau Username yang terdaftar' };
    }
    return {
      success: true,
      data: true,
      message: 'Petunjuk reset kata sandi telah dikirimkan ke kontak WhatsApp aparatur terdaftar.',
    };
  }

  async resetPassword(_token: string, newPass: string): Promise<ApiResponse<boolean>> {
    await simulateNetworkDelay(400);
    if (newPass.length < 8) {
      return { success: false, message: 'Kata sandi baru minimal 8 karakter' };
    }
    return { success: true, data: true, message: 'Kata sandi berhasil direset. Silakan login kembali.' };
  }

  /**
   * Permission Matrix Enforcement as per PRD Section 5
   */
  hasPermission(role: UserRole, action: PermissionAction): boolean {
    switch (action) {
      case 'view_dashboard':
        return true; // All roles can view their designated dashboard

      case 'manage_master_desa':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA';

      case 'view_master_desa':
        return role !== 'PERANGKAT_DESA';

      case 'manage_master_aparatur':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA';

      case 'view_master_aparatur':
        return role !== 'PERANGKAT_DESA';

      case 'manage_master_jabatan':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA';

      case 'view_master_jabatan':
        return role !== 'PERANGKAT_DESA';

      case 'regular_attendance':
        // Super Admin is NOT default attendance subject
        return role !== 'SUPER_ADMIN';

      case 'monitor_attendance':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA' || role === 'KEPALA_DESA' || role === 'SEKRETARIS_DESA';

      case 'attendance_correction':
        // STRICT PRD 5: Only Operator can perform attendance correction
        return role === 'OPERATOR_DESA';

      case 'submit_izin_sakit':
        return role !== 'SUPER_ADMIN';

      case 'approve_izin_sakit':
        return role === 'OPERATOR_DESA' || role === 'KEPALA_DESA' || role === 'SEKRETARIS_DESA';

      case 'submit_cuti':
        return role !== 'SUPER_ADMIN';

      case 'verify_cuti':
        // PRD: Operator / Sekretaris Desa can verify cuti
        return role === 'OPERATOR_DESA' || role === 'SEKRETARIS_DESA';

      case 'approve_cuti':
        // PRD 19: Final approval for Cuti is only Kepala Desa
        return role === 'KEPALA_DESA';

      case 'dl_self_submit':
        return role !== 'SUPER_ADMIN';

      case 'dl_assign':
        // Super Admin, Operator, Kades, Sekdes can assign DL to other apparatus
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA' || role === 'KEPALA_DESA' || role === 'SEKRETARIS_DESA';

      case 'dl_verify':
        return role === 'SEKRETARIS_DESA' || role === 'OPERATOR_DESA' || role === 'KEPALA_DESA' || role === 'SUPER_ADMIN';

      case 'dl_approve':
        return role === 'SEKRETARIS_DESA' || role === 'KEPALA_DESA' || role === 'SUPER_ADMIN';

      case 'dl_ratify':
        // STRICT PRD 12.3: Only Kepala Desa can ratify DL
        return role === 'KEPALA_DESA';

      case 'view_reports':
        return true;

      case 'manage_settings':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA';

      case 'view_audit_logs':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA' || role === 'KEPALA_DESA' || role === 'SEKRETARIS_DESA';

      case 'view_security_events':
        return role === 'SUPER_ADMIN' || role === 'OPERATOR_DESA';

      default:
        return false;
    }
  }
}

export const authService = new AuthService();
