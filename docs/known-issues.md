# Known Issues & Keterbatasan — KADESA Frontend

Dokumen ini mencatat batasan teknis frontend, asumsi, dan kontrol keamanan yang secara arsitektural membutuhkan tahap **Backend & Integration** untuk benar-benar aman.

---

## 1. Batasan Arsitektural & Keamanan (Membutuhkan Backend)

### 1.1 Otorisasi & Hak Akses Frontend Bukan Pengganti Keamanan Backend
- **Kondisi:** Kontrol hak akses di frontend menggunakan `ProtectedRoute`, `authService.hasPermission()`, dan `Role` dalam state/localStorage.
- **Keterbatasan:** Kontrol UI di browser dapat dimodifikasi oleh pengguna tingkat lanjut melalui DevTools atau manipulasi script client. Frontend **TIDAK PERNAH** menjadi batas otorisasi aman (security boundary).
- **Kebutuhan Backend:** Backend wajib menerapkan otorisasi ketat di tingkat server: PostgreSQL Row-Level Security (RLS), validasi JWT token yang ditandatangani secara kriptografis, dan verifikasi role pada setiap pemanggilan API/RPC.

### 1.2 Geofence Browser & Deteksi Fake GPS
- **Kondisi:** Perhitungan jarak geofence di frontend menggunakan rumus Haversine berbasis koordinat `navigator.geolocation` browser/perangkat.
- **Keterbatasan:** Frontend **TIDAK DAPAT** menjamin 100% keaslian lokasi fisik pengguna atau mendeteksi Fake GPS/mock location OS secara mutlak.
- **Kebutuhan Backend:** Backend wajib memvalidasi koordinat transaksi, mencatat metadata akurasi, membandingkan IP/ISP jika tersedia, dan mencatat log anomali ke tabel audit log.

### 1.3 Penyimpanan Bukti Foto Selfie (Evidence Storage)
- **Kondisi:** Foto bukti selfie presensi Dinas Luar (DL) saat ini ditangani sebagai data URI Base64 dalam memori aplikasi/mock adapter.
- **Keterbatasan:** Foto Base64 di browser tidak disimpan dalam private encrypted bucket dan tidak memiliki signed URLs yang kedaluwarsa.
- **Kebutuhan Backend:** Pada tahap Backend & Integration, foto selfie wajib diunggah ke Private Object Storage (misal Supabase Storage / S3 private bucket) dengan presigned upload URL, hak akses terbatas untuk verifikator berwenang, dan kebijakan retensi otomatis 2 tahun sesuai regulasi arsip desa.

### 1.4 Sumber Waktu Resmi (Server Authority)
- **Kondisi:** Jam perangkat browser pengguna dapat salah atau dimanipulasi oleh pengguna lokal.
- **Mitigasi di Frontend:** `attendanceService.getServerTime()` memisahkan waktu server dari waktu tampilan jam lokal.
- **Kebutuhan Backend:** Pada tahap Backend, seluruh `checkInAt`, `checkOutAt`, dan `serverTimestamp` mutlak ditentukan oleh fungsi server `now()` / `CURRENT_TIMESTAMP` di database, bukan timestamp yang dikirimkan dari payload browser.

### 1.5 Otomasi Background Scheduler untuk DL Ratification Overdue
- **Kondisi:** Status `RATIFICATION_OVERDUE` (jika Kepala Desa belum meratifikasi dalam 72 jam) saat ini dievaluasi secara dinamis saat UI memuat data.
- **Kebutuhan Backend:** Diperlukan background worker atau database cron job (`pg_cron`) yang secara berkala memeriksa batas waktu ratifikasi dan memicu notifikasi eskalasi secara asynchronous.

### 1.6 Layanan Tile Peta & Kuota Geocoding Eksternal
- **Kondisi:** Frontend menggunakan tile publik OpenStreetMap dan Nominatim Geocoding API secara langsung di client tanpa API key.
- **Keterbatasan:** Nominatim publik membatasi query maksimal ~1 request per detik dan OpenStreetMap tile server dapat membatasi akses pada lonjakan trafik tinggi.
- **Kebutuhan Backend:** Pada tahap Backend & Production, instansi desa atau vendor disarankan menyediakan proxy tile caching atau API key berlisensi (misal Mapbox / Google Maps / self-hosted Nominatim) melalui backend gateway agar kuota dan kestabilan jaringan terjamin.

---

## 2. Keterbatasan Tahap Frontend Saat Ini

