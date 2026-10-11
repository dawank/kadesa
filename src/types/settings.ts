export type SettingCategory =
  | 'WORK_SCHEDULE'
  | 'GEOFENCE'
  | 'WORKFLOW'
  | 'EVIDENCE'
  | 'SECURITY'
  | 'BRANDING'
  | 'LETTERHEAD';

/**
 * Daftar Baku Kunci Pengaturan Sistem (Hardcoded Constants - Tidak Dapat Diubah)
 */
export const SYSTEM_SETTING_KEYS = [
  'WORK_SCHEDULE_START',
  'WORK_SCHEDULE_END',
  'TOLERANCE_LATE_MINUTES',
  'TIMEZONE',
  'LOCATION_NAME',
  'REGULAR_ATTENDANCE_RADIUS_METERS',
  'DL_MIN_RADIUS_METERS',
  'DL_MAX_RADIUS_METERS',
  'DL_RATIFICATION_DEADLINE_HOURS',
  'MAX_SELFIE_FILE_SIZE_MB',
  'ALLOWED_SELFIE_FORMATS',
  'SESSION_TIMEOUT_MINUTES',
  'LOGIN_BACKGROUND_IMAGE',
  'VILLAGE_LOGO',
  'LETTERHEAD_CONFIG',
] as const;

export type SystemSettingKey = (typeof SYSTEM_SETTING_KEYS)[number];

export interface TimezoneOption {
  code: string; // 'Asia/Jakarta' | 'Asia/Makassar' | 'Asia/Jayapura'
  label: string; // 'WIB — Waktu Indonesia Barat'
  shortLabel: string; // 'WIB'
  offset: string; // 'UTC+07:00'
}

export const INDONESIA_TIMEZONES: TimezoneOption[] = [
  {
    code: 'Asia/Jakarta',
    label: 'WIB — Waktu Indonesia Barat',
    shortLabel: 'WIB',
    offset: 'UTC+07:00',
  },
  {
    code: 'Asia/Makassar',
    label: 'WITA — Waktu Indonesia Tengah',
    shortLabel: 'WITA',
    offset: 'UTC+08:00',
  },
  {
    code: 'Asia/Jayapura',
    label: 'WIT — Waktu Indonesia Timur',
    shortLabel: 'WIT',
    offset: 'UTC+09:00',
  },
];

export interface SystemSettingItem {
  id: string;
  category: SettingCategory;
  readonly key: SystemSettingKey | string; // Hardcoded, tidak dapat diubah oleh pengguna
  label: string;
  value: string;
  valueType: 'string' | 'number' | 'boolean' | 'json';
  description: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  updatedBy: string;
  updatedAt: string;
}

export interface WorkSchedule {
  id: string;
  dayOfWeek: number; // 1 (Senin) to 7 (Minggu)
  dayName: string;
  startTime: string; // HH:mm (e.g. 07:30)
  endTime: string; // HH:mm (e.g. 15:30)
  toleranceMinutes: number; // e.g. 15
  active: boolean;
}

export interface Holiday {
  id: string;
  date: string; // YYYY-MM-DD
  name: string;
  active: boolean;
}

export interface LetterheadLineConfig {
  text: string;
  fontSize: number; // Ukuran font dalam pt (contoh: 10, 12, 14, 16)
  fontWeight: 'normal' | 'bold' | '600' | '700' | '800';
  fontStyle: 'normal' | 'italic';
  textTransform: 'uppercase' | 'capitalize' | 'none';
  letterSpacing?: number; // Jarak antar huruf dalam px
}

export interface LetterheadConfig {
  templateId: 'standard_pemda' | 'classic_arial' | 'bookman_elegance' | 'two_logos';
  fontFamily: string; // 'Times New Roman, serif' | 'Arial, sans-serif' | 'Bookman Old Style, serif' | 'Georgia, serif'
  layout: 'left_logo_center_text' | 'left_logo_left_text' | 'center_logo_center_text' | 'two_logos_center_text';
  logoSize: number; // Ukuran lebar/tinggi logo dalam px (contoh: 75)
  logoUrl?: string; // URL / base64 logo desa atau daerah
  secondaryLogoUrl?: string; // Logo pendamping kanan jika memakai template dua logo
  showLogo: boolean;
  line1: LetterheadLineConfig; // Baris 1: Pemerintah Daerah Kabupaten/Kota
  line2: LetterheadLineConfig; // Baris 2: Kecamatan
  line3: LetterheadLineConfig; // Baris 3: Desa / Kantor Desa
  line4: LetterheadLineConfig; // Baris 4: Alamat Lengkap, Kode Pos, & Email / Kontak
  borderStyle: 'double' | 'solid_thick' | 'solid_thin' | 'none';
  borderColor: string; // Warna garis pembatas (default: '#000000')
  borderThickness: number; // Ketebalan garis pembatas (default: 3)
  paddingBottom: number; // Jarak padding bawah kop surat (px)
  defaultOrientation?: 'portrait' | 'landscape'; // Orientasi kertas cetak resmi
}

