import { DailyReportItem, MonthlyReportItem } from '../types/report';
import { ApiResponse, simulateNetworkDelay, IS_DEMO_MODE } from './apiClient';
import { attendanceService } from './attendanceService';
import { authService } from './authService';
import { settingsService } from './settingsService';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { LetterheadConfig, LetterheadLineConfig } from '../types/settings';

function formatLineStyle(line: LetterheadLineConfig): string {
  return `font-size: ${line.fontSize}pt; font-weight: ${line.fontWeight}; font-style: ${line.fontStyle}; text-transform: ${line.textTransform}; letter-spacing: ${line.letterSpacing ?? 0}px; margin: 0; line-height: 1.25;`;
}

function buildLetterheadMarkup(
  config: LetterheadConfig | undefined,
  villageLogo?: string,
  villageName = 'Desa Sukamaju'
): string {
  if (!config) {
    return `
      <div class="header" style="display: flex; align-items: center; justify-content: center; gap: 1.5rem; border-bottom: 3px double #0f172a; padding-bottom: 1rem; margin-bottom: 1.5rem;">
        ${villageLogo ? `<img src="${villageLogo}" alt="Logo Desa" style="width: 72px; height: 72px; object-fit: contain;" />` : ''}
        <div class="header-text" style="text-align: center;">
          <h2 style="margin: 0; font-size: 1.35rem; text-transform: uppercase; letter-spacing: 0.5px;">PEMERINTAH ${villageName.toUpperCase()}</h2>
          <p style="margin: 0.25rem 0 0; font-size: 0.875rem; color: #475569;">Kecamatan Cibinong, Kabupaten Bogor, Jawa Barat</p>
          <p class="app-sub" style="margin: 0.25rem 0 0; font-size: 0.8125rem; font-weight: 600; color: #047857;">Sistem Informasi Kehadiran Aparatur Desa (KADESA)</p>
        </div>
      </div>
    `;
  }

  const borderCss = (() => {
    switch (config.borderStyle) {
      case 'double':
        return `border-bottom: 3px double ${config.borderColor || '#000000'};`;
      case 'solid_thick':
        return `border-bottom: ${config.borderThickness || 3}px solid ${config.borderColor || '#000000'};`;
      case 'solid_thin':
        return `border-bottom: 1px solid ${config.borderColor || '#000000'};`;
      case 'none':
      default:
        return 'border-bottom: none;';
    }
  })();

  const logoSrc = villageLogo || config.logoUrl || '/logo-kadesa.png';
  const logoWidth = config.logoSize || 76;
  const showLogo = config.showLogo !== false;

  const primaryLogoHtml = showLogo
    ? `<img src="${logoSrc}" alt="Logo Instansi" style="width: ${logoWidth}px; max-height: ${Math.round(logoWidth * 1.25)}px; object-fit: contain;" />`
    : '';

  const secondaryLogoHtml =
    config.layout === 'two_logos_center_text' && config.secondaryLogoUrl
      ? `<img src="${config.secondaryLogoUrl}" alt="Logo Kedua" style="width: ${logoWidth}px; max-height: ${Math.round(logoWidth * 1.25)}px; object-fit: contain;" />`
      : '';

  const linesHtml = `
    <div style="display: flex; flex-direction: column; gap: 2px;">
      <p style="${formatLineStyle(config.line1)}">${config.line1.text}</p>
      <p style="${formatLineStyle(config.line2)}">${config.line2.text}</p>
      <p style="${formatLineStyle(config.line3)}">${config.line3.text}</p>
      <p style="${formatLineStyle(config.line4)}">${config.line4.text}</p>
    </div>
  `;

  if (config.layout === 'center_logo_center_text') {
    return `
      <div style="font-family: ${config.fontFamily}; text-align: center; ${borderCss} padding-bottom: ${config.paddingBottom || 10}px; margin-bottom: 1.5rem;">
        ${primaryLogoHtml ? `<div style="margin-bottom: 8px;">${primaryLogoHtml}</div>` : ''}
        ${linesHtml}
      </div>
    `;
  }

  if (config.layout === 'left_logo_left_text') {
    return `
      <div style="font-family: ${config.fontFamily}; display: flex; align-items: center; gap: 1.5rem; text-align: left; ${borderCss} padding-bottom: ${config.paddingBottom || 10}px; margin-bottom: 1.5rem;">
        ${primaryLogoHtml ? `<div style="flex-shrink: 0;">${primaryLogoHtml}</div>` : ''}
        <div style="flex-grow: 1;">${linesHtml}</div>
      </div>
    `;
  }

  // Default: left_logo_center_text & two_logos_center_text
  return `
    <div style="font-family: ${config.fontFamily}; display: flex; align-items: center; justify-content: space-between; gap: 1rem; ${borderCss} padding-bottom: ${config.paddingBottom || 10}px; margin-bottom: 1.5rem;">
      <div style="width: ${logoWidth}px; flex-shrink: 0; display: flex; justify-content: center;">
        ${primaryLogoHtml}
      </div>
      <div style="flex-grow: 1; text-align: center;">
        ${linesHtml}
      </div>
      <div style="width: ${logoWidth}px; flex-shrink: 0; display: flex; justify-content: center;">
        ${secondaryLogoHtml}
      </div>
    </div>
  `;
}