### 2.1 Persistensi Data Bersifat Mock / In-Memory
- **Kondisi:** Data transaksi tersimpan dalam memori runtime dan direset saat halaman dimuat ulang secara penuh (full refresh) ke initial mock state.
- **Solusi Mendatang:** Tahap Backend akan mengikat seluruh kontrak `ApiResponse<T>` pada endpoint RESTful dan RPC Supabase.

### 2.2 Mode Demo & Simulasi
- **Kondisi:** Fitur role switcher, fast-picker, dan simulasi tombol koordinat GPS telah diproteksi di balik `IS_DEMO_MODE`.
- **Aturan:** Pada build production non-demo (`VITE_ENABLE_DEMO_MODE=false`), seluruh elemen simulasi dinonaktifkan secara otomatis dari UI dan method service melempar exception jika dipanggil.

---

## 3. Asumsi Teknis yang Berlaku

1. **Model Deployment 1 Desa = 1 Instance:** Sesuai PRD Section 8, sistem mengasumsikan satu entitas profil desa per deployment.
2. **Timezone:** Didukung secara dinamis melalui konfigurasi terpusat `TIMEZONE` pada `settingsService` (default: `Asia/Jakarta`, dapat dikonfluorasi ke WITA/WIT).
3. **Penyimpanan NIK & NIPD:** NIK bersifat unik dan wajib bagi seluruh aparatur; NIPD bersifat opsional/nullable bagi aparatur yang belum memiliki SK definitif.

---

## 4. Status Backend Tahap 1 & Ketergantungan Terblokir (BLOCKED)

### 4.1 Komponen Terselesaikan & Hasil Audit (PASS / REMEDIATED)
- **Skema DDL Database 14 Tabel:** Migrasi SQL `supabase/migrations/20261009000001_initial_schema.sql` telah diaudit: menyelaraskan enum role ke `OPERATOR_DESA`, menambahkan state `RATIFICATION_OVERDUE`, mengeluarkan `PULANG_CEPAT` dari enum harian, dan menambahkan atribut `is_early_leave`, `early_leave_reason`, serta `early_leave_minutes` (ADR-010).
- **Kebijakan Row Level Security (RLS), Anti-Forgery & Backend Geofence Trigger:** Migrasi SQL `supabase/migrations/20261009000002_row_level_security.sql` telah diperbaiki dari kerentanan search_path, penempaan audit log, typo kolom syntax state, pembatasan ketat `auth_user_id`, penguncian hak pemberian/pencabutan `OPERATOR_DESA` khusus untuk `SUPER_ADMIN` pada INSERT & UPDATE (ADR-011), pemisahan konteks administratif database dari sesi API PostgREST, serta penambahan trigger backend `trg_enforce_attendance_geofence` yang menolak mutlak transaksi presensi kantor reguler jika koordinat belum dikonfirmasi (ADR-012).
- **Baseline Seed Data yang Bersih:** Migrasi SQL `supabase/migrations/20261009000003_seed_data.sql` telah disterilisasi dari password default publik, koordinat kantor dilabeli sebagai data contoh simulasi, dan parameter `OFFICE_COORDINATES_CONFIRMED = 'false'` (ADR-012).
- **Migrasi Rekonsiliasi Berurutan yang Idempoten:** Disediakan `supabase/migrations/20261009000004_early_leave_attributes.sql` dengan guard `IF NOT EXISTS` lengkap untuk seluruh kolom atribut pulang awal.
- **Standarisasi Role Global & Audit Trail:** Seluruh repositori telah diselaraskan ke baseline resmi `OPERATOR_DESA`. Pembaruan setting dan titik koordinat desa otomatis mencatat histori audit.
- **Supabase Client Abstraction:** Modul `src/services/supabaseClient.ts` mengisolasi inisialisasi client Supabase dengan deteksi status konfigurasi yang aman.
- **Remediasi Penegakan Keamanan Geofence di Sisi Server (PostgreSQL):** Telah dibuat `supabase/migrations/20261009000005_server_side_geofence_enforcement.sql` dan diselaraskan pada `20261009000002_row_level_security.sql`. Validasi jarak fisik presensi kantor dihitung secara otoritatif di database menggunakan fungsi PL/pgSQL `calculate_haversine_distance_meters` di dalam trigger `enforce_attendance_geofence_safety()`. Transaksi dengan koordinat di luar radius ditolak mutlak di level PostgreSQL, koordinat check-in dilindungi dari manipulasi saat check-out, batas geografis [-90..90, -180..180] ditegakkan, dan jalur DINAS_LUAR dikecualikan dengan kewajiban penugasan sah (lihat `docs/14-geofence-server-side-remediation.md`).
- **Keamanan Kredensial & Pengujian:** `.gitignore` dan `.env.example` telah diamankan dari kebocoran token rahasia (`service_role` key). Seluruh 65 pengujian otomatis lulus 100%. Laporan gate pra-live terdokumentasi di `docs/11-pre-live-migration-safety-gate.md`, `docs/14-geofence-server-side-remediation.md`, `docs/15-geofence-final-security-review.md`, `docs/16-final-privilege-trigger-audit.md`, `docs/17-approval-workflow-integrity-audit.md`, `docs/18-final-sql-verification.md`, `docs/19-targeted-sql-consistency-audit.md`, `docs/20-final-sql-source-review.md`, `docs/21-postgres-runtime-validation-plan.md`, `docs/23-backend-stage-1-final-gate.md`, dan `docs/24-staging-validation-and-live-readiness.md`.
- **Integritas Alur Persetujuan & Anti-Replay (Migrasi 006):** Dibuat `supabase/migrations/20261009000006_approval_workflow_integrity.sql` untuk mencegah: (1) pembuatan pengajuan koreksi langsung APPROVED, (2) manipulasi waktu ke nilai di luar persetujuan, (3) replay attack menggunakan persetujuan lama (`applied_at`), (4) self-approval oleh pemohon atau aparatur terkait, (5) pembuatan surat tugas DL langsung APPROVED/RATIFIED dan pembatasan wewenang ratifikasi mutlak hanya untuk Kepala Desa atau Super Admin, serta (6) remediasi penegakan geofence server-side yang menyelaraskan penolakan koordinat unconfirmed dan pembacaan titik kantor dari tabel `villages`.

