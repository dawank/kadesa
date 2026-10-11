# Laporan Implementasi Backend Tahap 1: Fondasi Database, Autentikasi, Otorisasi, Supabase, dan Keamanan — KADESA

**Tanggal:** 09 Oktober 2026  
**Status Fase Workflow:**
- Planning: **CLOSED** (Baseline Resmi Terkunci)
- Frontend: **LULUS BERSYARAT** (Tetap Utuh & Menjadi Acuan Integrasi)
- Backend: **IN PROGRESS** (Tahap 1 Selesai; Integrasi Live Menunggu Kredensial Supabase)
- Integration: **PENDING**
- Deployment: **PENDING**

---

## 1. Ringkasan Eksekutif & Tujuan Pekerjaan

Tahap Backend Tahap 1 berfokus pada pembangunan fondasi database, otorisasi peran (RBAC), Row Level Security (RLS), integrasi client Supabase, dan tata kelola keamanan kredensial. Tujuannya adalah menjadikan backend dan database PostgreSQL sebagai **Single Source of Truth** bagi autentikasi, hak akses, data operasional desa, dan validasi aturan bisnis KADESA (model 1 Desa = 1 Proyek Supabase).

Frontend yang sudah berstatus Lulus Bersyarat dijaga integritasnya tanpa perubahan aturan bisnis yang merusak. Arsitektur service layer telah disiapkan dengan adapter dan fallback yang aman.

---

## 2. Struktur Skema Database Relasional (14 Tabel)

File migrasi DDL awal: [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql)

Seluruh 14 tabel dirancang mengikuti PRD Bagian 30 dengan tipe data terstandarisasi, constraint integritas referensial, check constraint, trigger otomatis `updated_at`, dan indeks pencarian:

1. **`villages`**: Master data desa (1 desa per deployment: Sukamaju), koordinat kantor (`latitude`, `longitude`, `radius_meters`), alamat, telepon, dan referensi logo.
2. **`positions`**: Master data jabatan organisasi desa (Kepala Desa, Sekretaris Desa, Kaur, Kasi, Kadus) dengan flag `is_active`.
3. **`users`**: Akun pengguna & profil aparatur desa. Terhubung ke `auth.users(id)` via `auth_user_id`. Menyimpan role (`SUPER_ADMIN`, `OPERATOR`, `KEPALA_DESA`, `SEKRETARIS_DESA`, `PERANGKAT_DESA`), referensi `position_id`, NIK unik (16 digit), NIPD nullable, status aktif, dan foto profil.
4. **`system_settings`**: Konfigurasi parameter bisnis terpusat dengan masa berlaku (`effective_from`, `effective_to`), key unik, value JSONB, tipe data, dan audit pencatat.
5. **`work_schedules`**: Jam kerja dinamis per hari (Senin–Jumat/Sabtu), jam masuk, jam pulang, toleransi keterlambatan, dan jam mulai/selesai istirahat.
6. **`holidays`**: Kalender hari libur nasional dan cuti bersama resmi (tahun 2026).
7. **`attendance_records`**: Transaksi presensi harian aparatur. Mencatat `check_in_time`, `check_out_time`, koordinat, status (`HADIR`, `TERLAMBAT`, `PULANG_CEPAT`, `LIBUR`, `ALPHA`), flag `is_corrected`, dan histori koreksi.
8. **`dl_assignments`**: Surat tugas Dinas Luar (DL) dengan state machine ketat (`PENDING`, `VERIFIED`, `APPROVED`, `RATIFIED`, `REJECTED`, `CANCELLED`, `RATIFICATION_OVERDUE`), batas ratifikasi 72 jam, dan riwayat persetujuan JSONB.
9. **`dl_locations`**: Multi-titik lokasi penugasan dinas luar dengan koordinat dan radius geofence masing-masing.
10. **`dl_evidence`**: Bukti kehadiran dinas luar dengan foto selfie wajib, koordinat GPS, akurasi, dan waktu server.
11. **`absence_requests`**: Pengajuan izin, sakit, dan cuti dengan alur bertahap (`SUBMITTED` -> `VERIFIED` -> `APPROVED`), bukti dokumen, dan tanggal mulai/selesai.
12. **`attendance_corrections`**: Catatan koreksi administratif presensi secara non-destruktif, menjaga rekaman awal (`original_check_in`, `original_check_out`, `original_status`).
13. **`audit_logs`**: Log audit peristiwa penting (login, perubahan role, reset password, persetujuan DL/cuti, koreksi presensi). Dirancang dengan prinsip **WORM (Write Once, Read Many)**: operasi `UPDATE` dan `DELETE` dilarang.
14. **`notifications`**: Notifikasi operasional aparatur desa (status approval, batas ratifikasi, jadwal piket).

---

