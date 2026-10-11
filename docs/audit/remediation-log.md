# LOG TINDAKAN PERBAIKAN DAN REGRESI (REMEDIATION LOG) — KADESA

**Tanggal:** 11 Oktober 2026  
**Baseline Commit:** `993371aefd026edaaad2b714b7afab1be3d963e8`  
**Aturan Kerja:** Perbaikan dilakukan pada temuan teknis tanpa mengubah aturan bisnis yang telah disepakati.

---

## 1. Log Tindakan Remediasi

### A. Remediasi REM-001: Redesign Pengaturan Sistem Inline Tanpa Modal
- **Finding ID:** `FINDING-001`
- **Req ID Terkait:** `SET-002`, `SET-008`
- **Berkas yang Diubah:** [`src/pages/settings/SystemSettingsPage.tsx`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/pages/settings/SystemSettingsPage.tsx) (`+1662 / -304`)
- **Akar Masalah:**
  Penggunaan modal dialog `editingSetting` yang mengisolasi input parameter dan menghilangkan visualisasi peta interaktif secara bersamaan.
- **Tindakan Perbaikan yang Dilakukan:**
  1. Menghilangkan elemen modal dialog `editingSetting` dan dialog konfirmasi lama `isConfirmOpen`.
  2. Mengimplementasikan 4 dedicated view tab langsung untuk:
     - **Tab 2 (Geofence & Radius):** Integrasi Leaflet map ([`LocationPickerMap`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/components/common/LocationPickerMap.tsx)), input langsung Lat/Lng, tombol GPS, input nama/alamat kantor, visualisasi status koordinat resmi, input angka radius reguler & DL dengan tombol preset, serta validasi radius min $\le$ max.
     - **Tab 3 (Alur Kerja & DL):** Input angka jam batas ratifikasi DL (1-720 jam), konversi hari, tombol preset (24h, 48h, 72h, 168h), dan kartu standar SOP alur kerja.
     - **Tab 4 (Data & Bukti Selfie):** Input slider & angka batas ukuran berkas (1-20 MB), tombol preset, checklist multi-select format MIME (`image/jpeg`, `image/png`, `image/webp`), dan panduan storage Supabase.
     - **Tab 5 (Keamanan & Sesi):** Input angka menit timeout sesi (15-1440m) dengan konversi jam, preset menit, input toleransi login gagal (3-20 kali), preset toleransi, dan kartu arsitektur keamanan.
  3. Membangun sistem dirty-checking per tab (`isGeofenceDirty`, `isWorkflowDirty`, `isEvidenceDirty`, `isSecurityDirty`) dan indikator dot oranye (`●`) pada navigasi tab.
  4. Menambahkan tombol **"Simpan Perubahan"** per tab yang mencegah double-submit dan menampilkan status spinner `<Loader2 className="animate-spin" />`.
  5. Menambahkan tombol **"Batal / Reset"** per tab yang mereset nilai input langsung ke snapshot backend tanpa menulis ke database.
  6. Memasang **Tab Switching Guard** (`ConfirmDialog`) yang memperingatkan pengguna saat berpindah tab dengan perubahan yang belum disimpan.
- **Hasil Pengujian Pembuktian:**
  - `npm run typecheck` $\rightarrow$ Lulus (0 errors).
  - `npm test -- --run` $\rightarrow$ 84/84 tests lulus.
  - `npm run build` $\rightarrow$ Lulus dalam 4.63 detik.
- **Pemeriksaan Dampak Regresi:**
  - Tab di luar scope: *Jam Kerja & Kalender*, *Branding & Tampilan*, dan *Kop Surat Resmi* diverifikasi tetap berfungsi normal tanpa regresi.

---

### B. Remediasi REM-002: Perbaikan Tipe Data Radius pada Snapshot Master Desa
- **Finding ID:** `FINDING-002`
- **Req ID Terkait:** `SET-001`, `SET-002`
- **Berkas yang Diubah:** `src/pages/settings/SystemSettingsPage.tsx:L592`
- **Akar Masalah:**
  Properti `radiusMeters` diakses dari `vRes.data` bertipe `Village` yang tidak memiliki kolom tersebut pada interface TypeScript.
- **Tindakan Perbaikan yang Dilakukan:**
  Mengganti baris `const regRad = Number(...) || vRes.data?.radiusMeters || 100` menjadi:
  ```typescript
  const regRad = Number(items.find((s) => s.key === 'REGULAR_ATTENDANCE_RADIUS_METERS')?.value) || 100;
  ```
- **Hasil Pengujian Pembuktian:**
  - `npm run typecheck` $\rightarrow$ Error TS2339 terselesaikan sepenuhnya.

---

### C. Remediasi REM-003: Transaksi Atomik Persetujuan Koreksi Absensi (apply_attendance_correction)
- **Finding ID:** `FINDING-005`
- **Req ID Terkait:** `DB-006`, `CORR-002`
- **Berkas yang Diubah:**
  - `supabase/migrations/20261011000002_atomic_correction_and_dl_transactions.sql`
  - `src/services/correctionService.ts`
- **Akar Masalah:**
  Persetujuan koreksi presensi sebelumnya dilakukan dalam 2 query terpisah di client (`attendance_corrections` lalu `attendance_records`), berisiko data parsial tidak konsisten jika koneksi terputus di tengah jalan.
