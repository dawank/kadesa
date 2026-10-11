# KADESA — Final SQL Source Review Before Backend Stage 1 Approval

**Tanggal Peninjauan:** 09 Oktober 2026  
**Auditor / Reviewer:** Senior SQL Reviewer & Backend Security Auditor  
**Cakupan Berkas Sumber Aktual:**
- `supabase/migrations/20261009000001_initial_schema.sql`
- `supabase/migrations/20261009000002_row_level_security.sql`
- `supabase/migrations/20261009000003_seed_data.sql`
- `supabase/migrations/20261009000004_early_leave_attributes.sql`
- `supabase/migrations/20261009000005_server_side_geofence_enforcement.sql`
- `supabase/migrations/20261009000006_approval_workflow_integrity.sql`
**Status Gerbang Rekomendasi:** **READY FOR RUNTIME VALIDATION** *(Bukan Backend Stage 1 Final-Approved)*

---

## 1. Ringkasan Eksekutif & Status Temuan

Audit ini mengevaluasi implementasi aktual kode SQL migrasi 001–006 secara independen, menyeluruh, dan berbasis bukti baris kode nyata tanpa bersandar pada asumsi laporan sebelumnya.

### Temuan Kritis Sumber (Telah Ditemukan & Diremediasi Langsung):
1. **Regresi Section D Geofence pada Migrasi 006 (`enforce_attendance_geofence_safety`):**
   - **Kondisi Pemicu:** Pada migrasi 006, pendefinisian ulang fungsi `enforce_attendance_geofence_safety()` untuk menambahkan locking koreksi sempat memuat kembali blok geofence lama yang:
     1. Melakukan `RETURN NEW` jika `OFFICE_COORDINATES_CONFIRMED != 'true'`, yang meloloskan presensi kantor reguler tanpa validasi geofence saat koordinat belum dikonfirmasi (bertentangan dengan ADR-012).
     2. Mereferensikan kunci `OFFICE_LATITUDE`, `OFFICE_LONGITUDE`, dan `OFFICE_RADIUS_METERS` pada `system_settings` yang tidak ada di skema database (koordinat berada di tabel `villages`, dan kunci radius adalah `REGULAR_ATTENDANCE_RADIUS_METERS`).
   - **Dampak:** Vektor bypass geofence ketika unconfirmed, dan potensi error runtime saat koordinat resmi diaktifkan.
   - **Tingkat Risiko:** HIGH.
   - **Status Remediasi:** **PASS (REMEDIATED)** — Blok Section D pada migrasi 006 telah diselaraskan penuh dengan migrasi 005: mewajibkan penolakan presensi saat `OFFICE_COORDINATES_CONFIRMED != 'true'`, mengambil koordinat otoritatif dari tabel `villages`, dan menghitung jarak Haversine di server PostgreSQL.

---

## 2. Matriks Pemeriksaan Wajib & Klasifikasi

| No | Komponen Pemeriksaan Wajib | Status Klasifikasi | Ringkasan Bukti Sumber SQL Aktual |
|---|---|---|---|
| **1** | **Urutan Eksekusi Trigger & Efek Samping** | **PASS** | Evaluasi urutan alfabetikal trigger PostgreSQL dan rantai pemanggilan antar-tabel. |
| **2** | **Jalur Konsumsi Koreksi (`applied_at` & `applied_by`)** | **PASS** | Validasi transaksi atomik, pencegahan manipulasi PostgREST, dan anti-replay 1-to-1. |
| **3** | **State Machine Koreksi & Dinas Luar (DL)** | **PASS** | Validasi transisi status, anti-self-approval, finalitas status terminal, dan imutabilitas. |
| **4** | **Konkurensi & Penguncian Baris (`FOR UPDATE`)** | **PASS (Statis)** / **NOT VERIFIED (Runtime)** | Urutan penguncian searah (`attendance_records` → `attendance_corrections` → `audit_logs`). Deadlock risk diakui tidak 0%. |
| **5** | **Validasi Server-Side Seluruh Jalur Tulis Presensi** | **PASS** | Penolakan koordinat unconfirmed, batasan koordinat [-90..90, -180..180], proteksi GPS historis, dan syarat DL. |
| **6** | **Konteks Hak Istimewa, RLS, & Identitas Aktor** | **PASS (Statis)** / **NOT VERIFIED (Runtime)** | `SECURITY DEFINER` dilindungi `SET search_path = public, pg_temp`, `session_user` membedakan direct DB vs PostgREST. |
| **7** | **Konsistensi Migrasi Fresh vs Upgrade & Skema Drift** | **PASS (Statis)** / **NOT VERIFIED (Runtime)** | Skrip idempoten (`IF NOT EXISTS`), namun konvergensi zero-drift belum dibuktikan tanpa runtime `pg_dump`. |

