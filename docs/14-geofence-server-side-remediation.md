# KADESA — Laporan Remediasi Keamanan Geofence di Sisi Server (PostgreSQL)

**Tanggal:** 09 Oktober 2026  
**Status Gate:** REMEDIATED & HARDENED (OFFLINE / PRE-LIVE)  
**Tautan Terkait:**
- [`supabase/migrations/20261009000005_server_side_geofence_enforcement.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000005_server_side_geofence_enforcement.sql)
- [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql)
- [`src/services/attendanceService.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/services/attendanceService.ts)
- [`src/test/attendance.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/attendance.test.ts)
- [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts)

---

## 1. Konteks dan Latar Belakang Masalah

Pada audit keamanan sebelumnya, ditemukan bahwa fungsi trigger database `enforce_attendance_geofence_safety()` di `20261009000002_row_level_security.sql` hanya memeriksa status konfigurasi `OFFICE_COORDINATES_CONFIRMED`. Perhitungan jarak fisik (Haversine) hanya berada pada lapisan klien (`attendanceService.ts`).

### Dampak Kerentanan (Vulnerability Impact):
Jika seorang pengguna yang telah login mengirimkan request mutasi langsung via PostgREST API (`POST /attendance_records` atau `PATCH /attendance_records?id=eq.att-xxx`) menggunakan Supabase Anon/Publishable Key dengan JWT miliknya, pengguna tersebut secara teoritis dapat mengirimkan nilai latitude/longitude sembarang (misalnya dari rumah atau luar kota) dan mencatat kehadiran kantor reguler tanpa ditolak oleh database.

### Prinsip Remediasi KADESA:
1. **Database sebagai Sumber Kebenaran Otoritatif (Authoritative Source of Truth):** Seluruh aturan geofence wajib ditegakkan di level PostgreSQL trigger/constraint, independen dari kode frontend atau manipulasi PostgREST client.
2. **Dual-Layer Validation:** Frontend TypeScript tetap menjalankan validasi untuk umpan balik pengguna (UX instan), tetapi database adalah lapisan pemutus mutlak.
3. **Pemisahan Jalur DINAS_LUAR:** Presensi Dinas Luar dikecualikan dari batasan jarak kantor desa, namun tetap wajib mematuhi batas koordinat geografis dan menyertakan surat penugasan resmi (`dl_assignment_id`).
4. **Anti-Tampering Saat Check-Out:** Request check-out via API tidak boleh mengubah titik koordinat check-in yang sudah tervalidasi sebelumnya.

---

## 2. Inventarisasi Kolom, Skema, dan Sumber Data Terkait

Berdasarkan audit skema aktual pada [`supabase/migrations/20261009000001_initial_schema.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000001_initial_schema.sql):

| Entitas / Kolom | Tipe Data | Deskripsi & Peran |
|---|---|---|
| `attendance_records.type` | `attendance_type_enum` | Nilai: `'REGULAR'`, `'DINAS_LUAR'` |
| `attendance_records.check_in_latitude` | `DECIMAL(10, 8)` | Koordinat lintang saat masuk |
| `attendance_records.check_in_longitude` | `DECIMAL(11, 8)` | Koordinat bujur saat masuk |
| `attendance_records.check_in_distance_meters` | `INTEGER` | Jarak kalkulasi terhadap kantor desa (dihitung otomatis oleh DB) |
| `attendance_records.check_out_latitude` | `DECIMAL(10, 8)` | Koordinat lintang saat pulang |
| `attendance_records.check_out_longitude` | `DECIMAL(11, 8)` | Koordinat bujur saat pulang |
| `attendance_records.check_out_distance_meters` | `INTEGER` | Jarak pulang terhadap kantor desa (dihitung otomatis oleh DB) |
| `villages.latitude` & `longitude` | `DECIMAL(10, 8) / DECIMAL(11, 8)` | Titik koordinat pusat kantor desa yang sah |
| `villages.radius_meters` | `INTEGER` | Radius toleransi default kantor desa (contoh: 100m) |
| `system_settings.REGULAR_ATTENDANCE_RADIUS_METERS` | `TEXT` (`value_type: 'number'`) | Override radius operasional terpusat berbasis waktu efektif |
| `system_settings.OFFICE_COORDINATES_CONFIRMED` | `TEXT` (`value_type: 'boolean'`) | Flag kepastian koordinat resmi dari Administrator (`'true'` / `'false'`) |

