# LAPORAN AUDIT GAP ANALYSIS IMPLEMENTASI APLIKASI KADESA
## TERHADAP SPESIFIKASI FINAL PRD v1.3.0

- **Aplikasi**: KADESA — Sistem Kehadiran Aparatur Desa
- **Dokumen Acuan**: `docs/PRD v1.3.0.md` (Versi 1.3.0 — 10 Oktober 2026)
- **Target Target Deployment**: Responsive Web App / PWA-Ready (1 Desa = 1 Supabase Project)
- **Lingkungan Produksi**: Vercel (`https://kadesa.vercel.app`) & Supabase Remote (`qjiwxtvhzeitjtznhkdc.supabase.co`)
- **Tanggal Audit**: 10 Oktober 2026
- **Status Rilis**: **PRE-PRODUCTION / GATED** (Belum Siap Peluncuran Produksi Penuh)
- **Metode Audit**: Static Code Inspection, Remote Database Introspection (Read-Only), Verification Suite Execution (`tsc`, `vitest`, `vite build`, `fetch`)

---

## 1. EXECUTIVE SUMMARY

Audit menyeluruh telah dilaksanakan terhadap basis kode aktual aplikasi KADESA (`kadesa-frontend`) serta skema basis data PostgreSQL aktif di Supabase. Pemeriksaan ini menguji tingkat kesesuaian implementasi teknis terhadap spesifikasi produk final yang tertuang dalam **PRD v1.3.0**.

### Ringkasan Kondisi Aktual:
1. **Pondasi Frontend & Kode Aplikasi**: 
   - Aplikasi dibangun menggunakan React 19, TypeScript 5.8, Tailwind/Vanilla CSS design tokens, dan React Router 7.
   - Pengecekan statis TypeScript (`npm run typecheck`) berhasil tanpa kesalahan (**0 error**).
   - Pengujian otomatis unit & integrasi (`npm test`) melalui Vitest berhasil meluluskan seluruh **13 file pengujian dan 68 kasus uji (100% PASS)**.
   - Proses kompilasi produksi (`npm run build`) berhasil mentransformasi **2.026 modul** menjadi bundel siap saji, dan URL produksi Vercel (`https://kadesa.vercel.app`) aktif melayani permintaan HTTP 200.
2. **Kesesuaian Fitur & Database Remote**:
   - Sebagian besar prinsip arsitektural PRD v1.3.0 telah diimplementasikan dengan baik, antara lain: pemisahan prinsipil antara *Role* dan *Jabatan*, pembatasan wewenang *Operator Desa* terhadap akun *Super Admin*, pencatatan atribut *Early Leave* tanpa merusak status primer harian, trigger proteksi geofence sisi server berbasis formula Haversine, proteksi *WORM* (Write Once, Read Many) pada tabel `audit_logs`, serta pemisahan identitas visual logo aplikasi (`/logo-kadesa.png`) dan logo cetak desa (`villages.logo_desa`).
3. **Kesenjangan Kritis (Critical Gaps)**:
   - Ditemukan diskrepansi pada integrasi autentikasi: PRD v1.3.0 Section 30.2 secara tegas mewajibkan seluruh kredensial dikelola oleh **Supabase Auth** tanpa menyimpan `password_hash` lokal di database. Pada implementasi aktual, kolom `password_hash` masih ada pada tabel `public.users`, dan penambahan aparatur baru dari menu admin belum memicu pembuatan akun `auth.users` di Supabase Auth.
   - Ditemukan mekanisme darurat `kadesa_access_token` di `localStorage` dan fallback Bearer manual pada `masterService.ts` yang dibuat untuk melewati trigger otorisasi `prevent_unauthorized_user_tampering()`, yang bertentangan dengan PRD v1.3.0 Section 40.1 Item 9.
   - Storage Bucket di Supabase masih kosong (`[]`), sehingga berkas bukti foto selfie Dinas Luar belum diunggah ke *private Storage bucket* melainkan disimpan secara in-memory / Base64.
   - Stored Procedure / RPC database yang dideklarasikan pada kode frontend (`record_system_audit_event`, `verify_user_credentials`, `get_server_time`) belum terdaftar di schema cache PostgREST remote, memicu fallback diam-diam ke direct insert atau jam lokal browser.
   - Trigger database `enforce_attendance_correction_lifecycle` mewajibkan permohonan koreksi baru berstatus `PENDING`, sedangkan antarmuka dan layanan `correctionService.ts` mengirim status `APPROVED` secara langsung, menyebabkan penolakan transaksi di sisi database.

### Keputusan Arsitektur:
Aplikasi KADESA **DAPAT DIPERBAIKI MELALUI INCREMENTAL REFACTORING**. **TIDAK PERLU MELAKUKAN FULL REBUILD**. Struktur modul, komponen UI, perutean, dan tabel database inti sudah selaras dengan domain model PRD v1.3.0. Penyelarasan dapat diselesaikan melalui perbaikan bertahap pada integrasi auth, penyesuaian RPC database, aktivasi Supabase Storage, dan sinkronisasi state machine koreksi.

---

## 2. REQUIREMENT MATRIX BERDASARKAN PRD v1.3.0

Berikut adalah evaluasi kepatuhan 25 area requirement PRD v1.3.0 terhadap kode dan database aktual:

