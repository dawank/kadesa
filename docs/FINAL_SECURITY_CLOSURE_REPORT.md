# LAPORAN FINAL SECURITY CLOSURE — KADESA
**Berdasarkan Instruksi Penutupan Keamanan Pasca-Audit**  
**Tanggal:** 10 Oktober 2026  
**Status Kesiapan:** **NOT PRODUCTION READY (BLOCKED OLEH TEMUAN KRITIS)**  
**Target Proyek Supabase:** `https://qjiwxtvhzeitjtznhkdc.supabase.co`  
**Target Deployment Vercel:** `https://kadesa.vercel.app` (Deployment ID: `dpl_5m6GTGCntftkpYhXe5GVqfS9K26M`)

---

## RINGKASAN STATUS PENUTUPAN KEAMANAN

| No | Fokus Verifikasi | Status | Ringkasan Bukti Objektif |
|:---:|:---|:---:|:---|
| 1 | **Status Rotasi Service-Role Key yang Terekspos** | **FAIL** | Pengujian probe langsung terhadap endpoint otorisasi Supabase membuktikan key lama masih aktif dan diterima (`HTTP 200 OK`). Key belum dicabut atau dirotasi. |
| 2 | **Panduan Mekanisme Resmi Rotasi Key** | **PASS** | Prosedur rotasi resmi Supabase Dashboard & mitigasi penguncian secret telah didokumentasikan secara aman tanpa mencetak secret. |
| 3 | **Verifikasi Edge Function Pasca-Perubahan Secret** | **NOT VERIFIED** | Belum dapat diverifikasi karena rotasi key pada Supabase Dashboard belum dilakukan. Edge Function saat ini masih berjalan pada key lama. |
| 4 | **Keamanan Kata Sandi Akun Pilot/Operasional** | **FAIL** | 6 akun inti operasional desa terverifikasi masih dapat diautentikasi menggunakan kata sandi default pabrikan. |
| 5 | **Status `VITE_ENABLE_DEMO_MODE` pada Vercel Production** | **PASS** | Nilai environment variable produksi terverifikasi bernilai `"false"`. Kode `IS_DEMO_MODE` aktif mengevaluasi ke `false` di production. |
| 6 | **Peniadaan Fallback In-Memory / Mock yang Menyamarkan Error** | **PASS** | Layanan Presensi, Koreksi, Audit, dan Laporan telah dipastikan menolak menyamarkan kegagalan database; agregasi laporan bulanan telah dihubungkan ke query tabel database. |
| 7 | **Verifikasi Deployment Aktif Vercel** | **PASS** | Deployment produksi aktif `dpl_5m6GTGCntftkpYhXe5GVqfS9K26M` di `https://kadesa.vercel.app` menyajikan bundle `index-DkQCdGnP.js` yang 100% identik dengan hasil build yang lolos lint, typecheck, dan 68 unit/integration test. |

---

## 1. PEMERIKSAAN ROTASI SERVICE-ROLE KEY

- **Metode Pengujian:**  
  Mengirimkan HTTP GET request terautentikasi ke endpoint administrasi Supabase (`/auth/v1/admin/users`) menggunakan kredensial service-role key yang sebelumnya muncul pada riwayat perintah.
- **Hasil Pengujian:**  
  Endpoint merespons dengan status code **`HTTP 200 OK`**.
- **Evaluasi:**  
  **STATUS: FAIL.**  
  Key tersebut **masih aktif** dan **belum dirotasi maupun dicabut**. Kunci ini memiliki hak administratif penuh terhadap database dan autentikasi Supabase.

---

## 2. PANDUAN LANGKAH ROTASI KEY SECARA RESMI

Untuk mencabut key yang terekspos dan menerbitkan key baru secara aman, pengelola proyek wajib menjalankan langkah-langkah berikut pada konsol resmi Supabase:

1. Buka browser dan login ke **Supabase Dashboard**:  
   `https://supabase.com/dashboard/project/qjiwxtvhzeitjtznhkdc`
2. Masuk ke menu **Project Settings** (ikon gerigi di bilah kiri bawah) -> **API**.
3. Gulir ke bagian **Project API Keys** dan **JWT Settings**.
4. Klik tombol **Roll API Key** / **Generate new JWT secret**.
   - *Peringatan:* Tindakan ini akan membatalkan seluruh token JWT lama, termasuk anon key dan service-role key yang terekspos.