---

## 3. Rincian Temuan & Bukti SQL Aktual

### 3.1 Urutan Eksekusi Trigger dan Efek Samping (Call Chain)
- **File:** `supabase/migrations/20261009000001_initial_schema.sql`, `...000002_row_level_security.sql`, `...000006_approval_workflow_integrity.sql`
- **Trigger yang Terlibat:**
  1. `trg_attendance_records_updated_at` (`BEFORE UPDATE ON attendance_records`) → memanggil `update_updated_at_column()`
  2. `trg_enforce_attendance_geofence` (`BEFORE INSERT OR UPDATE ON attendance_records`) → memanggil `enforce_attendance_geofence_safety()`
  3. `trg_enforce_attendance_correction_lifecycle` (`BEFORE INSERT OR UPDATE ON attendance_corrections`) → memanggil `enforce_attendance_correction_lifecycle()`
  4. `trg_deny_audit_logs_mutation` (`BEFORE UPDATE OR DELETE ON audit_logs`) → memanggil `reject_audit_logs_mutation()`
- **Urutan Eksekusi Aktual:**
  Sesuai spesifikasi PostgreSQL, trigger `BEFORE UPDATE` pada tabel yang sama dieksekusi berdasarkan urutan alfabetikal nama trigger:
  1. `trg_attendance_records_updated_at` berjalan terlebih dahulu: memperbarui `NEW.updated_at = NOW()`.
  2. `trg_enforce_attendance_geofence` berjalan kedua:
     - Melakukan validasi imutabilitas data historis.
     - Mengunci baris `attendance_corrections` via `SELECT ... FOR UPDATE`.
     - Menyetel parameter transaksi `kadesa.applying_correction_id`.
     - Mengeksekusi `UPDATE attendance_corrections SET applied_at = NOW(), applied_by = ...`.
       - *Sub-rantai:* memicu `trg_enforce_attendance_correction_lifecycle` pada `attendance_corrections`. Trigger memeriksa `current_setting('kadesa.applying_correction_id')`, memvalidasi status `APPROVED`, memastikan bidang usulan tidak berubah, dan mengizinkan pembaruan `applied_at`.
     - Membersihkan setting transaksi `kadesa.applying_correction_id`.
     - Memanggil `record_system_audit_event('APPLY_ATTENDANCE_CORRECTION', ...)`:
       - *Sub-rantai:* mengeksekusi `INSERT INTO audit_logs`. Trigger `trg_deny_audit_logs_mutation` tidak terpicu karena operasi adalah `INSERT`.
- **Klasifikasi:** **PASS** (Urutan eksekusi deterministik, tidak ada infinite loop, dan seluruh efek samping berada dalam satu transaksi atomik).

---

