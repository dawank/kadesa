# Laporan Verifikasi PostgreSQL Runtime Gate & Audit Keamanan — KADESA

**Tanggal Verifikasi:** 09 Oktober 2026  
**Auditor / AI Coding Engineer:** Antigravity AI Pair Programmer  
**Lingkungan Eksekusi:** Local Development Host (Windows 11)  
**Status Runtime Engine:** **PostgreSQL Engine / Docker Unavailable Locally**  
**Fase Proyek:**
- Planning: **CLOSED** (Baseline PRD Terkunci)
- Frontend: **LULUS BERSYARAT** (Acuan Integrasi Terkunci)
- Backend Tahap 1: **RUNTIME VERIFICATION GATE AUDITED & CLASSIFIED**
- Integration: **PENDING**
- Deployment: **PENDING**

---

## 1. Ringkasan Eksekutif & Status Ketersediaan Lingkungan Runtime

Berdasarkan mandat pemeriksaan runtime independen pada gerbang pra-live (*PostgreSQL Runtime Verification Gate*):

1. **Pemeriksaan Ketersediaan Engine Database Lokal:**
   - Pemeriksaan biner sistem host (`where.exe psql`, `where.exe postgres`, `where.exe docker`, `Get-Service *postgres*`) mengonfirmasi bahwa **tidak ada engine PostgreSQL lokal maupun container engine Docker** yang terpasang dan berjalan pada mesin kerja pengembang saat ini.
   - Sesuai larangan ketat proyek (*"Jangan memasang layanan baru, membuka akses jaringan, atau menggunakan database bersama tanpa izin eksplisit"*), agen tidak memasang paket database baru secara sepihak.
2. **Prinsip Kejujuran Audit:**
   - Seluruh kriteria yang menuntut eksekusi mesin database nyata diklasifikasikan secara jujur dan transparan sebagai:
     `NOT VERIFIED — PostgreSQL runtime environment unavailable`.
   - Tidak ada pemeriksaan statis SQL atau unit test JavaScript/TypeScript mock yang diklaim sebagai bukti eksekusi runtime PostgreSQL.

---

## 2. Taksonomi Status Verifikasi

Laporan ini membedakan secara tegas 6 klasifikasi status verifikasi:
1. `PASS — VERIFIED AT RUNTIME`: Teruji dan terverifikasi secara empiris pada runtime database PostgreSQL yang sebenarnya.
2. `PASS — STATIC REVIEW ONLY`: Lulus audit inspeksi kode statis (DDL, PL/pgSQL, syntax, policy, constraint).
3. `PASS — APPLICATION UNIT TEST ONLY`: Lulus pengujian otomatis logika aplikasi pada framework Vitest / NodeJS mock.
4. `FAIL`: Diuji dan menghasilkan kegagalan fungsi atau pelanggaran keamanan.
5. `NOT VERIFIED`: Tidak dapat dibuktikan karena prasyarat lingkungan tidak tersedia.
6. `BLOCKED`: Terhalang oleh kebijakan keamanan, ketiadaan izin eksplisit, atau ketergantungan eksternal.

---

## 3. Audit Berkas Migrasi Aktual (Static Code Inspection)

Pemeriksaan baris demi baris pada berkas SQL aktual di `supabase/migrations/`:

### A. Migrasi 001: `20261009000001_initial_schema.sql` (`PASS — STATIC REVIEW ONLY`)
- **Tabel Relasional (14 Tabel):**
  1. `villages`: Profil desa & pusat radius (CHECK `radius_meters BETWEEN 20 AND 500`).
  2. `positions`: Master jabatan (`nama UNIQUE`, `active`, `effective_from`, `effective_to`).
  3. `users`: Akun aparatur (`auth_user_id UUID NULL`, `nik CHECK LENGTH=16`, `role user_role_enum`, FK ke `positions`).
  4. `system_settings`: Pengaturan sistem terpusat (`key`, `value`, `effective_from`, `status`).
  5. `work_schedules`: Jadwal mingguan (`day_of_week BETWEEN 1 AND 7`, `tolerance_minutes >= 0`).
  6. `holidays`: Kalender libur nasional & lokal (`date UNIQUE`).
  7. `attendance_records`: Transaksi presensi harian (`UNIQUE(user_id, attendance_date)`, status `attendance_status_enum`, kolom atribut `is_early_leave`, `early_leave_reason`, `early_leave_minutes CHECK >= 0`).
  8. `dl_assignments`: Surat tugas dinas luar (`state dl_state_enum`, `CHECK end_date >= start_date`).
  9. `dl_locations`: Multi-titik lokasi tugas (`CHECK radius_meters BETWEEN 25 AND 500`, FK ON DELETE CASCADE).
  10. `dl_evidence`: Bukti selfie presensi DL (`storage_reference`, koordinat, akurasi, timestamp).
  11. `absence_requests`: Pengajuan izin/cuti (`state absence_state_enum`, `CHECK end_date >= start_date`).
  12. `attendance_corrections`: Koreksi administratif non-destruktif (`original_*` vs `corrected_*`).
  13. `audit_logs`: Rekam jejak audit keamanan (`actor_user_id`, `details JSONB`, timestamp).
  14. `notifications`: Notifikasi in-app (`recipient_user_id`, `read BOOLEAN`).
- **Tipe Enum (7 Enum):**
  - `user_role_enum`: `SUPER_ADMIN`, `OPERATOR_DESA`, `KEPALA_DESA`, `SEKRETARIS_DESA`, `PERANGKAT_DESA`.
  - `attendance_status_enum`: `HADIR`, `TERLAMBAT`, `ALPHA`, `IZIN`, `SAKIT`, `DINAS_LUAR`, `CUTI`, `LIBUR`. *(Nilai `PULANG_CEPAT` tidak ada, sesuai ADR-010).*
  - `attendance_type_enum`, `setting_category_enum`, `dl_state_enum`, `absence_type_enum`, `absence_state_enum`, `correction_state_enum`.
- **Fungsi Helper:** `update_updated_at_column()` untuk pembaruan kolom `updated_at`.

