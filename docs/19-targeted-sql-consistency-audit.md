# KADESA — Laporan Targeted SQL Consistency Audit Before Backend Gate Approval

**Tanggal:** 09 Oktober 2026  
**Status Gate:** TARGETED SQL CONSISTENCY AUDIT PASSED & HARDENED (OFFLINE / PRE-LIVE GATE)  
**Tautan Terkait:**
- [`supabase/migrations/20261009000006_approval_workflow_integrity.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000006_approval_workflow_integrity.sql)
- [`supabase/migrations/20261009000005_server_side_geofence_enforcement.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000005_server_side_geofence_enforcement.sql)
- [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql)
- [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql)
- [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts)

---

## 1. Audit Konflik Lifecycle Koreksi Presensi

### A. Penelusuran Urutan Aktual Eksekusi SQL
Ketika presensi diperbarui dengan merujuk dokumen koreksi berstatus `APPROVED`, urutan eksekusi internal database adalah sebagai berikut:

```
[1. Klien mengirim UPDATE pada attendance_records]
       │
       ▼
[2. BEFORE UPDATE Trigger: enforce_attendance_geofence_safety()]
       │
       ├─► Mengecek status auth dan keabsahan identitas aparatur.
       ├─► SELECT ... FROM attendance_corrections ... FOR UPDATE (Row Lock Eksklusif).
       ├─► Memverifikasi nilai persis (check_in_at, check_out_at, status).
       ├─► Mengatur konteks transaksi lokal:
       │     PERFORM set_config('kadesa.applying_correction_id', v_approved_corr.id, true);
       │
       ├─► Menandai konsumsi koreksi:
       │     UPDATE public.attendance_corrections
       │     SET applied_at = NOW(), applied_by = ... WHERE id = v_approved_corr.id;
       │           │
       │           ▼
       │     [BEFORE UPDATE Trigger: enforce_attendance_correction_lifecycle()]
       │           │
       │           ├─► Memeriksa apakah applied_at diubah saat OLD.applied_at IS NULL.
       │           ├─► Memverifikasi current_setting('kadesa.applying_correction_id', true) = OLD.id.
       │           ├─► Memverifikasi TIDAK ADA kolom lain yang dimutasi (nilai koreksi, snapshot, alasan).
       │           └─► Mengizinkan konsumsi: RETURN NEW.
       │
       ├─► Membersihkan konteks transaksi lokal:
       │     PERFORM set_config('kadesa.applying_correction_id', '', true);
       │
       ├─► Mencatat log audit atomik:
       │     PERFORM public.record_system_audit_event('APPLY_ATTENDANCE_CORRECTION', ...);
       │
       └─► Mengizinkan pembaruan presensi: RETURN NEW.
```

### B. Bukti Pencegahan Konflik & Penutupan Celah
1. **Apakah pembaruan `applied_at` memicu lifecycle trigger yang menolak UPDATE?**
   * *Analisis Celah:* Pada implementasi umum, jika trigger `attendance_corrections` menerapkan aturan `IF OLD.state IN ('APPROVED', 'REJECTED') THEN RAISE EXCEPTION ...`, maka pembaruan internal `applied_at` oleh sistem presensi akan **bertabrakan dan ditolak sendiri** oleh trigger lifecycle koreksi.
   * *Solusi Terarah:* Diciptakan jalur konsumsi tervalidasi berbasis variabel transaksi `kadesa.applying_correction_id`. Pembaruan `applied_at` hanya diizinkan jika `current_setting('kadesa.applying_correction_id', true)` cocok dengan `OLD.id`. Pemanggilan langsung via PostgREST yang mencoba mengisi atau mereset `applied_at` ditolak seketika (`RAISE EXCEPTION 'Pemberian tanda konsumsi koreksi (applied_at) hanya sah melalui alur presensi resmi.'`).
2. **Immutability Nilai Koreksi Saat Konsumsi:**
   Trigger memastikan bahwa saat `applied_at` diisi, **TIDAK ADA kolom usulan, data asli, atau metadata persetujuan yang berubah**:
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
3. **Pencegahan Reset / Replay Setelah Dikonsumsi:**
   Setelah suatu baris memiliki `applied_at IS NOT NULL`, baris tersebut terkunci permanen:
   ```sql
   IF OLD.applied_at IS NOT NULL THEN
       IF NEW.applied_at IS DISTINCT FROM OLD.applied_at OR ... THEN
           RAISE EXCEPTION 'Koreksi yang telah diterapkan bersifat permanen dan tidak dapat diubah atau digunakan ulang.';
       END IF;
   END IF;
   ```
4. **Jaminan Atomisitas Transaksi:**
   Seluruh mutasi pada `attendance_records`, pembaruan `applied_at` pada `attendance_corrections`, dan penulisan catatan `audit_logs` dieksekusi dalam satu transaksi atomik. Jika salah satu gagal atau melanggar constraint, seluruh operasi di-rollback secara utuh.

---

## 2. Audit Konkurensi & Analisis Risiko Deadlock