| No | Modul / Requirement PRD v1.3.0 | Status Kepatuhan | Bukti / Lokasi Kode / DB | Keterangan & Gap Analisis |
|:---|:---|:---:|:---|:---|
| 1 | **Prinsip Role vs Jabatan** (PRD 1, 4) | **COMPLIANT** | `src/types/auth.ts`, `positions`, `users` | Role (`SUPER_ADMIN`, `OPERATOR_DESA`, dll) terpisah mutlak dari `jabatan_id`. |
| 2 | **Wewenang Operator Desa** (PRD 4, 40.1) | **COMPLIANT** | `src/services/masterService.ts#L418-431`, trigger DB | Operator tidak dapat membuat/mengedit akun Operator/Super Admin dan dilarang mengubah role sendiri. |
| 3 | **Pemisahan Logo Aplikasi vs Logo Desa** (PRD 5, 30.1) | **COMPLIANT** | `src/context/BrandingContext.tsx`, `villages.logo_desa` | `/logo-kadesa.png` permanen di UI; `villages.logo_desa` khusus media cetak PDF/Kop Surat. |
| 4 | **Kredensial & Autentikasi** (PRD 2, 30.2) | **PARTIAL** | `src/services/authService.ts`, `users.password_hash` | Login via Supabase Auth aktif, namun `password_hash` lokal masih ada dan registrasi aparatur baru belum otomatis provision `auth.users`. |
| 5 | **Resiliensi Sesi Resmi** (PRD 40.1 item 9) | **NON-COMPLIANT** | `src/services/masterService.ts#L471-482`, `localStorage` | Terdapat fallback token buatan `kadesa_access_token` untuk membypass PostgREST RLS saat trigger gagal mengenali sesi. |
| 6 | **Jam Otoritatif Server** (PRD 1, 30.2) | **PARTIAL** | `src/services/attendanceService.ts#L77-83` | RPC `get_server_time` tidak ada di DB remote; frontend mengandalkan jam browser client `new Date()`. |
| 7 | **Geofence Server-Side Enforcement** (PRD 8, 40.1) | **COMPLIANT** | `supabase/migrations/005`, trigger DB | Formula Haversine divalidasi otoritatif di database melalui trigger PostgreSQL. |
| 8 | **Fail-Safe Titik Koordinat Kantor** (PRD 8, 40.1) | **COMPLIANT** | `system_settings.OFFICE_COORDINATES_CONFIRMED` | Database bernilai `true` (lat: `-7.242911`, lon: `108.168147`, radius: `100m`). |
| 9 | **Atribut Kepulangan Awal (Early Leave)** (PRD 9, 40.1) | **COMPLIANT** | `attendance_records.is_early_leave`, `early_leave_minutes` | Status harian tetap sah `HADIR`/`TERLAMBAT`; menit pulang awal tercatat terpisah. |
| 10 | **Atomic Check-Out Concurrency** (PRD 30.3) | **PARTIAL** | `src/services/attendanceService.ts#L597-611` | Query UPDATE belum menyertakan klausul `.is('check_out_at', null)` dan belum memvalidasi jumlah row terdampak. |
| 11 | **Surat Tugas Dinas Luar Lifecycle** (PRD 12, 31) | **COMPLIANT** | `src/services/dlService.ts`, `dl_assignments` | Alur `PENDING` -> `VERIFIED` -> `APPROVED` -> `RATIFIED` berjalan sesuai state machine. |
| 12 | **Ratifikasi Kades & Deadline 72 Jam** (PRD 12, 40.1) | **COMPLIANT** | `dl_assignments.ratification_deadline`, `dlService.ts#L407` | Hanya `KEPALA_DESA` yang berhak meratifikasi; deadline tersimpan di database. |
| 13 | **Bukti Selfie DL & Private Storage** (PRD 15, 30.2) | **NON-COMPLIANT** | Supabase Storage `[]`, `dlService.ts#L729-741` | Tidak ada bucket Supabase Storage; bukti selfie disimpan sebagai Base64 in-memory tanpa upload DB/Storage. |
| 14 | **Multi-Lokasi Dinas Luar** (PRD 14) | **COMPLIANT** | `dl_locations` (3 baris di DB), `dlService.ts#L699` | Mendukung koordinat multi-lokasi penugasan dengan validasi radius per titik. |
| 15 | **Izin & Sakit Lifecycle** (PRD 10, 31) | **COMPLIANT** | `src/services/absenceService.ts`, `absence_requests` | Pengajuan `SUBMITTED` -> `APPROVED`/`REJECTED` tersinkronisasi ke status kehadiran. |
| 16 | **Cuti Multi-Stage Workflow** (PRD 11, 31) | **COMPLIANT** | `absence_requests`, `absenceService.ts#L421-470` | Alur `SUBMITTED` -> `VERIFIED` (Sekdes) -> `APPROVED` (Kades) berfungsi di kode dan DB. |
| 17 | **Koreksi Presensi Non-Destruktif** (PRD 13, 30.3) | **NON-COMPLIANT** | `src/services/correctionService.ts#L98`, trigger DB | Service mengirim `APPROVED` langsung; trigger menolak karena mewajibkan `PENDING`. Terjadi silent fallback. |
| 18 | **Konfigurasi Kop Surat Dinamis (Letterhead)** (PRD 36.2) | **COMPLIANT** | `system_settings.LETTERHEAD_CONFIG`, `reportService.ts` | 4 baris teks instansi, pilihan preset garis batas, pratinjau WYSIWYG, dan integrasi cetak PDF. |
| 19 | **Configuration Resolver Berbasis Tanggal** (PRD 36.7) | **PARTIAL** | `src/services/settingsService.ts#L15-43` | Saat query ke Supabase, filter `dateStr` diabaikan dan hanya mengambil `status = 'ACTIVE'`. |
| 20 | **Audit Log WORM (Immutabilitas)** (PRD 20, 40.1) | **COMPLIANT** | `trg_deny_audit_logs_mutation`, `audit_logs` | Trigger PostgreSQL secara mutlak menolak operasi UPDATE dan DELETE pada tabel `audit_logs`. |
| 21 | **Pencatatan Audit via Stored Procedure** (PRD 20, 40.1) | **PARTIAL** | `auditService.ts#L94`, DB schema | RPC `record_system_audit_event` tidak ada di database, memicu fallback ke direct table insert. |
| 22 | **Ekspor Laporan Excel & Cetak PDF** (PRD 19, 40.1) | **COMPLIANT** | `src/services/reportService.ts#L225,L300` | Format Spreadsheet XML 2003 (`.xls`) dan tata letak cetak PDF A4 Portrait/Landscape berjalan lancar. |
| 23 | **Notifikasi In-App** (PRD 18) | **PARTIAL** | `notifications` (1 baris di DB), `notificationService.ts` | UI menampilkan notifikasi, namun pemicu otomatis dari backend untuk semua event belum lengkap. |
| 24 | **Isolasi 1 Deployment = 1 Desa** (PRD 38) | **COMPLIANT** | Skema Supabase, `.env.local` | Arsitektur single-tenant murni untuk Desa Sukamaju, tanpa pencampuran data multi-tenant. |
| 25 | **Anti-Tampering Riwayat GPS** (PRD 8, 30.3) | **COMPLIANT** | Trigger DB `trg_enforce_attendance_geofence` | Koordinat check-in/out tidak dapat diubah pasca-pencatatan kecuali melalui alur koreksi sah. |