---

## 3. Rancang Bangun Perbaikan di Sisi Database (PostgreSQL)

### A. Validasi Rentang Geografis (Table Constraints)
Pada tabel `villages`, ditambahkan validasi batas rentang bumi yang sah:
```sql
ALTER TABLE public.villages 
ADD CONSTRAINT chk_villages_latitude CHECK (latitude BETWEEN -90.0 AND 90.0);

ALTER TABLE public.villages 
ADD CONSTRAINT chk_villages_longitude CHECK (longitude BETWEEN -180.0 AND 180.0);
```

### B. Kalkulasi Jarak Haversine Murni di PostgreSQL (Tanpa Ketergantungan Ekstensi PostGIS)
Karena Supabase free tier atau database standar tidak selalu mengaktifkan PostGIS secara default, diimplementasikan fungsi Haversine murni matematis yang `IMMUTABLE`, `STRICT`, dan `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION public.calculate_haversine_distance_meters(
    p_lat1 DOUBLE PRECISION,
    p_lon1 DOUBLE PRECISION,
    p_lat2 DOUBLE PRECISION,
    p_lon2 DOUBLE PRECISION
)
RETURNS INTEGER AS $$
DECLARE
    r CONSTANT DOUBLE PRECISION := 6371000.0; -- Radius bumi (meter)
    d_lat DOUBLE PRECISION;
    d_lon DOUBLE PRECISION;
    a DOUBLE PRECISION;
    c DOUBLE PRECISION;
BEGIN
    IF p_lat1 IS NULL OR p_lon1 IS NULL OR p_lat2 IS NULL OR p_lon2 IS NULL THEN
        RETURN NULL;
    END IF;

    d_lat := RADIANS(p_lat2 - p_lat1);
    d_lon := RADIANS(p_lon2 - p_lon1);

    a := (SIN(d_lat / 2.0) * SIN(d_lat / 2.0)) +
         (COS(RADIANS(p_lat1)) * COS(RADIANS(p_lat2)) * SIN(d_lon / 2.0) * SIN(d_lon / 2.0));

    IF a > 1.0 THEN
        a := 1.0;
    END IF;

    c := 2.0 * ATAN2(SQRT(a), SQRT(1.0 - a));

    RETURN ROUND(r * c)::INTEGER;
END;
$$ LANGUAGE plpgsql IMMUTABLE STRICT SECURITY DEFINER SET search_path = public, pg_temp;
```

### C. Trigger Otoritatif `enforce_attendance_geofence_safety()`
Trigger ini dipasang pada `BEFORE INSERT OR UPDATE ON attendance_records` dengan alur validasi berikut:
1. **Bypass Admin Internal:** Migrasi/seed/maintenance CLI (`postgres`, `supabase_admin`, `service_role`) diizinkan untuk keperluan administrasi data.
2. **Validasi Batas Koordinat Transaksi:** Memastikan `check_in_latitude` [-90..90], `check_in_longitude` [-180..180], `check_out_latitude` [-90..90], `check_out_longitude` [-180..180]. Berlaku untuk seluruh tipe presensi.
3. **Pengecualian DINAS_LUAR:** Jika `NEW.type = 'DINAS_LUAR'`, evaluasi jarak terhadap kantor desa dilewati, namun koordinat tetap divalidasi rentangnya.
4. **Validasi REGULAR Presensi Kantor:**
   - **Pemeriksaan Konfirmasi:** Menolak transaksi jika `OFFICE_COORDINATES_CONFIRMED != 'true'`.
   - **Pengambilan Konfigurasi Terpusat Dinamis:** Mengambil koordinat dari `villages` dan radius dari `system_settings.REGULAR_ATTENDANCE_RADIUS_METERS` (fallback ke `villages.radius_meters`). Nilai tidak di-hardcode ke dalam kode trigger.
   - **Kalkulasi & Timpa Jarak Check-In:** Menghitung jarak via `calculate_haversine_distance_meters` dan secara otoritatif mengisi kolom `NEW.check_in_distance_meters`. Jika `v_check_in_dist > v_effective_radius`, transaksi dibatalkan (`RAISE EXCEPTION`).
   - **Kalkulasi & Validasi Check-Out:** Jika melakukan check-out dengan koordinat, jarak dihitung dan disimpan di `NEW.check_out_distance_meters`. Transaksi ditolak jika berada di luar radius kantor.
   - **Proteksi Anti-Tampering:** Saat operasi `UPDATE` oleh pengguna biasa, modifikasi terhadap `check_in_latitude`, `check_in_longitude`, `check_in_distance_meters`, atau `check_in_at` ditolak mutlak. Hanya Super Admin / Operator melalui jalur koreksi resmi yang diizinkan.

