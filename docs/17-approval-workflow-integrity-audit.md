# KADESA — Laporan Final Approval-Workflow Integrity Audit

**Tanggal:** 09 Oktober 2026  
**Status Gate:** APPROVAL WORKFLOW INTEGRITY AUDIT PASSED & HARDENED (OFFLINE / PRE-LIVE GATE)  
**Tautan Terkait:**
- [`supabase/migrations/20261009000006_approval_workflow_integrity.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000006_approval_workflow_integrity.sql)
- [`supabase/migrations/20261009000005_server_side_geofence_enforcement.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000005_server_side_geofence_enforcement.sql)
- [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql)
- [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql)
- [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts)
- [`src/test/absence_correction.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/absence_correction.test.ts)
- [`src/test/dl.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/dl.test.ts)

---

## 1. Audit Integritas Koreksi Presensi (Attendance Correction Integrity)

Pemeriksaan komprehensif dilakukan terhadap seluruh siklus koreksi presensi non-destruktif, dari pengajuan formulir, hak persetujuan pejabat, hingga aplikasi perubahan ke transaksi kehadiran:

| Aspek Uji Celah | Kondisi Awal (Vulnerability) | Solusi Remidiasi pada Migrasi 006 | Status |
|---|---|---|---|
| **Pembuatan permohonan langsung berstatus `APPROVED`** | Policy RLS lama mengizinkan Operator melakukan INSERT tanpa membatasi nilai `state`. Operator dapat mengirim `state = 'APPROVED'` dan sembarang `approved_by`. | Ditegakkan trigger `enforce_attendance_correction_lifecycle()`: Operasi INSERT **WAJIB** `state = 'PENDING'`. Seluruh kolom persetujuan (`approved_by`, `approved_at`, `applied_at`, `applied_by`) dipaksa `NULL`. Policy RLS `corrections_insert_operator` ditambahkan klausul `WITH CHECK (state = 'PENDING' AND approved_by IS NULL)`. | **REMEDIATED** |
| **Pemohon / Operator mengubah status persetujuan sepihak** | Tidak ada validasi transisi status pada tabel `attendance_corrections`. Pemohon dapat mengubah statusnya sendiri. | Trigger memvalidasi: transisi ke `APPROVED` hanya dapat dilakukan oleh pejabat berwenang (`SUPER_ADMIN`, `KEPALA_DESA`, `SEKRETARIS_DESA`, atau `OPERATOR_DESA` untuk staf lain). **Prinsip Anti-Self-Approval**: `v_actor_user_id <> OLD.requested_by` DAN `v_actor_user_id <> OLD.user_id`. Pemohon dilarang menyetujui koreksinya sendiri. | **REMEDIATED** |
| **Pengiriman `correction_state = 'CORRECTED'` tanpa persetujuan sah** | Pengecekan hanya memastikan keberadaan setidaknya 1 baris berstatus `APPROVED` tanpa memverifikasi keterkaitan nilai dan status konsumsi. | Trigger `enforce_attendance_geofence_safety` memvalidasi keberadaan baris `attendance_corrections` berstatus `APPROVED` yang aktif dan belum pernah dikonsumsi (`applied_at IS NULL`). Jika tidak ditemukan, request ditolak seketika (`RAISE EXCEPTION`). | **REMEDIATED** |
| **Pengguna mengubah waktu ke nilai berbeda dari yang disetujui** | Trigger hanya memeriksa keberadaan baris `APPROVED`, tetapi tidak membandingkan nilai payload `NEW.check_in_at` atau `NEW.check_out_at` terhadap `corrected_check_in` / `corrected_check_out`. | Trigger memverifikasi nilai secara mutlak: `NEW.check_in_at` **WAJIB SAMA PERSIS** dengan `v_approved_corr.corrected_check_in`, `NEW.check_out_at` **WAJIB SAMA PERSIS** dengan `v_approved_corr.corrected_check_out`, dan `NEW.status` **WAJIB SAMA PERSIS** dengan `v_approved_corr.corrected_status`. Deviasi 1 detik atau 1 status ditolak. | **REMEDIATED** |
| **Replay Attack: Penggunaan persetujuan lama berulang kali** | Sekali dokumen `APPROVED` tercipta, query `EXISTS (SELECT 1 ... WHERE state = 'APPROVED')` bernilai TRUE selamanya. Operator dapat mengubah waktu berkali-kali di masa depan tanpa persetujuan baru. | Menambahkan kolom `applied_at TIMESTAMPTZ NULL` dan `applied_by VARCHAR(50) NULL`. Begitu koreksi diterapkan ke presensi, trigger secara atomik mengeksekusi `UPDATE attendance_corrections SET applied_at = NOW(), applied_by = ... WHERE id = ...`. Pencarian dokumen koreksi hanya mengambil yang `applied_at IS NULL`. Persetujuan lama tidak dapat digunakan kembali. | **REMEDIATED** |
| **Pencatatan Audit Trail Koreksi** | Alasan, nilai asli, dan identitas penyetuju harus terekam utuh. | Snapshot nilai asli (`original_check_in`, `original_check_out`, `original_status`) disalin langsung dari database saat pengajuan. Kolom `original_*` pada transaksi presensi dikunci. Peristiwa perubahan terekam dalam tabel `attendance_corrections` dan diteruskan ke log audit. | **REMEDIATED** |

