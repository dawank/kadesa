# PEMETAAN ALUR DATA LINTAS LAPISAN (FRONTEND TO BACKEND DATA FLOW)

**Tanggal:** 11 Oktober 2026  
**Metodologi:** Penelusuran Jalur Penuh (*Full-Path Tracing*):  
`Requirement → UI Component → State Management → Service Layer → PostgREST API / RPC → Database (Tables, Constraints, Triggers) → Authorization (RLS) → Response Handling → Automated Tests`

---

## 1. Domain A: Autentikasi dan Manajemen Sesi

```mermaid
sequenceDiagram
    autonumber
    actor User as Aparatur Desa
    participant UI as LoginPage.tsx
    participant Ctx as AuthContext.tsx
    participant Svc as authService.ts
    participant SupaAuth as Supabase Auth (GoTrue)
    participant DB as public.users
    participant Audit as auditService.ts

    User->>UI: Input username & password
    UI->>Ctx: login(username, password)
    Ctx->>Svc: authService.login(username, password)
    Svc->>SupaAuth: signInWithPassword({ email: username + '@desa.local', password })
    alt Kredensial Valid
        SupaAuth-->>Svc: JWT Session (Access Token & Refresh Token)
        Svc->>DB: SELECT * FROM users WHERE auth_user_id = session.user.id
        DB-->>Svc: Data Profil Aparatur (active=true, role, jabatan)
        Svc->>Audit: Catat event LOGIN_SUCCESS ke public.audit_logs
        Svc-->>Ctx: ApiResponse<AuthSession>
        Ctx->>Ctx: setCurrentUser(user), isAuthenticated=true
        Ctx-->>UI: Navigasi otomatis ke /dashboard
    else Kredensial Salah / Akun Nonaktif
        SupaAuth-->>Svc: AuthApiError: Invalid login credentials
        Svc->>Audit: Catat event LOGIN_FAILED ke public.audit_logs
        Svc-->>Ctx: ApiResponse<Error>
        Ctx-->>UI: Tampilkan toast notifikasi peringatan
    end
```

- **Integritas Waktu Sesi:** Token sesi di-*refresh* otomatis oleh SDK `@supabase/supabase-js`. Durasi kedaluwarsa diselaraskan dengan parameter `SESSION_TIMEOUT_MINUTES` pada `system_settings`.
- **Proteksi Identitas:** Identitas aktor operasi sensitif diambil dari `auth.uid()` pada header JWT, bukan dari payload client.
- **Pembuktian Test:** `src/test/auth.test.ts`, `src/test/password_management.test.ts`.

---

## 2. Domain B & C: Pengaturan Sistem & Master Data Desa

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Super Admin / Operator
    participant UI as SystemSettingsPage.tsx (Inline Tab)
    participant Map as LocationPickerMap.tsx (Leaflet)
    participant Svc as settingsService.ts / masterService.ts
    participant DB as public.system_settings & public.villages
    participant Audit as public.audit_logs

    Admin->>UI: Ubah parameter di tab Geofence / Alur Kerja / Bukti / Keamanan
    Note over UI: State form ditandai 'isDirty', tombol Simpan Perubahan aktif
    Admin->>UI: Klik tombol 'Simpan Perubahan'
    UI->>Svc: updateSetting(key, newValue, effectiveDate, actor)
    Svc->>DB: UPDATE system_settings SET value = newValue, effective_from = ... WHERE key = ...
    DB-->>Svc: Row updated
    Svc->>Audit: INSERT INTO audit_logs (actor, action='UPDATE_SETTING', details)
    Svc-->>UI: ApiResponse.success = true
    UI->>UI: Tampilkan toast sukses, mutasi snapshot ke state terbaru (dirty=false)
```

- **Penyimpanan Selektif:** Hanya mengirim parameter yang terbukti berubah (*dirty checking*) terhadap snapshot backend.
- **Konsistensi Peta & Profil:** Pengubahan koordinat kantor pada tab Geofence menyinkronkan data ke `public.villages` (`latitude`, `longitude`, `alamat`) dan `public.system_settings` (`OFFICE_COORDINATES`).
- **Pembuktian Test:** `src/test/settings.test.ts`, `src/test/branding.test.ts`.

---

## 3. Domain D: Presensi Masuk (Check-In) dan Pulang (Check-Out) Kantor

```mermaid
sequenceDiagram
    autonumber
    actor Aparatur as Perangkat Desa
    participant UI as PresensiRegulerPage.tsx
    participant GPS as Geolocation API Browser
    participant Svc as attendanceService.ts
    participant DB as public.attendance_records
    participant Trg as Trigger: enforce_attendance_geofence_safety()

    Aparatur->>UI: Klik 'Catat Kehadiran Masuk'
    UI->>GPS: getCurrentPosition()
    GPS-->>UI: Latitude, Longitude, Accuracy (meters)
    UI->>Svc: checkIn({ lat, lng, address })
    Svc->>DB: INSERT INTO attendance_records (user_id, attendance_date, check_in_latitude, ...)
    DB->>Trg: BEFORE INSERT EXECUTE
    Note over Trg: 1. Periksa apakah koordinat kantor terkonfirmasi<br>2. Hitung jarak Haversine server-side<br>3. Pastikan jarak <= radius efektif desa (misal 100m)
    alt Di Dalam Radius Geofence
        Trg-->>DB: Lulus validasi
        DB-->>Svc: Row attendance_record created (status: HADIR/TERLAMBAT)
        Svc-->>UI: ApiResponse.success = true
        UI-->>Aparatur: Tampilkan badge kehadiran hijau & waktu resmi server
    else Di Luar Radius Geofence
        Trg-->>DB: RAISE EXCEPTION 'Presensi ditolak: Anda berada di luar radius kantor desa'
        DB-->>Svc: PostgREST Error (PGRST Exception)
        Svc-->>UI: ApiResponse.success = false, message error
        UI-->>Aparatur: Tampilkan peringatan jarak & gagal simpan
    end