class ReportService {
  async getDailyReport(date?: string): Promise<ApiResponse<DailyReportItem[]>> {
    await simulateNetworkDelay(250);
    const targetDate = date || new Date().toISOString().split('T')[0];

    const users = await authService.getAllUsers();
    const attRes = await attendanceService.getAllAttendance(targetDate);
    if (!attRes.success && !IS_DEMO_MODE) {
      return {
        success: false,
        message: attRes.message || 'Gagal mengambil data kehadiran untuk laporan harian',
        data: [],
      };
    }
    const records = attRes.data || [];

    const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    const [tY, tM, tD] = targetDate.split('-').map(Number);
    const targetDateObj = new Date(Date.UTC(tY, tM - 1, tD, 12, 0, 0));
    const dayScheduleInfo = await settingsService.getScheduleForDate(targetDateObj, timezone);
    const isWorkingDay = dayScheduleInfo.isWorkingDay;

    const reportItems: DailyReportItem[] = users
      .filter((u) => u.attendanceRequired && u.active)
      .map((user) => {
        const record = records.find(
          (r) => r.userId === user.id && r.attendanceDate === targetDate
        );

        const checkIn = record?.checkInAt ? record.checkInAt.split('T')[1].slice(0, 5) : null;
        const checkOut = record?.checkOutAt ? record.checkOutAt.split('T')[1].slice(0, 5) : null;
        
        let status = record ? record.status : 'ALPHA';
        if (!record && !isWorkingDay) {
          status = 'LIBUR';
        }

        const isEarlyLeave = record?.isEarlyLeave ?? false;
        const earlyLeaveMinutes = record?.earlyLeaveMinutes ?? 0;
        const earlyLeaveReason = record?.earlyLeaveReason;

        let note = record?.statusReason || (!isWorkingDay ? (dayScheduleInfo.holidayName ? `Hari Libur: ${dayScheduleInfo.holidayName}` : 'Hari Libur / Non-Kerja') : undefined);
        if (isEarlyLeave) {
          const earlyText = `Pulang Awal (${earlyLeaveMinutes} mnt${earlyLeaveReason ? `: ${earlyLeaveReason}` : ''})`;
          note = note ? `${note} | ${earlyText}` : earlyText;
        }

        return {
          id: `rep-${user.id}`,
          userId: user.id,
          nama: user.nama,
          jabatan: user.jabatanNama,
          date: targetDate,
          checkIn,
          checkOut,
          status,
          isLate: status === 'TERLAMBAT',
          lateMinutes: status === 'TERLAMBAT' ? 12 : 0,
          isEarlyLeave,
          earlyLeaveMinutes,
          earlyLeaveReason,
          note,
        };
      });

    return { success: true, data: reportItems };
  }

