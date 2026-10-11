# Laporan Verifikasi Konfigurasi Supabase dan Konektivitas — KADESA

**Tanggal Pemeriksaan:** 09 Oktober 2026  
**Auditor / AI Coding Engineer:** Antigravity AI Pair Programmer  
**Target Proyek:** Supabase Cloud Instance (`qjiwxtvhzeitjtznhkdc`)  
**Status Konektivitas:** **CONNECTED & VERIFIED (LIVE REACHABLE, FRESH DATABASE)**  
**Status Skema Database Live:** **NOT YET APPLIED (EMPTY / TABEL BELUM DIBUAT)**  
**Fase Proyek:**
- Planning: **CLOSED** (PRD Baseline Terkunci)
- Frontend: **LULUS BERSYARAT** (Acuan Integrasi)
- Backend Tahap 1: **PRE-LIVE CONNECTIVITY VERIFIED**
- Integration: **PENDING**
- Deployment: **PENDING**

---

## 1. Verifikasi Konfigurasi Environment & Keamanan Kredensial

1. **Pembacaan Variabel Lingkungan:**
   - Variabel terbaca dari file lingkungan lokal [`.env.local`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/.env.local), yang merupakan mekanisme standar Vite untuk environment lokal.
   - Nama variabel telah diverifikasi sesuai persis dengan kode implementasi:
     - `VITE_SUPABASE_URL`: Terkonfigurasi dengan domain endpoint Supabase resmi.
     - `VITE_SUPABASE_ANON_KEY`: Terkonfigurasi dengan token JWT publishable/anon.
     - `VITE_ENABLE_DEMO_MODE`: Terpasang `true` untuk menjaga isolasi antarmuka pengujian.
2. **Penyembunyian Nilai Kredensial (Sanitasi & Masking):**
   - **URL Proyek (Masked):** `https://qjiwxtvhzeitjtznhkdc.supabase.co` (Ref ID: `qjiwxtvhzeitjtznhkdc`)
   - **Anon/Publishable Key (Masked):** `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...z0-c1Y` *(Nilai lengkap tidak dicetak dalam log, commit, dokumentasi, maupun source code).*
3. **Pemeriksaan File Git Tracked:**
   - File `.gitignore` diverifikasi memuat aturan pengabaian eksplisit untuk `.env`, `.env.local`, `.env.development.local`, dan `*.local`.
   - File template [`.env.example`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/.env.example) hanya berisi nama variabel dan string placeholder aman tanpa nilai rahasia.
   - Tidak ada token JWT, kata sandi, atau `service_role` key yang masuk ke file yang dilacak Git.

---

## 2. Hasil Pengujian Konektivitas Layanan Supabase (Non-Destruktif)

Pengujian dilakukan menggunakan probe HTTP non-destruktif dari lingkungan lokal:

| Layanan Supabase | Endpoint yang Diuji | Status HTTP | Respons Aktual & Keterangan | Status Verifikasi |
|---|---|:---:|---|:---:|
| **HTTPS Gateway / Ping** | `https://qjiw***.supabase.co` | **200 OK** | Domain cloud Supabase aktif, handshake SSL/TLS valid. | **PASS** |
| **Auth API (GoTrue)** | `/auth/v1/health` | **200 OK** | Service Auth berjalan aktif (`version: v2.197.0`, nama: `GoTrue`). | **PASS** |
| **Auth Settings** | `/auth/v1/settings` | **200 OK** | Konfigurasi otentikasi aktif, penyedia eksternal terbaca normal. | **PASS** |
| **PostgREST API (Root)** | `/rest/v1/` | **401 Unauthorized** | PostgREST menolak akses katalog skema root untuk `anon` key (sesuai ekspektasi keamanan Supabase). | **PASS** *(Expected Behavior)* |
| **PostgREST API (Tables)** | `/rest/v1/villages?select=*` | **404 Not Found** | Kode `PGRST205`: *"Could not find the table 'public.villages' in the schema cache"*. | **PASS** *(Tabel belum ada)* |
| **PostgREST API (Users)** | `/rest/v1/users?select=*` | **404 Not Found** | Kode `PGRST205`: *"Could not find the table 'public.users' in the schema cache"*. | **PASS** *(Tabel belum ada)* |
| **PostgREST API (Settings)** | `/rest/v1/system_settings?select=*` | **404 Not Found** | Kode `PGRST205`: *"Could not find the table 'public.system_settings' in the schema cache"*. | **PASS** *(Tabel belum ada)* |
| **PostgREST API (Attendance)**| `/rest/v1/attendance_records?select=*` | **404 Not Found** | Kode `PGRST205`: *"Could not find the table 'public.attendance_records' in the schema cache"*. | **PASS** *(Tabel belum ada)* |
| **Storage API** | `/storage/v1/bucket` | **200 OK** | Mengembalikan `[]` (Array kosong). Belum ada private storage bucket yang dibuat. | **PASS** |