---

## 2. Audit Integritas Persetujuan Dinas Luar (DL Assignment Integrity)

Pemeriksaan mendalam dilakukan terhadap siklus hidup surat tugas Dinas Luar (`dl_assignments`), matriks otorisasi per jenjang jabatan, dan keterkaitannya dengan presensi:

| Aspek Uji Celah | Kondisi Awal (Vulnerability) | Solusi Remidiasi pada Migrasi 006 | Status |
|---|---|---|---|
| **Pembuatan surat tugas langsung `APPROVED` / `RATIFIED`** | Policy RLS `dl_assignments_insert_policy` sebelumnya memberikan klausul luas kepada role internal tanpa memeriksa `state`. Operator atau Sekdes dapat menyisipkan surat tugas yang langsung disetujui/diratifikasi. | Ditegakkan trigger `enforce_dl_assignment_lifecycle()`: Operasi INSERT **WAJIB** `state = 'PENDING'`. Bidang `verified_by`, `verified_at`, `approved_by`, `approved_at`, `ratified_by`, `ratified_at` dipaksa `NULL`. Policy RLS ditambahkan klausul `WITH CHECK (state = 'PENDING' AND verified_by IS NULL AND approved_by IS NULL AND ratified_by IS NULL)`. | **REMEDIATED** |
| **Pemisahan kewenangan pengajuan dan persetujuan** | Tidak ada pembatasan transisi status di level database (hanya ada di TypeScript mock service). | Trigger PostgreSQL menegakkan state machine berjenjang:<br>1. `PENDING -> VERIFIED`: Hanya oleh `SEKRETARIS_DESA` atau `SUPER_ADMIN`.<br>2. `VERIFIED -> APPROVED`: Oleh `KEPALA_DESA`, `SEKRETARIS_DESA`, atau `SUPER_ADMIN`.<br>3. `PENDING -> APPROVED`: Diskresi khusus `KEPALA_DESA`.<br>4. **`APPROVED -> RATIFIED`**: **HANYA KEPALA DESA (`KEPALA_DESA`) ATAU SUPER_ADMIN**. Operator atau Sekdes yang mencoba meratifikasi ditolak tegas (`RAISE EXCEPTION`). | **REMEDIATED** |
| **Pencegahan Self-Approval (Konflik Kepentingan)** | Pengaju dapat menyetujui surat tugas miliknya sendiri jika memiliki peran verifikator/penyetuju. | Trigger memvalidasi anti-self-approval:<br>`v_actor_user_id <> OLD.requester_user_id`<br>`v_actor_user_id <> OLD.subject_user_id`<br>Pemohon atau aparatur yang bersangkutan dilarang memverifikasi atau menyetujui surat tugasnya sendiri. | **REMEDIATED** |
| **Integritas Penolakan & Pembatalan** | Pengguna dapat mengubah status ke `REJECTED` atau `CANCELLED` tanpa alasan, atau mengubah kembali status yang sudah terminal. | Status `REJECTED` wajib menyertakan `rejection_reason`. Status `CANCELLED` wajib menyertakan `cancellation_reason`. Status `REJECTED`, `CANCELLED`, dan `RATIFIED` bersifat terminal dan dilarang dialihkan ke status lain. | **REMEDIATED** |
| **Keterkaitan Presensi dengan `dl_assignment_id`** | Potensi penggunaan ID penugasan sembarang atau milik orang lain untuk melompati geofence kantor desa. | Trigger `enforce_attendance_geofence_safety` memvalidasi:<br>1. Dokumen penugasan ada.<br>2. `subject_user_id = NEW.user_id` (wajib untuk aparatur bersangkutan).<br>3. `NEW.attendance_date BETWEEN start_date AND end_date` (dalam rentang tanggal tugas).<br>4. `state IN ('APPROVED', 'RATIFIED')` (surat tugas wajib sah).<br>5. Bukti foto selfie `check_in_selfie_url` wajib terisi. | **REMEDIATED** |