### 3.2 Verifikasi Jalur Konsumsi Koreksi Presensi
- **File:** `supabase/migrations/20261009000006_approval_workflow_integrity.sql`
- **Fungsi / Trigger:** `enforce_attendance_correction_lifecycle()`, `enforce_attendance_geofence_safety()`
- **Bukti SQL Aktual:**
  1. **Hanya Melalui Alur Presensi Resmi:**
     ```sql
     -- Pada enforce_attendance_correction_lifecycle:
     IF NEW.applied_at IS NOT NULL AND OLD.applied_at IS NULL THEN
         IF OLD.state != 'APPROVED' THEN
             RAISE EXCEPTION 'Hanya koreksi berstatus APPROVED yang dapat diterapkan ke presensi.';
         END IF;

         IF current_setting('kadesa.applying_correction_id', true) IS DISTINCT FROM OLD.id THEN
             RAISE EXCEPTION 'Pemberian tanda konsumsi koreksi (applied_at) hanya sah melalui alur presensi resmi.';
         END IF;
     ...
     ```
  2. **Penolakan Pemanggilan Langsung via PostgREST:**
     ```sql
     IF NEW.applied_at IS NOT NULL OR NEW.applied_by IS NOT NULL THEN
         RAISE EXCEPTION 'Kolom applied_at dan applied_by hanya dapat ditetapkan oleh sistem saat presensi diperbarui.';
     END IF;
     ```
  3. **Imutabilitas Usulan, Snapshot Awal, dan Metadata Persetujuan:**
     ```sql
     IF NEW.state IS DISTINCT FROM OLD.state
        OR NEW.corrected_check_in IS DISTINCT FROM OLD.corrected_check_in
        OR NEW.corrected_check_out IS DISTINCT FROM OLD.corrected_check_out
        OR NEW.corrected_status IS DISTINCT FROM OLD.corrected_status
        OR NEW.reason IS DISTINCT FROM OLD.reason
        OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
        OR NEW.approved_at IS DISTINCT FROM OLD.approved_at THEN
         RAISE EXCEPTION 'Konsumsi koreksi dilarang memodifikasi data atau usulan koreksi.';
     END IF;
     ```
  4. **Pencegahan Replay Attack (Anti-Replay):**
     Setelah `applied_at IS NOT NULL`, baris koreksi menjadi permanen dan tidak dapat digunakan ulang atau diubah:
     ```sql
     IF OLD.applied_at IS NOT NULL THEN
         IF NEW.applied_at IS DISTINCT FROM OLD.applied_at
            OR ... THEN
             RAISE EXCEPTION 'Koreksi yang telah diterapkan bersifat permanen dan tidak dapat diubah atau digunakan ulang.';
         END IF;
         RETURN NEW;
     END IF;
     ```
     Pada `enforce_attendance_geofence_safety()`, filter konsumsi mewajibkan `applied_at IS NULL`:
     ```sql
     SELECT * INTO v_approved_corr
     FROM public.attendance_corrections
     WHERE attendance_record_id = NEW.id
       AND state = 'APPROVED'
       AND applied_at IS NULL
       AND (corrected_check_in IS NOT DISTINCT FROM NEW.check_in_at)
       AND (corrected_check_out IS NOT DISTINCT FROM NEW.check_out_at)
       AND (corrected_status = NEW.status)
     ORDER BY approved_at DESC LIMIT 1 FOR UPDATE;
     ```
- **Klasifikasi:** **PASS**.

---

### 3.3 State Machine Koreksi Presensi dan Dinas Luar (DL)
- **File:** `supabase/migrations/20261009000006_approval_workflow_integrity.sql`
- **Fungsi / Trigger:** `enforce_attendance_correction_lifecycle()`, `enforce_dl_assignment_lifecycle()`
- **Bukti SQL Aktual:**
  1. **Pengajuan Baru Wajib PENDING:**
     - `attendance_corrections`: `NEW.state IS DISTINCT FROM 'PENDING'` → `RAISE EXCEPTION`. Kolom `approved_*` dan `applied_*` dipaksa `NULL`.
     - `dl_assignments`: `NEW.state IS DISTINCT FROM 'PENDING'` → `RAISE EXCEPTION`. Kolom `verified_*`, `approved_*`, `ratified_*` dipaksa `NULL`.
  2. **Anti-Self-Approval Terbukti:**
     - Koreksi Presensi:
       ```sql
       IF v_actor_user_id = OLD.requested_by OR v_actor_user_id = OLD.user_id THEN
           RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur terkait dilarang menyetujui koreksi presensinya sendiri.';
       END IF;
       ```
     - Dinas Luar:
       ```sql
       -- Verifikasi:
       IF v_actor_user_id = OLD.requester_user_id OR v_actor_user_id = OLD.subject_user_id THEN
           RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur bersangkutan tidak boleh memverifikasi tugasnya sendiri.';
       END IF;
       -- Persetujuan:
       IF v_actor_user_id = OLD.requester_user_id OR v_actor_user_id = OLD.subject_user_id THEN
           RAISE EXCEPTION 'Konflik kepentingan: Pemohon atau aparatur bersangkutan tidak boleh menyetujui surat tugasnya sendiri.';
       END IF;
       ```
  3. **Wewenang Khusus Ratifikasi Kepala Desa (PRD 12.3):**
     ```sql
     ELSIF NEW.state = 'RATIFIED' THEN
         IF OLD.state != 'APPROVED' THEN
             RAISE EXCEPTION 'Hanya surat tugas berstatus APPROVED yang dapat diratifikasi (Status saat ini: %).', OLD.state;
         END IF;
         IF v_actor_role NOT IN ('KEPALA_DESA', 'SUPER_ADMIN') THEN
             RAISE EXCEPTION 'Kewenangan ditolak: Hanya Kepala Desa yang berwenang meratifikasi surat tugas Dinas Luar.';
         END IF;
     ```
  4. **Kewajiban Alasan Penolakan dan Pembatalan:**
     - `REJECTED`: `rejection_reason` wajib diisi (`length(trim(NEW.rejection_reason)) > 0`).
     - `CANCELLED`: `cancellation_reason` wajib diisi (`length(trim(NEW.cancellation_reason)) > 0`).
  5. **Finalitas Status Terminal (Terminal Immutability):**
     - Pada `dl_assignments`: jika `OLD.state IN ('RATIFIED', 'REJECTED', 'CANCELLED')`, transisi ke status apa pun ditolak dan seluruh parameter penugasan/pengesahan dilarang dimodifikasi.