---

## 4. Strategi Migrasi yang Aman

Mengikuti kebijakan keselamatan migrasi:
1. **Migrasi Baru Berurutan (Incremental Migration):**  
   Dibuat file migrasi [`supabase/migrations/20261009000005_server_side_geofence_enforcement.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000005_server_side_geofence_enforcement.sql) yang menerapkan penambahan fungsi kalkulasi Haversine, pengecekan batas desa, dan pemasangan ulang trigger geofence yang diperkuat.
2. **Sinkronisasi Greenfield Deployment:**  
   File migrasi fondasi RLS [`supabase/migrations/20261009000002_row_level_security.sql`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/supabase/migrations/20261009000002_row_level_security.sql) diselaraskan agar instalasi database baru dari nol (fresh database) langsung memiliki fungsi kalkulasi Haversine dan trigger geofence otoritatif tanpa anomali urutan.
3. **Idempotensi Penuh:**  
   Seluruh perintah DDL menggunakan klausa kondisional `DO $$ ... IF NOT EXISTS`, `CREATE OR REPLACE FUNCTION`, dan `DROP TRIGGER IF EXISTS`.

---

## 5. Sinkronisasi Layer TypeScript & Umpan Balik Pengguna

Untuk memastikan integritas ujung ke ujung (end-to-end parity):
1. **Validasi Rentang Koordinat:**  
   Metode `validateGeofence()`, `checkIn()`, dan `checkOut()` pada [`src/services/attendanceService.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/services/attendanceService.ts) kini memvalidasi bahwa latitude berada pada rentang -90 hingga 90 dan longitude berada pada rentang -180 hingga 180 sebelum melakukan kalkulasi.
2. **Dukungan Alur DINAS_LUAR:**  
   `checkIn()` mendukung parameter `attendanceType: 'DINAS_LUAR'` dan `dlAssignmentId`. Presensi dinas luar tidak memeriksa jarak kantor desa, tetapi wajib menyertakan ID surat penugasan (`DL_ASSIGNMENT_REQUIRED`). Check-out dinas luar juga dibebaskan dari geofence kantor desa.
3. **Interface Type Definition:**  
   Tipe data [`AttendanceRecord`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/types/attendance.ts) dilengkapi properti `attendanceType?: 'REGULAR' | 'DINAS_LUAR'` dan `dlAssignmentId?: string | null`.

---

## 6. Hasil Pengujian dan Verifikasi

### A. Pengujian Otomatis (Vitest & TypeScript Compiler)
Seluruh pengujian dijalankan dan diverifikasi secara nyata:
- **TypeScript Typecheck:** `npm run typecheck` → **PASSED (0 Errors)**
- **Test Suite Lengkap:** `npm run test -- --run` → **PASSED (12 Test Files, 63 Tests Passed)**

### B. Rincian Test Cases yang Dijalankan:
1. **Dalam Radius (Inside Geofence):** Offset ~50m dari kantor desa (`-6.4828, 106.8436`) → Diterima (`ACCEPT`, `distanceMeters <= 100`).
2. **Tepat pada Batas Radius (Exact Boundary):** Titik pada jarak tepat 100m (`-6.481901, 106.8436`) → Diterima (`ACCEPT`, `distanceMeters = 100`).
3. **Tepat di Luar Batas Radius (Just Outside Boundary):** Titik pada jarak ~102m (`-6.48188, 106.8436`) → Ditolak (`REJECT`, `distanceMeters > 100`).
4. **Jauh di Luar Radius (Far Outside Radius):** Jarak 500m dan 15km → Ditolak (`REJECT`, `errorCode: OUT_OF_GEOFENCE`).
5. **Koordinat Tidak Valid (Invalid Coordinates):**
   - Latitude > 90 (`95.0`) → Ditolak (`INVALID_COORDINATES`).
   - Longitude > 180 (`185.0`) → Ditolak (`INVALID_COORDINATES`).
   - Latitude Check-Out < -90 (`-95.0`) → Ditolak (`INVALID_COORDINATES`).