### A. Evaluasi Skenario Konkurensi

| Skenario Konkurensi | Mekanisme Penanganan di Tingkat SQL | Batas Bukti & Status |
|---|---|---|
| **Dua transaksi mencoba memakai persetujuan yang sama** | Query pencarian koreksi menggunakan kunci baris eksklusif `FOR UPDATE`:<br>Transaksi 1 mengunci baris target di `attendance_corrections`. Transaksi 2 terblokir menunggu lock. Setelah Transaksi 1 commit dengan `applied_at = NOW()`, Transaksi 2 mengevaluasi ulang predikat `applied_at IS NULL` dan gagal menemukan baris sah, lalu memicu `RAISE EXCEPTION`. | **MITIGATED (Static Inspection Pass, Runtime NOT VERIFIED)** |
| **Dua koreksi berbeda merujuk pada presensi yang sama** | Transaksi 1 yang mengeksekusi `UPDATE attendance_records` memegang row lock pada rekaman presensi tersebut. Transaksi 2 yang mencoba mengubah presensi yang sama akan terantre menunggu Transaksi 1 selesai. Setelah Transaksi 1 selesai, Transaksi 2 mengevaluasi nilai presensi yang sudah ter-update. | **MITIGATED (Static Inspection Pass, Runtime NOT VERIFIED)** |
| **Kegagalan saat menandai persetujuan sebagai terpakai** | Jika trigger `enforce_attendance_correction_lifecycle` melempar exception saat pembaruan `applied_at`, maka transaksi PostgreSQL secara otomatis membatalkan seluruh operasi (Rollback), sehingga `attendance_records` tidak pernah berubah secara parsial. | **ACID ATOMIC (Static Inspection Pass, Runtime NOT VERIFIED)** |

### B. Evaluasi Risiko Deadlock & Batas Bukti yang Tersedia
* **Mekanisme Mitigasi:**
  Sistem menerapkan pengurutan penguncian searah (**Unidirectional Lock Ordering**):
  $\text{attendance\_records} \xrightarrow{\quad\text{DML Lock}\quad} \text{attendance\_corrections} \xrightarrow{\quad\text{FOR UPDATE Lock}\quad} \text{audit\_logs}$
  Tidak ada alur di kode database yang mengunci `attendance_corrections` terlebih dahulu lalu memutasi `attendance_records`.
* **Batas Bukti yang Tersedia:**
  **Risiko deadlock tidak dapat dinyatakan 0%.** Meskipun mitigasi desain arsitektur lock ordering telah diterapkan, bukti matematis bebas deadlock mutlak pada sistem konkuren nyata mensyaratkan pengujian runtime dengan beban paralel multi-klien (`pgbench` / concurrency runner pada engine database aktif). Karena database lokal / Docker tidak tersedia di lingkungan ini, hasil pengujian konkurensi runtime secara transparan diklasifikasikan sebagai **`NOT VERIFIED`**.

---

## 3. Audit Finalitas Alur Dinas Luar (DL)