---

## 3. DAFTAR BUG YANG DITEMUKAN SAAT UJI COBA

Selama pengujian sistem nyata dan simulasi transaksi terhubung ke database Supabase, ditemukan 9 bug operasional:

### BUG-01: Gagal Simpan Aparatur Baru Akibat Penolakan Sesi PostgREST
- **Deskripsi**: Saat membuat aparatur baru di menu Master Aparatur Desa, muncul galat: `Gagal menyimpan aparatur ke database: Aksi ditolak: sesi autentikasi pengguna tidak valid atau anonim.`
- **Penyebab**: Trigger `prevent_unauthorized_user_tampering()` pada tabel `users` memeriksa `auth.uid()`. Ketika token sesi Supabase Client di peramban mengalami masa kedaluwarsa atau desinkronisasi, panggilan PostgREST dianggap anonim (`auth.uid() IS NULL`).
- **Bukti Kode**: `src/services/masterService.ts#L461-498` dan `supabase/migrations/20261009000002_row_level_security.sql#L92-130`.

### BUG-02: Akun Aparatur Baru Tidak Memiliki Kredensial Supabase Auth
- **Deskripsi**: Aparatur baru yang ditambahkan oleh Operator Desa tidak dapat login ke sistem secara mandiri menggunakan surel/username dan kata sandi yang telah didaftarkan.
- **Penyebab**: Fungsi `addApparatus()` hanya melakukan INSERT ke tabel `public.users` dengan nilai `auth_user_id: NULL` dan `password_hash: 'pbkdf2_sha256$...'`. Fungsi ini tidak memanggil Supabase Auth Admin API (`supabase.auth.admin.createUser`) untuk membuat record pada skema internal `auth.users`.
- **Bukti Kode**: `src/services/masterService.ts#L457` & `src/services/authService.ts#L164-203`.

### BUG-03: Permohonan Koreksi Presensi Ditolak oleh Trigger State Machine
- **Deskripsi**: Saat Operator Desa melakukan koreksi jam check-in/out melalui antarmuka, data koreksi tidak tersimpan ke remote database `attendance_corrections` melainkan tersimpan di memori lokal.
- **Penyebab**: Trigger database `trg_enforce_attendance_correction_lifecycle` (Migration 006, baris 51-53) menetapkan aturan bahwa pengajuan baru wajib memiliki `state: 'PENDING'`. Namun pada `correctionService.ts` baris 98, payload dikirim dengan `state: 'APPROVED'`, memicu exception PostgreSQL: *"Pengajuan koreksi baru wajib berstatus PENDING. Pemohon tidak dapat menetapkan status langsung APPROVED"*.
- **Bukti Kode**: `src/services/correctionService.ts#L98` vs `supabase/migrations/20261009000006_approval_workflow_integrity.sql#L51`.