5. Salin nilai **anon / public key** yang baru diterbitkan.
6. Perbarui variabel `VITE_SUPABASE_ANON_KEY` pada Vercel Dashboard:  
   `Project Settings -> Environment Variables -> Edit VITE_SUPABASE_ANON_KEY` lalu lakukan trigger redeployment.
7. Pada arsitektur Supabase Cloud, seluruh Supabase Edge Functions (seperti `create-apparatus-user`) menerima `SUPABASE_SERVICE_ROLE_KEY` secara terinjeksi otomatis dari platform, sehingga fungsi backend akan langsung menggunakan secret yang baru tanpa perlu modifikasi source code.

---

## 3. VERIFIKASI EDGE FUNCTION `create-apparatus-user`

- **STATUS: NOT VERIFIED (Menunggu Eksekusi Rotasi)**
- **Alasan:**  
  Meskipun Edge Function saat ini terbukti menolak request tanpa autentikasi (HTTP 401), menolak role non-admin (HTTP 403), dan memvalidasi body request (HTTP 400), fungsi ini **belum dapat diverifikasi "setelah perubahan secret"** karena proses rotasi API key pada Supabase Dashboard belum dieksekusi.
- **Rencana Pengujian Pasca-Rotasi:**  
  Segera setelah langkah di Bab 2 selesai, jalankan kembali suite pengujian untuk memastikan Edge Function berhasil menerbitkan akun menggunakan service-role key baru tanpa kendala authorization.

---

## 4. KEAMANAN KATA SANDI AKUN OPERASIONAL / PILOT

- **Metode Pengujian:**  
  Melakukan probe autentikasi password grant ke Supabase Auth endpoint (`/auth/v1/token?grant_type=password`) terhadap seluruh identitas aparatur desa yang terdaftar di database `public.users`.
- **Hasil Pengujian:**  
  Ditemukan **6 akun operasional utama** yang masih aktif dengan kata sandi default pabrikan (`password123`):
  1. `superadmin@desa.local` (Role: `SUPER_ADMIN`)
  2. `dawank@desa.local` (Role: `SUPER_ADMIN`)
  3. `operator@desa.local` (Role: `OPERATOR_DESA`)
  4. `kades@desa.local` (Role: `KEPALA_DESA`)
  5. `sekdes@desa.local` (Role: `SEKRETARIS_DESA`)
  6. `dewi@desa.local` (Role: `PERANGKAT_DESA`)
- **Tindakan yang Diambil:**  
  Sesuai instruksi audit ("Jangan mengubah kata sandi akun pengguna tanpa otorisasi yang sesuai"), kata sandi pengguna **tidak diubah secara sepihak**.
- **Evaluasi:**  
  **STATUS: FAIL (RISIKO KEAMANAN TINGGI).**  
  Akun-akun dengan hak istimewa tinggi (`SUPER_ADMIN`, `OPERATOR_DESA`, `KEPALA_DESA`) rentan terhadap pengambilalihan akun secara instan jika aplikasi dipublikasikan ke lingkungan produksi tanpa penggantian kata sandi operasional individual.

---

## 5. VERIFIKASI MODE DEMO PADA VERCEL PRODUCTION

- **Pemeriksaan Environment:**  
  Mengambil konfigurasi target produksi melalui Vercel CLI (`vercel env pull --environment=production`).
  - Hasil: `VITE_ENABLE_DEMO_MODE="false"`
- **Pemeriksaan Resolusi Runtime:**  
  File `src/services/apiClient.ts` mengonfigurasi:
  ```typescript
  export const IS_DEMO_MODE = import.meta.env.MODE === 'test'
    ? true
    : import.meta.env.DEV
    ? (import.meta.env.VITE_ENABLE_DEMO_MODE !== 'false')
    : (import.meta.env.VITE_ENABLE_DEMO_MODE === 'true');
  ```
  Pada lingkungan Vercel Production (`!import.meta.env.DEV` dan `import.meta.env.MODE !== 'test'`), nilai `IS_DEMO_MODE` dievaluasi menjadi `false`.
- **Evaluasi:**  
  **STATUS: PASS.** Mode demo tidak aktif pada deployment produksi.

