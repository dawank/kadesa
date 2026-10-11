import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { settingsService } from '../../services/settingsService';
import { reportService } from '../../services/reportService';
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

  // Setting Edit Modal
  const [editingSetting, setEditingSetting] = useState<SystemSettingItem | null>(null);
  const [newValue, setNewValue] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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

  const loadData = async () => {
    const sRes = await settingsService.getAllSettings();
    if (sRes.data) {
      setSettings(sRes.data);
      const tzItem = sRes.data.find((s) => s.key === 'TIMEZONE');
      if (tzItem) {
        setSelectedTimezone(tzItem.value);
      }
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

  const filteredSettings = settings.filter((s) => s.category === activeCategory && s.status === 'ACTIVE');

  const openEditModal = (item: SystemSettingItem) => {
    setEditingSetting(item);
    setNewValue(item.value);
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
  };

  const handleSaveSetting = async () => {
    if (!editingSetting || !currentUser) return;
    setIsSaving(true);
    const res = await settingsService.updateSetting(
      editingSetting.key,
      newValue,
      effectiveFrom,
      `${currentUser.nama} (${currentUser.role})`
    );
    setIsSaving(false);
    setIsConfirmOpen(false);
    setEditingSetting(null);

    if (res.success) {
      showToast(res.message || 'Pengaturan berhasil diperbarui', 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal menyimpan pengaturan', 'error');
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
            onClick={() => setActiveCategory('WORK_SCHEDULE')}
          >
            <Clock size={14} /> 1. Jam Kerja & Kalender
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'GEOFENCE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('GEOFENCE')}
          >
            <MapPin size={14} /> 2. Geofence & Radius
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'WORKFLOW' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('WORKFLOW')}
          >
            <FileCheck size={14} /> 3. Alur Kerja & DL
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'EVIDENCE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('EVIDENCE')}
          >
            <Shield size={14} /> 4. Data & Bukti Selfie
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'SECURITY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('SECURITY')}
          >
            <Settings size={14} /> 5. Keamanan & Sesi
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'BRANDING' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('BRANDING')}
          >
            <Palette size={14} /> 6. Branding & Tampilan
          </button>
          <button
            type="button"
            className={`btn ${activeCategory === 'LETTERHEAD' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveCategory('LETTERHEAD')}
          >
            <FileText size={14} /> 7. Kop Surat Resmi
          </button>
        </div>
      </div>

      {/* Category Parameters Table (khusus kategori parameter key-value: GEOFENCE, WORKFLOW, EVIDENCE, SECURITY) */}
      {activeCategory !== 'WORK_SCHEDULE' && activeCategory !== 'BRANDING' && activeCategory !== 'LETTERHEAD' && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <div className="card-header">
            <h3 className="card-title">Parameter Konfigurasi Aktif</h3>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Parameter</th>
                  <th>Nilai Aktif</th>
                  <th>Mulai Berlaku</th>
                  <th>Deskripsi</th>
                  <th style={{ textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filteredSettings.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem 1rem' }}>
                      Tidak ada parameter konfigurasi aktif dalam kategori ini.
                    </td>
                  </tr>
                ) : (
                  filteredSettings.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.label}</strong></td>
                      <td>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.875rem',
                            fontWeight: 700,
                            color: 'var(--color-primary-700)',
                            backgroundColor: 'var(--color-primary-50)',
                            padding: '0.2rem 0.5rem',
                            borderRadius: 4,
                          }}
                        >
                          {item.value}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>
                          {item.effectiveFrom}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)' }}>
                          {item.description}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {canManage && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.75rem' }}
                            onClick={() => openEditModal(item)}
                          >
                            Ubah Nilai
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
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

      {/* Edit Setting Modal */}
      {editingSetting && (
        <Modal
          isOpen={!!editingSetting}
          onClose={() => setEditingSetting(null)}
          title={`Ubah Pengaturan — ${editingSetting.label}`}
          footer={
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditingSetting(null)}
                disabled={isSaving}
              >
                Batal
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setIsConfirmOpen(true)}
                disabled={isSaving || !newValue.trim()}
              >
                <Save size={16} /> Simpan Pengaturan
              </button>
            </>
          }
        >
          <div>
            <div className="form-group">
              <label className="form-label">Nilai Baru <span className="required">*</span></label>
              {editingSetting.key === 'TIMEZONE' ? (
                <select
                  className="form-select"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  autoFocus
                >
                  {INDONESIA_TIMEZONES.map((tz) => (
                    <option key={tz.code} value={tz.code}>
                      {tz.label} ({tz.code} — {tz.offset})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  className="form-input"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  autoFocus
                />
              )}
              <span className="form-hint">{editingSetting.description}</span>
            </div>

            <div className="form-group">
              <label className="form-label">Mulai Berlaku <span className="required">*</span></label>
              <input
                type="date"
                className="form-input"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
              />
            </div>
          </div>
        </Modal>
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

      {/* Confirm Setting Save */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleSaveSetting}
        title="Konfirmasi Perubahan Pengaturan"
        message={`Apakah Anda yakin ingin mengubah "${editingSetting?.label}" menjadi "${newValue}" mulai tanggal ${effectiveFrom}?`}
        confirmLabel="Ya, Simpan Perubahan"
        isLoading={isSaving}
      />
    </div>
  );
};