6. **Kantor Belum Dikonfirmasi (Unconfirmed Office Coordinates):** Jika `OFFICE_COORDINATES_CONFIRMED = false`, presensi kantor ditolak (`OFFICE_LOCATION_UNCONFIRMED`).
7. **Validasi Geofence Check-Out:** Check-out di luar radius (500m) ditolak (`OUT_OF_GEOFENCE`).
8. **Proteksi Anti-Tampering Check-In saat Check-Out:** Titik koordinat check-in awal dijamin tidak berubah saat transaksi check-out dilakukan.
9. **Jalur DINAS_LUAR:**
   - Jarak 35km dari kantor desa dengan `dl_assignment_id` valid → Berhasil dicatat (`status: DINAS_LUAR`, bebas batasan radius kantor).
   - Presensi DINAS_LUAR tanpa `dl_assignment_id` → Ditolak (`DL_ASSIGNMENT_REQUIRED`).
   - Presensi DINAS_LUAR dengan koordinat invalid (lat > 90) → Ditolak (`INVALID_COORDINATES`).
   - Check-out DINAS_LUAR di luar radius desa → Berhasil dicatat.
10. **Verifikasi Integritas Migrasi Database 005:** [`src/test/backend_foundation.test.ts`](file:///d:/DAWANK/APLIKASI_TEST/KADESA/src/test/backend_foundation.test.ts) memvalidasi eksistensi migrasi 005, formula Haversine, batasan geografis desa, trigger geofence, dan pencabutan hak eksekusi publik.

### C. Klasifikasi Hasil Uji Runtime PostgreSQL:
> [!IMPORTANT]
> **Status Runtime Database:** `NOT VERIFIED — PostgreSQL runtime environment unavailable`  
> Karena Docker dan PostgreSQL lokal tidak tersedia di host kerja pengembang, dan migrasi langsung ke Supabase Live dilarang keras oleh batasan safety gate tugas ini, eksekusi runtime trigger di dalam engine PostgreSQL sesungguhnya **BELUM DIJALANKAN DI LIVE DATABASE**. Verifikasi saat ini mencakup verifikasi statis DDL/SQL, validasi sintaks logika, pengujian unit test mock vitest, dan compiler TypeScript.

---

## 7. Analisis Risiko Tersisa & Tindakan Pra-Live

1. **Akurasi Perhitungan Haversine Floating Point di PostgreSQL vs JavaScript:**  
   Fungsi SQL menggunakan `DOUBLE PRECISION` dan radius bumi $6.371.000$ meter yang identik dengan implementasi TypeScript. Variasi pembulatan dibatasi maksimal $\pm 1$ meter pada batas lingkaran.
2. **Kebutuhan Konfirmasi Koordinat Resmi:**  
   Titik koordinat kantor Desa Sukamaju pada seed data tetap berstatus data contoh simulasi (`OFFICE_COORDINATES_CONFIRMED = 'false'`). Operator/Admin desa wajib menyimpan koordinat definitif melalui halaman Profil Desa sebelum presensi operasional dapat berjalan di lapangan.
3. **Penerapan SQL di Supabase Live:**  
   Saat pengguna memberikan izin migrasi live, urutan eksekusi SQL di Supabase SQL Editor adalah:
   - `20261009000001_initial_schema.sql`
   - `20261009000002_row_level_security.sql` (sudah mencakup fungsi Haversine dan trigger geofence)
   - `20261009000003_seed_data.sql`
   - `20261009000004_early_leave_attributes.sql`
   - `20261009000005_server_side_geofence_enforcement.sql` (rekonsiliasi terpisah untuk database yang sudah terpasang)