---

## 3. Hak Akses Kredensial & Batasan Keamanan

1. **Karakteristik Anon / Publishable Key:**
   - Kredensial yang diberikan merupakan token JWT dengan klaim `role: "anon"`.
   - Anon key **TIDAK MEMILIKI** hak administratif database (DDL privileges).
   - Anon key tidak dapat menjalankan `CREATE TABLE`, `ALTER TABLE`, membuat extension, atau mengubah konfigurasi database.
2. **Ketiadaan Kredensial Administratif:**
   - Tidak ada `service_role` key atau password PostgreSQL database yang diminta, disimpan, maupun digunakan pada tugas ini.
   - Sesuai prinsip *least privilege*, seluruh pemeriksaan dijalankan hanya menggunakan hak akses publik/anonim yang sah.

---

## 4. Status Migrasi Skema Live (Status Aktual)

- **Temuan Objektif:**
  Panggilan API PostgREST ke seluruh tabel master maupun tabel transaksi mengembalikan galat `PGRST205 (Could not find the table in schema cache)`.
- **Kesimpulan Status Migrasi:**
  Database Supabase live pada proyek ini berstatus **BERSIH / KOSONG (FRESH DATABASE)**. Skrip migrasi `001_initial_schema.sql`, `002_row_level_security.sql`, `003_seed_data.sql`, maupun `004_early_leave_attributes.sql` **BELUM DITERAPKAN** ke database Supabase live tersebut.
- **Konfirmasi Larangan:**
  Tidak ada migrasi SQL yang dijalankan, tidak ada skema yang diubah, dan tidak ada data fiktif yang disuntikkan ke proyek cloud Supabase dalam tugas ini.

---

## 5. Penegakan Geofence & Koordinat Belum Dikonfirmasi

1. **Tingkat Database (Skema Siap Pakai):**
   - File migrasi [`20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql) telah dipersenjatai fungsi dan trigger `enforce_attendance_geofence_safety()`.
   - Begitu migrasi diterapkan, database secara mutlak menolak transaksi presensi reguler (`REGULAR`) jika `OFFICE_COORDINATES_CONFIRMED` pada `system_settings` bernilai selain `'true'`.
2. **Tingkat Service & Antarmuka:**
   - Logika service layer [`attendanceService.checkIn()`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/services/attendanceService.ts) dan antarmuka presensi tetap memblokir presensi kantor reguler jika dijalankan pada mode non-demo dengan status lokasi yang belum terkonfirmasi (`OFFICE_LOCATION_UNCONFIRMED`).
   - Koordinat placeholder `-6.4828, 106.8436` tidak diaktifkan sebagai lokasi operasional.

---

## 6. Pemeriksaan yang Belum Dapat Dilakukan (Pending / Blocked)

Karena skema migrasi database belum diterapkan di Supabase live:
1. **Kueri Data Tabel Live:** Belum dapat menguji `SELECT/INSERT/UPDATE` pada tabel live karena tabel belum dibuat di PostgreSQL Supabase.
2. **Verifikasi RLS Live di Cloud:** Pengujian RLS live melalui PostgREST membutuhkan tabel dan policy yang sudah terpasang di database.
3. **Login Kriptografis Supabase Auth:** Pendaftaran/login user aparatur melalui Supabase Auth membutuhkan tabel profil `users` di schema `public` untuk sinkronisasi identitas aparatur.
4. **Unggah Berkas Selfie Evidence:** Bucket private `evidence` belum dibuat di Supabase Storage.

---

## 7. Rekomendasi & Langkah Selanjutnya

1. **Konfirmasi Pra-Migrasi:**
   - Konfigurasi environment dan konektivitas jaringan ke Supabase telah terbukti valid dan siap digunakan.
2. **Penerapan Migrasi Live (Memerlukan Tindakan / Persetujuan Pengguna):**
   - Karena Anon Key tidak memiliki wewenang eksekusi DDL, 4 file migrasi SQL KADESA yang telah diaudit perlu diterapkan ke proyek Supabase melalui **Supabase Dashboard -> SQL Editor**:
     1. [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql)
     2. [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql)
     3. [`supabase/migrations/20261009000003_seed_data.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000003_seed_data.sql)
     4. [`supabase/migrations/20261009000004_early_leave_attributes.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000004_early_leave_attributes.sql)
3. **Verifikasi Pasca-Penerapan:**
   - Setelah pengguna mengeksekusi file SQL tersebut di Supabase SQL Editor, verifikasi live PostgREST dan live authentication dapat segera dijalankan.
