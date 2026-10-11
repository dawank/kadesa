# LAPORAN TINDAK LANJUT FINAL SECURITY CLOSURE — KADESA
**Tanggal Evaluasi:** 10 Oktober 2026  
**Status Kesiapan:** **NOT PRODUCTION READY (MENUNGGU TINDAKAN ADMINISTRATOR)**  
**Target Proyek Supabase:** `https://qjiwxtvhzeitjtznhkdc.supabase.co`  
**Target Deployment Vercel:** `https://kadesa.vercel.app` (`dpl_5m6GTGCntftkpYhXe5GVqfS9K26M`)

---

## 1. TABEL STATUS PEKERJAAN

| No | Komponen / Pengujian | Status | Bukti & Catatan Teknis |
|:---:|:---|:---:|:---|
| 1 | **Status Key Service-Role Lama** | **FAIL** | Probe otentikasi ke `/auth/v1/admin/users` menggunakan key lama masih menghasilkan `HTTP 200 OK`. Kunci belum dicabut di remote control plane. |
| 2 | **Rotasi Key Service-Role Lama** | **WAITING FOR ADMIN ACTION** | Mekanisme pencabutan resmi API key lama memerlukan konfirmasi pemilik proyek di Supabase Dashboard (langkah rinci tersedia di Bab 2). |
| 3 | **Penggantian Kata Sandi 6 Akun Default** | **WAITING FOR ADMIN ACTION** | 6 akun inti (`superadmin`, `dawank`, `operator`, `kades`, `sekdes`, `dewi`) masih terbukti menerima `password123`. Memerlukan aksi penggantian oleh Administrator. |
| 4 | **Verifikasi Edge Function Pasca-Rotasi** | **NOT VERIFIED** | Edge Function `create-apparatus-user` lolos uji proteksi saat ini (HTTP 401 unauth, HTTP 403 non-admin, HTTP 400 bad payload), namun verifikasi fungsi menggunakan key baru baru dapat dibuktikan setelah rotasi dieksekusi. |
| 5 | **Otorisasi & RLS (Database)** | **PASS** | Sesi anonim dan Perangkat Desa mendapatkan 0 baris pada `audit_logs`. RPC pencatatan audit menolak pemanggilan anonim (HTTP 400). |
| 6 | **Transaksi Presensi & Koreksi** | **PASS** | Constraint unik `uq_user_attendance_date` memblokir check-in ganda (Error 23505). Guard update check-out konkuren bekerja atomik. Trigger koreksi menolak self-approval dan insert langsung status APPROVED. |
| 7 | **Peniadaan Mock Fallback pada Audit & Laporan** | **PASS** | Layanan Presensi, Koreksi, Audit, dan Laporan mengembalikan error database tanpa menyamarkan kegagalan dengan mock data. `getMonthlyReport` melakukan query agregasi SQL nyata ke tabel `attendance_records`. |
| 8 | **Konfigurasi Vercel Production** | **PASS** | Nilai environment variable `VITE_ENABLE_DEMO_MODE="false"`. `IS_DEMO_MODE` dievaluasi ketat ke `false`. |
| 9 | **Pemeriksaan Bundle Frontend dari Secret** | **PASS** | Analisis token JWT pada seluruh bundle produksi (`dist/assets/*.js`) mengonfirmasi 0 key `service_role`. Hanya token publik `anon` yang terpasang pada client. |
| 10 | **Verifikasi Build, Lint, & Test** | **PASS** | `npm run lint` (0 error), `npm run typecheck` (0 error), `npm test` (68/68 passed), `npm run build` (lulus). |

---

## 2. PANDUAN LANGKAH ADMINISTRATOR (ACTION PLAN)

### A. Tindakan 1: Rotasi Service-Role Key di Supabase Dashboard
Supabase menyimpan kunci master API pada dashboard kontrol:
1. Buka browser dan login ke akun Supabase Anda:  
   👉 **URL:** `https://supabase.com/dashboard/project/qjiwxtvhzeitjtznhkdc/settings/api`
2. Gulir ke bagian **Project API Keys** dan **JWT Settings**.
3. Klik tombol **Roll API Key** (atau **Generate new JWT secret**).
4. Konfirmasi tindakan tersebut saat kotak dialog peringatan muncul.
   - *Dampak:* Key lama yang terekspos seketika menjadi tidak berlaku (invalid).
5. Salin nilai **anon public key** yang baru, lalu perbarui di Vercel:
   - Buka **Vercel Dashboard** -> Project `kadesa` -> **Settings** -> **Environment Variables**.
   - Edit nilai `VITE_SUPABASE_ANON_KEY` dengan anon key baru dan klik **Save**.
   - Klik **Deployments** -> pilih deployment terbaru -> klik **Redeploy**.
6. Pada Edge Functions (`create-apparatus-user`), Supabase Cloud secara otomatis memperbarui nilai internal `SUPABASE_SERVICE_ROLE_KEY` tanpa perlu perubahan konfigurasi manual.

---

### B. Tindakan 2: Penggantian Kata Sandi 6 Akun Operasional
Untuk mengamankan akun dari kata sandi default pabrikan:
1. Buka menu autentikasi Supabase:  
   👉 **URL:** `https://supabase.com/dashboard/project/qjiwxtvhzeitjtznhkdc/auth/users`
2. Cari ke-6 akun berikut satu per satu:
   - `superadmin@desa.local`
   - `dawank@desa.local`
   - `operator@desa.local`
   - `kades@desa.local`
   - `sekdes@desa.local`
   - `dewi@desa.local`
3. Klik ikon titik tiga (**...**) di sisi kanan masing-masing baris akun -> pilih **Change password**.
4. Masukkan kata sandi baru yang kuat (minimal 8 karakter kombinasi huruf, angka, dan simbol) untuk masing-masing akun, lalu simpan.
5. Berikan kata sandi baru tersebut secara aman kepada masing-masing personil desa terkait.

---

## 3. PROSEDUR UJI ULANG OTOMATIS SETELAH TINDAKAN SELESAI

Setelah Anda menyelesaikan kedua tindakan di atas, beri tahu saya dengan mengetik:
`"Saya sudah melakukan rotasi key dan mengganti kata sandi. Lakukan verifikasi sekarang."`

Saya akan langsung menjalankan suite verifikasi otomatis untuk:
1. Mengonfirmasi bahwa key lama menghasilkan `HTTP 401 Unauthorized` (terbukti dicabut).
2. Mengonfirmasi bahwa ke-6 akun menolak login dengan kata sandi `password123`.
3. Menguji Edge Function `create-apparatus-user` menggunakan kredensial aktif baru.
4. Mendeklarasikan status akhir **PRODUCTION READY**.