### BUG-04: Bukti Selfie Dinas Luar Tidak Disimpan ke Database Remote
- **Deskripsi**: Presensi Dinas Luar yang melampirkan foto selfie tidak menghasilkan baris baru pada tabel `dl_evidence` di remote Supabase.
- **Penyebab**: Metode `submitDLAttendance()` pada `src/services/dlService.ts` baris 632-761 tidak memiliki blok eksekusi `if (!IS_DEMO_MODE && isSupabaseConfigured())` untuk melakukan INSERT ke tabel `dl_evidence`. Metode tersebut hanya memutasi objek memori lokal `this.assignments`.
- **Bukti Kode**: `src/services/dlService.ts#L729-755`.

### BUG-05: Galat 404 pada Pemanggilan Stored Procedure Audit Log
- **Deskripsi**: Konsol peramban menampilkan galat: `Could not find the function public.record_system_audit_event in the schema cache`.
- **Penyebab**: Fungsi stored procedure `record_system_audit_event` belum dibuat atau belum di-expose dengan hak akses EXECUTE untuk peran `authenticated` pada remote Supabase. Akibatnya, `auditService.ts` selalu mengalami kegagalan pada RPC dan harus beralih ke direct table insert.
- **Bukti Introspeksi**: Hasil uji introspeksi database remote: `RPC [record_system_audit_event]: ERROR: Could not find the function public.record_system_audit_event(p_action, p_details) in the schema cache`.

### BUG-06: Ketiadaan Endpoint Waktu Resmi Server (Official Server Time)
- **Deskripsi**: Waktu presensi yang dicatat pada mode mandiri rentan terhadap manipulasi jam peramban pengguna.
- **Penyebab**: RPC `get_server_time()` tidak tersedia di PostgREST API (`ERROR: Could not find the function public.get_server_time`). Metode `attendanceService.getServerTime()` terpaksa menggunakan waktu lokal peramban `new Date()`.
- **Bukti Introspeksi**: Hasil introspeksi `RPC [get_server_time]: ERROR: Could not find the function public.get_server_time without parameters in the schema cache`.

### BUG-07: Parameter Tanggal Diabaikan pada Pembacaan Remote System Settings
- **Deskripsi**: Perubahan pengaturan operasional di masa lalu tidak dapat direkonstruksi secara deterministik berdasarkan tanggal transaksi.
- **Penyebab**: Pada `settingsService.getActiveSetting()`, saat mengambil data dari tabel `system_settings`, query PostgREST hanya memfilter `.eq('status', 'ACTIVE')` tanpa memfilter rentang tanggal `effective_from` dan `effective_to` menggunakan argumen `dateStr`.
- **Bukti Kode**: `src/services/settingsService.ts#L18-24`.

### BUG-08: HTTP 429 Too Many Requests Saat Refresh Halaman
- **Deskripsi**: Pengguna mendapati galat `Failed to load resource: the server responded with a status of 429 ()` pada endpoint `/auth/v1/token?grant_type=refresh_token`.
- **Penyebab**: Komponen frontend melakukan inisialisasi ganda dan pengecekan sesi token berulang-ulang tanpa mekanisme *debounce* atau *backoff throttling* saat navigasi menu.
- **Bukti Log**: User error report log nomor 4 pada riwayat percakapan.

### BUG-09: Storage Bucket Supabase Belum Terkonfigurasi
- **Deskripsi**: Fitur penyimpanan bukti tidak memiliki target bucket fisik di remote Supabase.
- **Penyebab**: Panggilan `supabase.storage.listBuckets()` mengembalikan array kosong `[]`. Bucket privat `dl-evidence` dan `attachments` belum dibuat di remote Supabase.
- **Bukti Introspeksi**: Hasil script introspeksi remote: `Storage Buckets: [] Error: undefined`.

---

## 4. FITUR YANG BELUM SESUAI PRD

Bagian ini merangkum fitur yang sudah memiliki kode implementasi, namun perilakunya menyimpang dari ketentuan PRD v1.3.0:

1. **Pengelolaan Kredensial Aparatur (PRD Section 30.2)**:
   - *Spesifikasi PRD*: Kredensial aparatur wajib dikelola sepenuhnya oleh Supabase Auth. Tabel profil pengguna (`users`) dilarang menyimpan `password_hash` aplikasi sendiri.
   - *Kondisi Aktual*: Tabel `public.users` masih memiliki kolom `password_hash`, dan `masterService.ts` mengisi nilai tiruan `pbkdf2_sha256$...`. Hal ini memecah identitas pengguna menjadi dua subsistem yang tidak sinkron.

2. **Resiliensi Sesi & Token Fallback (PRD Section 40.1 Item 9)**:
   - *Spesifikasi PRD*: Wajib menggunakan pola sesi resmi Supabase. Dilarang menambahkan persistensi token buatan atau fallback Bearer buatan hanya untuk melewati trigger.
   - *Kondisi Aktual*: `authService.ts` menyimpan `kadesa_access_token` di `localStorage`, dan `masterService.ts` (baris 471-482) membuat panggilan raw `fetch` dengan menyuntikkan header Bearer manual ketika Supabase JS client gagal.

3. **Format Penyimpanan Bukti Selfie Dinas Luar (PRD Section 15 & 30.2)**:
   - *Spesifikasi PRD*: Bukti selfie wajib disimpan dalam format *Private Evidence Storage* dengan *presigned signed URL* bertenggang waktu.
   - *Kondisi Aktual*: `dlService.ts` menyimpan foto sebagai string Base64 mentah (`storageReference: selfieBase64`) secara in-memory, membebani konsumsi memori dan melanggar prinsip *private storage by default*.