- **Klasifikasi:** **PASS**.

---

### 3.4 Analisis Transaksi, Urutan Penguncian, & Konkurensi
- **File:** `supabase/migrations/20261009000006_approval_workflow_integrity.sql`
- **Mekanisme Penguncian:**
  - Baris `attendance_records` dikunci secara implisit oleh perintah `UPDATE` dari klien.
  - Baris `attendance_corrections` dikunci secara eksplisit menggunakan `SELECT ... FOR UPDATE` di dalam trigger sebelum `UPDATE attendance_corrections`.
  - Baris `audit_logs` disisipkan (`INSERT`) sebagai rekam jejak.
- **Urutan Penguncian (Lock Ordering):**
  $\text{attendance\_records} \longrightarrow \text{attendance\_corrections} \longrightarrow \text{audit\_logs}$
- **Evaluasi Dua Transaksi Bersamaan (Race Condition):**
  - Jika dua transaksi konkuren mencoba memakai persetujuan koreksi yang sama:
    Transaksi 1 mengunci baris `attendance_corrections`.
    Transaksi 2 menunggu (`WAIT FOR LOCK`).
    Setelah Transaksi 1 melakukan commit (`applied_at = NOW()`), Transaksi 2 membaca kembali baris tersebut di bawah isolasi `READ COMMITTED`.
    Karena `applied_at IS NULL` tidak lagi terpenuhi, kueri Transaksi 2 mengembalikan 0 baris (`v_approved_corr.id IS NULL`), dan Transaksi 2 langsung melempar `RAISE EXCEPTION 'Koreksi presensi ditolak: Tidak ditemukan dokumen koreksi berstatus APPROVED yang sah, belum digunakan, dan sesuai persis...'`.
- **Evaluasi Risiko Deadlock:**
  - Operasi UPDATE langsung pada `attendance_corrections` (persetujuan/penolakan oleh operator) **tidak pernah** mengunci tabel `attendance_records`.
  - Oleh karena itu, penguncian bersifat satu arah (unidirectional).
  - **Pernyataan Batas Bukti:** Meskipun desain satu arah merupakan mitigasi standar terhadap deadlock, **risiko deadlock tidak dapat dinyatakan 0% secara teoritis atau tanpa beban kerja multi-koneksi di lingkungan runtime PostgreSQL sesungguhnya**.
- **Klasifikasi:** **PASS (Statis)** / **NOT VERIFIED (Runtime Concurrency Engine)**.

---

