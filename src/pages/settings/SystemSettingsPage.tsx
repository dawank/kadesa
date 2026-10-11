import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { settingsService } from '../../services/settingsService';
import { masterService } from '../../services/masterService';
import { reportService } from '../../services/reportService';
import { Village } from '../../types/master';
import {
  SystemSettingItem,
  WorkSchedule,
  Holiday,
  SettingCategory,
  LetterheadConfig,
  LetterheadLineConfig,
  TimezoneOption,
  INDONESIA_TIMEZONES,
} from '../../types/settings';
import { Modal } from '../../components/common/Modal';
import { ConfirmDialog } from '../../components/common/ConfirmDialog';
import { LocationPickerMap } from '../../components/common/LocationPickerMap';
import { useToast } from '../../context/ToastContext';
import {
  Settings,
  Clock,
  MapPin,
  Shield,
  FileCheck,
  Calendar,
  Save,
  Plus,
  Trash2,
  AlertCircle,
  Palette,
  Image as ImageIcon,
  Upload,
  Camera,
  ExternalLink,
  RefreshCw,
  Printer,
  FileText,
  Type,
  Sliders,
  Sparkles,
  Check,
  Globe,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Info,
  Navigation,
  Compass,
  Loader2,
} from 'lucide-react';

export const SystemSettingsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();

  const [activeCategory, setActiveCategory] = useState<SettingCategory>('WORK_SCHEDULE');
  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);

  // Branding & Visuals
  const {
    logo,
    villageName,
    loginBackground,
    letterheadConfig,
    updateVillageLogo,
    removeVillageLogo,
    updateLoginBackground,
    resetLoginBackground,
    updateLetterheadConfig,
    resetLetterheadConfig,
  } = useBranding();

  const [formLetterhead, setFormLetterhead] = useState<LetterheadConfig>(letterheadConfig);
  const [isSavingLetterhead, setIsSavingLetterhead] = useState(false);
  const [activeLineTab, setActiveLineTab] = useState<'line1' | 'line2' | 'line3' | 'line4'>('line1');

  useEffect(() => {
    if (letterheadConfig) {
      setFormLetterhead(letterheadConfig);
    }
  }, [letterheadConfig]);

  const LETTERHEAD_PRESETS = [
    {
      id: 'standard_pemda' as const,
      name: 'Standar Pemda (Sesuai Contoh)',
      tag: 'Rekomendasi Dinas',
      desc: 'Format resmi instansi pemda: font serif, logo kiri, teks tengah bertingkat, garis ganda',
      config: {
        templateId: 'standard_pemda' as const,
        fontFamily: 'Times New Roman, serif',
        layout: 'left_logo_center_text' as const,
        logoSize: 76,
        showLogo: true,
        borderStyle: 'double' as const,
        borderColor: '#000000',
        borderThickness: 3,
        paddingBottom: 10,
        defaultOrientation: 'portrait' as const,
        line1: { text: 'PEMERINTAH DAERAH KABUPATEN TASIKMALAYA', fontSize: 14, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line2: { text: 'KECAMATAN CISAYONG', fontSize: 13, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line3: { text: 'DESA NUSAWANGI', fontSize: 16, fontWeight: '800' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line4: { text: 'Jl. Nusawangi no. 40 Cisayong 46153 Tasikmalaya | e-mail : nusawangi.ds@gmail.com', fontSize: 10, fontWeight: 'normal' as const, fontStyle: 'italic' as const, textTransform: 'none' as const, letterSpacing: 0 },
      },
    },
    {
      id: 'classic_arial' as const,
      name: 'Modern Sans (Arial)',
      tag: 'Kontemporer',
      desc: 'Tampilan kontemporer bersih dengan font Arial dan garis tebal solid',
      config: {
        templateId: 'classic_arial' as const,
        fontFamily: 'Arial, sans-serif',
        layout: 'left_logo_center_text' as const,
        logoSize: 72,
        showLogo: true,
        borderStyle: 'solid_thick' as const,
        borderColor: '#0f172a',
        borderThickness: 2.5,
        paddingBottom: 10,
        defaultOrientation: 'portrait' as const,
        line1: { text: 'PEMERINTAH KABUPATEN BOGOR', fontSize: 13, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line2: { text: 'KECAMATAN CIBINONG', fontSize: 12, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line3: { text: 'PEMERINTAH DESA SUKAMAJU', fontSize: 15, fontWeight: '800' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line4: { text: 'Jl. Raya Sukamaju No. 12 Cibinong 16911 | Telp: (021) 87654321', fontSize: 9.5, fontWeight: 'normal' as const, fontStyle: 'normal' as const, textTransform: 'none' as const, letterSpacing: 0 },
      },
    },
    {
      id: 'bookman_elegance' as const,
      name: 'Bookman Elegan',
      tag: 'Klasik Formal',
      desc: 'Nuansa formal klasik dengan jenis huruf Bookman Old Style',
      config: {
        templateId: 'bookman_elegance' as const,
        fontFamily: 'Bookman Old Style, serif',
        layout: 'left_logo_center_text' as const,
        logoSize: 78,
        showLogo: true,
        borderStyle: 'double' as const,
        borderColor: '#1e293b',
        borderThickness: 3,
        paddingBottom: 12,
        defaultOrientation: 'portrait' as const,
        line1: { text: 'PEMERINTAH KABUPATEN TASIKMALAYA', fontSize: 13.5, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line2: { text: 'KECAMATAN CISAYONG', fontSize: 12.5, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line3: { text: 'KANTOR KEPALA DESA NUSAWANGI', fontSize: 15.5, fontWeight: '800' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line4: { text: 'Jl. Nusawangi No. 40 Cisayong 46153 Tasikmalaya | e-mail: nusawangi.ds@gmail.com', fontSize: 10, fontWeight: 'normal' as const, fontStyle: 'italic' as const, textTransform: 'none' as const, letterSpacing: 0 },
      },
    },
    {
      id: 'two_logos' as const,
      name: 'Dua Logo (Simetris)',
      tag: 'Bilateral',
      desc: 'Logo Pemkab di kiri dan Logo Desa di kanan dengan teks terpusat di tengah',
      config: {
        templateId: 'two_logos' as const,
        fontFamily: 'Times New Roman, serif',
        layout: 'two_logos_center_text' as const,
        logoSize: 72,
        showLogo: true,
        borderStyle: 'double' as const,
        borderColor: '#000000',
        borderThickness: 3,
        paddingBottom: 10,
        defaultOrientation: 'portrait' as const,
        line1: { text: 'PEMERINTAH DAERAH KABUPATEN BOGOR', fontSize: 13.5, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line2: { text: 'KECAMATAN CIBINONG', fontSize: 12.5, fontWeight: '700' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line3: { text: 'DESA SUKAMAJU', fontSize: 15.5, fontWeight: '800' as const, fontStyle: 'normal' as const, textTransform: 'uppercase' as const, letterSpacing: 0.5 },
        line4: { text: 'Jl. Raya Sukamaju No. 12 Cibinong 16911 | email: desasukamaju@bogorkab.go.id', fontSize: 9.5, fontWeight: 'normal' as const, fontStyle: 'italic' as const, textTransform: 'none' as const, letterSpacing: 0 },
        secondaryLogoUrl: '/logo-kadesa.png',
      },
    },
  ];

  const updateLine = (lineKey: 'line1' | 'line2' | 'line3' | 'line4', patch: Partial<LetterheadLineConfig>) => {
    setFormLetterhead((prev) => ({
      ...prev,
      [lineKey]: {
        ...prev[lineKey],
        ...patch,
      },
    }));
  };

  const handleApplyLetterheadPreset = (presetId: LetterheadConfig['templateId']) => {
    const found = LETTERHEAD_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    setFormLetterhead((prev) => ({
      ...prev,
      ...found.config,
      line1: { ...prev.line1, ...found.config.line1 },
      line2: { ...prev.line2, ...found.config.line2 },
      line3: { ...prev.line3, ...found.config.line3 },
      line4: { ...prev.line4, ...found.config.line4 },
    }));
    showToast(`Template "${found.name}" diterapkan ke editor`, 'info');
  };

  const handleSaveLetterhead = async () => {
    setIsSavingLetterhead(true);
    try {
      const ok = await updateLetterheadConfig(formLetterhead, currentUser?.nama || 'Operator');
      if (ok) {
        showToast('Pengaturan kop surat resmi berhasil disimpan ke sistem', 'success');
      } else {
        showToast('Gagal menyimpan kop surat', 'error');
      }
    } catch {
      showToast('Terjadi kesalahan saat menyimpan kop surat', 'error');
    } finally {
      setIsSavingLetterhead(false);
    }
  };

  const handleResetLetterhead = async () => {
    setIsSavingLetterhead(true);
    try {
      const ok = await resetLetterheadConfig(currentUser?.nama || 'Operator');
      if (ok) {
        setFormLetterhead(letterheadConfig);
        showToast('Kop surat dikembalikan ke setelan standar dinas', 'info');
      }
    } finally {
      setIsSavingLetterhead(false);
    }
  };

  const handleTestPrintLetterhead = () => {
    reportService.exportToPDF(
      'UJI PRATINJAU CETAK KOP SURAT DINAS',
      ['No', 'Parameter Tata Naskah', 'Nilai Konfigurasi Terpilih', 'Status Verifikasi'],
      [
        ['1', 'Tata Letak / Alignment', formLetterhead.layout, 'Sesuai Spesifikasi'],
        ['2', 'Jenis Huruf (Font)', formLetterhead.fontFamily, 'Teraplikasi'],
        ['3', 'Format Garis Pembatas', formLetterhead.borderStyle, 'Sesuai Standar'],
        ['4', 'Proporsi Ukuran Huruf', `B1: ${formLetterhead.line1.fontSize}pt | B2: ${formLetterhead.line2.fontSize}pt | B3: ${formLetterhead.line3.fontSize}pt | B4: ${formLetterhead.line4.fontSize}pt`, 'Terverifikasi'],
        ['5', 'Orientasi Kertas Cetak', formLetterhead.defaultOrientation === 'landscape' ? 'Landscape (Mendatar)' : 'Portrait (Tegak)', 'Sesuai Pilihan'],
      ],
      'Dokumen uji pratinjau tata naskah dinas dan kop surat resmi KADESA',
      logo,
      villageName,
      formLetterhead,
      formLetterhead.defaultOrientation || 'portrait'
    );
    showToast(
      `Jendela pratinjau cetak PDF (${formLetterhead.defaultOrientation === 'landscape' ? 'Landscape / Mendatar' : 'Portrait / Tegak'}) dibuka.`,
      'info'
    );
  };

  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState('');

  const PRESET_BACKGROUNDS = [
    {
      id: 'kantor',
      name: 'Kantor Balai Desa',
      url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'alam',
      name: 'Persawahan & Alam Desa',
      url: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1920&q=80',
    },
    {
      id: 'modern',
      name: 'Gedung Pemerintahan Modern',
      url: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1920&q=80',
    },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format logo harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran logo maksimal 2 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setIsUploadingLogo(true);
      const ok = await updateVillageLogo(result);
      setIsUploadingLogo(false);
      if (ok) {
        showToast('Logo resmi desa berhasil diperbarui (di-overwrite)', 'success');
        loadData();
      } else {
        showToast('Gagal memperbarui logo desa', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    setIsUploadingLogo(true);
    const ok = await removeVillageLogo();
    setIsUploadingLogo(false);
    if (ok) {
      showToast('Logo desa direset ke logo bawaan', 'info');
      loadData();
    } else {
      showToast('Gagal mereset logo desa', 'error');
    }
  };

  const handleBgUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format foto latar belakang harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 3 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setIsUploadingBg(true);
      const ok = await updateLoginBackground(result, currentUser?.nama);
      setIsUploadingBg(false);
      if (ok) {
        showToast('Foto latar belakang login berhasil diperbarui (di-overwrite)', 'success');
        loadData();
      } else {
        showToast('Gagal memperbarui foto latar belakang', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetBg = async (url: string) => {
    setIsUploadingBg(true);
    const ok = await updateLoginBackground(url, currentUser?.nama);
    setIsUploadingBg(false);
    if (ok) {
      showToast('Foto latar belakang login berhasil diganti', 'success');
      loadData();
    }
  };

  const handleSaveCustomBgUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customBgUrl.trim()) {
      showToast('Masukkan URL foto latar belakang', 'warning');
      return;
    }
    setIsUploadingBg(true);
    const ok = await updateLoginBackground(customBgUrl.trim(), currentUser?.nama);
    setIsUploadingBg(false);
    if (ok) {
      showToast('URL foto latar belakang berhasil disimpan', 'success');
      setCustomBgUrl('');
      loadData();
    }
  };

  const handleResetBg = async () => {
    setIsUploadingBg(true);
    const ok = await resetLoginBackground(currentUser?.nama);
    setIsUploadingBg(false);
    if (ok) {
      showToast('Foto latar belakang login direset ke default', 'info');
      loadData();
    }
  };

  // Village Master Profile State
  const [village, setVillage] = useState<Village | null>(null);

  // Form State Interfaces
  interface GeofenceFormState {
    office_lat: number;
    office_lng: number;
    office_address: string;
    location_name: string;
    regular_radius: number;
    dl_min_radius: number;
    dl_max_radius: number;
    confirmed_status: boolean;
  }

  interface WorkflowFormState {
    dl_ratification_hours: number;
  }

  interface EvidenceFormState {
    max_selfie_size_mb: number;
    allowed_formats: string[];
  }

  interface SecurityFormState {
    session_timeout_minutes: number;
    max_login_attempts: number;
  }

  // Snapshots from backend for dirty checking & reset
  const [geofenceSnapshot, setGeofenceSnapshot] = useState<GeofenceFormState | null>(null);
  const [workflowSnapshot, setWorkflowSnapshot] = useState<WorkflowFormState | null>(null);
  const [evidenceSnapshot, setEvidenceSnapshot] = useState<EvidenceFormState | null>(null);
  const [securitySnapshot, setSecuritySnapshot] = useState<SecurityFormState | null>(null);

  // Form Working States (Direct Editing)
  const [geofenceForm, setGeofenceForm] = useState<GeofenceFormState>({
    office_lat: -6.4828,
    office_lng: 106.8436,
    office_address: 'Jl. Raya Sukamaju No. 12, Cibinong',
    location_name: 'Kantor Desa Sukamaju',
    regular_radius: 100,
    dl_min_radius: 25,
    dl_max_radius: 500,
    confirmed_status: true,
  });

  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({
    dl_ratification_hours: 72,
  });

  const [evidenceForm, setEvidenceForm] = useState<EvidenceFormState>({
    max_selfie_size_mb: 5,
    allowed_formats: ['image/jpeg', 'image/png', 'image/webp'],
  });

  const [securityForm, setSecurityForm] = useState<SecurityFormState>({
    session_timeout_minutes: 120,
    max_login_attempts: 5,
  });

  // Saving state for the active direct-edit tab
  const [isSavingTab, setIsSavingTab] = useState(false);

  // Tab guard state
  const [pendingTab, setPendingTab] = useState<SettingCategory | null>(null);
  const [isLeaveTabConfirmOpen, setIsLeaveTabConfirmOpen] = useState(false);

  // Timezone State
  const [selectedTimezone, setSelectedTimezone] = useState<string>('Asia/Jakarta');
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);

  // Dynamic Work Schedules State
  const [editableSchedules, setEditableSchedules] = useState<WorkSchedule[]>([]);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [isSavingAllSchedules, setIsSavingAllSchedules] = useState(false);

  // Holiday Modal
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  const canManage = hasPermission('manage_settings');

  // Dirty detection per tab
  const isGeofenceDirty = Boolean(
    geofenceSnapshot &&
    (geofenceForm.office_lat !== geofenceSnapshot.office_lat ||
     geofenceForm.office_lng !== geofenceSnapshot.office_lng ||
     geofenceForm.office_address !== geofenceSnapshot.office_address ||
     geofenceForm.location_name !== geofenceSnapshot.location_name ||
     geofenceForm.regular_radius !== geofenceSnapshot.regular_radius ||
     geofenceForm.dl_min_radius !== geofenceSnapshot.dl_min_radius ||
     geofenceForm.dl_max_radius !== geofenceSnapshot.dl_max_radius ||
     geofenceForm.confirmed_status !== geofenceSnapshot.confirmed_status)
  );

  const isWorkflowDirty = Boolean(
    workflowSnapshot &&
    workflowForm.dl_ratification_hours !== workflowSnapshot.dl_ratification_hours
  );

  const isEvidenceDirty = Boolean(
    evidenceSnapshot &&
    (evidenceForm.max_selfie_size_mb !== evidenceSnapshot.max_selfie_size_mb ||
     evidenceForm.allowed_formats.slice().sort().join(',') !== evidenceSnapshot.allowed_formats.slice().sort().join(','))
  );

  const isSecurityDirty = Boolean(
    securitySnapshot &&
    (securityForm.session_timeout_minutes !== securitySnapshot.session_timeout_minutes ||
     securityForm.max_login_attempts !== securitySnapshot.max_login_attempts)
  );

  const getUnsavedCount = (): number => {
    if (activeCategory === 'GEOFENCE' && geofenceSnapshot) {
      let count = 0;
      if (geofenceForm.office_lat !== geofenceSnapshot.office_lat || geofenceForm.office_lng !== geofenceSnapshot.office_lng) count++;
      if (geofenceForm.office_address !== geofenceSnapshot.office_address) count++;
      if (geofenceForm.location_name !== geofenceSnapshot.location_name) count++;
      if (geofenceForm.regular_radius !== geofenceSnapshot.regular_radius) count++;
      if (geofenceForm.dl_min_radius !== geofenceSnapshot.dl_min_radius) count++;
      if (geofenceForm.dl_max_radius !== geofenceSnapshot.dl_max_radius) count++;
      if (geofenceForm.confirmed_status !== geofenceSnapshot.confirmed_status) count++;
      return count;
    }
    if (activeCategory === 'WORKFLOW' && workflowSnapshot) {
      return workflowForm.dl_ratification_hours !== workflowSnapshot.dl_ratification_hours ? 1 : 0;
    }
    if (activeCategory === 'EVIDENCE' && evidenceSnapshot) {
      let count = 0;
      if (evidenceForm.max_selfie_size_mb !== evidenceSnapshot.max_selfie_size_mb) count++;
      if (evidenceForm.allowed_formats.slice().sort().join(',') !== evidenceSnapshot.allowed_formats.slice().sort().join(',')) count++;
      return count;
    }
    if (activeCategory === 'SECURITY' && securitySnapshot) {
      let count = 0;
      if (securityForm.session_timeout_minutes !== securitySnapshot.session_timeout_minutes) count++;
      if (securityForm.max_login_attempts !== securitySnapshot.max_login_attempts) count++;
      return count;
    }
    return 0;
  };

  const isCurrentTabDirty = (): boolean => {
    if (activeCategory === 'GEOFENCE') return isGeofenceDirty;
    if (activeCategory === 'WORKFLOW') return isWorkflowDirty;
    if (activeCategory === 'EVIDENCE') return isEvidenceDirty;
    if (activeCategory === 'SECURITY') return isSecurityDirty;
    return false;
  };

  const handleTabClick = (targetCat: SettingCategory) => {
    if (targetCat === activeCategory) return;
    if (isCurrentTabDirty()) {
      setPendingTab(targetCat);
      setIsLeaveTabConfirmOpen(true);
    } else {
      setActiveCategory(targetCat);
    }
  };

  const handleConfirmLeaveTab = () => {
    if (activeCategory === 'GEOFENCE' && geofenceSnapshot) setGeofenceForm({ ...geofenceSnapshot });
    else if (activeCategory === 'WORKFLOW' && workflowSnapshot) setWorkflowForm({ ...workflowSnapshot });
    else if (activeCategory === 'EVIDENCE' && evidenceSnapshot) setEvidenceForm({ ...evidenceSnapshot });
    else if (activeCategory === 'SECURITY' && securitySnapshot) setSecurityForm({ ...securitySnapshot });

    if (pendingTab) {
      setActiveCategory(pendingTab);
      setPendingTab(null);
    }
    setIsLeaveTabConfirmOpen(false);
  };

  const handleResetActiveTab = () => {
    if (activeCategory === 'GEOFENCE' && geofenceSnapshot) {
      setGeofenceForm({ ...geofenceSnapshot });
      showToast('Perubahan parameter Geofence dikembalikan ke nilai awal', 'info');
    } else if (activeCategory === 'WORKFLOW' && workflowSnapshot) {
      setWorkflowForm({ ...workflowSnapshot });
      showToast('Perubahan parameter Alur Kerja dikembalikan ke nilai awal', 'info');
    } else if (activeCategory === 'EVIDENCE' && evidenceSnapshot) {
      setEvidenceForm({ ...evidenceSnapshot });
      showToast('Perubahan parameter Bukti Selfie dikembalikan ke nilai awal', 'info');
    } else if (activeCategory === 'SECURITY' && securitySnapshot) {
      setSecurityForm({ ...securitySnapshot });
      showToast('Perubahan parameter Keamanan dikembalikan ke nilai awal', 'info');
    }
  };

  const loadData = async () => {
    const sRes = await settingsService.getAllSettings();
    const vRes = await masterService.getVillage();
    if (vRes.data) {
      setVillage(vRes.data);
    }

    if (sRes.data) {
      setSettings(sRes.data);
      const tzItem = sRes.data.find((s) => s.key === 'TIMEZONE');
      if (tzItem) {
        setSelectedTimezone(tzItem.value);
      }

      const items = sRes.data;

      // GEOFENCE resolution
      const locName = items.find((s) => s.key === 'LOCATION_NAME')?.value || vRes.data?.nama || 'Kantor Desa Sukamaju';
      const regRad = Number(items.find((s) => s.key === 'REGULAR_ATTENDANCE_RADIUS_METERS')?.value) || 100;
      const dlMin = Number(items.find((s) => s.key === 'DL_MIN_RADIUS_METERS')?.value) || 25;
      const dlMax = Number(items.find((s) => s.key === 'DL_MAX_RADIUS_METERS')?.value) || 500;
      const confirmed = items.find((s) => s.key === 'OFFICE_COORDINATES_CONFIRMED')?.value !== 'false';

      let lat = vRes.data?.latitude ?? -6.4828;
      let lng = vRes.data?.longitude ?? 106.8436;
      const officeCoordsSetting = items.find((s) => s.key === 'OFFICE_COORDINATES')?.value;
      if (officeCoordsSetting && officeCoordsSetting.includes(',')) {
        const parts = officeCoordsSetting.split(',').map((p) => Number(p.trim()));
        if (!isNaN(parts[0]) && !isNaN(parts[1])) {
          lat = parts[0];
          lng = parts[1];
        }
      }

      const gState: GeofenceFormState = {
        office_lat: lat,
        office_lng: lng,
        office_address: vRes.data?.alamat || 'Jl. Raya Sukamaju No. 12, Cibinong',
        location_name: locName,
        regular_radius: regRad,
        dl_min_radius: dlMin,
        dl_max_radius: dlMax,
        confirmed_status: confirmed,
      };
      setGeofenceSnapshot(gState);
      setGeofenceForm(gState);

      // WORKFLOW
      const ratHours = Number(items.find((s) => s.key === 'DL_RATIFICATION_DEADLINE_HOURS')?.value) || 72;
      const wState: WorkflowFormState = { dl_ratification_hours: ratHours };
      setWorkflowSnapshot(wState);
      setWorkflowForm(wState);

      // EVIDENCE
      const maxMb = Number(items.find((s) => s.key === 'MAX_SELFIE_FILE_SIZE_MB')?.value) || 5;
      const formatsStr = items.find((s) => s.key === 'ALLOWED_SELFIE_FORMATS')?.value || 'image/jpeg,image/png,image/webp';
      const formats = formatsStr.split(',').map((f) => f.trim()).filter(Boolean);
      const eState: EvidenceFormState = {
        max_selfie_size_mb: maxMb,
        allowed_formats: formats.length > 0 ? formats : ['image/jpeg', 'image/png', 'image/webp'],
      };
      setEvidenceSnapshot(eState);
      setEvidenceForm(eState);

      // SECURITY
      const sTimeout = Number(items.find((s) => s.key === 'SESSION_TIMEOUT_MINUTES')?.value) || 120;
      const maxAttempts = Number(items.find((s) => s.key === 'MAX_LOGIN_ATTEMPTS')?.value) || 5;
      const secState: SecurityFormState = {
        session_timeout_minutes: sTimeout,
        max_login_attempts: maxAttempts,
      };
      setSecuritySnapshot(secState);
      setSecurityForm(secState);
    }

    const schRes = await settingsService.getWorkSchedules();
    if (schRes.data) {
      setSchedules(schRes.data);
      setEditableSchedules(schRes.data);
    }

    const holRes = await settingsService.getHolidays();
    if (holRes.data) setHolidays(holRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveActiveTab = async () => {
    if (!currentUser) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const actor = `${currentUser.nama} (${currentUser.role})`;

    if (activeCategory === 'GEOFENCE') {
      if (isNaN(geofenceForm.office_lat) || geofenceForm.office_lat < -90 || geofenceForm.office_lat > 90) {
        showToast('Latitude kantor desa harus berada dalam rentang valid -90 hingga 90', 'warning');
        return;
      }
      if (isNaN(geofenceForm.office_lng) || geofenceForm.office_lng < -180 || geofenceForm.office_lng > 180) {
        showToast('Longitude kantor desa harus berada dalam rentang valid -180 hingga 180', 'warning');
        return;
      }
      if (geofenceForm.regular_radius < 20 || geofenceForm.regular_radius > 500) {
        showToast('Radius presensi reguler harus antara 20 dan 500 meter', 'warning');
        return;
      }
      if (geofenceForm.dl_min_radius > geofenceForm.dl_max_radius) {
        showToast('Radius minimum Dinas Luar tidak boleh lebih besar dari radius maksimum', 'warning');
        return;
      }

      setIsSavingTab(true);
      let anyError = false;

      // Update village profile jika koordinat atau alamat berubah
      if (geofenceSnapshot && (
        geofenceForm.office_lat !== geofenceSnapshot.office_lat ||
        geofenceForm.office_lng !== geofenceSnapshot.office_lng ||
        geofenceForm.office_address !== geofenceSnapshot.office_address
      )) {
        const vRes = await masterService.updateVillage({
          latitude: geofenceForm.office_lat,
          longitude: geofenceForm.office_lng,
          alamat: geofenceForm.office_address,
        });
        if (!vRes.success) {
          anyError = true;
          showToast(vRes.message || 'Gagal menyimpan profil desa', 'error');
        }
      }

      // Update system settings items yang berubah
      if (geofenceSnapshot) {
        if (geofenceForm.office_lat !== geofenceSnapshot.office_lat || geofenceForm.office_lng !== geofenceSnapshot.office_lng) {
          const coordStr = `${geofenceForm.office_lat}, ${geofenceForm.office_lng}`;
          const res = await settingsService.updateSetting('OFFICE_COORDINATES', coordStr, todayStr, actor);
          if (!res.success) anyError = true;
        }
        if (geofenceForm.regular_radius !== geofenceSnapshot.regular_radius) {
          const res = await settingsService.updateSetting('REGULAR_ATTENDANCE_RADIUS_METERS', String(geofenceForm.regular_radius), todayStr, actor);
          if (!res.success) anyError = true;
        }
        if (geofenceForm.dl_min_radius !== geofenceSnapshot.dl_min_radius) {
          const res = await settingsService.updateSetting('DL_MIN_RADIUS_METERS', String(geofenceForm.dl_min_radius), todayStr, actor);
          if (!res.success) anyError = true;
        }
        if (geofenceForm.dl_max_radius !== geofenceSnapshot.dl_max_radius) {
          const res = await settingsService.updateSetting('DL_MAX_RADIUS_METERS', String(geofenceForm.dl_max_radius), todayStr, actor);
          if (!res.success) anyError = true;
        }
        if (geofenceForm.location_name !== geofenceSnapshot.location_name) {
          const res = await settingsService.updateSetting('LOCATION_NAME', geofenceForm.location_name, todayStr, actor);
          if (!res.success) anyError = true;
        }
        if (geofenceForm.confirmed_status !== geofenceSnapshot.confirmed_status) {
          const res = await settingsService.updateSetting('OFFICE_COORDINATES_CONFIRMED', String(geofenceForm.confirmed_status), todayStr, actor);
          if (!res.success) anyError = true;
        }
      }

      setIsSavingTab(false);
      if (!anyError) {
        showToast('Pengaturan Geofence & Radius berhasil disimpan', 'success');
        loadData();
      }
    } else if (activeCategory === 'WORKFLOW') {
      if (workflowForm.dl_ratification_hours < 1 || workflowForm.dl_ratification_hours > 720) {
        showToast('Batas waktu ratifikasi DL harus antara 1 hingga 720 jam', 'warning');
        return;
      }
      setIsSavingTab(true);
      const res = await settingsService.updateSetting('DL_RATIFICATION_DEADLINE_HOURS', String(workflowForm.dl_ratification_hours), todayStr, actor);
      setIsSavingTab(false);
      if (res.success) {
        showToast('Pengaturan Alur Kerja & DL berhasil disimpan', 'success');
        loadData();
      } else {
        showToast(res.message || 'Gagal menyimpan pengaturan alur kerja', 'error');
      }
    } else if (activeCategory === 'EVIDENCE') {
      if (evidenceForm.max_selfie_size_mb < 1 || evidenceForm.max_selfie_size_mb > 20) {
        showToast('Ukuran maksimal file foto harus antara 1 hingga 20 MB', 'warning');
        return;
      }
      if (evidenceForm.allowed_formats.length === 0) {
        showToast('Pilih minimal 1 format file foto yang didukung', 'warning');
        return;
      }
      setIsSavingTab(true);
      let anyError = false;
      if (evidenceSnapshot?.max_selfie_size_mb !== evidenceForm.max_selfie_size_mb) {
        const res = await settingsService.updateSetting('MAX_SELFIE_FILE_SIZE_MB', String(evidenceForm.max_selfie_size_mb), todayStr, actor);
        if (!res.success) anyError = true;
      }
      if (evidenceSnapshot?.allowed_formats.slice().sort().join(',') !== evidenceForm.allowed_formats.slice().sort().join(',')) {
        const res = await settingsService.updateSetting('ALLOWED_SELFIE_FORMATS', evidenceForm.allowed_formats.join(','), todayStr, actor);
        if (!res.success) anyError = true;
      }
      setIsSavingTab(false);
      if (!anyError) {
        showToast('Pengaturan Data & Bukti Selfie berhasil disimpan', 'success');
        loadData();
      } else {
        showToast('Sebagian pengaturan bukti selfie gagal disimpan', 'error');
      }
    } else if (activeCategory === 'SECURITY') {
      if (securityForm.session_timeout_minutes < 15 || securityForm.session_timeout_minutes > 1440) {
        showToast('Batas waktu sesi harus antara 15 hingga 1440 menit (24 jam)', 'warning');
        return;
      }
      if (securityForm.max_login_attempts < 3 || securityForm.max_login_attempts > 20) {
        showToast('Batas percobaan login harus antara 3 hingga 20 kali', 'warning');
        return;
      }
      setIsSavingTab(true);
      let anyError = false;
      if (securitySnapshot?.session_timeout_minutes !== securityForm.session_timeout_minutes) {
        const res = await settingsService.updateSetting('SESSION_TIMEOUT_MINUTES', String(securityForm.session_timeout_minutes), todayStr, actor);
        if (!res.success) anyError = true;
      }
      if (securitySnapshot?.max_login_attempts !== securityForm.max_login_attempts) {
        const res = await settingsService.updateSetting('MAX_LOGIN_ATTEMPTS', String(securityForm.max_login_attempts), todayStr, actor);
        if (!res.success) anyError = true;
      }
      setIsSavingTab(false);
      if (!anyError) {
        showToast('Pengaturan Keamanan & Sesi berhasil disimpan', 'success');
        loadData();
      } else {
        showToast('Sebagian pengaturan keamanan gagal disimpan', 'error');
      }
    }
  };

  const handleSaveTimezone = async () => {
    if (!currentUser) return;
    setIsSavingTimezone(true);
    const todayStr = new Date().toISOString().split('T')[0];
    const res = await settingsService.updateSetting(
      'TIMEZONE',
      selectedTimezone,
      todayStr,
      `${currentUser.nama} (${currentUser.role})`
    );
    setIsSavingTimezone(false);
    if (res.success) {
      const tzObj = INDONESIA_TIMEZONES.find((t) => t.code === selectedTimezone);
      showToast(`Zona waktu resmi desa berhasil disimpan: ${tzObj?.label || selectedTimezone}`, 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal menyimpan zona waktu', 'error');
    }
  };

  const handleScheduleFieldChange = (id: string, field: keyof WorkSchedule, value: any) => {
    setEditableSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSaveSingleSchedule = async (sch: WorkSchedule) => {
    if (!currentUser) return;
    if (sch.active && sch.startTime && sch.endTime && sch.startTime >= sch.endTime) {
      showToast(`Jadwal ${sch.dayName}: Jam masuk (${sch.startTime}) harus lebih awal dari jam pulang (${sch.endTime})`, 'warning');
      return;
    }

    setSavingScheduleId(sch.id);
    const res = await settingsService.updateWorkSchedule(
      sch.id,
      sch,
      `${currentUser.nama}`,
      `${currentUser.role}`
    );
    setSavingScheduleId(null);

    if (res.success) {
      showToast(`Jadwal hari ${sch.dayName} berhasil disimpan (${sch.active ? 'Kerja' : 'Libur'})`, 'success');
      loadData();
    } else {
      showToast(res.message || `Gagal menyimpan jadwal ${sch.dayName}`, 'error');
    }
  };

  const handleSaveAllSchedules = async () => {
    if (!currentUser) return;
    for (const sch of editableSchedules) {
      if (sch.active && sch.startTime && sch.endTime && sch.startTime >= sch.endTime) {
        showToast(`Jadwal ${sch.dayName}: Jam masuk (${sch.startTime}) harus lebih awal dari jam pulang (${sch.endTime})`, 'warning');
        return;
      }
    }

    setIsSavingAllSchedules(true);
    let allOk = true;
    for (const sch of editableSchedules) {
      const res = await settingsService.updateWorkSchedule(
        sch.id,
        sch,
        `${currentUser.nama}`,
        `${currentUser.role}`
      );
      if (!res.success) {
        allOk = false;
        showToast(res.message || `Gagal menyimpan jadwal ${sch.dayName}`, 'error');
        break;
      }
    }
    setIsSavingAllSchedules(false);

    if (allOk) {
      showToast('Seluruh jadwal hari kerja mingguan berhasil disimpan ke database', 'success');
      loadData();
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      showToast('Tanggal dan nama libur wajib diisi', 'warning');
      return;
    }
    const res = await settingsService.addHoliday(holidayDate, holidayName);
    if (res.success) {
      showToast('Hari libur berhasil ditambahkan', 'success');
      setIsHolidayModalOpen(false);
      setHolidayDate('');
      setHolidayName('');
      loadData();
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    const res = await settingsService.deleteHoliday(id);
    if (res.success) {
      showToast('Hari libur dihapus', 'info');
      loadData();
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>Pengaturan Konfigurasi Sistem KADESA</h1>
          <p>
            Kelola pengaturan parameter kerja, lokasi presensi, keamanan, dan tata naskah dinas desa
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeCategory === 'WORK_SCHEDULE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('WORK_SCHEDULE')}
          >
            <Clock size={14} /> 1. Jam Kerja & Kalender
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'GEOFENCE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('GEOFENCE')}
            style={{ position: 'relative' }}
          >
            <MapPin size={14} /> 2. Geofence & Radius
            {isGeofenceDirty && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-warning-500, #f59e0b)',
                  marginLeft: 6,
                }}
                title="Terdapat perubahan belum disimpan"
              />
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'WORKFLOW' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('WORKFLOW')}
            style={{ position: 'relative' }}
          >
            <FileCheck size={14} /> 3. Alur Kerja & DL
            {isWorkflowDirty && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-warning-500, #f59e0b)',
                  marginLeft: 6,
                }}
                title="Terdapat perubahan belum disimpan"
              />
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'EVIDENCE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('EVIDENCE')}
            style={{ position: 'relative' }}
          >
            <Shield size={14} /> 4. Data & Bukti Selfie
            {isEvidenceDirty && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-warning-500, #f59e0b)',
                  marginLeft: 6,
                }}
                title="Terdapat perubahan belum disimpan"
              />
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'SECURITY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('SECURITY')}
            style={{ position: 'relative' }}
          >
            <Settings size={14} /> 5. Keamanan & Sesi
            {isSecurityDirty && (
              <span
                style={{
                  display: 'inline-block',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-warning-500, #f59e0b)',
                  marginLeft: 6,
                }}
                title="Terdapat perubahan belum disimpan"
              />
            )}
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'BRANDING' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('BRANDING')}
          >
            <Palette size={14} /> 6. Branding & Tampilan
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'LETTERHEAD' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('LETTERHEAD')}
          >
            <FileText size={14} /> 7. Kop Surat Resmi
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. TAB GEOFENCE & RADIUS (DIRECT INLINE EDITING)                           */}
      {/* ========================================================================= */}
      {activeCategory === 'GEOFENCE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Card: Titik Pusat & Peta Interaktif */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">
                <MapPin size={18} color="var(--color-primary-600)" />
                Titik Pusat Kantor Desa & Visualisasi Geofence
              </h3>
              <span className={`badge ${geofenceForm.confirmed_status ? 'badge-hadir' : 'badge-izin'}`}>
                {geofenceForm.confirmed_status ? 'Koordinat Resmi Terverifikasi' : 'Status Pilot / Belum Diverifikasi'}
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
              Atur titik koordinat referensi kantor desa dan pantau radius lingkaran geofence secara interaktif. Titik ini menjadi titik acuan verifikasi kehadiran presensi aparatur desa secara langsung.
            </p>

            {/* Pilot vs Official Warning Notice */}
            <div
              style={{
                backgroundColor: geofenceForm.confirmed_status ? 'var(--color-slate-50)' : '#fffbeb',
                border: `1px solid ${geofenceForm.confirmed_status ? 'var(--border-subtle)' : '#fde68a'}`,
                borderRadius: 'var(--radius-md)',
                padding: '0.875rem 1rem',
                marginBottom: '1.25rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <AlertTriangle size={18} color={geofenceForm.confirmed_status ? 'var(--color-slate-600)' : '#d97706'} style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ flex: 1, fontSize: '0.8125rem' }}>
                <strong style={{ color: geofenceForm.confirmed_status ? 'var(--color-slate-800)' : '#92400e' }}>
                  Perhatian Integritas Koordinat Kantor:
                </strong>
                <p style={{ margin: '0.25rem 0 0.5rem', color: geofenceForm.confirmed_status ? 'var(--color-slate-600)' : '#b45309' }}>
                  Sistem membedakan koordinat pilot pengujian dengan koordinat definitif kantor desa resmi. Jangan menganggap koordinat pilot sebagai koordinat resmi desa sebelum ditinjau langsung oleh Kepala Desa / BPD.
                </p>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: canManage ? 'pointer' : 'default', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    checked={geofenceForm.confirmed_status}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, confirmed_status: e.target.checked }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span>Tandai titik ini sebagai Koordinat Resmi Kantor Desa yang Terverifikasi</span>
                </label>
              </div>
            </div>

            {/* Form Fields: Lokasi & Alamat */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Nama Titik Lokasi Kantor <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={geofenceForm.location_name}
                  onChange={(e) => setGeofenceForm((prev) => ({ ...prev, location_name: e.target.value }))}
                  placeholder="Contoh: Kantor Desa Sukamaju"
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Label referensi lokasi kantor yang tampil pada laporan presensi aparatur</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Alamat Lengkap Kantor Desa <span className="required">*</span>
                </label>
                <input
                  type="text"
                  className="form-input"
                  value={geofenceForm.office_address}
                  onChange={(e) => setGeofenceForm((prev) => ({ ...prev, office_address: e.target.value }))}
                  placeholder="Contoh: Jl. Raya Sukamaju No. 12, Cibinong"
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Alamat administratif kantor yang tersinkronisasi dengan master data profil desa</span>
              </div>
            </div>

            {/* Interactive Leaflet Map */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Peta Penentuan Titik & Lingkaran Radius Geofence (Geser Marker atau Klik pada Peta)
              </label>
              <LocationPickerMap
                latitude={geofenceForm.office_lat}
                longitude={geofenceForm.office_lng}
                radiusMeters={geofenceForm.regular_radius}
                onChange={(coords) => {
                  setGeofenceForm((prev) => ({
                    ...prev,
                    office_lat: Number(coords.latitude.toFixed(6)),
                    office_lng: Number(coords.longitude.toFixed(6)),
                  }));
                }}
                onRadiusChange={(newRad) => {
                  setGeofenceForm((prev) => ({ ...prev, regular_radius: newRad }));
                }}
                height="380px"
                showSearch={true}
                showGpsButton={true}
                showManualInputs={false}
                readOnly={!canManage || isSavingTab}
              />
            </div>

            {/* Direct Coordinate Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'flex-end' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Latitude Titik Pusat <span className="required">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={geofenceForm.office_lat}
                  onChange={(e) => setGeofenceForm((prev) => ({ ...prev, office_lat: parseFloat(e.target.value) || 0 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Rentang valid: -90.0 s/d 90.0</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Longitude Titik Pusat <span className="required">*</span>
                </label>
                <input
                  type="number"
                  step="0.000001"
                  className="form-input"
                  value={geofenceForm.office_lng}
                  onChange={(e) => setGeofenceForm((prev) => ({ ...prev, office_lng: parseFloat(e.target.value) || 0 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Rentang valid: -180.0 s/d 180.0</span>
              </div>

              <div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ width: '100%', height: '40px' }}
                  disabled={!canManage || isSavingTab}
                  onClick={() => {
                    if (navigator.geolocation) {
                      navigator.geolocation.getCurrentPosition(
                        (pos) => {
                          setGeofenceForm((prev) => ({
                            ...prev,
                            office_lat: Number(pos.coords.latitude.toFixed(6)),
                            office_lng: Number(pos.coords.longitude.toFixed(6)),
                          }));
                          showToast('Koordinat GPS berhasil disinkronkan dari perangkat Anda', 'info');
                        },
                        (err) => {
                          showToast(`Gagal membaca GPS: ${err.message}`, 'warning');
                        },
                        { enableHighAccuracy: true }
                      );
                    } else {
                      showToast('Browser Anda tidak mendukung geolokasi GPS', 'error');
                    }
                  }}
                >
                  <Navigation size={14} /> Gunakan GPS Perangkat
                </button>
              </div>
            </div>
          </div>

          {/* Card: Parameter Batas Radius */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Compass size={18} color="var(--color-primary-600)" />
                Parameter Batas Radius Presensi Reguler & Dinas Luar (DL)
              </h3>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '1.25rem' }}>
              {/* Radius Presensi Reguler */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Radius Presensi Reguler
                  </label>
                  <span className="badge badge-primary">{geofenceForm.regular_radius} meter</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '0.875rem' }}>
                  Jarak maksimal aparatur dari titik kantor desa agar presensi biasa (WFO) dianggap sah.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    min="20"
                    max="500"
                    step="5"
                    className="form-input"
                    value={geofenceForm.regular_radius}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, regular_radius: parseInt(e.target.value) || 0 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Meter</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[50, 100, 150, 200].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`btn ${geofenceForm.regular_radius === preset ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setGeofenceForm((prev) => ({ ...prev, regular_radius: preset }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {preset} m
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius Min DL */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Radius Minimum Dinas Luar (DL)
                  </label>
                  <span className="badge badge-secondary">{geofenceForm.dl_min_radius} meter</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '0.875rem' }}>
                  Jarak terendah dari kantor desa agar tugas luar daerah tidak tertukar dengan presensi kantor.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    min="10"
                    max="1000"
                    step="5"
                    className="form-input"
                    value={geofenceForm.dl_min_radius}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, dl_min_radius: parseInt(e.target.value) || 0 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Meter</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[15, 25, 50, 100].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`btn ${geofenceForm.dl_min_radius === preset ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setGeofenceForm((prev) => ({ ...prev, dl_min_radius: preset }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {preset} m
                    </button>
                  ))}
                </div>
              </div>

              {/* Radius Max DL */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Radius Maksimum Dinas Luar (DL)
                  </label>
                  <span className="badge badge-secondary">{geofenceForm.dl_max_radius} meter</span>
                </div>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '0.875rem' }}>
                  Batas jangkauan terluar radius dinas luar desa dalam penugasan standar.
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    min="50"
                    max="10000"
                    step="25"
                    className="form-input"
                    value={geofenceForm.dl_max_radius}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, dl_max_radius: parseInt(e.target.value) || 0 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>Meter</span>
                </div>
                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[250, 500, 1000, 2000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`btn ${geofenceForm.dl_max_radius === preset ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setGeofenceForm((prev) => ({ ...prev, dl_max_radius: preset }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {preset} m
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Validation warning if DL min > DL max */}
            {geofenceForm.dl_min_radius > geofenceForm.dl_max_radius && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: 'var(--radius-md)',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  color: '#991b1b',
                  fontSize: '0.8125rem',
                }}
              >
                <AlertTriangle size={16} />
                <span>
                  <strong>Kesalahan Validasi:</strong> Batas radius minimum Dinas Luar ({geofenceForm.dl_min_radius} m) tidak boleh melebihi batas radius maksimum ({geofenceForm.dl_max_radius} m).
                </span>
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          <div
            className="card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: isGeofenceDirty ? '2px solid var(--color-warning-500, #f59e0b)' : '1px solid var(--border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {isGeofenceDirty ? (
                <span
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={15} color="#d97706" />
                  {getUnsavedCount()} perubahan parameter Geofence belum disimpan
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" />
                  Semua nilai parameter Geofence sesuai database
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetActiveTab}
                disabled={!isGeofenceDirty || isSavingTab}
              >
                <RotateCcw size={14} /> Batal / Reset
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveActiveTab}
                disabled={!isGeofenceDirty || isSavingTab || !canManage || geofenceForm.dl_min_radius > geofenceForm.dl_max_radius}
              >
                {isSavingTab ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSavingTab ? 'Menyimpan...' : 'Simpan Perubahan Geofence'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TAB ALUR KERJA & DL (DIRECT INLINE EDITING)                             */}
      {/* ========================================================================= */}
      {activeCategory === 'WORKFLOW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <FileCheck size={18} color="var(--color-primary-600)" />
                Konfigurasi Batas Waktu Ratifikasi Dinas Luar (DL)
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
              Atur batas toleransi waktu yang diberikan kepada Kepala Desa atau Sekretaris Desa untuk memverifikasi dan meratifikasi laporan penugasan Dinas Luar setelah kegiatan selesai dilaksanakan.
            </p>

            <div
              style={{
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1.25rem',
                maxWidth: '650px',
                marginBottom: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                  Batas Waktu Ratifikasi Laporan DL <span className="required">*</span>
                </label>
                <span className="badge badge-primary">
                  {workflowForm.dl_ratification_hours} Jam ({(workflowForm.dl_ratification_hours / 24).toFixed(1)} Hari)
                </span>
              </div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                Setelah aparatur mengirimkan laporan kehadiran DL, atasan memiliki waktu hingga batas ini untuk menyetujui atau menolak. Melebihi batas ini, pengajuan berstatus kedaluwarsa sesuai regulasi desa.
              </p>

              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem' }}>
                <input
                  type="number"
                  min="1"
                  max="720"
                  step="1"
                  className="form-input"
                  style={{ maxWidth: '160px' }}
                  value={workflowForm.dl_ratification_hours}
                  onChange={(e) => setWorkflowForm({ dl_ratification_hours: parseInt(e.target.value) || 0 })}
                  disabled={!canManage || isSavingTab}
                />
                <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>Jam</span>
                <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>(Rentang: 1 – 720 Jam / 30 Hari)</span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {[
                  { hours: 24, label: '24 Jam (1 Hari)' },
                  { hours: 48, label: '48 Jam (2 Hari)' },
                  { hours: 72, label: '72 Jam (3 Hari — Rekomendasi)' },
                  { hours: 168, label: '168 Jam (7 Hari Kalender)' },
                ].map((item) => (
                  <button
                    key={item.hours}
                    type="button"
                    className={`btn ${workflowForm.dl_ratification_hours === item.hours ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                    style={{ fontSize: '0.75rem' }}
                    onClick={() => setWorkflowForm({ dl_ratification_hours: item.hours })}
                    disabled={!canManage || isSavingTab}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* SOP Alur Kerja Explanation Card */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
              }}
            >
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Info size={16} color="var(--color-primary-600)" />
                Standar Operasional Alur Kerja Dinas Luar (SOP KADESA)
              </h4>
              <ol style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', paddingLeft: '1.25rem', margin: 0, lineHeight: 1.6 }}>
                <li>Aparatur desa mengajukan penugasan DL atau melakukan presensi tugas luar disertai bukti foto selfie dan geotag koordinat GPS.</li>
                <li>Sistem mencatat presensi dengan status <em>Menunggu Ratifikasi</em> dan memicu notifikasi kepada pejabat penilai.</li>
                <li>Kepala Desa / Pejabat Penilai memverifikasi keabsahan penugasan sebelum batas {workflowForm.dl_ratification_hours} jam berakhir.</li>
                <li>Seluruh tindakan ratifikasi tercatat secara permanen di Audit Trail Supabase Cloud.</li>
              </ol>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div
            className="card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: isWorkflowDirty ? '2px solid var(--color-warning-500, #f59e0b)' : '1px solid var(--border-subtle)',
            }}
          >
            <div>
              {isWorkflowDirty ? (
                <span
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={15} color="#d97706" />
                  Batas waktu ratifikasi telah diubah (belum disimpan ke database)
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" />
                  Nilai parameter Alur Kerja sesuai dengan database
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetActiveTab}
                disabled={!isWorkflowDirty || isSavingTab}
              >
                <RotateCcw size={14} /> Batal / Reset
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveActiveTab}
                disabled={!isWorkflowDirty || isSavingTab || !canManage}
              >
                {isSavingTab ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSavingTab ? 'Menyimpan...' : 'Simpan Perubahan Alur Kerja'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. TAB DATA & BUKTI SELFIE (DIRECT INLINE EDITING)                         */}
      {/* ========================================================================= */}
      {activeCategory === 'EVIDENCE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Shield size={18} color="var(--color-primary-600)" />
                Ketentuan Bukti Foto Presensi & Berkas Selfie
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
              Atur parameter validasi berkas foto kehadiran, batas ukuran berkas yang diperkenankan diunggah oleh aparatur, serta format gambar yang didukung.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.25rem' }}>
              {/* Parameter 1: Max Selfie File Size */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Ukuran Maksimal Berkas Foto <span className="required">*</span>
                  </label>
                  <span className="badge badge-primary">{evidenceForm.max_selfie_size_mb} MB</span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                  Batas ukuran file foto maksimal sebelum diunggah ke storage. Foto akan dikompresi otomatis di sisi browser aparatur.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="range"
                    min="1"
                    max="20"
                    step="1"
                    value={evidenceForm.max_selfie_size_mb}
                    onChange={(e) => setEvidenceForm((prev) => ({ ...prev, max_selfie_size_mb: parseInt(e.target.value) || 1 }))}
                    disabled={!canManage || isSavingTab}
                    style={{ flex: 1 }}
                  />
                  <input
                    type="number"
                    min="1"
                    max="20"
                    step="1"
                    className="form-input"
                    style={{ width: '80px', textAlign: 'center' }}
                    value={evidenceForm.max_selfie_size_mb}
                    onChange={(e) => setEvidenceForm((prev) => ({ ...prev, max_selfie_size_mb: parseInt(e.target.value) || 1 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>MB</span>
                </div>

                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { val: 2, label: '2 MB' },
                    { val: 5, label: '5 MB (Rekomendasi)' },
                    { val: 10, label: '10 MB' },
                    { val: 15, label: '15 MB' },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      className={`btn ${evidenceForm.max_selfie_size_mb === p.val ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setEvidenceForm((prev) => ({ ...prev, max_selfie_size_mb: p.val }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 2: Allowed Formats */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Format Berkas Gambar yang Didukung <span className="required">*</span>
                  </label>
                  <span className="badge badge-secondary">{evidenceForm.allowed_formats.length} Format Aktif</span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                  Pilih tipe format berkas foto bukti kehadiran yang diizinkan untuk diunggah oleh sistem.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                  {[
                    { mime: 'image/jpeg', name: 'JPEG / JPG', desc: 'Format standar kamera smartphone dengan kompresi optimal' },
                    { mime: 'image/png', name: 'PNG', desc: 'Format lossless dengan resolusi tinggi' },
                    { mime: 'image/webp', name: 'WebP', desc: 'Format web modern sangat hemat bandwidth (Rekomendasi)' },
                  ].map((fmt) => {
                    const isChecked = evidenceForm.allowed_formats.includes(fmt.mime);
                    return (
                      <label
                        key={fmt.mime}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.625rem',
                          padding: '0.5rem 0.75rem',
                          backgroundColor: isChecked ? '#f0fdf4' : '#ffffff',
                          border: `1px solid ${isChecked ? '#bbf7d0' : 'var(--border-subtle)'}`,
                          borderRadius: 'var(--radius-md)',
                          cursor: canManage && !isSavingTab ? 'pointer' : 'default',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setEvidenceForm((prev) => ({
                                ...prev,
                                allowed_formats: [...prev.allowed_formats, fmt.mime],
                              }));
                            } else {
                              if (evidenceForm.allowed_formats.length <= 1) {
                                showToast('Minimal harus ada 1 format gambar yang diizinkan', 'warning');
                                return;
                              }
                              setEvidenceForm((prev) => ({
                                ...prev,
                                allowed_formats: prev.allowed_formats.filter((f) => f !== fmt.mime),
                              }));
                            }
                          }}
                          disabled={!canManage || isSavingTab}
                          style={{ marginTop: 3 }}
                        />
                        <div style={{ fontSize: '0.8125rem' }}>
                          <strong style={{ color: 'var(--color-slate-800)' }}>{fmt.name}</strong>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 6 }}>
                            ({fmt.mime})
                          </span>
                          <div style={{ color: 'var(--color-slate-600)', fontSize: '0.75rem', marginTop: 2 }}>{fmt.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Storage Info Card */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
                display: 'flex',
                gap: '0.75rem',
                alignItems: 'flex-start',
              }}
            >
              <Info size={18} color="var(--color-primary-600)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
                <strong style={{ color: 'var(--color-slate-800)' }}>Penyimpanan Foto Bukti Supabase:</strong> Berkas foto selfie aparatur dikompresi di browser pengguna sebelum diunggah ke bucket penyimpanan <code>evidence</code> Supabase. Hal ini menjaga konsumsi kuota data aparatur di pelosok desa tetap hemat tanpa mengorbankan ketajaman wajah aparatur.
              </div>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div
            className="card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: isEvidenceDirty ? '2px solid var(--color-warning-500, #f59e0b)' : '1px solid var(--border-subtle)',
            }}
          >
            <div>
              {isEvidenceDirty ? (
                <span
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={15} color="#d97706" />
                  {getUnsavedCount()} perubahan ketentuan foto selfie belum disimpan
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" />
                  Parameter ketentuan bukti foto tersimpan sesuai database
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetActiveTab}
                disabled={!isEvidenceDirty || isSavingTab}
              >
                <RotateCcw size={14} /> Batal / Reset
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveActiveTab}
                disabled={!isEvidenceDirty || isSavingTab || !canManage || evidenceForm.allowed_formats.length === 0}
              >
                {isSavingTab ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSavingTab ? 'Menyimpan...' : 'Simpan Perubahan Bukti Selfie'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TAB KEAMANAN & SESI (DIRECT INLINE EDITING)                             */}
      {/* ========================================================================= */}
      {activeCategory === 'SECURITY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Settings size={18} color="var(--color-primary-600)" />
                Parameter Keamanan Sesi & Proteksi Akses
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
              Kelola waktu toleransi kedaluwarsa sesi pengguna serta perlindungan terhadap upaya peretasan brute force pada akun aparatur desa.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem', marginBottom: '1.25rem' }}>
              {/* Parameter 1: Session Timeout */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Batas Waktu Kedaluwarsa Sesi (Timeout) <span className="required">*</span>
                  </label>
                  <span className="badge badge-primary">
                    {securityForm.session_timeout_minutes} Menit ({(securityForm.session_timeout_minutes / 60).toFixed(1)} Jam)
                  </span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                  Durasi inaktivitas maksimal sebelum sesi login aparatur otomatis berakhir demi menjaga kerahasiaan data di perangkat bersama.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    min="15"
                    max="1440"
                    step="15"
                    className="form-input"
                    style={{ maxWidth: '160px' }}
                    value={securityForm.session_timeout_minutes}
                    onChange={(e) => setSecurityForm((prev) => ({ ...prev, session_timeout_minutes: parseInt(e.target.value) || 0 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>Menit</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>(15 – 1440 Menit)</span>
                </div>

                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { mins: 30, label: '30 Menit' },
                    { mins: 60, label: '60 Menit (1 Jam)' },
                    { mins: 120, label: '120 Menit (2 Jam — Rekomendasi)' },
                    { mins: 480, label: '480 Menit (8 Jam / 1 Shift)' },
                  ].map((item) => (
                    <button
                      key={item.mins}
                      type="button"
                      className={`btn ${securityForm.session_timeout_minutes === item.mins ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setSecurityForm((prev) => ({ ...prev, session_timeout_minutes: item.mins }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameter 2: Max Login Attempts */}
              <div
                style={{
                  backgroundColor: 'var(--color-slate-50)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.25rem',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label className="form-label" style={{ marginBottom: 0, fontWeight: 700 }}>
                    Batas Maksimal Percobaan Login Gagal <span className="required">*</span>
                  </label>
                  <span className="badge badge-secondary">{securityForm.max_login_attempts} Kali Percobaan</span>
                </div>

                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
                  Toleransi kesalahan kata sandi berturut-turut sebelum akun dibekukan sementara untuk mencegah serangan penembakan sandi otomatis.
                </p>

                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <input
                    type="number"
                    min="3"
                    max="20"
                    step="1"
                    className="form-input"
                    style={{ maxWidth: '160px' }}
                    value={securityForm.max_login_attempts}
                    onChange={(e) => setSecurityForm((prev) => ({ ...prev, max_login_attempts: parseInt(e.target.value) || 0 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-slate-700)' }}>Kali</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>(Rentang: 3 – 20 Kali)</span>
                </div>

                <div style={{ display: 'flex', gap: '0.375rem', flexWrap: 'wrap' }}>
                  {[
                    { attempts: 3, label: '3 Kali (Ketat)' },
                    { attempts: 5, label: '5 Kali (Standar Rekomendasi)' },
                    { attempts: 10, label: '10 Kali (Longgar)' },
                  ].map((item) => (
                    <button
                      key={item.attempts}
                      type="button"
                      className={`btn ${securityForm.max_login_attempts === item.attempts ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                      onClick={() => setSecurityForm((prev) => ({ ...prev, max_login_attempts: item.attempts }))}
                      disabled={!canManage || isSavingTab}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Security Architecture Info */}
            <div
              style={{
                backgroundColor: '#f8fafc',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                padding: '1rem 1.25rem',
              }}
            >
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--color-slate-800)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Shield size={16} color="var(--color-primary-600)" />
                Arsitektur Keamanan Terpasang KADESA
              </h4>
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', margin: 0, lineHeight: 1.6 }}>
                Sistem menerapkan kontrol keamanan berlapis: <strong>Supabase Row Level Security (RLS)</strong> pada seluruh tabel data, otentikasi token JWT terenkripsi, serta isolasi peran berbasis Role-Based Access Control (RBAC). Setiap percobaan otentikasi dicatat pada sistem log keamanan secara real-time.
              </p>
            </div>
          </div>

          {/* Action Footer Bar */}
          <div
            className="card"
            style={{
              padding: '1rem 1.25rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '1rem',
              borderTop: isSecurityDirty ? '2px solid var(--color-warning-500, #f59e0b)' : '1px solid var(--border-subtle)',
            }}
          >
            <div>
              {isSecurityDirty ? (
                <span
                  style={{
                    backgroundColor: '#fffbeb',
                    color: '#92400e',
                    border: '1px solid #fde68a',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontWeight: 600,
                  }}
                >
                  <AlertCircle size={15} color="#d97706" />
                  {getUnsavedCount()} perubahan parameter keamanan belum disimpan
                </span>
              ) : (
                <span
                  style={{
                    backgroundColor: '#f0fdf4',
                    color: '#166534',
                    border: '1px solid #bbf7d0',
                    padding: '0.35rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <CheckCircle2 size={15} color="#16a34a" />
                  Parameter Keamanan & Sesi tersimpan sesuai database
                </span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetActiveTab}
                disabled={!isSecurityDirty || isSavingTab}
              >
                <RotateCcw size={14} /> Batal / Reset
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSaveActiveTab}
                disabled={!isSecurityDirty || isSavingTab || !canManage}
              >
                {isSavingTab ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {isSavingTab ? 'Menyimpan...' : 'Simpan Perubahan Keamanan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCategory === 'WORK_SCHEDULE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Card 1: Timezone Selector */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Globe size={18} color="var(--color-primary-600)" />
                Konfigurasi Zona Waktu Indonesia Resmi
              </h3>
              <span className="badge badge-hadir">
                {INDONESIA_TIMEZONES.find((t) => t.code === selectedTimezone)?.shortLabel || 'WIB'}
              </span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1rem' }}>
              Pilih standar zona waktu Indonesia resmi desa. Sistem menggunakan waktu resmi server/database dan menginterpretasikannya ke zona waktu yang dipilih untuk penentuan tanggal absensi, jam operasional, keterlambatan, dan pelaporan tanpa mengubah timestamp historis.
            </p>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: '1', minWidth: '280px' }}>
                <label className="form-label">Standar Zona Waktu Indonesia <span className="required">*</span></label>
                <select
                  className="form-select"
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  disabled={!canManage || isSavingTimezone}
                >
                  {INDONESIA_TIMEZONES.map((tz) => (
                    <option key={tz.code} value={tz.code}>
                      {tz.label} ({tz.offset}) — {tz.code}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div
                  style={{
                    backgroundColor: 'var(--color-slate-50)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '0.5rem 0.875rem',
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Waktu Lokal Terkini</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '0.9375rem', color: 'var(--color-slate-900)' }}>
                    {new Date().toLocaleTimeString('id-ID', { timeZone: selectedTimezone, hour: '2-digit', minute: '2-digit', second: '2-digit' })}{' '}
                    {INDONESIA_TIMEZONES.find((t) => t.code === selectedTimezone)?.shortLabel}
                  </span>
                </div>

                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleSaveTimezone}
                    disabled={isSavingTimezone}
                  >
                    <Save size={16} /> {isSavingTimezone ? 'Menyimpan...' : 'Simpan Zona Waktu'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Card 2: Dynamic Work Schedules & Operating Hours per Day */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <h3 className="card-title">
                  <Clock size={18} color="var(--color-primary-600)" />
                  Jadwal Hari Kerja Dinamis & Jam Operasional Harian
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginTop: 4 }}>
                  Atur status hari kerja (<strong>KERJA</strong> atau <strong>LIBUR</strong>) untuk setiap hari (Senin s/d Minggu) serta jam operasional individual (Jam Masuk, Jam Pulang, dan Toleransi Keterlambatan).
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveAllSchedules}
                  disabled={isSavingAllSchedules}
                >
                  <Save size={14} /> {isSavingAllSchedules ? 'Menyimpan Semua...' : 'Simpan Semua Hari Kerja'}
                </button>
              )}
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '160px' }}>Hari</th>
                    <th style={{ width: '110px' }}>Status</th>
                    <th style={{ width: '150px' }}>Jam Masuk</th>
                    <th style={{ width: '150px' }}>Jam Pulang</th>
                    <th style={{ width: '150px' }}>Toleransi (Menit)</th>
                    <th style={{ textAlign: 'right', width: '100px' }}>Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {editableSchedules.map((sch) => (
                    <tr key={sch.id} style={{ backgroundColor: sch.active ? 'transparent' : 'var(--color-slate-50)' }}>
                      <td>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', cursor: canManage ? 'pointer' : 'default', fontWeight: 600 }}>
                          <input
                            type="checkbox"
                            checked={sch.active}
                            onChange={(e) => handleScheduleFieldChange(sch.id, 'active', e.target.checked)}
                            disabled={!canManage}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--color-primary-600)', cursor: 'pointer' }}
                          />
                          <span>{sch.dayName}</span>
                        </label>
                      </td>
                      <td>
                        <span className={`badge ${sch.active ? 'badge-hadir' : 'badge-libur'}`}>
                          {sch.active ? 'Kerja' : 'Libur'}
                        </span>
                      </td>
                      <td>
                        <input
                          type="time"
                          className="form-input"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                          value={sch.startTime}
                          disabled={!canManage || !sch.active}
                          onChange={(e) => handleScheduleFieldChange(sch.id, 'startTime', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="time"
                          className="form-input"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                          value={sch.endTime}
                          disabled={!canManage || !sch.active}
                          onChange={(e) => handleScheduleFieldChange(sch.id, 'endTime', e.target.value)}
                        />
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          max="120"
                          className="form-input"
                          style={{ padding: '0.35rem 0.5rem', fontSize: '0.875rem' }}
                          value={sch.toleranceMinutes}
                          disabled={!canManage || !sch.active}
                          onChange={(e) => handleScheduleFieldChange(sch.id, 'toleranceMinutes', Number(e.target.value))}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canManage && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem', padding: '0.35rem 0.65rem' }}
                            onClick={() => handleSaveSingleSchedule(sch)}
                            disabled={savingScheduleId === sch.id || isSavingAllSchedules}
                          >
                            {savingScheduleId === sch.id ? 'Menyimpan...' : 'Simpan'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Card 3: Holiday Calendar */}
          <div className="card">
            <div className="card-header">
              <div>
                <h3 className="card-title">
                  <Calendar size={18} color="var(--color-primary-600)" />
                  Daftar Hari Libur Nasional & Desa ({holidays.length})
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 2 }}>
                  Hari libur resmi desa dikecualikan dari status ALPHA dan bebas dari penalti keterlambatan.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setIsHolidayModalOpen(true)}
                >
                  <Plus size={14} /> Tambah Libur
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {holidays.map((hol) => (
                <div
                  key={hol.id}
                  style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <strong>{hol.name}</strong>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {hol.date}
                    </div>
                  </div>
                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--color-accent-rose)' }}
                      onClick={() => handleDeleteHoliday(hol.id)}
                      title="Hapus Hari Libur"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeCategory === 'BRANDING' && (
        <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
          {/* Village Official Logo Settings Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <Palette size={18} color="var(--color-primary-600)" />
                Logo Resmi Instansi Desa (Media Cetak & Kop Surat)
              </h3>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Logo resmi instansi desa digunakan khusus untuk kop surat dinas, berkas laporan presensi cetak (PDF), dan dokumen administratif desa. Logo desa terpisah dari Logo Aplikasi KADESA dan <strong>tidak akan menggantikan logo aplikasi</strong>.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 90,
                  height: 90,
                  borderRadius: 'var(--radius-lg)',
                  border: '2px solid var(--color-primary-200)',
                  backgroundColor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 8,
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0,
                }}
              >
                <img
                  src={logo}
                  alt={`Logo Desa ${villageName}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 2 }}>{villageName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Format: JPG, PNG, atau WebP (maks. 2 MB)
                </div>

                {canManage && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label className="btn btn-primary btn-sm" style={{ cursor: isUploadingLogo ? 'wait' : 'pointer', margin: 0 }}>
                      <Upload size={14} /> Ganti Logo Desa (Overwrite)
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </label>

                    {logo !== '/logo-kadesa.png' && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={handleResetLogo}
                        disabled={isUploadingLogo}
                        title="Kembalikan ke logo bawaan"
                      >
                        <RefreshCw size={14} /> Reset ke Bawaan
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-100)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                color: 'var(--color-primary-800)',
              }}
            >
              <strong>Petunjuk:</strong> Logo desa digunakan khusus pada dokumen cetak dan naskah dinas resmi. Logo aplikasi sistem tetap dipertahankan.
            </div>
          </div>

          {/* Login Page Background Photo Settings Card */}
          <div className="card">
            <div className="card-header">
              <h3 className="card-title">
                <ImageIcon size={18} color="var(--color-primary-600)" />
                Foto Latar Belakang Halaman Login
              </h3>
              <a
                href="/login"
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                title="Buka halaman login di tab baru"
              >
                Lihat Login <ExternalLink size={12} />
              </a>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Foto visual latar belakang yang ditampilkan saat aparatur desa membuka halaman masuk (Login Page) KADESA.
            </p>

            {/* Live Mockup Preview */}
            <div
              style={{
                width: '100%',
                height: 140,
                borderRadius: 'var(--radius-lg)',
                backgroundImage: `url("${loginBackground}")`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                position: 'relative',
                overflow: 'hidden',
                marginBottom: '1rem',
                border: '1px solid var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* Overlay simulation */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.82), rgba(10, 25, 47, 0.88))',
                  backdropFilter: 'blur(2px)',
                }}
              />
              <div
                style={{
                  position: 'relative',
                  zIndex: 2,
                  padding: '0.5rem 1rem',
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                }}
              >
                <img src={logo} alt="Logo" style={{ width: 26, height: 26, objectFit: 'contain' }} />
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-primary-900)' }}>KADESA</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>Pratinjau Form Login</div>
                </div>
              </div>
            </div>

            {canManage && (
              <>
                {/* Upload & Reset Buttons */}
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                  <label className="btn btn-primary btn-sm" style={{ cursor: isUploadingBg ? 'wait' : 'pointer', margin: 0 }}>
                    <Upload size={14} /> Unggah Foto Sendiri (Overwrite)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      style={{ display: 'none' }}
                      onChange={handleBgUpload}
                      disabled={isUploadingBg}
                    />
                  </label>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetBg}
                    disabled={isUploadingBg}
                  >
                    <RefreshCw size={14} /> Reset ke Foto Default
                  </button>
                </div>

                {/* Preset Options */}
                <div style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem' }}>
                    Atau Pilih Rekomendasi Galeri Cepat:
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.5rem' }}>
                    {PRESET_BACKGROUNDS.map((preset) => {
                      const isSelected = loginBackground === preset.url;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleSelectPresetBg(preset.url)}
                          disabled={isUploadingBg}
                          style={{
                            padding: '0.5rem',
                            borderRadius: 'var(--radius-md)',
                            border: isSelected ? '2px solid var(--color-primary-600)' : '1px solid var(--border-subtle)',
                            backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                            cursor: 'pointer',
                            textAlign: 'left',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.25rem',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 48,
                              borderRadius: 4,
                              backgroundImage: `url("${preset.url}")`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }}
                          />
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: isSelected ? 'var(--color-primary-800)' : 'inherit' }}>
                            {preset.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Custom URL Option */}
                <form onSubmit={handleSaveCustomBgUrl}>
                  <label className="form-label" style={{ fontSize: '0.75rem' }}>
                    Atau Masukkan Tautan / URL Foto Kustom:
                  </label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      type="url"
                      className="form-input"
                      style={{ fontSize: '0.8125rem' }}
                      placeholder="https://contoh-domain.id/foto-kantor-desa.jpg"
                      value={customBgUrl}
                      onChange={(e) => setCustomBgUrl(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary btn-sm" disabled={isUploadingBg || !customBgUrl.trim()}>
                      Terapkan
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}

      {/* 7. Pengaturan Kop Surat Resmi Tab Content */}
      {activeCategory === 'LETTERHEAD' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '2rem' }}>
          {/* Letterhead Designer & Customization Card */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileText size={18} color="var(--color-primary-600)" />
                <h3 className="card-title" style={{ margin: 0 }}>
                  Desain & Pengaturan Kop Surat (Media Cetak & PDF)
                </h3>
                <span className="badge badge-primary" style={{ fontSize: '0.7rem' }}>
                  Kustomisasi Fleksibel
                </span>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestPrintLetterhead}
                  title="Buka pratinjau cetak PDF dokumen dengan kop surat ini"
                >
                  <Printer size={14} /> Uji Pratinjau Cetak
                </button>
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetLetterhead}
                      disabled={isSavingLetterhead}
                      title="Kembalikan format kop surat ke standar dinas"
                    >
                      <RefreshCw size={14} /> Reset ke Standar
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={handleSaveLetterhead}
                      disabled={isSavingLetterhead}
                    >
                      <Save size={14} /> {isSavingLetterhead ? 'Menyimpan...' : 'Simpan Desain Kop'}
                    </button>
                  </>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Kop surat ini digunakan otomatis pada seluruh naskah cetak dinas, dokumen PDF laporan harian, dan rekapitulasi bulanan KADESA. 
              Tata letak, jenis font, ukuran, dan gaya di setiap baris dapat disesuaikan secara mandiri tanpa kaku.
            </p>

            {/* Template Presets Selector */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <Sparkles size={14} color="var(--color-primary-600)" /> Pilih Template Rekomendasi (Preset Siap Pakai):
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.75rem' }}>
                {LETTERHEAD_PRESETS.map((p) => {
                  const isSelected = formLetterhead.templateId === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handleApplyLetterheadPreset(p.id)}
                      style={{
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        border: isSelected ? '2px solid var(--color-primary-600)' : '1px solid var(--border-subtle)',
                        backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                        textAlign: 'left',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.25rem',
                        boxShadow: isSelected ? '0 0 0 1px var(--color-primary-600)' : 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: isSelected ? 'var(--color-primary-900)' : 'inherit' }}>
                          {p.name}
                        </span>
                        {isSelected && <Check size={14} color="var(--color-primary-600)" />}
                      </div>
                      <span className="badge badge-secondary" style={{ width: 'fit-content', fontSize: '0.65rem' }}>
                        {p.tag}
                      </span>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0, marginTop: '0.25rem', lineHeight: 1.3 }}>
                        {p.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Live Interactive WYSIWYG Letterhead Preview Box */}
            <div style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700, margin: 0 }}>
                    Pratinjau Langsung (WYSIWYG Live Preview — Kertas Dokumen):
                  </label>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
                    A4 {formLetterhead.defaultOrientation === 'landscape' ? 'Mendatar (Landscape)' : 'Tegak (Portrait)'}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', backgroundColor: 'var(--color-slate-100)', padding: '2px', borderRadius: 'var(--radius-sm)' }}>
                    <button
                      type="button"
                      className={`btn btn-xs ${(!formLetterhead.defaultOrientation || formLetterhead.defaultOrientation === 'portrait') ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                      onClick={() => setFormLetterhead((prev) => ({ ...prev, defaultOrientation: 'portrait' }))}
                    >
                      Tegak (Portrait)
                    </button>
                    <button
                      type="button"
                      className={`btn btn-xs ${formLetterhead.defaultOrientation === 'landscape' ? 'btn-primary' : 'btn-ghost'}`}
                      style={{ fontSize: '0.68rem', padding: '0.2rem 0.5rem', height: 'auto' }}
                      onClick={() => setFormLetterhead((prev) => ({ ...prev, defaultOrientation: 'landscape' }))}
                    >
                      Mendatar (Landscape)
                    </button>
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                    Font: <strong>{formLetterhead.fontFamily.split(',')[0]}</strong> | Garis: <strong>{formLetterhead.borderStyle}</strong>
                  </span>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: 'var(--radius-md)',
                  padding: '1.5rem',
                  maxWidth: formLetterhead.defaultOrientation === 'landscape' ? '100%' : '780px',
                  margin: '0 auto',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                  fontFamily: formLetterhead.fontFamily,
                  color: '#0f172a',
                  overflowX: 'auto',
                }}
              >
                {/* Simulated Official Letterhead */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: formLetterhead.layout === 'left_logo_left_text' ? 'flex-start' : 'space-between',
                    gap: '1rem',
                    paddingBottom: `${formLetterhead.paddingBottom || 10}px`,
                    borderBottom: (() => {
                      switch (formLetterhead.borderStyle) {
                        case 'double':
                          return `3px double ${formLetterhead.borderColor || '#000000'}`;
                        case 'solid_thick':
                          return `${formLetterhead.borderThickness || 3}px solid ${formLetterhead.borderColor || '#000000'}`;
                        case 'solid_thin':
                          return `1px solid ${formLetterhead.borderColor || '#000000'}`;
                        case 'none':
                        default:
                          return 'none';
                      }
                    })(),
                  }}
                >
                  {/* Left / Primary Logo */}
                  {formLetterhead.showLogo && (
                    <div
                      style={{
                        width: formLetterhead.logoSize,
                        flexShrink: 0,
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={logo || '/logo-kadesa.png'}
                        alt="Logo Instansi"
                        style={{
                          width: formLetterhead.logoSize,
                          maxHeight: Math.round(formLetterhead.logoSize * 1.25),
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  )}

                  {/* Centered / Aligned Text Lines */}
                  <div
                    style={{
                      flexGrow: 1,
                      textAlign: formLetterhead.layout === 'left_logo_left_text' ? 'left' : 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <div
                      style={{
                        fontSize: `${formLetterhead.line1.fontSize}pt`,
                        fontWeight: formLetterhead.line1.fontWeight,
                        fontStyle: formLetterhead.line1.fontStyle,
                        textTransform: formLetterhead.line1.textTransform,
                        letterSpacing: `${formLetterhead.line1.letterSpacing ?? 0}px`,
                        lineHeight: 1.25,
                      }}
                    >
                      {formLetterhead.line1.text || 'PEMERINTAH DAERAH KABUPATEN TASIKMALAYA'}
                    </div>

                    <div
                      style={{
                        fontSize: `${formLetterhead.line2.fontSize}pt`,
                        fontWeight: formLetterhead.line2.fontWeight,
                        fontStyle: formLetterhead.line2.fontStyle,
                        textTransform: formLetterhead.line2.textTransform,
                        letterSpacing: `${formLetterhead.line2.letterSpacing ?? 0}px`,
                        lineHeight: 1.25,
                      }}
                    >
                      {formLetterhead.line2.text || 'KECAMATAN CISAYONG'}
                    </div>

                    <div
                      style={{
                        fontSize: `${formLetterhead.line3.fontSize}pt`,
                        fontWeight: formLetterhead.line3.fontWeight,
                        fontStyle: formLetterhead.line3.fontStyle,
                        textTransform: formLetterhead.line3.textTransform,
                        letterSpacing: `${formLetterhead.line3.letterSpacing ?? 0}px`,
                        lineHeight: 1.25,
                      }}
                    >
                      {formLetterhead.line3.text || 'DESA NUSAWANGI'}
                    </div>

                    <div
                      style={{
                        fontSize: `${formLetterhead.line4.fontSize}pt`,
                        fontWeight: formLetterhead.line4.fontWeight,
                        fontStyle: formLetterhead.line4.fontStyle,
                        textTransform: formLetterhead.line4.textTransform,
                        letterSpacing: `${formLetterhead.line4.letterSpacing ?? 0}px`,
                        lineHeight: 1.25,
                      }}
                    >
                      {formLetterhead.line4.text || 'Jl. Nusawangi no. 40 Cisayong 46153 Tasikmalaya | e-mail : nusawangi.ds@gmail.com'}
                    </div>
                  </div>

                  {/* Right Secondary Logo (or balanced spacer) */}
                  {formLetterhead.layout === 'two_logos_center_text' ? (
                    <div
                      style={{
                        width: formLetterhead.logoSize,
                        flexShrink: 0,
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <img
                        src={formLetterhead.secondaryLogoUrl || logo || '/logo-kadesa.png'}
                        alt="Logo Pendamping"
                        style={{
                          width: formLetterhead.logoSize,
                          maxHeight: Math.round(formLetterhead.logoSize * 1.25),
                          objectFit: 'contain',
                        }}
                      />
                    </div>
                  ) : formLetterhead.showLogo && formLetterhead.layout === 'left_logo_center_text' ? (
                    <div style={{ width: formLetterhead.logoSize, flexShrink: 0 }} />
                  ) : null}
                </div>

                {/* Simulated Document Body Sneak Peek */}
                <div style={{ marginTop: '1rem', textAlign: 'center', opacity: 0.6 }}>
                  <div style={{ fontSize: '10.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    LAPORAN KEHADIRAN & REKAPITULASI APARATUR DESA
                  </div>
                  <div style={{ fontSize: '8pt', color: '#64748b', marginTop: 2 }}>
                    Nomor: 800 / 012 / Desa / {new Date().getFullYear()} — Dokumen Resmi Pemerintahan Desa
                  </div>
                </div>
              </div>
            </div>

            {/* Customization Controls: Global Settings */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  <Type size={13} style={{ display: 'inline', marginRight: 4 }} /> Jenis Huruf (Font Family)
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.8125rem' }}
                  value={formLetterhead.fontFamily}
                  onChange={(e) => setFormLetterhead((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  disabled={!canManage}
                >
                  <option value="Times New Roman, serif">Times New Roman (Standar Resmi Pemda)</option>
                  <option value="Arial, sans-serif">Arial (Modern & Bersih)</option>
                  <option value="Bookman Old Style, serif">Bookman Old Style (Klasik Formal)</option>
                  <option value="Georgia, serif">Georgia (Elegan & Tajam)</option>
                  <option value="Tahoma, sans-serif">Tahoma (Tegas & Rapi)</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Tata Letak (Layout Kop Surat)
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.8125rem' }}
                  value={formLetterhead.layout}
                  onChange={(e) =>
                    setFormLetterhead((prev) => ({
                      ...prev,
                      layout: e.target.value as LetterheadConfig['layout'],
                    }))
                  }
                  disabled={!canManage}
                >
                  <option value="left_logo_center_text">Logo Kiri — Teks Tengah (Standar Pemda)</option>
                  <option value="left_logo_left_text">Logo Kiri — Teks Rata Kiri</option>
                  <option value="two_logos_center_text">Dua Logo (Kiri & Kanan) — Teks Tengah</option>
                  <option value="center_logo_center_text">Logo Tengah Atas — Teks Tengah</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Garis Pembatas Bawah (Border Separator)
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.8125rem' }}
                  value={formLetterhead.borderStyle}
                  onChange={(e) =>
                    setFormLetterhead((prev) => ({
                      ...prev,
                      borderStyle: e.target.value as LetterheadConfig['borderStyle'],
                    }))
                  }
                  disabled={!canManage}
                >
                  <option value="double">Garis Ganda / Double (Resmi Instansi)</option>
                  <option value="solid_thick">Garis Tunggal Tebal</option>
                  <option value="solid_thin">Garis Tunggal Tipis</option>
                  <option value="none">Tanpa Garis Pembatas</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Orientasi Kertas Standar
                </label>
                <select
                  className="form-select"
                  style={{ fontSize: '0.8125rem' }}
                  value={formLetterhead.defaultOrientation || 'portrait'}
                  onChange={(e) =>
                    setFormLetterhead((prev) => ({
                      ...prev,
                      defaultOrientation: e.target.value as 'portrait' | 'landscape',
                    }))
                  }
                  disabled={!canManage}
                >
                  <option value="portrait">Tegak (Portrait) — Rekomendasi Surat & Harian</option>
                  <option value="landscape">Mendatar (Landscape) — Rekomendasi Rekap Bulanan</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                  Ukuran Logo di Kop: {formLetterhead.logoSize}px
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="range"
                    min={48}
                    max={110}
                    step={2}
                    value={formLetterhead.logoSize}
                    onChange={(e) =>
                      setFormLetterhead((prev) => ({ ...prev, logoSize: Number(e.target.value) }))
                    }
                    disabled={!canManage}
                    style={{ flexGrow: 1 }}
                  />
                  <label style={{ fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem', whiteSpace: 'nowrap' }}>
                    <input
                      type="checkbox"
                      checked={formLetterhead.showLogo}
                      onChange={(e) =>
                        setFormLetterhead((prev) => ({ ...prev, showLogo: e.target.checked }))
                      }
                      disabled={!canManage}
                    />
                    Tampilkan Logo
                  </label>
                </div>
              </div>
            </div>

            {/* Per-Line Granular Customizer */}
            <div style={{ backgroundColor: 'var(--color-slate-50)', padding: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="form-label" style={{ fontSize: '0.78125rem', fontWeight: 700, margin: 0 }}>
                  <Sliders size={14} style={{ display: 'inline', marginRight: 4 }} /> Penyesuaian Teks & Tipografi Per Baris:
                </label>
                <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  {(['line1', 'line2', 'line3', 'line4'] as const).map((lineKey, idx) => {
                    const labels = ['Baris 1 (Pemda)', 'Baris 2 (Kecamatan)', 'Baris 3 (Desa)', 'Baris 4 (Alamat & Kontak)'];
                    const isTabActive = activeLineTab === lineKey;
                    return (
                      <button
                        key={lineKey}
                        type="button"
                        onClick={() => setActiveLineTab(lineKey)}
                        className={`btn ${isTabActive ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        style={{ fontSize: '0.72rem', padding: '0.25rem 0.5rem' }}
                      >
                        {labels[idx]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Active Line Editor */}
              {(() => {
                const currentLine = formLetterhead[activeLineTab];
                const lineDescriptions = {
                  line1: 'Tingkat Pemerintahan Induk (Contoh: PEMERINTAH DAERAH KABUPATEN TASIKMALAYA)',
                  line2: 'Tingkat Wilayah Kecamatan (Contoh: KECAMATAN CISAYONG)',
                  line3: 'Instansi Desa Resmi (Contoh: DESA NUSAWANGI atau KANTOR KEPALA DESA NUSAWANGI)',
                  line4: 'Alamat Kantor, Kode Pos, Nomor Kontak, serta Email Resmi Desa',
                };

                return (
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                      {lineDescriptions[activeLineTab]}
                    </p>

                    <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                        Isi Teks Baris:
                      </label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '0.875rem' }}
                        value={currentLine.text}
                        onChange={(e) => updateLine(activeLineTab, { text: e.target.value })}
                        disabled={!canManage}
                        placeholder="Ketik teks kop surat..."
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '0.75rem' }}>
                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          Ukuran Font (pt):
                        </label>
                        <input
                          type="number"
                          step={0.5}
                          min={7}
                          max={26}
                          className="form-input"
                          style={{ fontSize: '0.8125rem' }}
                          value={currentLine.fontSize}
                          onChange={(e) => updateLine(activeLineTab, { fontSize: parseFloat(e.target.value) || 12 })}
                          disabled={!canManage}
                        />
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          Ketebalan Huruf:
                        </label>
                        <select
                          className="form-select"
                          style={{ fontSize: '0.8125rem' }}
                          value={currentLine.fontWeight}
                          onChange={(e) =>
                            updateLine(activeLineTab, {
                              fontWeight: e.target.value as LetterheadLineConfig['fontWeight'],
                            })
                          }
                          disabled={!canManage}
                        >
                          <option value="normal">Normal (Reguler)</option>
                          <option value="600">Sedang (Semi-Bold)</option>
                          <option value="700">Tebal (Bold)</option>
                          <option value="800">Sangat Tebal (Extra Bold)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          Gaya Huruf:
                        </label>
                        <select
                          className="form-select"
                          style={{ fontSize: '0.8125rem' }}
                          value={currentLine.fontStyle}
                          onChange={(e) =>
                            updateLine(activeLineTab, {
                              fontStyle: e.target.value as LetterheadLineConfig['fontStyle'],
                            })
                          }
                          disabled={!canManage}
                        >
                          <option value="normal">Tegak (Normal)</option>
                          <option value="italic">Miring (Italic)</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          Kapitalisasi Teks:
                        </label>
                        <select
                          className="form-select"
                          style={{ fontSize: '0.8125rem' }}
                          value={currentLine.textTransform}
                          onChange={(e) =>
                            updateLine(activeLineTab, {
                              textTransform: e.target.value as LetterheadLineConfig['textTransform'],
                            })
                          }
                          disabled={!canManage}
                        >
                          <option value="uppercase">HURUF BESAR SEMUA</option>
                          <option value="capitalize">Huruf Awal Kapital</option>
                          <option value="none">Sesuai Teks Asli</option>
                        </select>
                      </div>

                      <div className="form-group" style={{ margin: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.72rem', fontWeight: 600 }}>
                          Spasi Antar Huruf (px):
                        </label>
                        <input
                          type="number"
                          step={0.5}
                          min={-1}
                          max={4}
                          className="form-input"
                          style={{ fontSize: '0.8125rem' }}
                          value={currentLine.letterSpacing ?? 0}
                          onChange={(e) =>
                            updateLine(activeLineTab, {
                              letterSpacing: parseFloat(e.target.value) || 0,
                            })
                          }
                          disabled={!canManage}
                        />
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Bottom Footer Actions */}
            {canManage && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestPrintLetterhead}
                >
                  <Printer size={14} /> Uji Cetak Kop Surat
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetLetterhead}
                  disabled={isSavingLetterhead}
                >
                  <RefreshCw size={14} /> Reset ke Standar
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveLetterhead}
                  disabled={isSavingLetterhead}
                >
                  <Save size={14} /> {isSavingLetterhead ? 'Menyimpan...' : 'Simpan Desain Kop Surat'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Holiday Modal */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title="Tambah Hari Libur Baru"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setIsHolidayModalOpen(false)}>
              Batal
            </button>
            <button type="button" className="btn btn-primary" onClick={handleAddHoliday}>
              Simpan Hari Libur
            </button>
          </>
        }
      >
        <form onSubmit={handleAddHoliday}>
          <div className="form-group">
            <label className="form-label">Tanggal Libur <span className="required">*</span></label>
            <input
              type="date"
              className="form-input"
              value={holidayDate}
              onChange={(e) => setHolidayDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Nama / Keterangan Libur <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Hari Raya Idul Adha"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
            />
          </div>
        </form>
      </Modal>

      {/* Tab Leave Guard Confirmation */}
      <ConfirmDialog
        isOpen={isLeaveTabConfirmOpen}
        onClose={() => setIsLeaveTabConfirmOpen(false)}
        onConfirm={handleConfirmLeaveTab}
        title="Konfirmasi Tinggalkan Tab"
        message="Terdapat perubahan konfigurasi yang belum Anda simpan pada tab ini. Jika Anda berpindah tab tanpa menekan tombol 'Simpan Perubahan', seluruh perubahan yang baru Anda masukkan akan dibatalkan kembali ke nilai awal. Apakah Anda yakin ingin berpindah tab?"
        confirmLabel="Ya, Batalkan Perubahan & Pindah Tab"
      />
    </div>
  );
};