4. **Koreksi Presensi Non-Destruktif (PRD Section 13 & 30.3)**:
   - *Spesifikasi PRD*: Alur koreksi presensi harus mengikuti mesin status dua tahap (`REQUESTED/PENDING` -> `APPROVED`/`REJECTED`) untuk menjaga integritas rekam jejak.
   - *Kondisi Aktual*: UI modal koreksi langsung memproses persetujuan di sisi klien (`state: 'APPROVED'`), sehingga ditolak oleh trigger database dan berujung pada penyimpanan data semu di memori browser.

5. **Atomisitas Check-Out (PRD Section 30.3)**:
   - *Spesifikasi PRD*: Operasi Check-Out wajib bersifat atomic dan hanya berhasil jika presensi belum memiliki Check-Out sebelumnya dengan memeriksa jumlah baris yang terpengaruh (*affected rows* > 0).
   - *Kondisi Aktual*: `attendanceService.ts` hanya melakukan pemeriksaan awal di frontend (`existingDb.check_out_at`) lalu menjalankan UPDATE berdasarkan ID tanpa klausul kondisional `check_out_at IS NULL` di level query.

---

## 5. FITUR YANG BELUM DIIMPLEMENTASIKAN

Berikut adalah daftar kebutuhan PRD v1.3.0 yang belum diimplementasikan di basis kode maupun database:

1. **Penyediaan Akun Supabase Auth Terotomasi (User Provisioning Pipeline)**:
   - Belum tersedia backend service / Supabase Edge Function berprivilege *service-role* yang bertugas membuat akun `auth.users` secara otomatis saat Operator Desa mendaftarkan aparatur baru.
2. **Private Storage Bucket & Signed URL Resolver**:
   - Belum dibuat bucket `dl-evidence` dan `absence-attachments` di Supabase Storage.
   - Belum ada fungsi pembacaan berkas menggunakan `supabase.storage.from(...).createSignedUrl(...)`.
3. **Penyimpanan Transaksional `dl_evidence` di Remote DB**:
   - Belum ada kode yang menghubungkan form presensi DL dengan tabel remote `public.dl_evidence`.
4. **Endpoint / RPC Waktu Otoritatif Server (`get_server_time()`)**:
   - Belum ada stored procedure PostgreSQL ringan `get_server_time()` yang mengembalikan `NOW()` secara aman ke PostgREST API.
5. **Stored Procedure Audit Log Otoritatif (`record_system_audit_event()`)**:
   - Fungsi PostgreSQL `public.record_system_audit_event()` belum di-deploy ke schema remote Supabase.
6. **Mekanisme Automatic Notification Triggers**:
   - Notifikasi pengajuan DL baru ke Kades/Sekdes dan notifikasi tenggat waktu ratifikasi (72 jam) belum dipicu oleh database trigger maupun cron background.

---

## 6. MASALAH DATABASE, RPC, RLS, AUTHORIZATION, DAN SECURITY

Berdasarkan introspeksi langsung terhadap remote PostgreSQL Supabase (`qjiwxtvhzeitjtznhkdc.supabase.co`):

### 6.1 Status Tabel dan Skema Aktual
- **Tabel Fisik yang Ada (12 Tabel)**:
  1. `villages` (1 baris data)
  2. `positions` (11 baris data)
  3. `users` (8 baris data)
  4. `attendance_records` (11 baris data)
  5. `dl_assignments` (7 baris data)
  6. `dl_locations` (3 baris data)
  7. `dl_evidence` (1 baris data)
  8. `absence_requests` (8 baris data)
  9. `attendance_corrections` (1 baris data)
  10. `work_schedules` (7 baris data)
  11. `holidays` (7 baris data)
  12. `audit_logs` (8 baris data)
  13. `notifications` (1 baris data)
  14. `system_settings` (17 baris data)
- **Tabel yang Tidak Ada**: `public.correction_requests` (Tabel fisik yang sah dan terdaftar adalah `public.attendance_corrections`).

### 6.2 Evaluasi RLS (Row Level Security) & Triggers
- **RLS Aktif**: RLS telah diaktifkan pada seluruh tabel utama.
- **Trigger Keamanan yang Terpasang & Berfungsi**:
  - `trg_deny_audit_logs_mutation`: Mencegah modifikasi/penghapusan riwayat audit (Immutability WORM terjamin).
  - `trg_enforce_attendance_geofence`: Menegakkan kepatuhan radius dan koordinat kantor desa.
  - `trg_enforce_attendance_correction_lifecycle`: Menegakkan validasi status `PENDING` saat pengajuan koreksi.
  - `trg_enforce_dl_assignment_lifecycle`: Menegakkan aturan persetujuan dan ratifikasi surat tugas DL.