### 4.2 Prasyarat Operasional Lapangan (OPERATIONAL PREREQUISITE)
- **Koordinat Resmi Kantor Desa Belum Dikonfirmasi:** Titik koordinat pusat kantor desa saat ini (`-6.4828, 106.8436`) merupakan data contoh simulasi pengujian.
- **Fail-Safe Presensi Produksi (Frontend & Database Level):** Pada mode operasional non-demo (`IS_DEMO_MODE = false`) maupun pada pemanggilan API database langsung, sistem secara otomatis menolak presensi kantor yang membutuhkan geofence (`OFFICE_LOCATION_UNCONFIRMED` / DB trigger exception) demi keamanan dan kepastian hukum, sampai koordinat resmi kantor Desa Sukamaju dikonfirmasi dan disimpan oleh Administrator (ADR-012).

### 4.3 Status Ketergantungan Supabase Live (CONNECTIVITY VERIFIED, MIGRATION PENDING)
- **Koneksi Jaringan Langsung ke Supabase (Live Database Connection):** **VERIFIED (PASS)**. Kredensial telah dikonfigurasi di `.env.local` (terisolasi dari Git), endpoint cloud aktif, dan handshake API Auth/PostgREST/Storage sukses (lihat `docs/13-supabase-connectivity-check.md`).
- **Ketiadaan Engine Database Lokal / Docker:** Host lokal tidak memiliki instalasi PostgreSQL atau Docker runtime, sehingga eksekusi DDL database lokal diklasifikasikan jujur sebagai `NOT VERIFIED — PostgreSQL runtime environment unavailable` (lihat `docs/12-postgresql-runtime-verification.md`).
- **Penegakan Jarak Geofence di Level DB Trigger:** **REMEDIATED (CODE/DDL AUDIT PASS, RUNTIME NOT VERIFIED)**. Logika kalkulasi jarak dan penolakan transaksi di luar radius kini telah tertanam di dalam fungsi trigger SQL `enforce_attendance_geofence_safety()`, bukan lagi hanya di layer TypeScript. Eksekusi runtime menunggu migrasi live dijalankan.
- **Skema Database Cloud Supabase:** Berstatus **FRESH / EMPTY**. Tabel-tabel KADESA belum dibuat di cloud (PostgREST merespons `PGRST205`). Menunggu eksekusi migrasi DDL 001–006 oleh pengguna di Supabase Dashboard SQL Editor.
- **Pengujian Login Kriptografis Supabase Auth (Live Network Call):** Berstatus `PENDING MIGRATION` (membutuhkan tabel `public.users` terpasang di database live).
- **Pengiriman Email Reset Password Sebenarnya (SMTP Provider):** Berstatus `NOT VERIFIED` karena memerlukan konfigurasi SMTP / Auth Email Provider di Supabase project dashboard.