## 3. Row Level Security (RLS) & Penegakan Hak Akses

File migrasi RLS: [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql)

RLS diaktifkan pada **seluruh 14 tabel** (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`).

### Aturan & Kebijakan Keamanan yang Ditegakkan:
1. **Helper Functions PostgreSQL:**
   - `get_current_user_role()`: Mengambil role akun pengguna saat ini dari tabel `public.users` berdasarkan `auth.uid()`.
   - `is_super_admin()`, `is_operator()`, `is_pimpinan()`: Mengevaluasi privilege eksekusi di tingkat SQL.
2. **Pemisahan Role vs Jabatan:**
   - Kebijakan SQL memastikan perubahan kolom `position_id` tidak mengubah `role`, dan perubahan `role` tidak mengubah `position_id`.
3. **Pembatasan Ketat Operator Desa (PRD Section 4 & 6):**
   - **Larangan Mengubah Role Sendiri:** Trigger PostgreSQL `prevent_operator_self_role_escalation()` melempar exception jika Operator mencoba memodifikasi role pada baris akunnya sendiri (`OLD.auth_user_id = auth.uid()`).
   - **Larangan Memberikan Role Operator / Super Admin:** Operator dilarang memberikan role `OPERATOR` atau `SUPER_ADMIN` kepada pengguna lain.
   - **Larangan Membuat Akun Operator / Super Admin:** Operator dilarang menginsert akun baru dengan role `OPERATOR` atau `SUPER_ADMIN`.
   - **Perlindungan Akun Super Admin:** Operator dilarang mengedit, mengubah, atau menonaktifkan akun `SUPER_ADMIN`.
4. **Proteksi Audit Log (Immutability):**
   - Policy RLS hanya mengizinkan `SELECT` dan `INSERT`. Operasi `UPDATE` dan `DELETE` tidak memiliki policy dan trigger database menolak mutasi secara mutlak (`BEFORE UPDATE OR DELETE -> EXCEPTION`).
5. **Proteksi Presensi & Dokumen Sensitif:**
   - Pengguna reguler (`PERANGKAT_DESA`) hanya dapat membaca riwayat presensi miliknya sendiri (`user_id = public.users.id`). Pimpinan dan Operator dapat membaca rekapitulasi seluruh aparatur desa.

---

## 4. Baseline Seed Data

File migrasi Seed: [`supabase/migrations/20261009000003_seed_data.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000003_seed_data.sql)

Menyediakan data awal desa:
- Profil Desa Sukamaju dengan koordinat kantor (`-6.2088`, `106.8456`) dan radius 100 meter.
- 5 Jabatan resmi desa (Kepala Desa, Sekretaris Desa, Kaur Keuangan, Kaur TU & Umum, Kasi Pemerintahan).
- 5 Akun pengguna contoh dengan password hash bcrypt standar.
- Pengaturan sistem hardcoded (jam kerja `08:00` - `15:30`, toleransi keterlambatan 15 menit, batas ratifikasi DL 72 jam, retensi selfie 2 tahun, timezone `Asia/Jakarta`).
- Jadwal kerja hari kerja Senin–Jumat.
- Kalender libur nasional 2026.

---

## 5. Abstraksi Supabase Client & Keamanan Kredensial