- **Celah Keamanan & Hambatan Otorisasi**:
  - **Sesi Desinkronisasi vs Strict Trigger**: Seluruh trigger di atas memiliki pengaman ketat:
    ```sql
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Aksi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
    END IF;
    ```
    Karena frontend adalah Single Page Application (SPA) yang berjalan di sisi browser, jika token Supabase Client kedaluwarsa atau tidak terinjeksi secara sempurna pada header request PostgREST, seluruh transaksi presensi, registrasi aparatur, dan koreksi akan langsung digagalkan oleh trigger database.
  - **Ketiadaan Stored Procedure RPC**: RPC `record_system_audit_event` yang seharusnya menjadi jalur utama pencatatan audit berprivilege `SECURITY DEFINER` tidak ditemukan di schema cache, sehingga sistem bergantung pada *direct table insert* yang rentan dibatasi oleh RLS.

---

## 7. MASALAH UI/UX DAN ALUR PENGGUNA

1. **Respon Lambat & Polling Token Redundan**:
   - Navigasi pertama kali ke menu *Data Aparatur Desa*, *Master Jabatan*, dan *Audit Log* terkadang mengalami penundaan (delay) hingga 2-3 detik karena terjadinya panggilan refresh token Supabase yang mengalami throttling (HTTP 429).
2. **Ketiadaan Feedback Saat Terjadi Fallback In-Memory**:
   - Ketika penyimpanan ke database remote gagal (misalnya pada koreksi presensi atau penambahan bukti DL), sistem menangkap galat tersebut di blok `catch` dan beralih ke penyimpanan memori lokal tanpa memberikan peringatan tegas kepada pengguna bahwa **data hanya tersimpan sementara di peramban dan belum tersinkronisasi ke server**.
3. **Form Modal Koreksi Presensi Membingungkan Pengguna**:
   - Modal koreksi presensi di UI menampilkan tombol "Simpan & Terapkan Koreksi" seolah-olah Operator Desa dapat langsung mengubah absensi secara sepihak, bertentangan dengan alur tata kelola pemerintahan yang mewajibkan verifikasi.
4. **Peringatan Kuota & Ukuran Kamera Selfie DL**:
   - Pada perangkat seluler dengan kamera beresolusi tinggi, konversi tangkapan kamera langsung ke string Base64 dapat menghasilkan data berukuran > 10MB yang memicu penolakan batas ukuran berkas (`MAX_SELFIE_FILE_SIZE_MB: 5MB`) tanpa adanya kompresi otomatis di sisi klien sebelum pengiriman.

---

## 8. HASIL PEMERIKSAAN TYPESCRIPT, LINT, BUILD, DAN AUTOMATED TESTS

Pengujian teknis dilakukan langsung pada repositori lokal:

### 8.1 TypeScript Typecheck
- **Perintah**: `npm run typecheck` (`tsc --noEmit`)
- **Hasil**: **0 Kesalahan (Exit Code 0)**. Seluruh tipe data, interface, dan enum sinkron tanpa *type mismatch*.

### 8.2 Linter
- **Perintah**: `npm run lint`
- **Hasil**: Script `lint` belum dikonfigurasi di `package.json` (`npm error Missing script: "lint"`). Pemeriksaan kualitas kode bergantung pada kompiler TypeScript strict mode.

### 8.3 Automated Unit & Integration Tests (Vitest)
- **Perintah**: `npm test` (`vitest run`)
- **Durasi**: 17,54 detik
- **Hasil**: **13 File Lulus, 68 Kasus Uji Lulus, 0 Gagal (100% PASS)**
  - `src/test/report_audit.test.ts` (6 tests) — PASS
  - `src/test/settings.test.ts` (4 tests) — PASS
  - `src/test/auth.test.ts` (4 tests) — PASS
  - `src/test/absence_correction.test.ts` (2 tests) — PASS
  - `src/test/operator_assignment.test.ts` (8 tests) — PASS
  - `src/test/password_management.test.ts` (6 tests) — PASS
  - `src/test/backend_foundation.test.ts` (8 tests) — PASS
  - `src/test/components.test.tsx` (1 test) — PASS
  - `src/test/protected_route.test.tsx` (2 tests) — PASS
  - `src/test/dl.test.ts` (4 tests) — PASS
  - `src/test/map.test.tsx` (5 tests) — PASS
  - `src/test/branding.test.ts` (5 tests) — PASS
  - `src/test/attendance.test.ts` (13 tests) — PASS

### 8.4 Production Build (Vite)
- **Perintah**: `npm run build` (`tsc && vite build`)
- **Durasi**: 7,82 detik
- **Hasil**: **Kompilasi Berhasil (Exit Code 0)**
  - Modul bertransformasi: **2.026 modul**
  - Aset Keluaran:
    - `dist/index.html` (1.11 kB / gzip: 0.60 kB)
    - `dist/assets/index-C89DqESE.css` (38.35 kB / gzip: 11.43 kB)
    - `dist/assets/index-B6pLFbDL.js` (1,058.81 kB / gzip: 278.30 kB)
  - Catatan Build: Vite memberikan peringatan bahwa ukuran chunk JavaScript (`index-B6pLFbDL.js`) melampaui 500 kB (perlu optimasi *code splitting*).

### 8.5 Pemeriksaan Deployment Produksi (Vercel)
- **Perintah**: Pengujian konektivitas HTTPS ke `https://kadesa.vercel.app`
- **Hasil**: **HTTP 200 OK**, respon HTML 1.105 bytes memuat metadata resmi KADESA.

---

## 9. RISIKO TERHADAP DATA YANG SUDAH TERSIMPAN

