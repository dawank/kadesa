import {
  SystemSettingItem,
  WorkSchedule,
  Holiday,
  SettingCategory,
  LetterheadConfig,
  DEFAULT_LETTERHEAD_CONFIG,
  TimezoneOption,
  INDONESIA_TIMEZONES,
} from '../types/settings';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { auditService } from './auditService';
import { supabase, isSupabaseConfigured } from './supabaseClient';

class SettingsService {
  private settings: SystemSettingItem[] = [];
  private schedules: WorkSchedule[] = [];
  private holidays: Holiday[] = [];

  /**
   * Khusus isolasi unit test offline
   */
  seedTestFixtures(fixtures: { settings?: SystemSettingItem[]; schedules?: WorkSchedule[]; holidays?: Holiday[] }): void {
    if (fixtures.settings) this.settings = [...fixtures.settings];
    if (fixtures.schedules) this.schedules = [...fixtures.schedules];
    if (fixtures.holidays) this.holidays = [...fixtures.holidays];
  }

  /**
   * Centralized Configuration Resolver (as specified in PRD Section 108 & 36.7)
   */
  async getActiveSetting(key: string, dateStr?: string): Promise<SystemSettingItem | undefined> {
    const targetDate = dateStr || new Date().toISOString().split('T')[0];

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        let query = supabase
          .from('system_settings')
          .select('*')
          .eq('key', key)
          .lte('effective_from', targetDate);

        // Filter effective_to: IS NULL OR >= targetDate
        query = query.or(`effective_to.is.null,effective_to.gte.${targetDate}`);

        // Order by effective_from DESC so the most recent effective configuration takes precedence
        const { data, error } = await query
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return {
            id: data.id,
            key: data.key,
            label: data.label || data.description || data.key,
            value: data.value,
            valueType: data.value_type || 'string',
            description: data.description || '',
            category: data.category as any,
            effectiveFrom: data.effective_from,
            effectiveTo: data.effective_to,
            status: data.status,
            updatedBy: data.updated_by || 'system',
            updatedAt: data.updated_at,
          };
        }
      } catch (err) {
        console.warn('Supabase getActiveSetting error:', err);
      }
    }

    return this.settings
      .filter(
        (s) =>
          s.key === key &&
          s.effectiveFrom <= targetDate &&
          (!s.effectiveTo || s.effectiveTo >= targetDate)
      )
      .sort((a, b) => b.effectiveFrom.localeCompare(a.effectiveFrom))[0];
  }

  async getStringSetting(key: string, fallback: string, dateStr?: string): Promise<string> {
    const s = await this.getActiveSetting(key, dateStr);
    return s ? s.value : fallback;
  }

  async getNumberSetting(key: string, fallback: number, dateStr?: string): Promise<number> {
    const s = await this.getActiveSetting(key, dateStr);
    return s ? Number(s.value) : fallback;
  }

  async isOfficeCoordinatesConfirmed(dateStr?: string): Promise<boolean> {
    const val = await this.getStringSetting('OFFICE_COORDINATES_CONFIRMED', 'false', dateStr);
    return val === 'true';
  }

  async getAllSettings(category?: SettingCategory): Promise<ApiResponse<SystemSettingItem[]>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
          data: [],
        };
      }
      try {
        let query = supabase.from('system_settings').select('*').order('category').order('key');
        if (category) {
          query = query.eq('category', category);
        }
        const { data, error } = await query;
        if (error) {
          return { success: false, message: `Gagal memuat pengaturan dari database: ${error.message}`, data: [] };
        }
        const list: SystemSettingItem[] = (data || []).map((d) => ({
          id: d.id,
          key: d.key,
          label: d.description || d.key,
          value: d.value,
          valueType: d.value_type || 'string',
          description: d.description || '',
          category: d.category as any,
          effectiveFrom: d.effective_from,
          effectiveTo: d.effective_to,
          status: d.status,
          updatedBy: d.updated_by || 'system',
          updatedAt: d.updated_at,
        }));
        this.settings = list;
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat pengaturan: ${err.message || err}`, data: [] };
      }
    }
    await simulateNetworkDelay(200);
    let list = [...this.settings];
    if (category) {
      list = list.filter((s) => s.category === category);
    }
    return { success: true, data: list };
  }

  async updateSetting(
    key: string,
    newValue: string,
    effectiveFrom: string,
    updatedBy: string
  ): Promise<ApiResponse<SystemSettingItem>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { data: updated, error } = await supabase
          .from('system_settings')
          .update({
            value: newValue,
            effective_from: effectiveFrom,
            updated_by: updatedBy,
            updated_at: new Date().toISOString(),
          })
          .eq('key', key)
          .select()
          .single();
        if (error) {
          return { success: false, message: `Gagal memperbarui pengaturan: ${error.message}` };
        }
        if (updated) {
          const item: SystemSettingItem = {
            id: updated.id,
            key: updated.key,
            label: updated.description || updated.key,
            value: updated.value,
            valueType: updated.value_type || 'string',
            description: updated.description || '',
            category: updated.category as any,
            effectiveFrom: updated.effective_from,
            effectiveTo: updated.effective_to,
            status: updated.status,
            updatedBy: updated.updated_by || updatedBy,
            updatedAt: updated.updated_at,
          };
          return { success: true, data: item, message: 'Pengaturan berhasil diperbarui di database.' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui: ${err.message}` };
      }
    }
    await simulateNetworkDelay(400);
    const existing = this.settings.find((s) => s.key === key && s.status === 'ACTIVE');
    if (!existing) {
      return { success: false, message: 'Pengaturan tidak ditemukan' };
    }

    // Versioning: Archive existing or set effectiveTo
    existing.effectiveTo = effectiveFrom;
    existing.status = 'ARCHIVED';

    const newSetting: SystemSettingItem = {
      ...existing,
      id: `set-${Date.now().toString().slice(-4)}`,
      value: newValue,
      effectiveFrom,
      effectiveTo: null,
      status: 'ACTIVE',
      updatedBy,
      updatedAt: new Date().toISOString(),
    };

    this.settings.push(newSetting);

    // Audit Trail: Record change in system_settings (PRD Section 36 & ADR-012 Point B.8)
    await auditService.recordAuditEvent({
      actorUserId: updatedBy,
      actorNama: updatedBy,
      actorRole: 'SUPER_ADMIN',
      eventType: 'SETTINGS_CHANGED',
      entityType: 'system_settings',
      entityId: newSetting.id,
      beforeData: { key, value: existing.value, status: existing.status },
      afterData: { key, value: newValue, status: 'ACTIVE', effectiveFrom },
      reason: `Pembaruan konfigurasi ${existing.label}`,
    });

    return {
      success: true,
      data: newSetting,
      message: `Pengaturan ${existing.label} berhasil diperbarui (Berlaku mulai ${effectiveFrom}).`,
    };
  }

  // Timezone Helper
  async getTimezone(): Promise<TimezoneOption> {
    const tzCode = await this.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    const found = INDONESIA_TIMEZONES.find((t) => t.code === tzCode);
    return found || INDONESIA_TIMEZONES[0];
  }

  // Work Schedules (Integrated with Supabase Cloud work_schedules)
  async getWorkSchedules(): Promise<ApiResponse<WorkSchedule[]>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
          data: [],
        };
      }
      try {
        const { data, error } = await supabase
          .from('work_schedules')
          .select('*')
          .order('day_of_week', { ascending: true });

        if (error) {
          return { success: false, message: `Gagal memuat jadwal kerja dari database: ${error.message}`, data: [] };
        }
        const list: WorkSchedule[] = (data || []).map((d: any) => ({
          id: d.id,
          dayOfWeek: d.day_of_week,
          dayName: d.day_name,
          startTime: d.start_time ? d.start_time.slice(0, 5) : '07:30',
          endTime: d.end_time ? d.end_time.slice(0, 5) : '15:30',
          toleranceMinutes: d.tolerance_minutes != null ? Number(d.tolerance_minutes) : 15,
          active: Boolean(d.active),
        }));
        this.schedules = list;
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat jadwal kerja: ${err.message || err}`, data: [] };
      }
    }
    await simulateNetworkDelay(200);
    return { success: true, data: [...this.schedules] };
  }

  async updateWorkSchedule(
    id: string,
    data: Partial<WorkSchedule>,
    actorNama?: string,
    actorRole?: string
  ): Promise<ApiResponse<WorkSchedule>> {
    // Validasi jam operasional jika hari berstatus kerja
    if (data.active !== false && data.startTime && data.endTime) {
      if (data.startTime >= data.endTime) {
        return {
          success: false,
          message: 'Jam mulai kerja harus lebih awal dari jam selesai kerja.',
        };
      }
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const dbPayload: any = {
          updated_at: new Date().toISOString(),
        };
        if (data.startTime !== undefined) {
          dbPayload.start_time = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
        }
        if (data.endTime !== undefined) {
          dbPayload.end_time = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;
        }
        if (data.toleranceMinutes !== undefined) {
          dbPayload.tolerance_minutes = Number(data.toleranceMinutes);
        }
        if (data.active !== undefined) {
          dbPayload.active = Boolean(data.active);
        }

        const { data: updated, error } = await supabase
          .from('work_schedules')
          .update(dbPayload)
          .eq('id', id)
          .select()
          .single();

        if (error) {
          return { success: false, message: `Gagal memperbarui jadwal kerja di database: ${error.message}` };
        }

        if (updated) {
          const item: WorkSchedule = {
            id: updated.id,
            dayOfWeek: updated.day_of_week,
            dayName: updated.day_name,
            startTime: updated.start_time ? updated.start_time.slice(0, 5) : '07:30',
            endTime: updated.end_time ? updated.end_time.slice(0, 5) : '15:30',
            toleranceMinutes: updated.tolerance_minutes != null ? Number(updated.tolerance_minutes) : 15,
            active: Boolean(updated.active),
          };

          const idx = this.schedules.findIndex((s) => s.id === id);
          if (idx !== -1) {
            this.schedules[idx] = item;
          }

          // Record Audit Log
          await auditService.recordAuditEvent({
            actorUserId: actorNama || 'system',
            actorNama: actorNama || 'Administrator',
            actorRole: actorRole || 'SUPER_ADMIN',
            eventType: 'SETTINGS_CHANGED',
            entityType: 'work_schedules',
            entityId: id,
            reason: `Pembaruan jadwal kerja hari ${item.dayName} (${item.active ? 'Kerja' : 'Libur'})`,
            afterData: { ...item },
          });

          return { success: true, data: item, message: `Jadwal hari ${item.dayName} berhasil disimpan.` };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal memperbarui jadwal kerja: ${err.message}` };
      }
    }

    await simulateNetworkDelay(300);
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx === -1) return { success: false, message: 'Jadwal kerja tidak ditemukan' };

    this.schedules[idx] = { ...this.schedules[idx], ...data };

    await auditService.recordAuditEvent({
      actorUserId: actorNama || 'system',
      actorNama: actorNama || 'Administrator',
      actorRole: actorRole || 'SUPER_ADMIN',
      eventType: 'SETTINGS_CHANGED',
      entityType: 'work_schedules',
      entityId: id,
      reason: `Pembaruan jadwal kerja hari ${this.schedules[idx].dayName} (${this.schedules[idx].active ? 'Kerja' : 'Libur'})`,
      afterData: { ...this.schedules[idx] },
    });

    return { success: true, data: this.schedules[idx], message: `Jadwal hari ${this.schedules[idx].dayName} berhasil disimpan.` };
  }

  /**
   * Helper terpadu: Ambil jadwal operasional dan status hari libur untuk suatu tanggal dan zona waktu tertentu
   */
  async getScheduleForDate(
    date: Date,
    tz?: string,
    options?: { schedules?: WorkSchedule[]; holidays?: Holiday[] }
  ): Promise<{
    schedule: WorkSchedule | null;
    isHoliday: boolean;
    holidayName?: string;
    isWorkingDay: boolean;
    dayName: string;
    dateStr: string;
    timezone: string;
  }> {
    const timezone = tz || (await this.getStringSetting('TIMEZONE', 'Asia/Jakarta'));
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);

    // Periksa hari libur
    const holidayList = options?.holidays ?? (await this.getHolidays()).data ?? [];
    const holiday = holidayList.find((h) => h.active && h.date === dateStr);

    // Tentukan hari dalam seminggu berdasarkan zona waktu target (1 = Senin s/d 7 = Minggu)
    const weekdayShort = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
    }).format(date);

    const dayMap: Record<string, number> = {
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6,
      Sun: 7,
    };
    const isoDay = dayMap[weekdayShort] || 1;

    const scheduleList = options?.schedules ?? (await this.getWorkSchedules()).data ?? [];
    const schedule = scheduleList.find((s) => s.dayOfWeek === isoDay) || null;

    const isHoliday = Boolean(holiday);
    const isWorkingDay = Boolean(schedule && schedule.active && !isHoliday);

    return {
      schedule,
      isHoliday,
      holidayName: holiday?.name,
      isWorkingDay,
      dayName: schedule?.dayName || weekdayShort,
      dateStr,
      timezone,
    };
  }

  // Holidays (Integrated with Supabase Cloud)
  async getHolidays(): Promise<ApiResponse<Holiday[]>> {
    if (!IS_DEMO_MODE) {
      if (!isSupabaseConfigured()) {
        return {
          success: false,
          message: 'Konfigurasi Supabase belum terpasang di environment.',
          errorCode: 'SUPABASE_NOT_CONFIGURED',
          data: [],
        };
      }
      try {
        const { data, error } = await supabase
          .from('holidays')
          .select('*')
          .order('date', { ascending: true });

        if (error) {
          return { success: false, message: `Gagal memuat hari libur dari database: ${error.message}`, data: [] };
        }
        const list: Holiday[] = (data || []).map((d: any) => ({
          id: d.id,
          date: d.date,
          name: d.name,
          active: Boolean(d.active),
        }));
        this.holidays = list;
        return { success: true, data: list };
      } catch (err: any) {
        return { success: false, message: `Gagal memuat hari libur: ${err.message || err}`, data: [] };
      }
    }
    await simulateNetworkDelay(200);
    return { success: true, data: [...this.holidays] };
  }

  async addHoliday(date: string, name: string): Promise<ApiResponse<Holiday>> {
    if (!date || !name.trim()) {
      return { success: false, message: 'Tanggal dan Nama hari libur wajib diisi' };
    }

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const id = `hol-${Date.now().toString().slice(-4)}`;
        const { data, error } = await supabase
          .from('holidays')
          .insert({
            id,
            date,
            name: name.trim(),
            active: true,
          })
          .select()
          .single();

        if (error) {
          return { success: false, message: `Gagal menambahkan hari libur ke database: ${error.message}` };
        }

        if (data) {
          const newHol: Holiday = {
            id: data.id,
            date: data.date,
            name: data.name,
            active: Boolean(data.active),
          };
          this.holidays.push(newHol);
          return { success: true, data: newHol, message: 'Hari libur berhasil ditambahkan ke database' };
        }
      } catch (err: any) {
        return { success: false, message: `Gagal menambahkan hari libur: ${err.message}` };
      }
    }

    await simulateNetworkDelay(300);
    const newHol: Holiday = {
      id: `hol-${Date.now().toString().slice(-4)}`,
      date,
      name: name.trim(),
      active: true,
    };
    this.holidays.push(newHol);
    return { success: true, data: newHol, message: 'Hari libur berhasil ditambahkan' };
  }

  async deleteHoliday(id: string): Promise<ApiResponse<boolean>> {
    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const { error } = await supabase.from('holidays').delete().eq('id', id);
        if (error) {
          return { success: false, message: `Gagal menghapus hari libur: ${error.message}` };
        }
        this.holidays = this.holidays.filter((h) => h.id !== id);
        return { success: true, data: true, message: 'Hari libur berhasil dihapus dari database' };
      } catch (err: any) {
        return { success: false, message: `Gagal menghapus hari libur: ${err.message}` };
      }
    }

    await simulateNetworkDelay(200);
    this.holidays = this.holidays.filter((h) => h.id !== id);
    return { success: true, data: true, message: 'Hari libur berhasil dihapus' };
  }

  // Branding & Login Background
  async getLoginBackground(): Promise<string> {
    const defaultBg = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80';
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('kadesa_login_bg');
      if (cached) return cached;
    }
    const val = await this.getStringSetting('LOGIN_BACKGROUND_IMAGE', defaultBg);
    return val;
  }

  async updateLoginBackground(imageUrl: string, updatedBy = 'Operator'): Promise<ApiResponse<string>> {
    await simulateNetworkDelay(300);
    const today = new Date().toISOString().split('T')[0];
    await this.updateSetting('LOGIN_BACKGROUND_IMAGE', imageUrl, today, updatedBy);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kadesa_login_bg', imageUrl);
      window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { loginBackground: imageUrl } }));
    }
    return { success: true, data: imageUrl, message: 'Foto latar belakang login berhasil diperbarui' };
  }

  async resetLoginBackground(updatedBy = 'Operator'): Promise<ApiResponse<string>> {
    await simulateNetworkDelay(300);
    const defaultBg = 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80';
    const today = new Date().toISOString().split('T')[0];
    await this.updateSetting('LOGIN_BACKGROUND_IMAGE', defaultBg, today, updatedBy);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kadesa_login_bg');
      window.dispatchEvent(new CustomEvent('kadesa-branding-changed', { detail: { loginBackground: defaultBg } }));
    }
    return { success: true, data: defaultBg, message: 'Foto latar belakang login direset ke default' };
  }

  // Letterhead Configuration for Official Print & PDF
  async getLetterheadConfig(): Promise<LetterheadConfig> {
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('kadesa_letterhead_config');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {}
      }
    }
    const val = await this.getStringSetting('LETTERHEAD_CONFIG', '');
    if (val) {
      try {
        return JSON.parse(val);
      } catch {}
    }
    return DEFAULT_LETTERHEAD_CONFIG;
  }

  async updateLetterheadConfig(
    config: LetterheadConfig,
    updatedBy = 'Operator'
  ): Promise<ApiResponse<LetterheadConfig>> {
    await simulateNetworkDelay(300);
    const today = new Date().toISOString().split('T')[0];
    const jsonStr = JSON.stringify(config);
    await this.updateSetting('LETTERHEAD_CONFIG', jsonStr, today, updatedBy);
    if (typeof window !== 'undefined') {
      localStorage.setItem('kadesa_letterhead_config', jsonStr);
      window.dispatchEvent(
        new CustomEvent('kadesa-branding-changed', { detail: { letterheadConfig: config } })
      );
    }
    return { success: true, data: config, message: 'Pengaturan desain kop surat berhasil disimpan' };
  }

  async resetLetterheadConfig(updatedBy = 'Operator'): Promise<ApiResponse<LetterheadConfig>> {
    await simulateNetworkDelay(300);
    const today = new Date().toISOString().split('T')[0];
    const jsonStr = JSON.stringify(DEFAULT_LETTERHEAD_CONFIG);
    await this.updateSetting('LETTERHEAD_CONFIG', jsonStr, today, updatedBy);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kadesa_letterhead_config');
      window.dispatchEvent(
        new CustomEvent('kadesa-branding-changed', {
          detail: { letterheadConfig: DEFAULT_LETTERHEAD_CONFIG },
        })
      );
    }
    return {
      success: true,
      data: DEFAULT_LETTERHEAD_CONFIG,
      message: 'Desain kop surat berhasil direset ke standar',
    };
  }
}

export const settingsService = new SettingsService();