### 3.5 Validasi Server-Side Seluruh Jalur Tulis `attendance_records`
- **File:** `supabase/migrations/20261009000005_server_side_geofence_enforcement.sql` & `...000006_approval_workflow_integrity.sql`
- **Fungsi / Trigger:** `enforce_attendance_geofence_safety()`
- **Bukti Validasi:**
  1. **Koordinat Tidak Terkonfirmasi Ditolak Mutlak (ADR-012):**
     ```sql
     SELECT value INTO v_office_confirmed_str
     FROM public.system_settings
     WHERE key = 'OFFICE_COORDINATES_CONFIRMED' LIMIT 1;

     IF v_office_confirmed_str IS NULL OR LOWER(TRIM(v_office_confirmed_str)) != 'true' THEN
         RAISE EXCEPTION 'Presensi kantor ditolak: Koordinat resmi kantor desa belum dikonfirmasi oleh Administrator. Geofence operasional belum aktif.';
     END IF;
     ```
  2. **Kelengkapan Pasangan & Rentang Koordinat Bumi:**
     - Penolakan koordinat parsial (latitude ada tapi longitude null, atau sebaliknya).
     - Validasi matematis: latitude $\in [-90, +90]$, longitude $\in [-180, +180]$.
  3. **Kalkulasi Haversine Otoritatif di Database:**
     - Jarak dihitung di PostgreSQL menggunakan `calculate_haversine_distance_meters()`.
     - `NEW.check_in_distance_meters` dan `NEW.check_out_distance_meters` diisi langsung oleh database. Nilai input dari client ditimpa secara otoritatif.
  4. **Penolakan di Luar Radius:**
     - Jika jarak $> \text{v\_effective\_radius}$, transaksi ditolak dengan `RAISE EXCEPTION`.
  5. **Pengecualian Jalur DINAS_LUAR:**
     - Wajib menyertakan `dl_assignment_id` yang sah, milik aparatur terkait, tanggal presensi berada dalam rentang `[start_date, end_date]`, status surat tugas dalam `('APPROVED', 'RATIFIED')`, dan foto selfie kehadiran wajib disertakan.
  6. **Imutabilitas GPS Historis Saat UPDATE:**
     - Koordinat dan jarak check-in historis dilarang dimutasi oleh siapa pun.
     - Koordinat dan jarak check-out historis dilarang dimutasi setelah check-out selesai.
- **Klasifikasi:** **PASS**.

---

### 3.6 Konteks Hak Istimewa, RLS, dan Identitas Aktor
- **File:** `supabase/migrations/20261009000002_row_level_security.sql`, `...000005_...sql`, `...000006_...sql`
- **Temuan & Mitigasi:**
  1. **Search Path Hijacking:**
     Seluruh fungsi `SECURITY DEFINER` menyertakan `SET search_path = public, pg_temp` untuk mencegah eskalasi hak istimewa melalui skema temporer pengguna.
  2. **Pembedaan Konteks Sesi Administratif vs PostgREST:**
     Penggunaan `session_user IN ('postgres', 'supabase_admin') AND auth.uid() IS NULL` memastikan bahwa pemeliharaan langsung via `psql` / migrasi diizinkan, sedangkan seluruh panggilan PostgREST via API wajib menyertakan `auth.uid()` yang sah:
     ```sql
     IF auth.uid() IS NULL THEN
         RAISE EXCEPTION 'Aksi ditolak: sesi autentikasi pengguna tidak valid atau anonim.';
     END IF;
     ```
  3. **Penutupan Permukaan Serangan RPC Haversine:**
     ```sql
     REVOKE EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(...) FROM PUBLIC, authenticated, anon;
     GRANT EXECUTE ON FUNCTION public.calculate_haversine_distance_meters(...) TO postgres, supabase_admin;
     ```
  4. **Audit Log WORM (Write Once, Read Many):**
     Hak `INSERT, UPDATE, DELETE` pada `audit_logs` dicabut dari peran klien. Penulisan log hanya dapat dilakukan melalui fungsi terpercaya `record_system_audit_event()`. Mutasi atau penghapusan log audit ditolak mutlak oleh trigger `trg_deny_audit_logs_mutation`.
- **Klasifikasi:** **PASS (Statis)** / **NOT VERIFIED (Runtime Session Context)**.

---