```

- **Waktu Resmi Server:** Waktu pencatatan kehadiran menggunakan fungsi database `NOW()` / `CURRENT_DATE`, menolak manipulasi jam perangkat pengguna.
- **Pencegahan Duplikasi:** Constraint database `uq_user_attendance_date UNIQUE(user_id, attendance_date)` menolak transaksi presensi masuk ganda pada hari yang sama.
- **Pulang Cepat (ADR-010):** Jika presensi pulang dicatat sebelum jam kerja berakhir, sistem mencatat `is_early_leave=true`, `early_leave_reason`, dan `early_leave_minutes` tanpa mengubah status primer `HADIR`/`TERLAMBAT` menjadi `PULANG_CEPAT`.
- **Pembuktian Test:** `src/test/attendance.test.ts`.

---

## 4. Domain E: Penugasan dan Presensi Dinas Luar (DL)

```mermaid
sequenceDiagram
    autonumber
    actor Staff as Aparatur Desa
    actor Sekdes as Verifikator (Sekdes/Operator)
    actor Kades as Kepala Desa
    participant UI as DinasLuarListPage / DetailPage / PresensiPage
    participant Svc as dlService.ts
    participant DB as public.dl_assignments & public.dl_evidence
    participant AttDB as public.attendance_records

    Staff->>UI: Ajukan Surat Tugas DL (/dl/create)
    UI->>Svc: createAssignment({ purpose, startDate, endDate, locations })
    Svc->>DB: INSERT INTO dl_assignments (state='PENDING')
    Sekdes->>UI: Buka /dl/:id, verifikasi keabsahan dokumen
    UI->>Svc: verifyAssignment(id)
    Svc->>DB: UPDATE dl_assignments SET state='VERIFIED' WHERE state='PENDING'
    Kades->>UI: Setujui penugasan DL
    UI->>Svc: approveAssignment(id)
    Svc->>DB: UPDATE dl_assignments SET state='APPROVED' WHERE state='VERIFIED'
    
    Note over Staff: Pada hari penugasan, Staff bertugas di lokasi DL
    Staff->>UI: Catat presensi DL (/dl/presensi/:id) dengan selfie & GPS
    UI->>Svc: checkInDL({ assignmentId, photoBlob, lat, lng })
    Svc->>DB: Simpan foto ke Storage, simpan koordinat ke dl_evidence
    Svc->>AttDB: INSERT INTO attendance_records (type='DINAS_LUAR', status='DINAS_LUAR', dl_assignment_id)
    
    Note over Kades: Setelah kegiatan selesai, Kades meratifikasi laporan
    Kades->>UI: Klik 'Ratifikasi Laporan DL'
    UI->>Svc: ratifyAssignment(id)
    Svc->>DB: UPDATE dl_assignments SET state='RATIFIED' WHERE state='APPROVED'
```

- **Kewajiban Jam Kerja:** Selesainya kegiatan Dinas Luar tidak otomatis mengakhiri kewajiban kerja harian aparatur desa.
- **Integritas Bukti:** Presensi Dinas Luar mewajibkan swafoto (selfie) dan geotag koordinat GPS yang disimpan ke tabel `dl_evidence`.
- **Eksklusivitas Ratifikasi:** Trigger SQL memastikan hanya akun dengan role `KEPALA_DESA` yang memiliki hak meratifikasi surat tugas DL.
- **Pembuktian Test:** `src/test/dl.test.ts`.

---

## 5. Domain F: Alur Izin, Sakit, Cuti, dan Koreksi Presensi

1. **Izin & Sakit:** Diajukan oleh aparatur, dapat disetujui oleh Operator, Sekretaris Desa, atau Kepala Desa. Status langsung tercatat pada rekap kehadiran harian.
2. **Cuti Tahunan & Alasan Penting:** Diajukan oleh aparatur, diverifikasi oleh Sekretaris Desa atau Operator, dan **persetujuan akhir wajib dilakukan oleh Kepala Desa** (`KEPALA_DESA`).
3. **Koreksi Presensi (Attendance Correction):**
   - Diajukan melalui form koreksi non-destruktif dengan alasan logis.
   - Hanya dapat disetujui dan diterapkan oleh `OPERATOR_DESA`.
   - Data asli tersimpan pada kolom `original_check_in`, `original_check_out`, dan `original_status` di `attendance_records` untuk audit jejak.
- **Pembuktian Test:** `src/test/absence_correction.test.ts`.

---

## 6. Domain H, I, J: Pelaporan, Dashboard, dan Audit Trail

1. **Dashboard & Monitoring:** Mengambil agregasi langsung dari query Supabase (`status`, `attendance_date = CURRENT_DATE`), menampilkan kartu statistik real-time tanpa angka fiktif. Jika data belum tersedia, menampilkan *empty state*.
2. **Laporan & Ekspor:** Mengambil master data profil desa dan konfigurasi kop surat dinas yang aktif dari `system_settings`, menghasilkan rekap kehadiran PDF/Excel resmi.
3. **Audit Log:** Seluruh peristiwa autentikasi, modifikasi master data, pengaturan sistem, persetujuan cuti, dan koreksi presensi dicatat secara permanen pada tabel `public.audit_logs`. RLS melarang mutlak operasi `DELETE` dan `UPDATE` pada tabel ini.
- **Pembuktian Test:** `src/test/report_audit.test.ts`, `src/test/supabase_production_fallback.test.ts`.