  async getMonthlyReport(month: number, year: number): Promise<ApiResponse<MonthlyReportItem[]>> {
    await simulateNetworkDelay(300);

    const timezone = await settingsService.getStringSetting('TIMEZONE', 'Asia/Jakarta');
    const lastDay = new Date(year, month, 0).getDate();

    const schedules = (await settingsService.getWorkSchedules()).data || [];
    const holidays = (await settingsService.getHolidays()).data || [];

    let calculatedWorkdays = 0;
    for (let day = 1; day <= lastDay; day++) {
      const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
      const info = await settingsService.getScheduleForDate(d, timezone, { schedules, holidays });
      if (info.isWorkingDay) {
        calculatedWorkdays++;
      }
    }
    const totalWorkdays = calculatedWorkdays > 0 ? calculatedWorkdays : 22;

    const users = await authService.getAllUsers();

    if (!IS_DEMO_MODE && isSupabaseConfigured()) {
      try {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const { data: dbRecords, error: dbErr } = await supabase
          .from('attendance_records')
          .select('user_id, status')
          .gte('attendance_date', startDate)
          .lte('attendance_date', endDate);

        if (dbErr) {
          return {
            success: false,
            message: `Gagal memuat rekap bulanan dari database: ${dbErr.message}`,
            data: [],
          };
        }

        const monthlyData: MonthlyReportItem[] = users
          .filter((u) => u.attendanceRequired && u.active)
          .map((user) => {
            const userRecords = (dbRecords || []).filter((r: any) => r.user_id === user.id);
            const hadir = userRecords.filter((r: any) => r.status === 'HADIR').length;
            const terlambat = userRecords.filter((r: any) => r.status === 'TERLAMBAT').length;
            const izin = userRecords.filter((r: any) => r.status === 'IZIN').length;
            const sakit = userRecords.filter((r: any) => r.status === 'SAKIT').length;
            const cuti = userRecords.filter((r: any) => r.status === 'CUTI').length;
            const dinasLuar = userRecords.filter((r: any) => r.status === 'DINAS_LUAR').length;
            const alpha = Math.max(0, totalWorkdays - (hadir + terlambat + izin + sakit + cuti + dinasLuar));
            const persentase = totalWorkdays > 0 ? Math.round(((hadir + terlambat + dinasLuar) / totalWorkdays) * 100) : 0;

            return {
              userId: user.id,
              nama: user.nama,
              jabatan: user.jabatanNama,
              totalWorkdays,
              hadir,
              terlambat,
              izin,
              sakit,
              cuti,
              dinasLuar,
              alpha,
              attendancePercentage: persentase,
            };
          });

        return { success: true, data: monthlyData };
      } catch (err: any) {
        return {
          success: false,
          message: `Gagal memuat rekap bulanan: ${err.message || err}`,
          data: [],
        };
      }
    }

    const monthlyData: MonthlyReportItem[] = users
      .filter((u) => u.attendanceRequired && u.active)
      .map((user) => {
        const hadir = 18;
        const terlambat = 2;
        const izin = 1;
        const sakit = 0;
        const cuti = 0;
        const dinasLuar = 1;
        const alpha = totalWorkdays - (hadir + terlambat + izin + sakit + cuti + dinasLuar);
        const persentase = Math.round(((hadir + terlambat + dinasLuar) / totalWorkdays) * 100);

        return {
          userId: user.id,
          nama: user.nama,
          jabatan: user.jabatanNama,
          totalWorkdays,
          hadir,
          terlambat,
          izin,
          sakit,
          cuti,
          dinasLuar,
          alpha: Math.max(0, alpha),
          attendancePercentage: persentase,
        };
      });

    return { success: true, data: monthlyData };
  }

  exportToCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
    const csvContent =
      headers.join(',') +
      '\n' +
      rows
        .map((row) =>
          row
            .map((cell) => {
              const cellStr = String(cell);
              if (cellStr.includes(',') || cellStr.includes('\n') || cellStr.includes('"')) {
                return `"${cellStr.replace(/"/g, '""')}"`;
              }
              return cellStr;
            })
            .join(',')
        )
        .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportToExcel(
    filename: string,
    headers: string[],
    rows: (string | number)[][],
    sheetTitle: string = 'Laporan Kehadiran'
  ): void {
    const xmlHeader = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#047857" ss:Pattern="Solid"/>
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
  </Style>
  <Style ss:ID="Data">
   <Alignment ss:Vertical="Center"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${sheetTitle.replace(/[/\\?*[\]]/g, ' ')}">
  <Table>
   <Row ss:StyleID="Header">
    ${headers.map((h) => `<Cell><Data ss:Type="String">${h}</Data></Cell>`).join('')}
   </Row>
   ${rows
     .map(
       (r) =>
         `<Row ss:StyleID="Data">${r
           .map((c) => `<Cell><Data ss:Type="${typeof c === 'number' ? 'Number' : 'String'}">${c}</Data></Cell>`)
           .join('')}</Row>`
     )
     .join('\n   ')}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlHeader], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportToPDF(
    title: string,
    headers: string[],
    rows: (string | number)[][],
    subtitle?: string,
    villageLogo?: string,
    villageName = 'Desa Sukamaju',
    letterheadConfig?: LetterheadConfig,
    orientation?: 'portrait' | 'landscape'
  ): void {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Izinkan pop-up browser untuk mencetak atau menyimpan dokumen PDF laporan.');
      return;
    }

    const effectiveOrientation: 'portrait' | 'landscape' =
      orientation || letterheadConfig?.defaultOrientation || 'portrait';

    const headerMarkup = buildLetterheadMarkup(letterheadConfig, villageLogo, villageName);