Remote database Supabase saat ini telah menyimpan data operasional awal:
- **1 entitas desa** (`vil-001` - Desa Sukamaju)
- **11 jabatan organisasi** (`positions`)
- **8 profil aparatur desa** (`users`)
- **11 transaksi presensi** (`attendance_records`)
- **7 penugasan dinas luar** (`dl_assignments`)
- **8 permohonan izin/cuti** (`absence_requests`)
- **8 rekam jejak audit keamanan** (`audit_logs`)
- **17 konfigurasi sistem** (`system_settings`)

### Analisis Risiko & Batasan:
1. **Risiko Hilangnya Data Relasional**:
   - Menjalankan migrasi destruktif (seperti `DROP TABLE` atau `TRUNCATE`) akan merusak integritas foreign key `attendance_records` -> `users` dan `dl_assignments` -> `users`.
   - **Tindakan Pencegahan**: Sesuai Aturan Wajib Nomor 1 & 7, skema database tidak boleh di-reset. Seluruh penyesuaian wajib berprinsip *non-destructive migration* (`ADD COLUMN IF NOT EXISTS`, penambahan trigger/fungsi).
2. **Risiko Integritas Kolom `password_hash`**:
   - Kolom `password_hash` pada `public.users` saat ini masih bertipe `TEXT NOT NULL` pada skema awal. Migration `20261010000003_allow_null_password_hash.sql` telah disiapkan untuk mengubahnya menjadi `NULLABLE` agar aparatur yang dibuat via Supabase Auth tidak dipaksa mengisi password hash lokal. Jika kolom ini diubah sembarangan tanpa sinkronisasi `auth_user_id`, akun aparatur yang ada bisa kehilangan referensi otentikasi.
3. **Risiko Audit Log Locking**:
   - Karena trigger `trg_deny_audit_logs_mutation` aktif, tabel `audit_logs` tidak dapat dimodifikasi. Setiap migrasi yang mencoba menyentuh atau merapikan data di tabel ini akan digagalkan oleh PostgreSQL.

---

## 10. REKOMENDASI PERBAIKAN DENGAN URUTAN PRIORITAS

Perbaikan direkomendasikan secara bertahap melalui pendekatan *incremental refactoring*:

### Prioritas P0 (Mendesak / Blocker Integritas & Keamanan):
1. **Penyelarasan Siklus Koreksi Presensi**:
   - Perbaiki `src/services/correctionService.ts` agar saat melakukan INSERT ke `attendance_corrections`, status awal yang dikirim adalah `'PENDING'` (bukan `'APPROVED'`).
   - Pisahkan aksi persetujuan menjadi langkah kedua yang memicu status `'APPROVED'` sesuai trigger database.
2. **Deploy Stored Procedure RPC Resmi**:
   - Deploy stored procedure `record_system_audit_event(p_action text, p_details jsonb, p_entity_type text, p_entity_id text)` dan `get_server_time()` ke database Supabase dengan hak akses `SECURITY DEFINER` dan GRANT EXECUTE ke role `authenticated` & `anon`.
3. **Remediasi Sesi Auth & Penghapusan Bypass Token**:
   - Hapus ketergantungan pada `localStorage.getItem('kadesa_access_token')` dan fallback Bearer manual di `masterService.ts`. Pastikan seluruh request API melewati instance resmi `supabase.auth.getSession()` yang tersinkronisasi.

### Prioritas P1 (Tinggi / Kelengkapan Alur Bisnis PRD):
1. **Integrasi Supabase Storage untuk Bukti Selfie DL**:
   - Buat bucket private `dl-evidence` pada remote Supabase Storage dengan RLS policy yang mengizinkan unggah berkas oleh pemilik penugasan.
   - Implementasikan fungsi upload berkas pada `dlService.ts` dan simpan URL referensi penyimpanan di tabel `dl_evidence`.
2. **Implementasi User Provisioning Pipeline**:
   - Sediakan mekanisme (misalnya via Supabase Edge Function atau integrasi aman) untuk membuat akun `auth.users` secara otomatis saat Operator Desa menambahkan aparatur baru, serta menyematkan `auth_user_id` yang valid ke tabel `public.users`.
3. **Atomisitas Check-Out**:
   - Perbarui query update pada `attendanceService.checkOut()` dengan menambahkan syarat `.is('check_out_at', null)` dan lakukan validasi bahwa jumlah baris yang berhasil diubah adalah 1 (bukan 0).

### Prioritas P2 (Sedang / Optimasi & Akurasi Data):
1. **Effective-Dated Query Resolver pada System Settings**:
   - Perbaiki `settingsService.getActiveSetting()` agar saat membaca dari Supabase, menyertakan filter tanggal efektif: `.lte('effective_from', targetDate).or('effective_to.is.null,effective_to.gte.' + targetDate)`.
2. **Optimasi Ukuran Bundel JavaScript (Code Splitting)**:
   - Terapkan dynamic import (`React.lazy`) pada halaman-halaman berat (seperti Leaflet Map, Laporan Excel/PDF, dan Audit Log) pada `src/App.tsx` untuk memecah bundel `index-B6pLFbDL.js` menjadi chunk yang lebih kecil (<500 kB).