### B. Migrasi 002: `20261009000002_row_level_security.sql` (`PASS — STATIC REVIEW ONLY`)
- **Row Level Security:** Diaktifkan (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`) pada seluruh 14 tabel.
- **Fungsi Keamanan (11 Fungsi):**
  1. `get_current_user_profile()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  2. `get_current_user_role()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  3. `is_super_admin()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  4. `is_operator()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  5. `is_admin_or_operator()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  6. `is_kepala_desa()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  7. `is_sekretaris_desa()`: `SECURITY DEFINER SET search_path = public, pg_temp;`
  8. `prevent_unauthorized_user_tampering()`: Trigger function pencegah hijacking `auth_user_id`, proteksi Super Admin, dan penguncian wewenang pemberian/pencabutan `OPERATOR_DESA` khusus untuk `SUPER_ADMIN`.
  9. `enforce_attendance_geofence_safety()`: Trigger function penolakan presensi `REGULAR` jika `OFFICE_COORDINATES_CONFIRMED != 'true'`.
  10. `record_system_audit_event()`: Trusted stored procedure untuk pencatatan log audit berbasis `auth.uid()`.
  11. `reject_audit_logs_mutation()`: Trigger function WORM (Write Once, Read Many).
- **Trigger Keamanan (3 Trigger):**
  1. `trg_protect_auth_user_id` ON `users` (BEFORE INSERT OR UPDATE).
  2. `trg_enforce_attendance_geofence` ON `attendance_records` (BEFORE INSERT OR UPDATE).
  3. `trg_deny_audit_logs_mutation` ON `audit_logs` (BEFORE UPDATE OR DELETE).
- **Pembatasan Hak Akses (Privilege Hardening):**
  - `REVOKE INSERT, UPDATE, DELETE ON audit_logs FROM authenticated, anon, PUBLIC;`
  - `REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;`
  - `GRANT EXECUTE` eksplisit hanya untuk fungsi-fungsi helper yang diperlukan role `authenticated`.

### C. Migrasi 003: `20261009000003_seed_data.sql` (`PASS — STATIC REVIEW ONLY`)
- **Desa Sukamaju:** Koordinat `-6.4828, 106.8436` dilabeli data contoh simulasi.
- **System Settings:** Memuat parameter kunci baku, termasuk `OFFICE_COORDINATES_CONFIRMED = 'false'`.
- **Akun Aparatur Awal:** `password_hash = 'LOCKED_USE_SUPABASE_AUTH_BOOTSTRAP'`, `auth_user_id = NULL`. Bebas kata sandi publik plaintext.

### D. Migrasi 004: `20261009000004_early_leave_attributes.sql` (`PASS — STATIC REVIEW ONLY`)
- Penambahan kolom `is_early_leave`, `early_leave_minutes`, dan `early_leave_reason` dibungkus guard `IF NOT EXISTS (SELECT 1 FROM information_schema.columns ...)`.
- Backfill historis dibungkus `IF EXISTS (SELECT 1 FROM pg_enum ... WHERE enumlabel = 'PULANG_CEPAT')`. Idempoten dan aman saat dieksekusi ulang.

---

## 4. Evaluasi Mandat Uji & Klasifikasi Bukti

### Evaluasi Bagian B — Uji Migrasi di PostgreSQL Terisolasi

| No | Skenario Pengujian Database | Status Verifikasi | Keterangan & Batasan |
|---|---|:---:|---|
| B.1 | Eksekusi urutan migrasi 001–004 pada database kosong | **NOT VERIFIED** | `PostgreSQL runtime environment unavailable`. Tidak ada engine database terpasang di host lokal. |
| B.2 | Pencatatan exit code dan versi PostgreSQL runtime | **NOT VERIFIED** | `PostgreSQL runtime environment unavailable`. |
| B.3 | Verifikasi katalog objek (pg_tables, pg_type, pg_trigger) di engine database | **NOT VERIFIED** | `PostgreSQL runtime environment unavailable`. |
| B.4 | Pengujian idempotensi eksekusi ulang migrasi pada database nyata | **NOT VERIFIED** | `PostgreSQL runtime environment unavailable`. |

*Catatan:* Pada tingkat abstraksi logika aplikasi, seluruh DDL di atas lulus uji verifikasi berkas pada [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts) (`PASS — APPLICATION UNIT TEST ONLY`).

---

### Evaluasi Bagian C — Uji Keamanan Geofence

| No | Aspek Keamanan Geofence | Status Verifikasi | Analisis Arsitektural & Bukti |
|---|---|:---:|---|
| C.1 | Penolakan INSERT presensi REGULAR saat koordinat unconfirmed di DB | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)*<br>**PASS** *(Unit Test)* | - Runtime DB: `PostgreSQL runtime environment unavailable`.<br>- Static Review: Trigger `enforce_attendance_geofence_safety()` melempar exception saat `OFFICE_COORDINATES_CONFIRMED != 'true'`.<br>- Unit Test: Teruji di `attendance.test.ts`. |
| C.2 | Penolakan UPDATE presensi saat koordinat unconfirmed | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)* | Trigger terpasang pada `BEFORE INSERT OR UPDATE ON attendance_records`. |
| C.3 | Batasan Validasi Trigger vs Jarak GPS Sebenarnya | **PERINGATAN ARSITEKTUR TERCATAT** | **Catatan Kritis:** Trigger database HANYA memeriksa flag `OFFICE_COORDINATES_CONFIRMED`. Trigger database **TIDAK MENGHITUNG** jarak Haversine/GPS. Perhitungan jarak geofence (radius) saat ini dilakukan pada layer service TypeScript (`attendanceService.validateGeofence`). |
| C.4 | Pengecualian Presensi Dinas Luar (DINAS_LUAR) dari Geofence Kantor | **PASS — STATIC REVIEW ONLY**<br>**PASS — APPLICATION UNIT TEST ONLY** | Trigger mengecualikan `NEW.type = 'DINAS_LUAR'`. Presensi DL tetap mewajibkan bukti tugas (`dl_assignments`), lokasi penugasan (`dl_locations`), dan foto selfie (`dl_evidence`). |

---

### Evaluasi Bagian D — Uji Bootstrap, Role, dan Privilege

| No | Skenario Otorisasi & Hak Akses | Status Verifikasi | Analisis Keamanan & Bukti |
|---|---|:---:|---|
| D.1 | Request tanpa autentikasi memodifikasi data dilindungi | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)* | Trigger `prevent_unauthorized_user_tampering()` menolak jika `auth.uid() IS NULL` pada konteks API client (`authenticated`/`anon`). Seluruh tabel dilindungi RLS. |
| D.2 | `PERANGKAT_DESA` dilarang memberi/mencabut role `OPERATOR_DESA` | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)*<br>**PASS** *(Unit Test)* | Dilarang oleh RLS `users_update_policy`, trigger anti-tampering, dan `masterService.updateApparatus` (`operator_assignment.test.ts`). |
| D.3 | `OPERATOR_DESA` dilarang mengangkat diri sendiri atau orang lain jadi Operator | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)*<br>**PASS** *(Unit Test)* | Ditegakkan pada trigger: `IF (NEW.role = 'OPERATOR_DESA' OR OLD.role = 'OPERATOR_DESA') AND NEW.role IS DISTINCT FROM OLD.role THEN RAISE EXCEPTION ...`. |
| D.4 | Hanya `SUPER_ADMIN` yang dapat memberi/mencabut `OPERATOR_DESA` | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)*<br>**PASS** *(Unit Test)* | Terverifikasi di `operator_assignment.test.ts` dan klausul trigger. |
| D.5 | Operator dilarang mengubah/menonaktifkan akun `SUPER_ADMIN` | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)*<br>**PASS** *(Unit Test)* | Trigger melempar exception: `Akun Super Admin dilindungi sistem dan tidak dapat diubah oleh peran lain`. |
| D.6 | Pengguna biasa dilarang memanipulasi `auth_user_id` | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)* | Trigger melempar exception jika `NEW.auth_user_id IS DISTINCT FROM OLD.auth_user_id` dan pemanggil bukan Super Admin. |
| D.7 | Pemisahan Identitas: DB role vs JWT role vs `auth.uid()` vs `users.role` | **TERVERIFIKASI SECARA ARSITEKTUR** | 1. **PostgreSQL Role:** `postgres` / `service_role` (internal) vs `anon` / `authenticated` (PostgREST gateway).<br>2. **JWT Auth UID:** `auth.uid()` mewakili UUID akun Supabase Auth.<br>3. **Application Role:** `users.role` (`SUPER_ADMIN`, `OPERATOR_DESA`, dll) tersimpan di tabel domain `public.users` dan dibaca via `get_current_user_role()`. |
| D.8 | Least Privilege & Keamanan `SECURITY DEFINER` | **PASS — STATIC REVIEW ONLY** | Seluruh 11 fungsi database dilengkapi `SET search_path = public, pg_temp;`. Hak `EXECUTE` publik dicabut dari skema `public`. |

---

### Evaluasi Bagian E — Uji Konsistensi Migrasi dan Audit Trail

| No | Aspek Konsistensi & Audit | Status Verifikasi | Analisis & Bukti |
|---|---|:---:|---|
| E.1 | Migrasi 004 pada Fresh DB vs Existing DB | **PASS — STATIC REVIEW ONLY** | - Fresh DB: Kolom sudah ada dari 001, guard `IF NOT EXISTS` melewati penambahan tanpa error. Nilai enum `PULANG_CEPAT` tidak ada, sehingga 0 baris diubah.<br>- Existing DB: Jika nilai `PULANG_CEPAT` ada di `pg_enum`, baris diubah ke `HADIR` dengan flag `is_early_leave = TRUE`. |
| E.2 | Idempotensi Backfill Historis | **PASS — STATIC REVIEW ONLY** | Kondisi `WHERE status::text = 'PULANG_CEPAT'` hanya cocok satu kali. Eksekusi ulang memproses 0 baris, menjaga immutabilitas data yang sudah dikonversi. |
| E.3 | Pencatatan Audit Trail untuk Settings & Desa | **PASS — APPLICATION UNIT TEST ONLY** | Teruji di `settings.test.ts` (mencatat `SETTINGS_CHANGED`) dan `masterService.ts` (mencatat `MASTER_UPDATED`). |
| E.4 | Penegakan Append-Only Audit Log di Level Database | **NOT VERIFIED** *(Runtime)*<br>**PASS** *(Static Review)* | Hak `INSERT, UPDATE, DELETE` dicabut dari client. Trigger `trg_deny_audit_logs_mutation` menolak mutasi. Penulisan audit hanya dapat dilakukan via RPC `record_system_audit_event()`. |

---

## 5. Ringkasan Hasil Pengujian Otomatis Aplikasi (Unit & Integration Tests)

Perintah pengujian dijalankan nyata pada command line:

1. **TypeScript Typecheck:**
   ```bash
   npm run typecheck
   ```
   - **Hasil:** **PASSED** (Exit Code `0`, 0 error).
2. **Kompilasi Bundler Produksi:**
   ```bash
   npm run build
   ```
   - **Hasil:** **PASSED** (Exit Code `0`, 1982 modul terkompilasi dalam 6.77s).
3. **Automated Test Suite (Vitest):**
   ```bash
   npm test -- --run
   ```
   - **Hasil:** **12/12 Test Files PASSED (100%), 58/58 Tests PASSED (100%), 0 Failed**.

---

## 6. Temuan Kritis Arsitektural & Rekomendasi Mitigasi

### Temuan Arsitektural: Validasi Jarak Geofence Belum di Level PostgreSQL
- **Kondisi:** Trigger PostgreSQL `trg_enforce_attendance_geofence` saat ini memeriksa apakah koordinat kantor desa telah diverifikasi (`OFFICE_COORDINATES_CONFIRMED = 'true'`). Namun, kalkulasi jarak fisik (rumus Haversine dalam radius meter terhadap lokasi kantor desa) saat ini dieksekusi di service layer frontend/TypeScript (`attendanceService.validateGeofence`).
- **Dampak Keamanan:** Jika koordinat kantor desa nantinya telah dikonfirmasi (`true`), seorang penyerang yang memanggil PostgREST API langsung dengan koordinat GPS sembarang di luar desa masih dapat lolos jika tidak ada fungsi kalkulasi jarak PostGIS / Haversine di tingkat trigger database.
- **Rekomendasi Tahap Integration:** Pada fase integrasi backend mendatang, tambahkan fungsi kalkulasi jarak Haversine di level PostgreSQL (atau menggunakan ekstensi PostGIS) pada trigger `attendance_records` untuk memvalidasi bahwa `check_in_latitude` & `check_in_longitude` benar-benar berada dalam `radius_meters` kantor desa.

---

## 7. Status Konfirmasi Larangan & Batasan Mutlak

1. **Migrasi Supabase Live:** **TIDAK DIJALANKAN.**
2. **Koneksi Database Produksi:** **TIDAK TERHUBUNG.**
3. **Akun Pengguna Live:** **TIDAK DIBUAT / TIDAK DIUBAH.**
4. **Geofence Operasional:** **TIDAK DIAKTIFKAN.** Koordinat `-6.4828, 106.8436` tetap berstatus data simulasi.
5. **Kredensial Istimewa:** Tidak ada `service_role` key atau password DB yang digunakan.

---

## 8. Rekomendasi Akhir

Gate verifikasi runtime PostgreSQL diklasifikasikan sebagai:
**STATIC AUDIT & LOGICAL UNIT TESTS PASSED (100%) — DATABASE RUNTIME NOT VERIFIED (HOST RUNTIME UNAVAILABLE).**

Proyek berada dalam posisi aman dan terkunci. **Tidak ada migrasi live yang boleh dijalankan sebelum peninjauan laporan ini selesai dan izin eksplisit diberikan oleh pengguna.**