---

## 6. PENIADAAN FALLBACK DATA IN-MEMORY / MOCK

Pemeriksaan dan remediasi dilakukan terhadap seluruh service inti untuk menjamin tidak ada kesalahan database yang disamarkan oleh mock data:

1. **Layanan Presensi (`src/services/attendanceService.ts`):**  
   - Fungsi `checkIn` dan `checkOut` mengembalikan status error eksplisit (`SERVER_TIME_ERROR`, `CHECKOUT_CONFLICT`, dll.) saat terjadi kendala koneksi atau integritas constraint.
   - Fungsi `getAllAttendance` telah diperbarui: saat kueri database gagal, fungsi segera mengembalikan `{ success: false, message: ... }` dan **tidak lagi jatuh ke array `this.records` lokal**.
2. **Layanan Koreksi (`src/services/correctionService.ts`):**  
   - Pengajuan dan persetujuan koreksi mematuhi trigger database `trg_enforce_attendance_correction_lifecycle`. Kesalahan database langsung dilemparkan ke antarmuka pengguna tanpa fallback in-memory.
3. **Layanan Audit (`src/services/auditService.ts`):**  
   - Fungsi `getAuditLogs` telah diperbaiki: kegagalan query database kini langsung mengembalikan pesan error resmi tanpa menyajikan log tiruan.
   - Fungsi `recordAuditEvent` tidak lagi memalsukan pencatatan lokal jika pemanggilan RPC database gagal.
4. **Layanan Laporan (`src/services/reportService.ts`):**  
   - Fungsi `getDailyReport` memvalidasi status respon dari database. Jika query presensi gagal, proses dihentikan dengan pelaporan error.
   - Fungsi `getMonthlyReport` telah diperbaiki: angka-angka statis (*hardcoded 18 hadir, 2 terlambat, dll.*) telah digantikan dengan kueri agregasi SQL nyata terhadap tabel `attendance_records` di database Supabase untuk rentang bulan dan tahun yang dipilih.
- **Evaluasi:**  
  **STATUS: PASS.** Seluruh operasi transaksional dan pelaporan terikat langsung ke database tanpa penyamaran in-memory.

---

## 7. VERIFIKASI DEPLOYMENT AKTIF VERCEL

- **Pengujian Kualitas Lokal:**
  - `npm run lint`: **PASS (Exit code 0)** — Tidak ada error ESLint pada direktori `src/`.
  - `npm run typecheck`: **PASS (Exit code 0)** — Pemeriksaan compiler TypeScript bersih.
  - `npm test`: **PASS (Exit code 0)** — 13 test file lulus, 68 dari 68 test case lulus (100%).
  - `npm run build`: **PASS (Exit code 0)** — Bundle produksi Vite dihasilkan dalam 4.11 detik (`dist/assets/index-DkQCdGnP.js`).
- **Pemeriksaan Deployment Vercel:**
  - **Deployment ID:** `dpl_5m6GTGCntftkpYhXe5GVqfS9K26M`
  - **Target URL:** `https://kadesa.vercel.app`
  - **Status:** `READY (Production)`
  - **Verifikasi Bundle Live:** Script bundle yang disajikan langsung oleh `https://kadesa.vercel.app` terkonfirmasi memuat `/assets/index-DkQCdGnP.js`, persis cocok dengan build yang lolos uji.
- **Evaluasi:**  
  **STATUS: PASS.**

---

## KESIMPULAN KESIAPAN PRODUKSI

Sesuai kriteria ketat audit keamanan dan instruksi kerja:

> **STATUS SISTEM SAAT INI: NOT PRODUCTION READY (BLOCKED)**  
> Meskipun arsitektur kode, integritas database, dan pipeline deployment Vercel telah lulus uji 100%, sistem **TIDAK DAPAT** dideklarasikan `PRODUCTION READY` sampai 2 prasyarat wajib berikut diselesaikan oleh Administrator:
> 1. **Mengeksekusi rotasi service-role key** pada Supabase Dashboard untuk mencabut key yang terekspos.
> 2. **Mengganti kata sandi default (`password123`)** pada akun-akun operasional berhak istimewa (`superadmin`, `operator`, `kades`, `sekdes`) dengan kata sandi produksi yang kuat.