3. **Debounce / Throttling pada Sesi Peramban**:
   - Pasang proteksi debounce pada listener auth state change untuk mencegah lonjakan request refresh token yang menimbulkan galat HTTP 429.

### Prioritas P3 (Rendah / Penyempurnaan & Standarisasi):
1. **Penambahan Konfigurasi ESLint**:
   - Tambahkan konfigurasi ESLint dan script `"lint": "eslint src --ext ts,tsx"` pada `package.json` untuk standarisasi CI/CD.
2. **Pemicu Notifikasi In-App Otomatis**:
   - Buat trigger database pada tabel `dl_assignments` dan `absence_requests` untuk secara otomatis mengisi tabel `notifications` saat ada pengajuan baru atau persetujuan.

---

## 11. FILE ATAU MODUL YANG DIPERKIRAKAN PERLU DIUBAH

Berdasarkan kesenjangan yang teridentifikasi, file-file berikut diperkirakan perlu disesuaikan pada tahap refactoring berikutnya:

1. **Frontend Services**:
   - `src/services/authService.ts`: Standardisasi sinkronisasi sesi Supabase Auth, pembersihan token buatan di `localStorage`.
   - `src/services/masterService.ts`: Penyesuaian pembuatan aparatur (menghubungkan provisioning kredensial Supabase Auth), penghapusan fallback Bearer manual.
   - `src/services/correctionService.ts`: Penyelarasan siklus hidup pengajuan koreksi presensi (`PENDING` -> `APPROVED`).
   - `src/services/dlService.ts`: Penambahan integrasi Supabase Storage untuk upload selfie DL dan penyimpanan baris ke tabel `dl_evidence`.
   - `src/services/attendanceService.ts`: Penambahan klausul atomisitas pada operasi check-out dan pembacaan waktu resmi dari RPC server.
   - `src/services/settingsService.ts`: Penyempurnaan resolusi konfigurasi remote berbasis tanggal efektif (`effective_from` & `effective_to`).
   - `src/services/auditService.ts`: Sinkronisasi pemanggilan RPC `record_system_audit_event`.
2. **Database Scripts / Migrations (Non-Destructive)**:
   - Script pembuatan stored procedure: `record_system_audit_event()` dan `get_server_time()`.
   - Konfigurasi Storage Bucket `dl-evidence` dan security policies Supabase Storage.
3. **Build & Tooling**:
   - `vite.config.ts`: Konfigurasi `rollupOptions.output.manualChunks` untuk pemecahan bundel vendor (React, Leaflet, Lucide).
   - `package.json`: Penambahan script linting resmi.

---

## 12. HAL YANG MASIH MEMERLUKAN KEPUTUSAN BISNIS ATAU AKSES EKSTERNAL

Sebelum aplikasi dinyatakan lulus dari gerbang rilis produksi (*Production Release Gate* PRD v1.3.0 Section 44), terdapat hal-hal yang membutuhkan penetapan dari pemangku kepentingan desa:

1. **Mekanisme Resmi Pendaftaran Akun Aparatur**:
   - Perlu keputusan arsitektural: Apakah pendaftaran aparatur desa baru menggunakan alur undangan surel (*Email Invitation*) resmi Supabase Auth, atau menggunakan alur pembuatan kata sandi langsung oleh Operator Desa via backend berprivilege (*Supabase Edge Function / Service Role Key*)?
2. **Konfirmasi Fisik Titik Koordinat Kantor Desa**:
   - Titik koordinat yang saat ini tersimpan di database (`-7.242911`, `108.168147` dengan radius 100 meter di Desa Sukamaju) perlu dituangkan dalam Berita Acara Penetapan Lokasi Kantor Desa yang disahkan oleh Kepala Desa.
3. **Akun Super Admin Produksi Definitif**:
   - Akun Super Admin saat ini (`dawank@desa.local`) harus digantikan atau dialihkan secara resmi kepada personel penanggung jawab teknis pemerintah desa yang sah, dan seluruh kredensial sementara wajib dirotasi.
4. **Kebijakan Retensi Berkas Bukti & Arsip**:
   - Sesuai PRD v1.3.0 Section 40.2, batas retensi berkas bukti selfie (default 2 tahun) dan pencadangan database off-site perlu disahkan dalam dokumen operasional pemerintah desa.

---

## KEPUTUSAN AKHIR AUDIT

Aplikasi **KADESA versi 1.3.0** memiliki fondasi teknis yang solid, UI yang responsif, logika pengujian yang komprehensif, serta integritas geofence dan WORM audit yang telah terpasang dengan baik. 

Kekurangan yang ditemukan **bukan merupakan cacat arsitektur mendasar**, melainkan ketidaksesuaian integrasi pada lapisan otentikasi Supabase, ketiadaan storage bucket remote, dan ketidakcocokan parameter state machine pada satu service koreksi.

Oleh karena itu, disimpulkan secara tegas bahwa **APLIKASI DAPAT DIPERBAIKI MELALUI INCREMENTAL REFACTORING**. **Tidak ada kebutuhan teknis untuk melakukan rancang ulang penuh (full rebuild)**. Perbaikan bertahap berbasis prioritas P0 dan P1 akan membawa aplikasi KADESA memenuhi seluruh kriteria *Production Release Gate* PRD v1.3.0.