### 3.7 Konsistensi Migrasi Fresh-Install vs Upgrade & Analisis Skema Drift
- **File:** Migrasi 001 s.d. 006
- **Analisis Riwayat File:**
  - Migrasi 001 (`initial_schema`) telah diselaraskan agar menyertakan kolom `is_early_leave`, `early_leave_minutes`, `early_leave_reason`, `dl_assignment_id`, `applied_at`, dan `applied_by`.
  - Migrasi 004, 005, dan 006 menyertakan klausa `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` yang idempoten.
- **Evaluasi Fresh vs Upgrade:**
  - **Fresh Database:** Eksekusi 001 s.d. 006 secara berurutan akan berjalan mulus karena klausa penambahan kolom menggunakan `IF NOT EXISTS` dan trigger menggunakan `CREATE OR REPLACE` serta `DROP TRIGGER IF EXISTS`.
  - **Existing/Upgrade Database:** Jika migrasi 001 telah diaplikasikan sebelumnya tanpa kolom terbaru, migrasi 004, 005, dan 006 akan menambahkan kolom tersebut tanpa merusak data yang sudah ada.
- **Batasan Bukti & Skema Drift:**
  - **Prinsip Kejujuran Teknis:** Idempotensi sintaks SQL **TIDAK SAMA** dengan pembuktian nol drift (*zero drift*).
  - Tanpa dua lingkungan PostgreSQL nyata yang dapat dibandingkan menggunakan utilitas `pg_dump -s` dan perbandingan diff skema biner, konvergensi skema skrip migrasi terhadap state database nyata **TIDAK DAPAT** dinyatakan 100% zero-drift.
- **Klasifikasi:** **PASS (Statis Idempoten)** / **NOT VERIFIED (Runtime Schema Drift Diff)**.

---

## 4. Hasil Pengujian Aplikasi Aktual (Offline)

Seluruh pengujian dijalankan ulang di lingkungan lokal untuk memastikan tidak ada regresi pada kode aplikasi:

```bash
# Perintah 1: Test Suite Lengkap
npm test
# Hasil: 12 test files passed, 65 tests passed (100%), durasi 15.97s, Exit Code: 0

# Perintah 2: Static Typecheck
npm run typecheck
# Hasil: tsc --noEmit selesai tanpa error, Exit Code: 0

# Perintah 3: Production Build
npm run build
# Hasil: Vite v6.4.4 compiled 1982 modules into dist/ secara bersih dalam 7.87s, Exit Code: 0
```

### Pemisahan Kategori Pengujian yang Jelas:
1. **Analisis SQL Statis:** **PASS** (Seluruh 7 area pemeriksaan memenuhi kriteria keamanan).
2. **Pengujian Aplikasi Offline (Vitest + Typecheck + Build):** **PASS** (65 unit tests lulus 100%, 0 error typecheck, bundle build bersih).
3. **Pengujian Runtime PostgreSQL Lokal:** **NOT VERIFIED** (Engine PostgreSQL lokal / Docker tidak terpasang di host Windows pengembang).
4. **Pengujian Supabase / PostgREST Live:** **NOT VERIFIED** (Koneksi jaringan dan endpoint diverifikasi terhubung, tetapi migrasi DDL live belum dijalankan sesuai batasan instruksi).
5. **Keputusan Manusia yang Diperlukan:**
   - Konfirmasi titik koordinat definitif kantor Desa Sukamaju oleh Administrator Desa (menggantikan koordinat simulasi `-6.4828, 106.8436`).
   - Persetujuan formal pengguna untuk mengeksekusi migrasi 001–006 di Supabase Dashboard SQL Editor.

---

## 5. Keputusan Rekomendasi Gerbang (Gate Recommendation)

Berdasarkan tinjauan mendalam atas kode sumber SQL aktual, remediasi regresi geofence pada migrasi 006, serta keberhasilan 100% pengujian offline:

### **STATUS REKOMENDASI: READY FOR RUNTIME VALIDATION**

> **Catatan Auditor:**  
> Status ini menyatakan bahwa seluruh berkas SQL migrasi 001–006 telah lolos audit sumber statis dan siap untuk diuji pada runtime PostgreSQL / Supabase yang sesungguhnya. Dokumen ini **TIDAK** menyatakan Backend Stage 1 *final-approved*, karena persetujuan akhir Backend Stage 1 mensyaratkan validasi runtime database nyata setelah migrasi dieksekusi atas izin pengguna.