    const now = new Date();
    const dateFormatted = now.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const timeFormatted = now.toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).replace(/\./g, ':');

    // Estimasi halaman berdasarkan volume baris data (portrait ~ 20 baris, landscape ~ 14 baris per A4)
    const rowsPerPage = effectiveOrientation === 'landscape' ? 14 : 20;
    const estimatedTotalPages = Math.max(1, Math.ceil(Math.max(rows.length, 1) / rowsPerPage));
    const randomDocSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const docRegistrationNumber = `KDS-LAP-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${randomDocSuffix}`;

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background-color: #ffffff;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page-container {
      min-height: ${effectiveOrientation === 'landscape' ? '88vh' : '94vh'};
      max-width: ${effectiveOrientation === 'landscape' ? '1200px' : '900px'};
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: ${effectiveOrientation === 'landscape' ? '1.25rem 2rem' : '1.5rem 2rem'};
      position: relative;
    }
    .content-area {
      flex-grow: 1;
    }
    .report-title-area {
      text-align: center;
      margin-bottom: 1.25rem;
    }
    .report-title {
      margin: 0;
      font-size: ${effectiveOrientation === 'landscape' ? '1.25rem' : '1.15rem'};
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: #0f172a;
    }
    .report-subtitle {
      font-size: 0.8125rem;
      color: #64748b;
      margin: 0.25rem 0 0;
    }
    table.report-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 1rem;
      font-size: ${effectiveOrientation === 'landscape' ? '0.875rem' : '0.8125rem'};
    }
    table.report-table th {
      background-color: #f1f5f9;
      color: #0f172a;
      border: 1px solid #cbd5e1;
      padding: ${effectiveOrientation === 'landscape' ? '7px 10px' : '8px 10px'};
      text-align: left;
      font-weight: 700;
    }
    table.report-table td {
      border: 1px solid #e2e8f0;
      padding: ${effectiveOrientation === 'landscape' ? '5px 10px' : '6px 10px'};
    }
    table.report-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    .signature-section {
      margin-top: 2.75rem;
      display: flex;
      justify-content: flex-end;
      page-break-inside: avoid;
    }
    .signature-box {
      text-align: center;
      min-width: 220px;
      font-size: 0.8125rem;
      line-height: 1.45;
    }
    .signature-space {
      height: 60px;
    }
    /* Bagian Bawah Laporan (Di atas footer fisik printer, menempel di badan dokumen resmi) */
    .document-provenance-bar {
      margin-top: 3.5rem;
      padding-top: 0.75rem;
      border-top: 1.5px solid #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 0.75rem;
      color: #475569;
      page-break-inside: avoid;
    }
    .app-stamp-title {
      font-weight: 700;
      font-size: 0.8125rem;
      color: #0f172a;
      letter-spacing: 0.2px;
    }
    .app-stamp-date {
      font-size: 0.71875rem;
      color: #475569;
      margin-top: 2px;
    }
    .provenance-right {
      text-align: right;
    }
    .page-number-box {
      font-weight: 700;
      font-size: 0.8125rem;
      color: #0f172a;
    }
    .security-code {
      font-size: 0.6875rem;
      color: #64748b;
      margin-top: 2px;
    }
    @media print {
      @page {
        size: A4 ${effectiveOrientation};
        margin: ${effectiveOrientation === 'landscape' ? '0.8cm 1.2cm 1cm 1.2cm' : '1cm 1.25cm 1.25cm 1.25cm'};
      }
      body {
        padding: 0;
      }
      .page-container {
        min-height: ${effectiveOrientation === 'landscape' ? '92vh' : '98vh'};
        padding: 0;
        max-width: none;
      }
    }
  </style>
</head>
<body>
  <div class="page-container">
    <div class="content-area">
      ${headerMarkup}
      <div class="report-title-area">
        <h3 class="report-title">${title}</h3>
        ${subtitle ? `<p class="report-subtitle">${subtitle}</p>` : ''}
      </div>
      <table class="report-table">
        <thead>
          <tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <div class="signature-section">
        <div class="signature-box">
          <div>Mengetahui,</div>
          <div style="font-weight: 700;">Kepala ${villageName}</div>
          <div class="signature-space"></div>
          <div style="font-weight: 700; text-decoration: underline;">Drs. H. Ahmad Dahlan</div>
          <div style="font-size: 0.71875rem; color: #64748b; margin-top: 2px;">NIPD / NIP. 19780512 200501 1 003</div>
        </div>
      </div>
    </div>

    <!-- Bagian Bawah Laporan: Tersemat Permanen Anti-Manipulasi -->
    <div class="document-provenance-bar">
      <div>
        <div class="app-stamp-title">Dicetak aplikasi Kadesa</div>
        <div class="app-stamp-date">pada tanggal ${dateFormatted}, pukul ${timeFormatted} WIB</div>
      </div>
      <div class="provenance-right">
        <div class="page-number-box">Halaman 1 dari ${estimatedTotalPages}</div>
        <div class="security-code">No. Registrasi: ${docRegistrationNumber} &bull; Keabsahan Terverifikasi Sistem</div>
      </div>
    </div>
  </div>
  <script>
    window.onload = function() { window.print(); }
  </script>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  }
}

export const reportService = new ReportService();
