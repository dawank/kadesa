import React, { useState, useEffect } from 'react';
import { reportService } from '../../services/reportService';
import { DailyReportItem, MonthlyReportItem } from '../../types/report';
import { useAuth } from '../../context/AuthContext';
import { useBranding } from '../../context/BrandingContext';
import { StatusBadge } from '../../components/common/StatusBadge';
import { useToast } from '../../context/ToastContext';
import {
  BarChart3,
  Calendar,
  FileSpreadsheet,
  Printer,
  FileText,
  Filter,
  UserCheck,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { currentUser } = useAuth();
  const { logo: villageLogo, villageName, letterheadConfig, locationSubtitle } = useBranding();
  const { showToast } = useToast();
  const [activeTab, setActiveTab] = useState<'DAILY' | 'MONTHLY'>('DAILY');
  const [paperOrientation, setPaperOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const isPerangkat = currentUser?.role === 'PERANGKAT_DESA';

  // Daily Report State
  const [dailyDate, setDailyDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<DailyReportItem[]>([]);

  // Monthly Report State
  const [month, setMonth] = useState<number>(new Date().getMonth() + 1);
  const [year, setYear] = useState<number>(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyReportItem[]>([]);

  const loadDaily = async () => {
    setIsLoading(true);
    try {
      const res = await reportService.getDailyReport(dailyDate);
      if (res.data) {
        const items = isPerangkat ? res.data.filter((d) => d.userId === currentUser?.id) : res.data;
        setDailyData(items);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const loadMonthly = async () => {
    setIsLoading(true);
    try {
      const res = await reportService.getMonthlyReport(month, year);
      if (res.data) {
        const items = isPerangkat ? res.data.filter((m) => m.userId === currentUser?.id) : res.data;
        setMonthlyData(items);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'DAILY') {
      loadDaily();
    } else {
      loadMonthly();
    }
  }, [activeTab, dailyDate, month, year, currentUser?.id]);

  const getExportData = () => {
    if (activeTab === 'DAILY') {
      const headers = ['Nama', 'Jabatan', 'Tanggal', 'Check-In', 'Check-Out', 'Status', 'Terlambat (Menit)', 'Pulang Awal (Menit)', 'Catatan / Alasan'];
      const rows = dailyData.map((d) => [
        d.nama,
        d.jabatan,
        d.date,
        d.checkIn || '-',
        d.checkOut || '-',
        d.status,
        d.lateMinutes,
        d.isEarlyLeave ? (d.earlyLeaveMinutes || 0) : 0,
        d.note || '-',
      ]);
      return {
        filename: isPerangkat ? `Laporan_Harian_Pribadi_${currentUser?.username}_${dailyDate}` : `Laporan_Harian_Kadesa_${dailyDate}`,
        title: isPerangkat ? `Laporan Kehadiran Pribadi — ${currentUser?.nama} (${dailyDate})` : `Laporan Kehadiran Aparatur Desa Tanggal ${dailyDate}`,
        headers,
        rows,
      };
    } else {
      const headers = [
        'Nama',
        'Jabatan',
        'Hari Kerja',
        'Hadir',
        'Terlambat',
        'Izin',
        'Sakit',
        'Dinas Luar',
        'Cuti',
        'Alpha',
        'Tingkat Kehadiran (%)',
      ];
      const rows = monthlyData.map((m) => [
        m.nama,
        m.jabatan,
        m.totalWorkdays,
        m.hadir,
        m.terlambat,
        m.izin,
        m.sakit,
        m.dinasLuar,
        m.cuti,
        m.alpha,
        `${m.attendancePercentage}%`,
      ]);
      return {
        filename: isPerangkat ? `Rekap_Bulanan_Pribadi_${currentUser?.username}_${month}_${year}` : `Laporan_Bulanan_Kadesa_${month}_${year}`,
        title: isPerangkat ? `Rekapitulasi Kehadiran Pribadi — ${currentUser?.nama} (${month}/${year})` : `Rekapitulasi Kehadiran Bulanan Periode ${month}/${year}`,
        headers,
        rows,
      };
    }
  };

  const handleExportCSV = () => {
    const { filename, headers, rows } = getExportData();
    reportService.exportToCSV(filename, headers, rows);
    showToast('File laporan CSV berhasil diunduh.', 'success');
  };

  const handleExportExcel = () => {
    const { filename, headers, rows, title } = getExportData();
    reportService.exportToExcel(filename, headers, rows, title);
    showToast('File Spreadsheet Excel (.xls) berhasil diunduh.', 'success');
  };

  const handleExportPDF = () => {
    const { title, headers, rows } = getExportData();
    reportService.exportToPDF(
      title,
      headers,
      rows,
      `Periode: ${activeTab === 'DAILY' ? dailyDate : `Bulan ${month} Tahun ${year}`}`,
      villageLogo,
      villageName,
      letterheadConfig,
      paperOrientation,
      locationSubtitle
    );
    showToast(
      `Dokumen PDF (${paperOrientation === 'landscape' ? 'Mendatar / Landscape' : 'Tegak / Portrait'}) berhasil dibuka.`,
      'info'
    );
  };

  const handlePrint = () => {
    handleExportPDF();
  };

  return (
    <div>
      <div className="page-header">
        <div className="page-title-group">
          <h1>{isPerangkat ? 'Laporan Kehadiran Pribadi' : 'Laporan & Rekapitulasi Kehadiran'}</h1>
          <p>
            {isPerangkat
              ? `Rekapitulasi dan riwayat kehadiran resmi untuk: ${currentUser?.nama} (${currentUser?.jabatanNama})`
              : 'Laporan komprehensif kehadiran harian, bulanan, keterlambatan, dan izin aparatur desa'}
          </p>
        </div>

        <div className="page-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Paper Orientation Selector (Portrait / Landscape) */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              backgroundColor: 'var(--color-slate-100)',
              padding: '2px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              gap: '2px',
            }}
            title="Pilih orientasi cetak dokumen resmi (Portrait / Landscape)"
          >
            <button
              type="button"
              className={`btn ${paperOrientation === 'portrait' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', minHeight: 0, height: 'auto' }}
              onClick={() => setPaperOrientation('portrait')}
            >
              Portrait (Tegak)
            </button>
            <button
              type="button"
              className={`btn ${paperOrientation === 'landscape' ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{ fontSize: '0.72rem', padding: '0.2rem 0.55rem', minHeight: 0, height: 'auto' }}
              onClick={() => setPaperOrientation('landscape')}
            >
              Landscape (Mendatar)
            </button>
          </div>

          <button type="button" className="btn btn-secondary btn-sm" onClick={handlePrint} title="Cetak dokumen resmi dengan orientasi terpilih">
            <Printer size={15} /> Cetak
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportCSV} title="Unduh format teks CSV">
            <FileText size={15} /> CSV
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExportPDF} title={`Buka layout cetak PDF (${paperOrientation === 'landscape' ? 'Landscape' : 'Portrait'})`}>
            <FileText size={15} /> PDF ({paperOrientation === 'landscape' ? 'Landscape' : 'Portrait'})
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={handleExportExcel} title="Unduh format spreadsheet Excel">
            <FileSpreadsheet size={15} /> Export Excel
          </button>
        </div>
      </div>

      {/* Tab Switcher & Filters */}
      <div className="card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${activeTab === 'DAILY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => {
                setActiveTab('DAILY');
                setPaperOrientation('portrait');
              }}
            >
              <Calendar size={14} /> Laporan Harian
            </button>
            <button
              type="button"
              className={`btn ${activeTab === 'MONTHLY' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => {
                setActiveTab('MONTHLY');
                setPaperOrientation('landscape');
              }}
            >
              <BarChart3 size={14} /> Rekapitulasi Bulanan
            </button>
          </div>

          {activeTab === 'DAILY' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Pilih Tanggal:</label>
              <input
                type="date"
                className="form-input"
                style={{ width: 'auto', minWidth: 140, padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                value={dailyDate}
                onChange={(e) => setDailyDate(e.target.value)}
              />
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Bulan:</label>
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 110, padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                  value={month}
                  onChange={(e) => setMonth(Number(e.target.value))}
                >
                  <option value={1}>Januari</option>
                  <option value={2}>Februari</option>
                  <option value={3}>Maret</option>
                  <option value={4}>April</option>
                  <option value={5}>Mei</option>
                  <option value={6}>Juni</option>
                  <option value={7}>Juli</option>
                  <option value={8}>Agustus</option>
                  <option value={9}>September</option>
                  <option value={10}>Oktober</option>
                  <option value={11}>November</option>
                  <option value={12}>Desember</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                <label style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Tahun:</label>
                <select
                  className="form-select"
                  style={{ width: 'auto', minWidth: 90, padding: '0.35rem 0.65rem', fontSize: '0.8125rem' }}
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Daily Report View */}
      {activeTab === 'DAILY' ? (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Calendar size={18} color="var(--color-primary-600)" />
              Laporan Kehadiran Tanggal {dailyDate}
            </h3>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Aparatur</th>
                  <th>Jabatan</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                  <th>Keterlambatan</th>
                  <th>Catatan / Keterangan</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Memuat laporan kehadiran...
                    </td>
                  </tr>
                ) : dailyData.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Belum ada data kehadiran pada tanggal {dailyDate}.
                    </td>
                  </tr>
                ) : (
                  dailyData.map((d) => (
                    <tr key={d.id}>
                      <td><strong>{d.nama}</strong></td>
                      <td>{d.jabatan}</td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{d.checkIn || '—'}</span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)' }}>{d.checkOut || '—'}</span>
                      </td>
                      <td>
                        <StatusBadge status={d.status} size="sm" />
                      </td>
                      <td>
                        {d.isLate ? (
                          <span style={{ color: '#b45309', fontWeight: 700 }}>{d.lateMinutes} Menit</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                          {d.note || 'Tepat Waktu'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Report View */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <BarChart3 size={18} color="var(--color-primary-600)" />
              Rekapitulasi Kehadiran Bulan {month}/{year}
            </h3>
          </div>

          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama Aparatur</th>
                  <th>Jabatan</th>
                  <th>Hari Kerja</th>
                  <th>Hadir</th>
                  <th>Terlambat</th>
                  <th>Izin</th>
                  <th>Sakit</th>
                  <th>DL</th>
                  <th>Cuti</th>
                  <th>Alpha</th>
                  <th style={{ textAlign: 'right' }}>% Kehadiran</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Memuat rekapitulasi bulanan...
                    </td>
                  </tr>
                ) : monthlyData.length === 0 ? (
                  <tr>
                    <td colSpan={11} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                      Belum ada data rekapitulasi kehadiran untuk periode {month}/{year}.
                    </td>
                  </tr>
                ) : monthlyData.map((m) => (
                  <tr key={m.userId}>
                    <td><strong>{m.nama}</strong></td>
                    <td>{m.jabatan}</td>
                    <td>{m.totalWorkdays}</td>
                    <td style={{ color: '#047857', fontWeight: 700 }}>{m.hadir}</td>
                    <td style={{ color: '#b45309', fontWeight: 700 }}>{m.terlambat}</td>
                    <td>{m.izin}</td>
                    <td>{m.sakit}</td>
                    <td style={{ color: '#7e22ce', fontWeight: 700 }}>{m.dinasLuar}</td>
                    <td>{m.cuti}</td>
                    <td style={{ color: '#dc2626', fontWeight: 700 }}>{m.alpha}</td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '0.875rem',
                          color: m.attendancePercentage >= 90 ? '#047857' : '#b45309',
                        }}
                      >
                        {m.attendancePercentage}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