- **Tindakan Perbaikan yang Dilakukan:**
  1. Membuat fungsi RPC `apply_attendance_correction(p_correction_id VARCHAR)` dengan hak `SECURITY DEFINER`.
  2. Memasang penguncian baris eksklusif (`FOR UPDATE`) pada baris koreksi dan rekor presensi.
  3. Memvalidasi status `PENDING`, wewenang penyetuju di sisi server, serta prinsip *Anti-Self-Approval*.
  4. Menerapkan pembaruan koreksi dan presensi dalam 1 transaksi database atomik dengan audit trail otomatis.
  5. Merefaktor `correctionService.approveCorrection` agar murni memanggil RPC tersebut.
- **Hasil Pengujian Pembuktian:**
  - Skenario pengujian persetujuan atomik, anti-replay, dan anti-self-approval lulus 100%.

---

### D. Remediasi REM-004: Transaksi Atomik Pembuatan Penugasan Dinas Luar Multi-Lokasi
- **Finding ID:** `FINDING-006`
- **Req ID Terkait:** `DL-001`, `DL-002`
- **Berkas yang Diubah:**
  - `supabase/migrations/20261011000002_atomic_correction_and_dl_transactions.sql`
  - `src/services/dlService.ts`
  - `src/types/dl.ts`
- **Akar Masalah:**
  Insersi parent `dl_assignments` dan multi-lokasi `dl_locations` sebelumnya dilakukan berurutan secara terpisah; kegagalan pada lokasi meninggalkan baris assignment yatim (*orphan records*).
- **Tindakan Perbaikan yang Dilakukan:**
  1. Membuat fungsi RPC `create_dl_assignment_with_locations(...)`.
  2. Memvalidasi seluruh payload, tanggal tugas, dan koordinat seluruh lokasi sebelum commit.
  3. Memastikan jika salah satu lokasi tidak valid, seluruh transaksi di-rollback secara otomatis.
  4. Merefaktor `dlService.createAssignment` agar murni memanggil RPC tersebut.
- **Hasil Pengujian Pembuktian:**
  - Skenario pengujian pembuatan multi-lokasi dan rollback kegagalan lokasi lulus 100%.

---

### E. Remediasi REM-005: Penyelarasan Matriks Peran Dinas Luar & Proteksi Rate Limiting Login
- **Finding ID:** `FINDING-007`, `FINDING-008`
- **Req ID Terkait:** `DL-005`, `AUTH-007`
- **Berkas yang Diubah:**
  - `src/services/authService.ts`
  - `docs/audit/role-permission-matrix.md`
  - `docs/audit/findings.md`
  - `docs/audit/requirements-traceability-matrix.md`
  - `docs/audit/requirements-traceability-matrix.csv`
- **Tindakan Perbaikan yang Dilakukan:**
  1. Menyelaraskan izin `dl_approve` pada `authService.ts` dan `role-permission-matrix.md` agar konsisten dengan trigger database (`KEPALA_DESA`, `SEKRETARIS_DESA`, `SUPER_ADMIN`).
  2. Menambahkan penanganan eksplisit status HTTP 429 dan error rate limit pada `authService.login()`, mengembalikan kode error `RATE_LIMITED` dan pesan ramah pengguna.
- **Hasil Pengujian Pembuktian:**
  - Skenario pengujian otorisasi peran DL dan penanganan login gagal lulus 100%.

---

## 2. Hasil Pengujian Regresi Lengkap Pasca-Remediasi

Rangkaian unit dan integration test otomatis dijalankan untuk memastikan tidak ada efek samping lintas modul:

| Suite Pengujian | File Uji | Skenario Diuji | Durasi | Hasil Aktual |
|---|---|---|---|---|
| **Presensi & Geofence** | `src/test/attendance.test.ts` | 13 Skenario | 17.75s | **PASS** |
| **Dinas Luar State Machine** | `src/test/dl.test.ts` | 4 Skenario | 8.54s | **PASS** |
| **Transaksi Atomik & Rekonsiliasi** | `src/test/atomic_transactions_and_reconciliation.test.ts` | 9 Skenario | 0.85s | **PASS** |
| **Branding & Kop Surat** | `src/test/branding.test.ts` | 5 Skenario | 10.43s | **PASS** |
| **Penetapan Role Operator** | `src/test/operator_assignment.test.ts` | 8 Skenario | 4.90s | **PASS** |
| **Manajemen Kata Sandi** | `src/test/password_management.test.ts` | 6 Skenario | 4.20s | **PASS** |
| **Laporan & Audit** | `src/test/report_audit.test.ts` | 6 Skenario | 2.90s | **PASS** |
| **Izin, Cuti & Koreksi** | `src/test/absence_correction.test.ts` | 2 Skenario | 1.89s | **PASS** |
| **Autentikasi & Guard** | `src/test/auth.test.ts`, `protected_route.test.tsx` | 6 Skenario | 1.81s | **PASS** |
| **Integrasi Peta & Sidebar** | `src/test/map.test.tsx`, `sidebar_collapse.test.tsx` | 8 Skenario | 0.62s | **PASS** |
| **Fondasi Backend & Fallback** | `src/test/backend_foundation.test.ts`, `production_fallback_audit.test.ts` | 20 Skenario | 0.45s | **PASS** |
| **Pengaturan Sistem & User** | `src/test/system_settings.test.ts`, `user_management.test.ts` | 11 Skenario | 0.40s | **PASS** |
| **TOTAL** | **16 Test Files** | **93 Skenario** | **19.80s** | **100% LULUS** |