File client: [`src/services/supabaseClient.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/services/supabaseClient.ts)

- **Singleton Pattern:** Menggunakan `@supabase/supabase-js` v2 dengan manajemen sesi persisten di `localStorage`.
- **Deteksi Konfigurasi:** Fungsi `isSupabaseConfigured()` memeriksa keberadaan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY`. Jika variabel belum diisi atau masih menggunakan default template, client tidak akan melempar crash fatal, melainkan bertransisi secara graceful ke fallback terisolir.
- **Pembersihan Rahasia Kredensial:**
  - File `.gitignore` memastikan `.env`, `.env.local`, dan file credentials tidak pernah terlacak Git.
  - File template [`.env.example`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/.env.example) hanya mencantumkan nama variabel publik (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_ENABLE_DEMO_MODE`) tanpa nilai rahasia.
  - Tidak ada `service_role` key, database password, atau JWT token rahasia yang disimpan atau disematkan di dalam source code frontend.

---

## 6. Hasil Pengujian Aktual (Test Matrix)

Seluruh pengujian dijalankan ulang secara nyata di terminal:

| No | Modul Pengujian | Status | Catatan Hasil Aktual |
|---|---|---|---|
| 1 | **DDL Migrations Integrity** | **PASS** | 14 tabel database lengkap, foreign keys, triggers, constraints diverifikasi |
| 2 | **Row Level Security (RLS)** | **PASS** | RLS aktif di seluruh 14 tabel, fungsi RBAC & helper functions terpasang |
| 3 | **Credential Isolation** | **PASS** | Bebas dari `service_role` key atau secret token dalam build/template |
| 4 | **Unconfigured Graceful Fallback** | **PASS** | `supabaseClient` tidak crash saat environment kosong |
| 5 | **Operator Desa RBAC Guards** | **PASS** | Larangan ubah role sendiri, larangan buat/beri Operator/Super Admin, proteksi Super Admin lulus (8/8 tests) |
| 6 | **Password Management & Reset** | **PASS** | Pembuatan password awal min 6 char, reset password oleh Admin, larangan reset Super Admin lulus (6/6 tests) |
| 7 | **Absence & Attendance Correction** | **PASS** | Multi-stage leave approval & koreksi presensi non-destruktif lulus (2/2 tests) |
| 8 | **Attendance & Geofence Logic** | **PASS** | Tolak check-in luar radius, tolak check-in ganda/setelah checkout lulus (5/5 tests) |
| 9 | **Dinas Luar (DL) State Machine** | **PASS** | Alur PENDING->APPROVED->RATIFIED, wajib selfie, tolak tanpa alasan lulus (4/4 tests) |
| 10 | **Reports & Audit Aggregations** | **PASS** | Label LIBUR vs ALPHA, tidak fabrikasi checkout, rekap bulanan aparatur lulus (6/6 tests) |
| 11 | **Branding, Logo & Letterhead** | **PASS** | Overwrite logo desa, overwrite foto login background, kop surat dinamis lulus (5/5 tests) |
| 12 | **TypeScript Typecheck** | **PASS** | `npm run typecheck` → 0 error (TypeScript 5.8) |
| 13 | **Production Bundle Build** | **PASS** | `npm run build` → sukses, ukuran bundle terverifikasi |

**Total Skor Pengujian Otomatis:** **12 File Test, 53 Test Cases LULUS 100% (0 Failed)**.

---

## 7. Status Fitur & Ketergantungan Terblokir (BLOCKED / NOT VERIFIED)

Sesuai instruksi Bagian 3 & Bagian 13:

| Komponen | Status | Alasan & Ketergantungan |
|---|---|---|
| **Live Database Network Calls** | `BLOCKED` | Memerlukan `VITE_SUPABASE_URL` dan `VITE_SUPABASE_ANON_KEY` dari pengguna |
| **Live Supabase Auth Cryptographic Session** | `BLOCKED` | Pengujian login langsung ke jaringan Supabase menunggu URL & anon key |
| **Email Pengiriman Reset Password (SMTP)** | `NOT VERIFIED` | Memerlukan penyedia SMTP aktif pada dashboard Supabase Auth |
| **Supabase Storage Bucket Evidence (Selfie)** | `BLOCKED` | Bucket privat `attendance-evidence` akan dibuat setelah proyek live terhubung |

---

## 8. Permintaan Konfigurasi Supabase Kepada Pengguna

Sesuai SOP Bagian 3, pengujian fondasi offline telah selesai dan sukses. Untuk menghubungkan aplikasi ke backend Supabase langsung dan menjalankan verifikasi database live, kami membutuhkan konfigurasi berikut:

1. **`VITE_SUPABASE_URL`**: URL proyek Supabase Anda (contoh: `https://abcdefghijkl.supabase.co`).
2. **`VITE_SUPABASE_ANON_KEY`**: Kunci API publik/anonim (publishable key) dari proyek Supabase Anda.

> **Cara Memperoleh Nilai Tersebut di Supabase Dashboard:**
> 1. Masuk ke dashboard proyek Anda di [https://supabase.com/dashboard](https://supabase.com/dashboard).
> 2. Buka menu **Project Settings** (ikon gerigi di bilah kiri bawah).
> 3. Klik sub-menu **API**.
> 4. Pada bagian **Project URL**, salin URL yang tertera.
> 5. Pada bagian **Project API keys**, salin kunci berlabel **`anon` `public`**.
> *(Catatan Keamanan: **JANGAN** menyalin `service_role` key).*
>
> **Langkah Pengisian Aman:**
> Anda dapat memberikan nilai tersebut melalui chat ini, atau membuatnya sendiri di file `.env` di root direktori proyek (`d:/DAWANK/APLIKASI_TEST/KADESA/.env`).

---

## 9. Rekomendasi Langkah Selanjutnya

1. Menunggu respons pengguna terkait konfigurasi Supabase Project URL dan Anon Key.
2. Setelah konfigurasi diberikan:
   - Terapkan file migrasi `20261009000001_initial_schema.sql`, `20261009000002_row_level_security.sql`, dan `20261009000003_seed_data.sql` ke database live Supabase.
   - Uji koneksi live database, login auth, dan RLS live query.
   - Lanjutkan ke implementasi backend tahap berikutnya (modul presensi, dinas luar, koreksi, dan storage bucket).