---

## 3. Konteks Administratif Supabase & Matriks Perilaku Sistem

Analisis menyeluruh terhadap interaksi `session_user`, `current_user`, `auth.uid()`, `SECURITY DEFINER`, RLS, dan hak `EXECUTE`:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              POSTGREST / CLIENT REQUESTS                               │
│  - Koneksi database fisik: user 'authenticator' (session_user = 'authenticator')       │
│  - SET LOCAL ROLE <anon | authenticated | service_role>                                │
└───────────────────────────┬────────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│     ROLE: anon        │       │  ROLE: authenticated  │
│ - current_user: anon  │       │ - current_user: auth  │
│ - auth.uid(): NULL    │       │ - auth.uid(): <uuid>  │
│ - session_user: auth' │       │ - session_user: auth' │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
            │ RLS Default Deny              │ RLS Policies Active
            │ No Table Access               │ Checked against users.role
            ▼                               ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                      TRIGGER FUNCTION (SECURITY DEFINER, owner: postgres)              │
│  - current_user beralih ke: 'postgres'                                                 │
│  - session_user TETAP: 'authenticator' (TIDAK BERUBAH)                                 │
│  - auth.uid() TETAP: NULL (anon) atau <uuid> (authenticated)                           │
│  - search_path: 'public, pg_temp' (aman dari hijacking skema)                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Evaluasi Bypass:                                                                      │
│  IF session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL THEN ...    │
│  -> Hasil untuk anon via PostgREST: FALSE (session_user adalah 'authenticator')       │
│  -> Hasil untuk authenticated via PostgREST: FALSE                                     │
│  -> Anon ditolak mutlak: auth.uid() IS NULL -> RAISE EXCEPTION                         │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Tabel Matriks Evaluasi Konteks Administratif:

| Konteks Pemanggilan | `session_user` | `current_user` Awal | `auth.uid()` | Perilaku Saat Memasuki Trigger `SECURITY DEFINER` | Evaluasi RLS | Perilaku Eksekusi & Batas Keamanan |
|---|---|---|---|---|---|---|
| **1. Request PostgREST Anonim** (`/rest/v1/...` tanpa JWT) | `authenticator` | `anon` | `NULL` | `current_user` -> `postgres`, `session_user` tetap `authenticator`, `auth.uid()` tetap `NULL`. | Ditolak oleh kebijakan RLS (Default Deny; tabel KADESA hanya memiliki policy `TO authenticated`). | Jika memicu trigger, pemeriksaan `auth.uid() IS NULL` langsung melempar `RAISE EXCEPTION`. Tidak ada celah bypass administratif. |
| **2. Request PostgREST Authenticated** (`/rest/v1/...` dengan JWT user) | `authenticator` | `authenticated` | `<uuid>` | `current_user` -> `postgres`, `session_user` tetap `authenticator`, `auth.uid()` mengembalikan user UUID. | Dievaluasi oleh policy `TO authenticated` berdasarkan profil peran di tabel `public.users`. | Trigger mengevaluasi seluruh aturan geofence, validasi DL, immutability koordinat, dan state machine koreksi. |
| **3. Request PostgREST Service-Role** (`apikey: service_role` via API) | `authenticator` | `service_role` | `NULL` | `current_user` -> `postgres`, `session_user` tetap `authenticator`, `auth.uid()` tetap `NULL`. | Bypasses RLS di level query planner PostgreSQL (`BYPASSRLS`). | **Trigger TETAP dieksekusi** pada operasi DML. Karena `session_user = 'authenticator'`, kondisi bypass superuser bernilai `FALSE`, dan request tertahan oleh validasi integritas trigger. |
| **4. Koneksi Langsung Superuser** (`psql`, CLI, Dashboard SQL Editor) | `postgres` atau `supabase_admin` | `postgres` atau `supabase_admin` | `NULL` | `current_user` = `postgres`, `session_user` = `postgres`, `auth.uid()` = `NULL`. | Bypass RLS (Superuser). | Kondisi `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL` bernilai `TRUE`. Diizinkan untuk eksekusi DDL migrasi dan pemeliharaan skema. |
| **5. Eksekusi Stored Procedure RPC** (`calculate_haversine_distance_meters`) | `authenticator` | `anon` / `authenticated` | `<uuid>` / `NULL` | Hak `EXECUTE` dicabut dari `PUBLIC`, `anon`, dan `authenticated`. | N/A (Fungsi matematika murni). | PostgREST menolak akses RPC (`/rpc/calculate_haversine_distance_meters`) dengan HTTP 403. Trigger internal tetap dapat memanggilnya karena trigger berjalan sebagai `postgres`. |

---

## 4. Strategi Migrasi Tanpa Drift (Migration Strategy)

Untuk memastikan tidak ada perbedaan perilaku antara database fresh (baru dibuat) dan database yang telah menerapkan migrasi lama:

