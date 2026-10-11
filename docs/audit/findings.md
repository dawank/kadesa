# DAFTAR TEMUAN AUDIT SISTEM (FINDINGS REGISTER) — KADESA

**Tanggal:** 11 Oktober 2026  
**Baseline Commit:** `993371aefd026edaaad2b714b7afab1be3d963e8`  
**Standar Klasifikasi:**
- **P0 — CRITICAL:** Kebocoran data serius, bypass otorisasi/RLS, kehilangan data permanen, atau integritas presensi dapat dimanipulasi tanpa terdeteksi.
- **P1 — HIGH:** Alur kerja inti gagal, data penting tidak konsisten antar-lapisan, transaksi tidak atomik, atau audit tidak dapat dipercaya.
- **P2 — MEDIUM:** Fungsi sekunder bermasalah, UX/error handling berpotensi membingungkan pengguna, atau risiko operasional terbatas.
- **P3 — LOW:** Masalah minor, maintainability kode, optimalisasi non-blocking, atau ketergantungan layanan eksternal.

---

## 1. Rangkuman Temuan Berdasarkan Severity

| Severity | Teridentifikasi | Selesai Diperbaiki | Pending Tindakan Operasional / Pihak Ketiga |
|---|:---:|:---:|:---:|
| **P0 — CRITICAL** | 0 | 0 | 0 |
| **P1 — HIGH** | 1 | 1 | 0 |
| **P2 — MEDIUM** | 2 | 1 | 1 |
| **P3 — LOW** | 1 | 0 | 1 |
| **TOTAL** | **4** | **2** | **2** |

*Catatan: Seluruh temuan P0 kritis terkait RLS, imutabilitas GPS, dan pencegahan eskalasi hak akses operator telah diverifikasi terselesaikan pada migrasi database 002–006.*

---

## 2. Rincian Temuan Terkonfirmasi

### FINDING-001: Ketergantungan pada Pop-up Modal untuk Modifikasi Parameter Konfigurasi
- **Severity:** `P1 — HIGH`
- **Status:** **RESOLVED / CLOSED** (Commit `993371a`)
- **Requirement ID:** `SET-002`, `SET-008`
- **Lokasi Kode:** [`src/pages/settings/SystemSettingsPage.tsx`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/pages/settings/SystemSettingsPage.tsx)
- **Bukti Aktual:**
  Pada implementasi sebelumnya, pengubahan parameter pada tab Geofence, Alur Kerja, Bukti Selfie, dan Keamanan membuka modal generik `editingSetting` satu per satu. Pengguna tidak dapat melihat pratinjau peta interaktif secara bersamaan dengan input angka radius dan tidak memiliki mekanisme satu tombol simpan per tab.
- **Skenario Pemicu:**
  Administrator mengklik tombol "Ubah Nilai" pada tabel konfigurasi untuk mengedit titik koordinat dan batas radius.
- **Dampak Bisnis:**
  Pengalaman pengguna (UX) terfragmentasi, risiko kekeliruan penetapan titik kantor desa karena tidak ada peta langsung di halaman pengaturan, dan potensi kesalahan submit parsial.
- **Akar Masalah (Root Cause):**
  Desain awal mengelompokkan 4 kategori konfigurasi ke dalam tabel key-value generik warisan prototipe.
- **Solusi yang Diterapkan:**
  1. Menghilangkan seluruh modal `editingSetting` pada 4 tab dalam scope.
  2. Menggantinya dengan layout kontrol langsung (*inline direct editing*):
     - Peta interaktif Leaflet ([`LocationPickerMap`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/components/common/LocationPickerMap.tsx)) dengan marker drag & lingkaran radius.
     - Input langsung Latitude, Longitude, Alamat, dan Nama Lokasi.
     - Input angka radius reguler, min DL, dan max DL dengan tombol preset cepat.
     - Kontrol slider ukuran file selfie (MB) dan multi-select format MIME (`jpeg`, `png`, `webp`).
     - Kontrol jam batas ratifikasi DL dan menit timeout sesi dengan konversi waktu.
  3. Menyediakan satu tombol **"Simpan Perubahan"** per tab yang selektif hanya mengirim perubahan dirty.
  4. Menyediakan tombol **"Batal / Reset"** yang memulihkan state ke snapshot awal tanpa request jaringan.
  5. Memasang **Tab Switching Guard** (`ConfirmDialog`) yang memperingatkan pengguna jika berpindah tab dengan perubahan belum disimpan.
- **Pengujian Pembuktian:**
  - `npm run typecheck` $\rightarrow$ 0 errors
  - `npm run lint` $\rightarrow$ 0 errors
  - `npm test -- --run` $\rightarrow$ 84/84 tests passed
  - `npm run build` $\rightarrow$ Sukses terkompilasi dalam 4.63 detik.

---

### FINDING-002: Tipe Data Antarmuka `Village` Mengakses Properti `radiusMeters` yang Tidak Didefinisikan
- **Severity:** `P2 — MEDIUM`
- **Status:** **RESOLVED / CLOSED** (Commit `993371a`)
- **Requirement ID:** `SET-001`, `SET-002`
- **Lokasi Kode:** `src/pages/settings/SystemSettingsPage.tsx:L592`
- **Bukti Aktual:**
  Baris kode `vRes.data?.radiusMeters` menghasilkan error kompilator TypeScript `TS2339: Property 'radiusMeters' does not exist on type 'Village'` saat menjalankan `npm run typecheck`.
