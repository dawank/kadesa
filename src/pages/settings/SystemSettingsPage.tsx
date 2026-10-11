import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Building2,
  Clock,
  MapPin,
  Shield,
  FileCheck,
  Calendar,
  Save,
  Plus,
  Trash2,
  Palette,
  Image as ImageIcon,
  Upload,
  Camera,
  ExternalLink,
  RefreshCw,
  FileText,
  RotateCcw,
  AlertTriangle,
  Info,
  Navigation,
  Compass,
  CheckCircle2,
} from 'lucide-react';

export type SettingTab = 'PROFILE' | 'GEOFENCE' | 'WORKFLOW' | 'DISPLAY';

export const SystemSettingsPage: React.FC = () => {
  const { currentUser, hasPermission } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab State
  const tabParam = searchParams.get('tab')?.toUpperCase();
  const initialTab: SettingTab =
    tabParam === 'GEOFENCE' ? 'GEOFENCE' :
    tabParam === 'WORKFLOW' ? 'WORKFLOW' :
    tabParam === 'DISPLAY' || tabParam === 'BRANDING' ? 'DISPLAY' :
    'PROFILE';

  const [activeTab, setActiveTab] = useState<SettingTab>(initialTab);

  useEffect(() => {
    const current = searchParams.get('tab')?.toUpperCase();
    if (current === 'GEOFENCE' && activeTab !== 'GEOFENCE') setActiveTab('GEOFENCE');
    else if (current === 'WORKFLOW' && activeTab !== 'WORKFLOW') setActiveTab('WORKFLOW');
    else if ((current === 'DISPLAY' || current === 'BRANDING') && activeTab !== 'DISPLAY') setActiveTab('DISPLAY');
    else if (current === 'PROFILE' && activeTab !== 'PROFILE') setActiveTab('PROFILE');
  }, [searchParams]);

  const [settings, setSettings] = useState<SystemSettingItem[]>([]);
  const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [village, setVillage] = useState<Village | null>(null);

  // Branding Context
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

  // Profile Form State (1. Profil Desa)
  interface ProfileFormState {
    nama: string;
    kecamatan: string;
    kabupaten: string;
    provinsi: string;
    kodePos: string;
    alamat: string;
  }

  const [profileForm, setProfileForm] = useState<ProfileFormState>({
    nama: '',
    kecamatan: '',
    kabupaten: '',
    provinsi: '',
    kodePos: '',
    alamat: '',
  });
  const [profileSnapshot, setProfileSnapshot] = useState<ProfileFormState | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Geofence Form State (2. Geofence & Radius)
  interface GeofenceFormState {
    office_lat: number;
    office_lng: number;
    regular_radius: number;
    dl_min_radius: number;
    dl_max_radius: number;
    confirmed_status: boolean;
  }

  const [geofenceForm, setGeofenceForm] = useState<GeofenceFormState>({
    office_lat: 0,
    office_lng: 0,
    regular_radius: 100,
    dl_min_radius: 25,
    dl_max_radius: 500,
    confirmed_status: true,
  });
  const [geofenceSnapshot, setGeofenceSnapshot] = useState<GeofenceFormState | null>(null);

  // Workflow Form State (3. Alur Kerja & DL + Bukti & Foto Selfie + Verifikasi)
  interface WorkflowFormState {
    dl_ratification_hours: number;
    max_selfie_size_mb: number;
    allowed_formats: string[];
    tolerance_late_minutes: number;
    session_timeout_minutes: number;
    max_login_attempts: number;
  }

  const [workflowForm, setWorkflowForm] = useState<WorkflowFormState>({
    dl_ratification_hours: 72,
    max_selfie_size_mb: 5,
    allowed_formats: ['image/jpeg', 'image/png', 'image/webp'],
    tolerance_late_minutes: 15,
    session_timeout_minutes: 120,
    max_login_attempts: 5,
  });
  const [workflowSnapshot, setWorkflowSnapshot] = useState<WorkflowFormState | null>(null);

  // Display State (4. Pengaturan Tampilan)
  const [formLetterhead, setFormLetterhead] = useState<LetterheadConfig>(letterheadConfig);
  const [isSavingLetterhead, setIsSavingLetterhead] = useState(false);
  const [activeLineTab, setActiveLineTab] = useState<'line1' | 'line2' | 'line3' | 'line4'>('line1');
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [customBgUrl, setCustomBgUrl] = useState('');

  // Timezone & Schedules
  const [selectedTimezone, setSelectedTimezone] = useState<string>('Asia/Jakarta');
  const [isSavingTimezone, setIsSavingTimezone] = useState(false);
  const [editableSchedules, setEditableSchedules] = useState<WorkSchedule[]>([]);
  const [savingScheduleId, setSavingScheduleId] = useState<string | null>(null);
  const [isSavingAllSchedules, setIsSavingAllSchedules] = useState(false);

  // Holiday Modal
  const [isHolidayModalOpen, setIsHolidayModalOpen] = useState(false);
  const [holidayDate, setHolidayDate] = useState('');
  const [holidayName, setHolidayName] = useState('');

  // Tab guard state
  const [pendingTab, setPendingTab] = useState<SettingTab | null>(null);
  const [isLeaveTabConfirmOpen, setIsLeaveTabConfirmOpen] = useState(false);
  const [isSavingTab, setIsSavingTab] = useState(false);

  const canManage = hasPermission('manage_settings') || hasPermission('manage_master_desa');

  useEffect(() => {
    if (letterheadConfig) {
      setFormLetterhead(letterheadConfig);
    }
  }, [letterheadConfig]);

  // Dirty state checks
  const isProfileDirty = Boolean(
    profileSnapshot &&
    (profileForm.nama !== profileSnapshot.nama ||
     profileForm.kecamatan !== profileSnapshot.kecamatan ||
     profileForm.kabupaten !== profileSnapshot.kabupaten ||
     profileForm.provinsi !== profileSnapshot.provinsi ||
     profileForm.kodePos !== profileSnapshot.kodePos ||
     profileForm.alamat !== profileSnapshot.alamat)
  );

  const isGeofenceDirty = Boolean(
    geofenceSnapshot &&
    (geofenceForm.office_lat !== geofenceSnapshot.office_lat ||
     geofenceForm.office_lng !== geofenceSnapshot.office_lng ||
     geofenceForm.regular_radius !== geofenceSnapshot.regular_radius ||
     geofenceForm.dl_min_radius !== geofenceSnapshot.dl_min_radius ||
     geofenceForm.dl_max_radius !== geofenceSnapshot.dl_max_radius ||
     geofenceForm.confirmed_status !== geofenceSnapshot.confirmed_status)
  );

  const isWorkflowDirty = Boolean(
    workflowSnapshot &&
    (workflowForm.dl_ratification_hours !== workflowSnapshot.dl_ratification_hours ||
     workflowForm.max_selfie_size_mb !== workflowSnapshot.max_selfie_size_mb ||
     workflowForm.allowed_formats.slice().sort().join(',') !== workflowSnapshot.allowed_formats.slice().sort().join(',') ||
     workflowForm.tolerance_late_minutes !== workflowSnapshot.tolerance_late_minutes ||
     workflowForm.session_timeout_minutes !== workflowSnapshot.session_timeout_minutes ||
     workflowForm.max_login_attempts !== workflowSnapshot.max_login_attempts)
  );

  const isCurrentTabDirty = (): boolean => {
    if (activeTab === 'PROFILE') return isProfileDirty;
    if (activeTab === 'GEOFENCE') return isGeofenceDirty;
    if (activeTab === 'WORKFLOW') return isWorkflowDirty;
    return false;
  };

  const handleTabClick = (targetTab: SettingTab) => {
    if (targetTab === activeTab) return;
    if (isCurrentTabDirty()) {
      setPendingTab(targetTab);
      setIsLeaveTabConfirmOpen(true);
    } else {
      setActiveTab(targetTab);
      setSearchParams({ tab: targetTab.toLowerCase() });
    }
  };

  const handleConfirmLeaveTab = () => {
    if (activeTab === 'PROFILE' && profileSnapshot) setProfileForm({ ...profileSnapshot });
    else if (activeTab === 'GEOFENCE' && geofenceSnapshot) setGeofenceForm({ ...geofenceSnapshot });
    else if (activeTab === 'WORKFLOW' && workflowSnapshot) setWorkflowForm({ ...workflowSnapshot });

    if (pendingTab) {
      setActiveTab(pendingTab);
      setSearchParams({ tab: pendingTab.toLowerCase() });
      setPendingTab(null);
    }
    setIsLeaveTabConfirmOpen(false);
  };

  // Load Data Kanonis
  const loadData = async () => {
    const [vRes, sRes, schRes, holRes] = await Promise.all([
      masterService.getVillage(),
      settingsService.getAllSettings(),
      settingsService.getWorkSchedules(),
      settingsService.getHolidays(),
    ]);

    if (vRes.data) {
      setVillage(vRes.data);
      const pData: ProfileFormState = {
        nama: vRes.data.nama || '',
        kecamatan: vRes.data.kecamatan || '',
        kabupaten: vRes.data.kabupaten || '',
        provinsi: vRes.data.provinsi || '',
        kodePos: vRes.data.kodePos || '',
        alamat: vRes.data.alamat || '',
      };
      setProfileForm(pData);
      setProfileSnapshot(pData);
    }

    if (sRes.data) {
      setSettings(sRes.data);
      const items = sRes.data;

      const tzItem = items.find((s) => s.key === 'TIMEZONE');
      if (tzItem) setSelectedTimezone(tzItem.value);

      // GEOFENCE resolution
      const regRad = Number(items.find((s) => s.key === 'REGULAR_ATTENDANCE_RADIUS_METERS')?.value) || 100;
      const dlMin = Number(items.find((s) => s.key === 'DL_MIN_RADIUS_METERS')?.value) || 25;
      const dlMax = Number(items.find((s) => s.key === 'DL_MAX_RADIUS_METERS')?.value) || 500;
      const confirmed = items.find((s) => s.key === 'OFFICE_COORDINATES_CONFIRMED')?.value !== 'false';

      let lat = vRes.data?.latitude ?? 0;
      let lng = vRes.data?.longitude ?? 0;
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
        regular_radius: regRad,
        dl_min_radius: dlMin,
        dl_max_radius: dlMax,
        confirmed_status: confirmed,
      };
      setGeofenceSnapshot(gState);
      setGeofenceForm(gState);

      // WORKFLOW + EVIDENCE + VERIFICATION
      const ratHours = Number(items.find((s) => s.key === 'DL_RATIFICATION_DEADLINE_HOURS')?.value) || 72;
      const maxMb = Number(items.find((s) => s.key === 'MAX_SELFIE_FILE_SIZE_MB')?.value) || 5;
      const formatsStr = items.find((s) => s.key === 'ALLOWED_SELFIE_FORMATS')?.value || 'image/jpeg,image/png,image/webp';
      const formats = formatsStr.split(',').map((f) => f.trim()).filter(Boolean);
      const tolMinutes = Number(items.find((s) => s.key === 'TOLERANCE_LATE_MINUTES')?.value) || 15;
      const sTimeout = Number(items.find((s) => s.key === 'SESSION_TIMEOUT_MINUTES')?.value) || 120;
      const maxAttempts = Number(items.find((s) => s.key === 'MAX_LOGIN_ATTEMPTS')?.value) || 5;

      const wState: WorkflowFormState = {
        dl_ratification_hours: ratHours,
        max_selfie_size_mb: maxMb,
        allowed_formats: formats.length > 0 ? formats : ['image/jpeg', 'image/png', 'image/webp'],
        tolerance_late_minutes: tolMinutes,
        session_timeout_minutes: sTimeout,
        max_login_attempts: maxAttempts,
      };
      setWorkflowSnapshot(wState);
      setWorkflowForm(wState);
    }

    if (schRes.data) {
      setSchedules(schRes.data);
      setEditableSchedules(schRes.data);
    }
    if (holRes.data) setHolidays(holRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Save Handlers
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.nama || !profileForm.kecamatan || !profileForm.kabupaten) {
      showToast('Nama desa, kecamatan, dan kabupaten wajib diisi', 'warning');
      return;
    }

    setIsSavingProfile(true);
    const res = await masterService.updateVillage(profileForm);
    setIsSavingProfile(false);

    if (res.success && res.data) {
      showToast('Profil identitas desa berhasil disimpan', 'success');
      setVillage(res.data);
      setProfileSnapshot({ ...profileForm });
      loadData();
    } else {
      showToast(res.message || 'Gagal menyimpan profil desa', 'error');
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('Format file logo harus JPG, PNG, atau WebP', 'warning');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('Ukuran file logo maksimal 2 MB', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const result = event.target?.result as string;
      setIsUploadingLogo(true);
      const res = await masterService.updateVillageLogo(result);
      setIsUploadingLogo(false);
      if (res.success) {
        showToast('Logo resmi desa berhasil diperbarui (di-overwrite)', 'success');
        setVillage((prev) => (prev ? { ...prev, logo: result } : null));
        loadData();
      } else {
        showToast(res.message || 'Gagal memperbarui logo desa', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleResetLogo = async () => {
    setIsUploadingLogo(true);
    const res = await masterService.removeVillageLogo();
    setIsUploadingLogo(false);
    if (res.success && res.data) {
      showToast('Logo desa direset ke logo bawaan', 'info');
      setVillage((prev) => (prev ? { ...prev, logo: res.data } : null));
      loadData();
    } else {
      showToast(res.message || 'Gagal mereset logo desa', 'error');
    }
  };

  const handleSaveGeofence = async () => {
    if (!currentUser) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const actor = `${currentUser.nama} (${currentUser.role})`;

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

    // Update coordinates in villages table
    if (geofenceSnapshot && (
      geofenceForm.office_lat !== geofenceSnapshot.office_lat ||
      geofenceForm.office_lng !== geofenceSnapshot.office_lng
    )) {
      const vRes = await masterService.updateVillage({
        latitude: geofenceForm.office_lat,
        longitude: geofenceForm.office_lng,
      });
      if (!vRes.success) {
        anyError = true;
        showToast(vRes.message || 'Gagal menyimpan koordinat desa', 'error');
      }
    }

    // Update system settings items
    if (geofenceSnapshot) {
      const coordsChanged =
        geofenceForm.office_lat !== geofenceSnapshot.office_lat ||
        geofenceForm.office_lng !== geofenceSnapshot.office_lng;

      if (coordsChanged) {
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
      if (geofenceForm.confirmed_status !== geofenceSnapshot.confirmed_status || coordsChanged) {
        const res = await settingsService.updateSetting('OFFICE_COORDINATES_CONFIRMED', String(geofenceForm.confirmed_status), todayStr, actor);
        if (!res.success) anyError = true;
      }
    }

    setIsSavingTab(false);
    if (!anyError) {
      showToast('Pengaturan Geofence & Radius berhasil disimpan', 'success');
      loadData();
    }
  };

  const handleSaveWorkflowAndEvidence = async () => {
    if (!currentUser) return;
    const todayStr = new Date().toISOString().split('T')[0];
    const actor = `${currentUser.nama} (${currentUser.role})`;

    if (workflowForm.dl_ratification_hours < 1 || workflowForm.dl_ratification_hours > 720) {
      showToast('Batas waktu ratifikasi DL harus antara 1 hingga 720 jam', 'warning');
      return;
    }
    if (workflowForm.max_selfie_size_mb < 1 || workflowForm.max_selfie_size_mb > 20) {
      showToast('Ukuran maksimal file foto harus antara 1 hingga 20 MB', 'warning');
      return;
    }
    if (workflowForm.allowed_formats.length === 0) {
      showToast('Pilih minimal 1 format file foto yang didukung', 'warning');
      return;
    }

    setIsSavingTab(true);
    let anyError = false;

    if (workflowSnapshot?.dl_ratification_hours !== workflowForm.dl_ratification_hours) {
      const res = await settingsService.updateSetting('DL_RATIFICATION_DEADLINE_HOURS', String(workflowForm.dl_ratification_hours), todayStr, actor);
      if (!res.success) anyError = true;
    }
    if (workflowSnapshot?.max_selfie_size_mb !== workflowForm.max_selfie_size_mb) {
      const res = await settingsService.updateSetting('MAX_SELFIE_FILE_SIZE_MB', String(workflowForm.max_selfie_size_mb), todayStr, actor);
      if (!res.success) anyError = true;
    }
    if (workflowSnapshot?.allowed_formats.slice().sort().join(',') !== workflowForm.allowed_formats.slice().sort().join(',')) {
      const res = await settingsService.updateSetting('ALLOWED_SELFIE_FORMATS', workflowForm.allowed_formats.join(','), todayStr, actor);
      if (!res.success) anyError = true;
    }
    if (workflowSnapshot?.tolerance_late_minutes !== workflowForm.tolerance_late_minutes) {
      const res = await settingsService.updateSetting('TOLERANCE_LATE_MINUTES', String(workflowForm.tolerance_late_minutes), todayStr, actor);
      if (!res.success) anyError = true;
    }
    if (workflowSnapshot?.session_timeout_minutes !== workflowForm.session_timeout_minutes) {
      const res = await settingsService.updateSetting('SESSION_TIMEOUT_MINUTES', String(workflowForm.session_timeout_minutes), todayStr, actor);
      if (!res.success) anyError = true;
    }
    if (workflowSnapshot?.max_login_attempts !== workflowForm.max_login_attempts) {
      const res = await settingsService.updateSetting('MAX_LOGIN_ATTEMPTS', String(workflowForm.max_login_attempts), todayStr, actor);
      if (!res.success) anyError = true;
    }

    setIsSavingTab(false);
    if (!anyError) {
      showToast('Pengaturan Alur Kerja & DL serta Bukti Selfie berhasil disimpan', 'success');
      loadData();
    } else {
      showToast('Sebagian pengaturan gagal disimpan', 'error');
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
      showToast('Standar zona waktu resmi berhasil disimpan', 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal menyimpan zona waktu', 'error');
    }
  };

  const handleScheduleChange = (id: string, field: keyof WorkSchedule, value: any) => {
    setEditableSchedules((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleSaveScheduleRow = async (schedule: WorkSchedule) => {
    setSavingScheduleId(schedule.id);
    const res = await settingsService.updateWorkSchedule(schedule.id, {
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      active: schedule.active,
    });
    setSavingScheduleId(null);
    if (res.success) {
      showToast(`Jadwal ${schedule.dayName} berhasil disimpan`, 'success');
      loadData();
    } else {
      showToast(res.message || 'Gagal memperbarui jadwal', 'error');
    }
  };

  const handleSaveAllSchedules = async () => {
    setIsSavingAllSchedules(true);
    let allOk = true;
    for (const s of editableSchedules) {
      const res = await settingsService.updateWorkSchedule(s.id, {
        startTime: s.startTime,
        endTime: s.endTime,
        active: s.active,
      });
      if (!res.success) allOk = false;
    }
    setIsSavingAllSchedules(false);
    if (allOk) {
      showToast('Seluruh jadwal kerja mingguan berhasil diperbarui', 'success');
      loadData();
    } else {
      showToast('Sebagian jadwal gagal disimpan', 'warning');
    }
  };

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayDate || !holidayName.trim()) {
      showToast('Tanggal dan nama hari libur wajib diisi', 'warning');
      return;
    }
    const res = await settingsService.addHoliday(holidayDate, holidayName.trim());
    if (res.success) {
      showToast('Hari libur resmi berhasil ditambahkan', 'success');
      setIsHolidayModalOpen(false);
      setHolidayDate('');
      setHolidayName('');
      loadData();
    } else {
      showToast(res.message || 'Gagal menambahkan hari libur', 'error');
    }
  };

  const handleDeleteHoliday = async (id: string) => {
    const res = await settingsService.deleteHoliday(id);
    if (res.success) {
      showToast('Hari libur berhasil dihapus', 'info');
      loadData();
    } else {
      showToast(res.message || 'Gagal menghapus hari libur', 'error');
    }
  };

  // Letterhead Presets
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

  // Background Upload Handlers
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

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1>Pengaturan Konfigurasi Sistem KADESA</h1>
          <p>
            Kelola identitas desa, koordinat geofence, alur penugasan dinas luar, bukti selfie, dan tata naskah resmi
          </p>
        </div>
      </div>

      {/* 4 Canonical Category Tabs */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${activeTab === 'PROFILE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('PROFILE')}
            style={{ position: 'relative' }}
          >
            <Building2 size={15} /> Profil Desa
            {isProfileDirty && (
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
            className={`btn ${activeTab === 'GEOFENCE' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('GEOFENCE')}
            style={{ position: 'relative' }}
          >
            <MapPin size={15} /> Geofence &amp; Radius
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
            className={`btn ${activeTab === 'WORKFLOW' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('WORKFLOW')}
            style={{ position: 'relative' }}
          >
            <FileCheck size={15} /> Alur Kerja &amp; DL
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
            className={`btn ${activeTab === 'DISPLAY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => handleTabClick('DISPLAY')}
          >
            <Palette size={15} /> Tampilan
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PROFIL DESA                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'PROFILE' && (
        <div className="responsive-grid-2" style={{ marginBottom: '1.5rem' }}>
          {/* Card: Identitas Administratif Desa */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h3 className="card-title">
                <Building2 size={18} color="var(--color-primary-600)" />
                Identitas Administratif Desa
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Kelola nama instansi desa dan alamat resmi. Data ini menjadi sumber kanonis identitas yang tampil pada kop surat, laporan presensi, dan berkas dinas resmi.
            </p>

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label">Nama Desa <span className="required">*</span></label>
                <input
                  type="text"
                  className="form-input"
                  value={profileForm.nama}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, nama: e.target.value }))}
                  disabled={!canManage || isSavingProfile}
                  placeholder="Contoh: Desa Sukamaju"
                />
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Kecamatan <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.kecamatan}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, kecamatan: e.target.value }))}
                    disabled={!canManage || isSavingProfile}
                    placeholder="Contoh: Cibinong"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kabupaten / Kota <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.kabupaten}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, kabupaten: e.target.value }))}
                    disabled={!canManage || isSavingProfile}
                    placeholder="Contoh: Bogor"
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-group">
                  <label className="form-label">Provinsi</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.provinsi}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, provinsi: e.target.value }))}
                    disabled={!canManage || isSavingProfile}
                    placeholder="Contoh: Jawa Barat"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Kode Pos</label>
                  <input
                    type="text"
                    className="form-input"
                    value={profileForm.kodePos}
                    onChange={(e) => setProfileForm((prev) => ({ ...prev, kodePos: e.target.value }))}
                    disabled={!canManage || isSavingProfile}
                    placeholder="Contoh: 16911"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Alamat Lengkap Kantor Desa</label>
                <textarea
                  className="form-textarea"
                  rows={3}
                  value={profileForm.alamat}
                  onChange={(e) => setProfileForm((prev) => ({ ...prev, alamat: e.target.value }))}
                  disabled={!canManage || isSavingProfile}
                  placeholder="Contoh: Jl. Raya Sukamaju No. 12, Cibinong"
                />
              </div>

              {canManage && (
                <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                  {isProfileDirty && (
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => profileSnapshot && setProfileForm({ ...profileSnapshot })}
                      disabled={isSavingProfile}
                    >
                      <RotateCcw size={14} /> Batalkan
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={isSavingProfile || !isProfileDirty}
                  >
                    <Save size={14} /> {isSavingProfile ? 'Menyimpan...' : 'Simpan Identitas Desa'}
                  </button>
                </div>
              )}
            </form>
          </div>

          {/* Card: Logo Resmi Instansi Desa */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '1rem' }}>
              <h3 className="card-title">
                <Palette size={18} color="var(--color-primary-600)" />
                Logo Resmi Instansi Desa
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Logo resmi instansi desa digunakan khusus untuk kop surat dinas, berkas laporan presensi cetak (PDF), dan dokumen administratif desa. Logo desa terpisah dari Logo Aplikasi KADESA dan <strong>tidak akan menggantikan logo aplikasi</strong>.
            </p>

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: 96,
                  height: 96,
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
                  src={village?.logo || logo || '/logo-kadesa.png'}
                  alt={`Logo Desa ${villageName}`}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 2 }}>{village?.nama || villageName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Format: JPG, PNG, atau WebP (maks. 2 MB)
                </div>

                {canManage && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <label className="btn btn-primary btn-sm" style={{ cursor: isUploadingLogo ? 'wait' : 'pointer', margin: 0 }}>
                      <Upload size={14} /> Ganti Logo Desa
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: 'none' }}
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                      />
                    </label>

                    {village?.logo && village.logo !== '/logo-kadesa.png' && (
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
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-primary-50)',
                border: '1px solid var(--color-primary-100)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                color: 'var(--color-primary-800)',
              }}
            >
              <strong>Petunjuk:</strong> Logo desa dikelola secara mandiri pada profil desa ini dan tidak disimpan di pengaturan tampilan lain.
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: GEOFENCE & RADIUS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'GEOFENCE' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">
                <MapPin size={18} color="var(--color-primary-600)" />
                Titik Pusat Kantor Desa &amp; Visualisasi Geofence
              </h3>
              <span className={`badge ${geofenceForm.confirmed_status ? 'badge-hadir' : 'badge-izin'}`}>
                {geofenceForm.confirmed_status ? 'Koordinat Resmi Terverifikasi' : 'Status Pilot / Belum Diverifikasi'}
              </span>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--color-slate-600)', marginBottom: '1.25rem' }}>
              Atur titik koordinat referensi kantor desa dan pantau radius lingkaran geofence secara interaktif. Titik ini menjadi acuan verifikasi kehadiran presensi aparatur desa.
            </p>

            {/* Read-Only Village Identity Context Badge */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1.25rem',
                fontSize: '0.8125rem',
                flexWrap: 'wrap',
                gap: '0.5rem',
              }}
            >
              <div>
                <span style={{ color: 'var(--text-muted)' }}>Pusat Instansi: </span>
                <strong>{village?.nama || villageName}</strong>
                <span style={{ margin: '0 0.5rem', color: 'var(--border-subtle)' }}>|</span>
                <span style={{ color: 'var(--text-muted)' }}>Alamat: </span>
                <span>{village?.alamat || '-'}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => handleTabClick('PROFILE')}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                title="Buka Profil Desa untuk mengubah nama atau alamat kantor"
              >
                Ubah di Profil Desa <ExternalLink size={12} />
              </button>
            </div>

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
                  Integritas Koordinat Kantor Desa:
                </strong>
                <p style={{ margin: '0.25rem 0 0.5rem', color: geofenceForm.confirmed_status ? 'var(--color-slate-600)' : '#b45309' }}>
                  Sistem membedakan koordinat pilot pengujian dengan koordinat definitif kantor desa resmi. Jangan menganggap koordinat pilot sebagai koordinat resmi sebelum diverifikasi langsung.
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

            {/* Interactive Leaflet Map */}
            <div style={{ marginBottom: '1.25rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>
                Peta Penentuan Titik &amp; Lingkaran Radius Geofence (Geser Marker atau Klik pada Peta)
              </label>
              <LocationPickerMap
                latitude={geofenceForm.office_lat}
                longitude={geofenceForm.office_lng}
                radiusMeters={geofenceForm.regular_radius}
                onChange={(coords) => {
                  const newLat = Number(coords.latitude.toFixed(6));
                  const newLng = Number(coords.longitude.toFixed(6));
                  const isCoordChanged = !geofenceSnapshot || newLat !== geofenceSnapshot.office_lat || newLng !== geofenceSnapshot.office_lng;
                  setGeofenceForm((prev) => ({
                    ...prev,
                    office_lat: newLat,
                    office_lng: newLng,
                    confirmed_status: isCoordChanged ? false : prev.confirmed_status,
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
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Latitude Pusat Kantor <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={geofenceForm.office_lat}
                    onChange={(e) => {
                      const newLat = parseFloat(e.target.value) || 0;
                      const isCoordChanged = !geofenceSnapshot || newLat !== geofenceSnapshot.office_lat;
                      setGeofenceForm((prev) => ({
                        ...prev,
                        office_lat: newLat,
                        confirmed_status: isCoordChanged ? false : prev.confirmed_status,
                      }));
                    }}
                    disabled={!canManage || isSavingTab}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <Navigation size={14} style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Longitude Pusat Kantor <span className="required">*</span></label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    value={geofenceForm.office_lng}
                    onChange={(e) => {
                      const newLng = parseFloat(e.target.value) || 0;
                      const isCoordChanged = !geofenceSnapshot || newLng !== geofenceSnapshot.office_lng;
                      setGeofenceForm((prev) => ({
                        ...prev,
                        office_lng: newLng,
                        confirmed_status: isCoordChanged ? false : prev.confirmed_status,
                      }));
                    }}
                    disabled={!canManage || isSavingTab}
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <Compass size={14} style={{ position: 'absolute', right: 12, top: 12, color: 'var(--text-muted)' }} />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Radius Presensi Kantor Reguler (Meter) <span className="required">*</span></label>
                <input
                  type="number"
                  min={20}
                  max={500}
                  className="form-input"
                  value={geofenceForm.regular_radius}
                  onChange={(e) => setGeofenceForm((prev) => ({ ...prev, regular_radius: parseInt(e.target.value, 10) || 20 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Batas toleransi radius kantor desa (20–500 meter)</span>
              </div>
            </div>

            {/* DL Radius Settings */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginTop: '0.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileCheck size={16} color="var(--color-primary-600)" />
                Batas Toleransi Radius Penugasan Dinas Luar (DL)
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Radius Minimum DL (Meter) <span className="required">*</span></label>
                  <input
                    type="number"
                    min={25}
                    max={geofenceForm.dl_max_radius}
                    className="form-input"
                    value={geofenceForm.dl_min_radius}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, dl_min_radius: parseInt(e.target.value, 10) || 25 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span className="form-hint">Batas bawah radius lokasi tujuan penugasan DL (min 25 m)</span>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Radius Maksimum DL (Meter) <span className="required">*</span></label>
                  <input
                    type="number"
                    min={geofenceForm.dl_min_radius}
                    max={500}
                    className="form-input"
                    value={geofenceForm.dl_max_radius}
                    onChange={(e) => setGeofenceForm((prev) => ({ ...prev, dl_max_radius: parseInt(e.target.value, 10) || 500 }))}
                    disabled={!canManage || isSavingTab}
                  />
                  <span className="form-hint">Batas atas radius lokasi tujuan penugasan DL (maks 500 m)</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            {canManage && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                {isGeofenceDirty && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => geofenceSnapshot && setGeofenceForm({ ...geofenceSnapshot })}
                    disabled={isSavingTab}
                  >
                    <RotateCcw size={14} /> Batalkan
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveGeofence}
                  disabled={isSavingTab || !isGeofenceDirty}
                >
                  <Save size={14} /> {isSavingTab ? 'Menyimpan...' : 'Simpan Perubahan Geofence & Radius'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ALUR KERJA & DL (TERPADU DENGAN FOTO SELFIE & JADWAL OPERASIONAL)  */}
      {/* ========================================================================= */}
      {activeTab === 'WORKFLOW' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Persetujuan Dinas Luar */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="card-title">
                <FileCheck size={18} color="var(--color-primary-600)" />
                Persetujuan Dinas Luar
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Batas waktu ratifikasi dan pengesahan penugasan Dinas Luar oleh Kepala Desa atau pejabat berwenang.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Batas Waktu Ratifikasi DL (Jam) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={720}
                  className="form-input"
                  value={workflowForm.dl_ratification_hours}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, dl_ratification_hours: parseInt(e.target.value, 10) || 1 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Maksimal waktu (jam) bagi Kepala Desa untuk mengesahkan penugasan DL (standar 72 jam)</span>
              </div>
            </div>

            {/* Workflow Lifecycle Summary Box */}
            <div
              style={{
                padding: '0.875rem 1rem',
                backgroundColor: 'var(--color-slate-50)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
              }}
            >
              <strong>Alur Status Penugasan DL:</strong>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                <span className="badge badge-pending">1. Pengajuan (PENDING)</span>
                <span>&rarr;</span>
                <span className="badge badge-verified">2. Verifikasi Sekdes / Operator</span>
                <span>&rarr;</span>
                <span className="badge badge-hadir">3. Persetujuan Pejabat</span>
                <span>&rarr;</span>
                <span className="badge badge-hadir">4. Ratifikasi Kades (RATIFIED)</span>
              </div>
            </div>
          </div>

          {/* Lokasi Dinas Luar */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="card-title">
                <MapPin size={18} color="var(--color-primary-600)" />
                Lokasi Dinas Luar
              </h3>
              <span className="badge badge-hadir">Tersinkronisasi dari Geofence</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Rentang batas radius penugasan multi-lokasi yang disinkronkan secara terpusat dari konfigurasi Geofence &amp; Radius.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
              <div style={{ padding: '0.75rem 1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-slate-50)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Radius Minimum Lokasi Tugas:</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                  {geofenceForm.dl_min_radius} Meter
                </div>
              </div>
              <div style={{ padding: '0.75rem 1rem', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--color-slate-50)' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Radius Maksimum Lokasi Tugas:</span>
                <div style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--color-slate-800)' }}>
                  {geofenceForm.dl_max_radius} Meter
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleTabClick('GEOFENCE')}
              >
                <MapPin size={14} /> Atur Rentang Radius di Geofence &amp; Radius
              </button>
            </div>
          </div>

          {/* Bukti Kehadiran */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="card-title">
                <Camera size={18} color="var(--color-primary-600)" />
                Bukti Kehadiran
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Ukuran file, format visual, dan keamanan penyimpanan foto selfie presensi aparatur desa.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">
                  Maksimal Ukuran Foto Selfie (MB) <span className="required">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  className="form-input"
                  value={workflowForm.max_selfie_size_mb}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, max_selfie_size_mb: parseInt(e.target.value, 10) || 1 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Batas ukuran gambar foto selfie (1–20 MB)</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Format File Foto yang Diizinkan <span className="required">*</span></label>
                <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                  {['image/jpeg', 'image/png', 'image/webp'].map((fmt) => {
                    const isChecked = workflowForm.allowed_formats.includes(fmt);
                    return (
                      <label key={fmt} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: canManage ? 'pointer' : 'default', fontSize: '0.875rem' }}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setWorkflowForm((prev) => ({ ...prev, allowed_formats: [...prev.allowed_formats, fmt] }));
                            } else {
                              setWorkflowForm((prev) => ({ ...prev, allowed_formats: prev.allowed_formats.filter((f) => f !== fmt) }));
                            }
                          }}
                          disabled={!canManage || isSavingTab}
                        />
                        <span>{fmt.replace('image/', '.')}</span>
                      </label>
                    );
                  })}
                </div>
                <span className="form-hint">Pilih format kompresi visual yang didukung kamera browser aparatur</span>
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
              <strong>Integritas Bukti Foto:</strong> Foto selfie tersimpan aman di Supabase Storage (bucket <code>dl-evidence</code>) dengan otorisasi akses terbatas (Row Level Security &amp; Signed Access).
            </div>
          </div>

          {/* Verifikasi & Jam Kerja */}
          <div className="card">
            <div className="card-header" style={{ marginBottom: '0.75rem' }}>
              <h3 className="card-title">
                <Clock size={18} color="var(--color-primary-600)" />
                Verifikasi &amp; Jam Kerja
              </h3>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Toleransi keterlambatan, batas sesi login, zona waktu resmi, jadwal kerja mingguan, dan hari libur operasional desa.
            </p>

            {/* Toleransi & Sesi */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Toleransi Keterlambatan (Menit) <span className="required">*</span></label>
                <input
                  type="number"
                  min={0}
                  max={60}
                  className="form-input"
                  value={workflowForm.tolerance_late_minutes}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, tolerance_late_minutes: parseInt(e.target.value, 10) || 0 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Dispensasi keterlambatan check-in (menit)</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Batas Waktu Sesi Login (Menit) <span className="required">*</span></label>
                <input
                  type="number"
                  min={15}
                  max={1440}
                  className="form-input"
                  value={workflowForm.session_timeout_minutes}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, session_timeout_minutes: parseInt(e.target.value, 10) || 15 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Otomatis logout saat tidak aktif (15–1440 menit)</span>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Batas Percobaan Login Gagal <span className="required">*</span></label>
                <input
                  type="number"
                  min={3}
                  max={20}
                  className="form-input"
                  value={workflowForm.max_login_attempts}
                  onChange={(e) => setWorkflowForm((prev) => ({ ...prev, max_login_attempts: parseInt(e.target.value, 10) || 3 }))}
                  disabled={!canManage || isSavingTab}
                />
                <span className="form-hint">Kunci akun sementara jika gagal berulang</span>
              </div>
            </div>

            {/* Standar Zona Waktu */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
              <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: '0.5rem' }}>Zona Waktu Resmi Desa</h4>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  className="form-input"
                  style={{ width: 'auto', minWidth: 260 }}
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  disabled={!canManage || isSavingTimezone}
                >
                  {INDONESIA_TIMEZONES.map((tz) => (
                    <option key={tz.code} value={tz.code}>
                      {tz.label} ({tz.offset})
                    </option>
                  ))}
                </select>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleSaveTimezone}
                    disabled={isSavingTimezone}
                  >
                    <Save size={14} /> {isSavingTimezone ? 'Menyimpan...' : 'Simpan Zona Waktu'}
                  </button>
                )}
              </div>
            </div>

            {/* Jadwal Kerja Mingguan */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem', marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Jadwal Kerja Mingguan Aparatur Desa</h4>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveAllSchedules}
                    disabled={isSavingAllSchedules}
                  >
                    <Save size={14} /> {isSavingAllSchedules ? 'Menyimpan...' : 'Simpan Seluruh Jadwal'}
                  </button>
                )}
              </div>

              <div className="table-responsive">
                <table className="table" style={{ width: '100%', fontSize: '0.8125rem' }}>
                  <thead>
                    <tr>
                      <th>Hari</th>
                      <th>Status Hari Kerja</th>
                      <th>Jam Masuk (Mulai)</th>
                      <th>Jam Pulang (Selesai)</th>
                      {canManage && <th style={{ textAlign: 'right' }}>Aksi</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {editableSchedules.map((schedule) => (
                      <tr key={schedule.id}>
                        <td style={{ fontWeight: 600 }}>{schedule.dayName}</td>
                        <td>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: canManage ? 'pointer' : 'default' }}>
                            <input
                              type="checkbox"
                              checked={schedule.active}
                              onChange={(e) => handleScheduleChange(schedule.id, 'active', e.target.checked)}
                              disabled={!canManage}
                            />
                            <span>{schedule.active ? 'Hari Kerja' : 'Hari Libur'}</span>
                          </label>
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-input"
                            style={{ width: 110, padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                            value={schedule.startTime}
                            onChange={(e) => handleScheduleChange(schedule.id, 'startTime', e.target.value)}
                            disabled={!canManage || !schedule.active}
                          />
                        </td>
                        <td>
                          <input
                            type="time"
                            className="form-input"
                            style={{ width: 110, padding: '0.25rem 0.5rem', fontSize: '0.8125rem' }}
                            value={schedule.endTime}
                            onChange={(e) => handleScheduleChange(schedule.id, 'endTime', e.target.value)}
                            disabled={!canManage || !schedule.active}
                          />
                        </td>
                        {canManage && (
                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleSaveScheduleRow(schedule)}
                              disabled={savingScheduleId === schedule.id}
                              style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            >
                              <Save size={12} /> {savingScheduleId === schedule.id ? 'Menyimpan...' : 'Simpan'}
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kalender Hari Libur */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h4 style={{ fontSize: '0.875rem', fontWeight: 700, margin: 0 }}>Daftar Hari Libur Resmi Nasional &amp; Daerah</h4>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setIsHolidayModalOpen(true)}
                  >
                    <Plus size={14} /> Tambah Hari Libur
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                {holidays.map((hol) => (
                  <div
                    key={hol.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      padding: '0.35rem 0.75rem',
                      backgroundColor: 'var(--color-slate-100)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.8125rem',
                    }}
                  >
                    <Calendar size={13} color="var(--text-muted)" />
                    <span><strong>{hol.date}</strong>: {hol.name}</span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(hol.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--color-accent-rose)', padding: 0 }}
                        title="Hapus hari libur"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Action Bar Tab 3 */}
            {canManage && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem', justifyContent: 'flex-end', borderTop: '1px solid var(--border-subtle)', paddingTop: '1.25rem' }}>
                {isWorkflowDirty && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => workflowSnapshot && setWorkflowForm({ ...workflowSnapshot })}
                    disabled={isSavingTab}
                  >
                    <RotateCcw size={14} /> Batalkan
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveWorkflowAndEvidence}
                  disabled={isSavingTab || !isWorkflowDirty}
                >
                  <Save size={14} /> {isSavingTab ? 'Menyimpan...' : 'Simpan Pengaturan Alur Kerja'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: PENGATURAN TAMPILAN                                                */}
      {/* ========================================================================= */}
      {activeTab === 'DISPLAY' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginBottom: '1.5rem' }}>
          {/* Card: Latar Belakang Login */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(to right, rgba(6, 78, 59, 0.85), rgba(15, 23, 42, 0.7))',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '1.5rem',
                  color: '#ffffff',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#a7f3d0' }}>
                    Pratinjau Halaman Masuk
                  </div>
                  <div style={{ fontSize: '1.125rem', fontWeight: 800 }}>KADESA — {villageName}</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.9 }}>Sistem Kehadiran Aparatur Desa</div>
                </div>
              </div>
            </div>

            {canManage && (
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '1rem' }}>
                <label className="btn btn-primary btn-sm" style={{ cursor: isUploadingBg ? 'wait' : 'pointer', margin: 0 }}>
                  <Upload size={14} /> Upload Foto Baru (Overwrite)
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
                  title="Kembalikan foto latar ke default"
                >
                  <RefreshCw size={14} /> Reset ke Foto Bawaan
                </button>
              </div>
            )}

            {canManage && (
              <form onSubmit={handleSaveCustomBgUrl} style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <input
                  type="url"
                  className="form-input"
                  placeholder="Atau masukkan tautan URL foto kustom (https://...)"
                  value={customBgUrl}
                  onChange={(e) => setCustomBgUrl(e.target.value)}
                  disabled={isUploadingBg}
                  style={{ fontSize: '0.8125rem' }}
                />
                <button type="submit" className="btn btn-secondary btn-sm" disabled={isUploadingBg || !customBgUrl.trim()}>
                  <Save size={14} /> Terapkan URL
                </button>
              </form>
            )}
          </div>

          {/* Card: Tata Naskah & Format Kop Surat Resmi Laporan */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 className="card-title">
                  <FileText size={18} color="var(--color-primary-600)" />
                  Tata Naskah &amp; Format Kop Surat Resmi (PDF Laporan)
                </h3>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleTestPrintLetterhead}
                  title="Buka pratinjau cetak PDF"
                >
                  <FileText size={14} /> Uji Cetak PDF
                </button>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveLetterhead}
                    disabled={isSavingLetterhead}
                  >
                    <Save size={14} /> {isSavingLetterhead ? 'Menyimpan...' : 'Simpan Kop Surat'}
                  </button>
                )}
              </div>
            </div>

            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Kustomisasi 4 baris teks hierarki instansi, jenis huruf, garis pembatas, dan tata letak kop surat resmi laporan kehadiran dinas.
            </p>

            {/* Presets */}
            {canManage && (
              <div style={{ marginBottom: '1.25rem' }}>
                <label className="form-label" style={{ marginBottom: '0.5rem' }}>Pilih Template Tata Naskah Dinas:</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '0.75rem' }}>
                  {LETTERHEAD_PRESETS.map((p) => {
                    const isSelected = formLetterhead.templateId === p.id;
                    return (
                      <div
                        key={p.id}
                        onClick={() => handleApplyLetterheadPreset(p.id)}
                        style={{
                          border: `2px solid ${isSelected ? 'var(--color-primary-600)' : 'var(--border-subtle)'}`,
                          backgroundColor: isSelected ? 'var(--color-primary-50)' : '#ffffff',
                          borderRadius: 'var(--radius-md)',
                          padding: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <strong style={{ fontSize: '0.8125rem' }}>{p.name}</strong>
                          <span className="badge badge-verified" style={{ fontSize: '0.65rem' }}>{p.tag}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{p.desc}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Typography & Layout Controls */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Jenis Huruf (Font Family)</label>
                <select
                  className="form-input"
                  value={formLetterhead.fontFamily}
                  onChange={(e) => setFormLetterhead((prev) => ({ ...prev, fontFamily: e.target.value }))}
                  disabled={!canManage}
                >
                  <option value="Times New Roman, serif">Times New Roman (Resmi Dinas)</option>
                  <option value="Arial, sans-serif">Arial (Modern Sans)</option>
                  <option value="Bookman Old Style, serif">Bookman Old Style (Klasik Formal)</option>
                  <option value="Georgia, serif">Georgia (Klasik Elegan)</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Gaya Garis Pembatas Bawah</label>
                <select
                  className="form-input"
                  value={formLetterhead.borderStyle}
                  onChange={(e) => setFormLetterhead((prev) => ({ ...prev, borderStyle: e.target.value as any }))}
                  disabled={!canManage}
                >
                  <option value="double">Garis Ganda (Tebal &amp; Tipis - Standar Pemda)</option>
                  <option value="solid_thick">Garis Tunggal Tebal Solid</option>
                  <option value="solid_thin">Garis Tunggal Tipis Minimalis</option>
                  <option value="none">Tanpa Garis Pembatas</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Orientasi Default Kertas</label>
                <select
                  className="form-input"
                  value={formLetterhead.defaultOrientation || 'portrait'}
                  onChange={(e) => setFormLetterhead((prev) => ({ ...prev, defaultOrientation: e.target.value as any }))}
                  disabled={!canManage}
                >
                  <option value="portrait">Portrait (Tegak - Dokumen Formal)</option>
                  <option value="landscape">Landscape (Mendatar - Rekap Tabel Lebar)</option>
                </select>
              </div>
            </div>

            {/* Line Tabs */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`btn ${activeLineTab === 'line1' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveLineTab('line1')}
                >
                  Baris 1: Instansi Utama
                </button>
                <button
                  type="button"
                  className={`btn ${activeLineTab === 'line2' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveLineTab('line2')}
                >
                  Baris 2: Kecamatan
                </button>
                <button
                  type="button"
                  className={`btn ${activeLineTab === 'line3' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveLineTab('line3')}
                >
                  Baris 3: Nama Desa
                </button>
                <button
                  type="button"
                  className={`btn ${activeLineTab === 'line4' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                  onClick={() => setActiveLineTab('line4')}
                >
                  Baris 4: Alamat &amp; Kontak
                </button>
              </div>

              <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                <label className="form-label">Teks Baris:</label>
                <input
                  type="text"
                  className="form-input"
                  value={formLetterhead[activeLineTab].text}
                  onChange={(e) => updateLine(activeLineTab, { text: e.target.value })}
                  disabled={!canManage}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ukuran Font (pt)</label>
                  <input
                    type="number"
                    min={8}
                    max={24}
                    step={0.5}
                    className="form-input"
                    value={formLetterhead[activeLineTab].fontSize}
                    onChange={(e) => updateLine(activeLineTab, { fontSize: parseFloat(e.target.value) || 12 })}
                    disabled={!canManage}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ketebalan Font</label>
                  <select
                    className="form-input"
                    value={formLetterhead[activeLineTab].fontWeight}
                    onChange={(e) => updateLine(activeLineTab, { fontWeight: e.target.value as any })}
                    disabled={!canManage}
                  >
                    <option value="normal">Normal (400)</option>
                    <option value="600">Semi Bold (600)</option>
                    <option value="700">Bold (700)</option>
                    <option value="800">Extra Bold (800)</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Transformasi</label>
                  <select
                    className="form-input"
                    value={formLetterhead[activeLineTab].textTransform || 'none'}
                    onChange={(e) => updateLine(activeLineTab, { textTransform: e.target.value as any })}
                    disabled={!canManage}
                  >
                    <option value="none">Sesuai Ketikan</option>
                    <option value="uppercase">HURUF BESAR (UPPERCASE)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Dynamic Preview */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Pratinjau Kop Surat Resmi:</label>
              <div
                style={{
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: '#ffffff',
                  padding: '1.5rem',
                  fontFamily: formLetterhead.fontFamily,
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', marginBottom: '0.75rem' }}>
                  <img
                    src={logo || '/logo-kadesa.png'}
                    alt="Logo Kop Surat"
                    style={{ width: formLetterhead.logoSize, height: formLetterhead.logoSize, objectFit: 'contain' }}
                  />
                  <div style={{ flex: 1, textAlign: 'center' }}>
                    <div style={{ fontSize: `${formLetterhead.line1.fontSize}pt`, fontWeight: formLetterhead.line1.fontWeight, textTransform: formLetterhead.line1.textTransform }}>
                      {formLetterhead.line1.text}
                    </div>
                    <div style={{ fontSize: `${formLetterhead.line2.fontSize}pt`, fontWeight: formLetterhead.line2.fontWeight, textTransform: formLetterhead.line2.textTransform }}>
                      {formLetterhead.line2.text}
                    </div>
                    <div style={{ fontSize: `${formLetterhead.line3.fontSize}pt`, fontWeight: formLetterhead.line3.fontWeight, textTransform: formLetterhead.line3.textTransform }}>
                      {formLetterhead.line3.text}
                    </div>
                    <div style={{ fontSize: `${formLetterhead.line4.fontSize}pt`, fontWeight: formLetterhead.line4.fontWeight, fontStyle: formLetterhead.line4.fontStyle, textTransform: formLetterhead.line4.textTransform }}>
                      {formLetterhead.line4.text}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    borderBottom: formLetterhead.borderStyle === 'double' ? '3px double #000000' :
                                  formLetterhead.borderStyle === 'solid_thick' ? '2.5px solid #000000' :
                                  formLetterhead.borderStyle === 'solid_thin' ? '1px solid #000000' : 'none',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            {canManage && (
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetLetterhead}
                  disabled={isSavingLetterhead}
                >
                  <RefreshCw size={14} /> Kembalikan ke Standar Dinas
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleSaveLetterhead}
                  disabled={isSavingLetterhead}
                >
                  <Save size={14} /> {isSavingLetterhead ? 'Menyimpan...' : 'Simpan Kop Surat'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Holiday Modal */}
      <Modal
        isOpen={isHolidayModalOpen}
        onClose={() => setIsHolidayModalOpen(false)}
        title="Tambah Hari Libur Resmi"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsHolidayModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={handleAddHoliday}
            >
              <Save size={16} /> Simpan Hari Libur
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
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Keterangan / Nama Hari Libur <span className="required">*</span></label>
            <input
              type="text"
              className="form-input"
              value={holidayName}
              onChange={(e) => setHolidayName(e.target.value)}
              placeholder="Contoh: Hari Raya Idul Fitri"
              required
            />
          </div>
        </form>
      </Modal>

      {/* Leave Tab Confirm Dialog */}
      <ConfirmDialog
        isOpen={isLeaveTabConfirmOpen}
        title="Perubahan Belum Disimpan"
        message="Anda memiliki perubahan pengaturan pada tab ini yang belum disimpan. Apakah Anda yakin ingin berpindah tab dan membuang perubahan tersebut?"
        confirmLabel="Ya, Pindah & Buang Perubahan"
        cancelLabel="Tetap di Tab Ini"
        isDestructive={false}
        onConfirm={handleConfirmLeaveTab}
        onClose={() => {
          setPendingTab(null);
          setIsLeaveTabConfirmOpen(false);
        }}
      />
    </div>
  );
};