1. **Prinsip Forward-Only Migration (Migrasi 006):**
   - Dibuat migrasi terarah baru: [`supabase/migrations/20261009000006_approval_workflow_integrity.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000006_approval_workflow_integrity.sql).
   - Seluruh pernyataan SQL dirancang **100% idempoten**:
     * `ADD COLUMN IF NOT EXISTS applied_at TIMESTAMPTZ NULL`
     * `ADD COLUMN IF NOT EXISTS applied_by VARCHAR(50) NULL`
     * `CREATE OR REPLACE FUNCTION ...`
     * `DROP TRIGGER IF EXISTS ... CREATE TRIGGER ...`
     * `DROP POLICY IF EXISTS ... CREATE POLICY ...`
2. **Sinkronisasi Skema Dasar (Migrasi 001 & 002):**
   - Kolom `applied_at` dan `applied_by` disinkronkan ke dalam definisi DDL tabel `attendance_corrections` pada `20261009000001_initial_schema.sql` agar fresh install langsung membuat tabel dengan struktur lengkap.
   - Database yang telah berjalan (existing DB) mengaplikasikan migrasi 006 untuk menambahkan kolom tersebut tanpa merusak data yang sudah ada.
3. **Konvergensi Hasil Akhir:**
   - Baik instalasi baru (`001 -> 002 -> 003 -> 004 -> 005 -> 006`) maupun upgrade database berjalan (`005 -> 006`) menghasilkan status skema, constraint, RLS, dan trigger yang **identik (Zero Drift)**.

---

## 5. Bukti Pengujian & Klasifikasi Transparan

Sesuai instruksi audit, seluruh klaim pengujian diklasifikasikan secara jujur dan transparan tanpa mengasumsikan mock test sebagai bukti runtime database:

| Jenis Pengujian | File Uji / Objek Verifikasi | Lingkungan | Jumlah Tes / Item | Hasil | Keterangan & Batas Validitas |
|---|---|---|---|---|---|
| **1. Static SQL DDL/DML Inspection** | `supabase/migrations/001–006` | Static Code Analysis | 14 tabel, 6 trigger, 18 RLS policies | **PASS** | Skema, foreign key `dl_assignment_id`, constraint `applied_at`, fungsi Haversine internal, dan trigger state machine terverifikasi valid secara sintaksis dan arsitektural. |
| **2. TypeScript Offline & Unit Suite** | `src/test/*.test.ts` (12 test files) | Vitest v3.2.7 (Node.js) | **65 tests passed (100%)** | **PASS** | Seluruh test suite aplikasi lulus (15.18s), mencakup pengujian role matrix, state machine DL, non-destructive correction, password rules, dan validasi migrasi 001–006. |
| **3. Static Typecheck** | `tsc --noEmit` | TypeScript 5.8 (Strict) | Seluruh source code proyek | **PASS** | 0 error kompilasi. Struktur tipe data sinkron. |
| **4. Frontend Production Build** | `vite build` | Vite 6.4.4 Production Mode | 1982 modul | **PASS** | Kompilasi bundle produksi bersih dalam 7.24s. |
| **5. PostgreSQL Engine Runtime Test** | DML Trigger & Constraint Live Execution | PostgreSQL Daemon / Docker | 8 skenario pengujian database | **NOT VERIFIED** | Lingkungan lokal Docker/PostgreSQL tidak terpasang di host Windows pengguna. Pengujian runtime DDL/trigger di database lokal **tidak dijalankan** dan ditandai transparan `NOT VERIFIED`. |
| **6. PostgREST / Supabase Cloud Live Test** | Live DML & RLS Evaluation di Cloud DB | `qjiwxtvhzeitjtznhkdc.supabase.co` | Konektivitas & PostgREST live | **NOT VERIFIED** | Sesuai batas tindakan, migrasi live **tidak dieksekusi** ke cloud Supabase dan database live tidak dimutasi. |

---

## 6. Berkas yang Diperbarui dalam Audit Ini

1. [`supabase/migrations/20261009000006_approval_workflow_integrity.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000006_approval_workflow_integrity.sql): File migrasi baru untuk perlindungan integritas alur persetujuan, anti-replay, dan state machine.
2. [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql): Penambahan kolom pelacak konsumsi koreksi `applied_at` dan `applied_by`.
3. [`src/types/correction.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/types/correction.ts): Penambahan tipe pelacak konsumsi koreksi.
4. [`src/services/correctionService.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/services/correctionService.ts): Penyelarasan atribut `appliedAt` dan `appliedByUserId` pada mock domain service.
5. [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts): Penambahan test suite validasi migrasi 006 (Total test bertambah menjadi 65 tests).
6. [`docs/17-approval-workflow-integrity-audit.md`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/docs/17-approval-workflow-integrity-audit.md): Dokumen laporan audit integritas alur persetujuan saat ini.
7. [`docs/00-project-status.md`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/docs/00-project-status.md): Sinkronisasi status gerbang pengujian offline (65 tests).
8. [`docs/known-issues.md`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/docs/known-issues.md): Sinkronisasi status mitigasi celah alur persetujuan.

---

## 7. Rekomendasi Gate Selanjutnya

Backend Tahap 1 kini telah diperkuat secara komprehensif pada level skema, trigger, state machine, dan anti-replay guard.

**Rekomendasi:**
1. Pertahankan `OFFICE_COORDINATES_CONFIRMED = 'false'` sampai koordinat resmi kantor desa Sukamaju diinput oleh administrator.
2. Ketika persetujuan migrasi live diberikan oleh pengguna:
   - Terapkan urutan migrasi lengkap: `001 -> 002 -> 003 -> 004 -> 005 -> 006`.
   - Jalankan reload cache skema PostgREST: `NOTIFY pgrst, 'reload schema'`.
3. Jangan melanjutkan ke fase Integration atau Deployment sebelum mendapat konfirmasi tertulis dari pengguna.