### A. Finalitas Status `RATIFIED`
Trigger [`enforce_dl_assignment_lifecycle()`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000006_approval_workflow_integrity.sql#L291-L320) kini mengunci status terminal secara mutlak:

```sql
IF OLD.state IN ('RATIFIED', 'REJECTED', 'CANCELLED') THEN
    IF NEW.state IS DISTINCT FROM OLD.state THEN
        RAISE EXCEPTION 'Surat tugas Dinas Luar berstatus % bersifat final dan tidak dapat diubah lagi.', OLD.state;
    END IF;

    -- Parameter penugasan dan pengesahan tidak boleh dimodifikasi pada status terminal
    IF NEW.purpose IS DISTINCT FROM OLD.purpose
       OR NEW.start_date IS DISTINCT FROM OLD.start_date
       OR NEW.end_date IS DISTINCT FROM OLD.end_date
       OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
       OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
       OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
       OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
       OR NEW.ratified_by IS DISTINCT FROM OLD.ratified_by
       OR NEW.ratified_at IS DISTINCT FROM OLD.ratified_at
       OR NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason
       OR NEW.cancellation_reason IS DISTINCT FROM OLD.cancellation_reason THEN
        RAISE EXCEPTION 'Surat tugas berstatus % bersifat immutable dan tidak dapat diubah.', OLD.state;
    END IF;
    RETURN NEW;
END IF;
```

### B. Evaluasi Konsistensi dengan Aturan Bisnis Terkunci
* Status `RATIFIED`: HANYA Kepala Desa (`KEPALA_DESA`) atau Super Admin yang berwenang menetapkannya dari status `APPROVED` (PRD Section 12.3).
* Status `REJECTED`: Wajib menyertakan `rejection_reason` (tidak boleh kosong/null).
* Status `CANCELLED`: Wajib menyertakan `cancellation_reason` (tidak boleh kosong/null).
* Identitas `requester_user_id` dan `subject_user_id`: Terkunci immutable pada seluruh operasi `UPDATE`.
* **Kesesuaian:** 100% selaras dengan baseline bisnis KADESA. **NOL BLOCKER (0 BLOCKER)**.

---

## 4. Audit Strategi Migrasi Fresh vs Upgrade

### A. Evaluasi Riwayat Berkas Migrasi 001–006
* `001_initial_schema.sql`: 14 tabel awal, tipe enum, indeks, trigger timestamp, kolom pelacak `applied_at` & `applied_by`.
* `002_row_level_security.sql`: Kebijakan RLS dasar, helper otorisasi, proteksi `auth_user_id`, audit log WORM.
* `003_seed_data.sql`: Data inisialisasi Desa Sukamaju (`OFFICE_COORDINATES_CONFIRMED = 'false'`).
* `004_early_leave_attributes.sql`: Penyesuaian atribut kepulangan awal secara idempoten.
* `005_server_side_geofence_enforcement.sql`: Haversine PL/pgSQL internal, boundary geografis, anti-tampering GPS historis.
* `006_approval_workflow_integrity.sql`: Penegakan state machine DL, konsumsi koreksi tervalidasi via setting transaksi, row lock `FOR UPDATE`, dan finalitas status terminal.

### B. Batas Pembuktian Konvergensi Skema (Idempotensi vs Zero Drift)
* **Idempotensi SQL:** Seluruh DDL pada migrasi 004, 005, dan 006 dirancang dengan guard idempoten (`CREATE OR REPLACE FUNCTION`, `ADD COLUMN IF NOT EXISTS`, `DROP TRIGGER IF EXISTS ... CREATE TRIGGER`, `DROP POLICY IF EXISTS ... CREATE POLICY`).
* **Batas Pembuktian Runtime:**
  **Idempotensi sintaksis SQL tidak sama dengan bukti zero drift pada runtime database.** Konvergensi skema fisik secara formal hanya dapat dibuktikan jika terdapat perbandingan skema fisik riil (`pg_dump -s` atau skema inspection diff) antara database yang dibangun dari awal (*fresh install*) dan database yang di-upgrade. Karena PostgreSQL runtime tidak aktif di host lokal, konvergensi skema runtime diklasifikasikan secara transparan sebagai **`NOT VERIFIED — Runtime schema diff pending database deployment`**.
* **Rekomendasi Prosedur Penerapan:**
  Karena database Supabase Cloud saat ini masih berstatus **kosong/fresh (belum ada tabel KADESA)**, prosedur yang wajib dijalankan adalah **mengeksekusi seluruh berkas migrasi `001 -> 002 -> 003 -> 004 -> 005 -> 006` secara berurutan dari awal**, bukan mengasumsikan database parsial.

---

## 5. Klasifikasi Transparan Hasil Pengujian

| Lapisan Verifikasi | Objek Uji | Hasil Aktual | Keterangan & Batas Validitas |
|---|---|---|---|
| **1. Static SQL Analysis** | Berkas migrasi `001–006` | **PASS** | Tidak ada konflik lifecycle koreksi, jalur konsumsi terkunci via setting transaksi, finalitas status DL ditegakkan, dan immutability field terpenuhi. |
| **2. Offline Test Suite** | 12 test files (Vitest v3.2.7) | **PASS (65/65 tests, 100%)** | Seluruh unit test suite lulus dalam 15.42s (mencakup verifikasi migrasi 006, konteks transaksi, terminal status, dan role matrix). |
| **3. Static Typecheck** | TypeScript 5.8 (`tsc --noEmit`) | **PASS (0 errors)** | Seluruh tipe TypeScript sinkron dengan skema database. |
| **4. Frontend Production Build** | Vite 6.4.4 (`vite build`) | **PASS** | Bundle produksi terkompilasi bersih dalam 7.10s. |
| **5. PostgreSQL Runtime Test** | DML Trigger & Concurrency Lock di Local DB | **NOT VERIFIED** | PostgreSQL / Docker tidak terpasang di host lokal Windows. Ditandai jujur **NOT VERIFIED**. |
| **6. Supabase Cloud Live Test** | Live DML & RLS di Project Supabase Cloud | **NOT VERIFIED** | Sesuai batas tindakan, migrasi live **tidak dijalankan** dan data cloud tidak diubah. |

---

## 6. Hal yang Memerlukan Keputusan Manusia (Human Decision Blockers)

1. **Konfirmasi Koordinat Resmi Kantor Desa:**
   Titik koordinat kantor desa saat ini (`-6.4828, 106.8436`) merupakan data simulasi pengujian. Parameter `OFFICE_COORDINATES_CONFIRMED` wajib tetap bernilai `'false'` sampai Administrator Desa menginput titik koordinat definitif kantor Desa Sukamaju.
2. **Persetujuan Eksekusi Migrasi Live:**
   Migrasi `001–006` siap diaplikasikan pada Supabase Dashboard SQL Editor saat pengguna memberikan persetujuan tertulis.

*Sistem berhenti di sini sesuai batasan instruksi mutlak dan menunggu arahan pengguna selanjutnya.*