- **Skenario Pemicu:**
  Pemuatan fungsi `loadData()` saat membaca data profil desa untuk inisialisasi state snapshot geofence.
- **Dampak Bisnis:**
  Kompilasi build produksi berpotensi gagal pada lingkungan CI/CD dengan pengecekan type-safety ketat.
- **Akar Masalah (Root Cause):**
  Interface `Village` pada `src/types/master.ts` hanya mendefinisikan kolom profil (`latitude`, `longitude`, `alamat`, dsb.), sedangkan parameter radius presensi operasional desa disimpan secara terpusat pada tabel `system_settings` dengan key `REGULAR_ATTENDANCE_RADIUS_METERS`.
- **Solusi yang Diterapkan:**
  Mengubah inisialisasi state radius reguler untuk mengambil nilai langsung dari koleksi `system_settings`:
  ```typescript
  const regRad = Number(items.find((s) => s.key === 'REGULAR_ATTENDANCE_RADIUS_METERS')?.value) || 100;
  ```
- **Pengujian Pembuktian:**
  - `npm run typecheck` $\rightarrow$ Lulus bersih tanpa error.

---

### FINDING-003: Titik Koordinat Kantor Desa Produksi Memerlukan Konfirmasi Lapangan
- **Severity:** `P2 — MEDIUM`
- **Status:** **CONFIRMED / MITIGATED VIA FAIL-SAFE (OPERATIONAL PREREQUISITE)**
- **Requirement ID:** `SET-003`, `ATT-012`
- **Lokasi Kode:** `public.system_settings(OFFICE_COORDINATES_CONFIRMED)` & `public.villages`
- **Bukti Aktual:**
  Titik koordinat yang tersimpan saat ini di database (`-6.4828, 106.8436`) merupakan data koordinat pengujian simulasi desa pilot.
- **Skenario Pemicu:**
  Aparatur desa melakukan presensi WFO di kantor desa asli yang lokasinya berbeda dari koordinat pilot.
- **Dampak Bisnis:**
  Presensi aparatur di kantor desa asli akan ditolak karena berada di luar geofence koordinat pilot, atau sebaliknya disetujui pada lokasi yang salah jika dianggap koordinat resmi tanpa persetujuan Kepala Desa.
- **Akar Masalah (Root Cause):**
  Aplikasi belum menerima persetujuan titik koordinat definitif dari Kepala Desa / instansi pemerintah desa setempat.
- **Mitigasi Teknis yang Terpasang:**
  Sistem menerapkan mekanisme **Fail-Safe Presensi Produksi (ADR-012)**:
  1. Parameter `OFFICE_COORDINATES_CONFIRMED` di database disetel `false` secara bawaan.
  2. Trigger database `enforce_attendance_geofence_safety` dan service `attendanceService.checkIn` menolak mutlak seluruh transaksi presensi kantor WFO dengan pesan:
     > *"Titik koordinat kantor desa belum dikonfirmasi resmi oleh Administrator Desa. Presensi reguler ditolak demi kepastian hukum lokasi."*
  3. Pada tab Geofence, disediakan checkbox dan indikator status: *"Tandai titik ini sebagai Koordinat Resmi Kantor Desa yang Terverifikasi"* yang hanya dapat dikonfirmasi oleh Administrator/Kepala Desa yang sah.
- **Langkah yang Dibutuhkan:**
  Administrator / Kepala Desa masuk ke menu Pengaturan Sistem $\rightarrow$ Tab Geofence & Radius, geser marker peta ke titik kantor desa fisik yang sebenarnya, centang konfirmasi koordinat resmi, dan tekan tombol **Simpan Perubahan**.

---

### FINDING-004: Ketergantungan Eksternal SMTP untuk Pengiriman Email Pemulihan Kata Sandi
- **Severity:** `P3 — LOW`
- **Status:** **CONFIRMED (EXTERNAL INTEGRATION PREREQUISITE)**
- **Requirement ID:** `AUTH-005`
- **Lokasi Kode:** Supabase Auth SMTP Settings
- **Bukti Aktual:**
  Fitur lupa sandi pada halaman `/forgot-password` mengarahkan instruksi pemulihan via kontak WhatsApp aparatur terdaftar. Pemanggilan fungsi `supabase.auth.resetPasswordForEmail()` bergantung pada ketersediaan relay server SMTP eksternal.
- **Skenario Pemicu:**
  Pengguna meminta tautan pemulihan kata sandi melalui surel (email) langsung dari aplikasi.
- **Dampak Bisnis:**
  Jika SMTP pihak ketiga belum dikonfigurasi di dashboard Supabase, email tautan pemulihan tidak akan terkirim ke kotak masuk aparatur.
- **Mitigasi Teknis yang Terpasang:**
  Sistem menyediakan alur administratif resmi yang lebih cocok untuk konteks desa:
  1. Halaman `/forgot-password` memberikan notifikasi kontak resmi kantor desa.
  2. Administrator (Super Admin / Operator) dapat melakukan **Admin Reset Password** secara instan melalui menu Master Aparatur ([`MasterAparaturPage.tsx`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/pages/master/MasterAparaturPage.tsx)) dengan hak akses terverifikasi.
