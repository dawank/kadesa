# Architectural Decisions (ADR) — KADESA Frontend

Dokumen ini mencatat keputusan arsitektural penting yang diambil selama implementasi frontend KADESA dan diteruskan ke tahap backend dan integrasi.

---

## ADR-001: Pemisahan Mutlak Peran Aplikasi (Role) vs Jabatan Organisasi

- **Konteks:** Dalam struktur pemerintahan desa, posisi seperti "Kaur Keuangan" atau "Kasi Pemerintahan" adalah jabatan organisasi, sedangkan peran dalam sistem adalah "Perangkat Desa". Kepala Desa memiliki peran "Kepala Desa" dan jabatan "Kepala Desa".
- **Keputusan:** Diimplementasikan tipe terpisah:
  - `UserRole = 'SUPER_ADMIN' | 'OPERATOR' | 'KEPALA_DESA' | 'SEKRETARIS_DESA' | 'PERANGKAT_DESA'`
  - `Position` sebagai entitas master data tersendiri yang direferensikan oleh `jabatanId`.
- **Dampak:** Frontend tidak pernah menyimpulkan hak akses (permission) berdasarkan string jabatan. Matriks hak akses murni dievaluasi berdasarkan `user.role`.

---

## ADR-002: Configuration-Driven Business Rules & Central Resolver

- **Konteks:** Parameter operasional desa seperti jam masuk kantor, toleransi keterlambatan, radius geofence, timezone, dan batas waktu ratifikasi DL tidak boleh di-hard-code di berbagai komponen UI (PRD Section 1, 36).
- **Keputusan:** Disediakan `settingsService` dengan metode `getActiveSetting(key, transactionDate)` yang mendukung penanggalan efektif (`effectiveFrom` dan `effectiveTo`). Timezone dinamis diambil melalui kunci `TIMEZONE`.
- **Dampak:** Perubahan pengaturan oleh Operator/Admin tidak mengubah histori presensi masa lalu secara retroaktif. Pada tahap backend, logika ini akan diteruskan ke RPC PostgreSQL.

---

## ADR-003: State Machine Berjenjang untuk Dinas Luar (DL) dan Cuti

- **Konteks:** Workflow DL dan Cuti memiliki tahapan verifikasi dan persetujuan yang melibatkan otoritas berbeda.
  - DL: `PENDING` → `VERIFIED` → `APPROVED` (Sekdes/Operator, mengaktifkan countdown 72 jam) → `RATIFIED` (khusus Kepala Desa). Kepala Desa juga memiliki hak direct approval / ratifikasi langsung.
  - Cuti: `SUBMITTED` → `VERIFIED` (Sekdes/Operator) → `APPROVED` (khusus Kepala Desa).
- **Keputusan:** Antarmuka dan service domain menyajikan alur state machine penuh dan linimasa approval dengan catatan otoritas pada setiap transisi status. State guard diimplementasikan pada tingkat service untuk menolak transisi ilegal.
- **Dampak:** Mencegah simplifikasi alur menjadi persetujuan satu tombol sepihak dan menjamin jejak audit birokrasi pemerintahan desa.

---

## ADR-004: Bukti Presensi — Tanpa Selfie untuk Reguler, Wajib Selfie untuk Dinas Luar

- **Konteks:** Sesuai PRD Section 3.2, 9, dan 14: Presensi reguler kantor desa **tidak** memerlukan foto selfie. Sebaliknya, presensi Dinas Luar (DL) di lokasi eksternal **wajib** menyertakan bukti foto selfie wajah.
- **Keputusan:**
  - Halaman Presensi Reguler hanya mengandalkan waktu resmi server dan validasi geofence kantor (koordinat & jarak).
  - Halaman Presensi Dinas Luar mengaktifkan komponen `CameraCapture` (live webcam snapshot atau upload foto fallback max 5MB) dan geofence lokasi tugas.
- **Dampak:** Menghemat bandwidth, mempercepat proses presensi harian di kantor desa, namun tetap menjaga akuntabilitas kehadiran di luar kantor.

---

## ADR-005: Isolasi Service Abstraction Layer

- **Konteks:** Pada tahap ini backend belum dibangun. Namun kode frontend tidak boleh terikat mati pada objek mock atau localStorage. Komponen halaman dilarang membaca atau memutasi `mockData` secara langsung.
- **Keputusan:** Seluruh komunikasi data melalui method asynchronous di folder `src/services/` dengan struktur kembalian seragam `ApiResponse<T>`. Mutasi koreksi dialirkan melalui `attendanceService.applyCorrection()`.
- **Dampak:** Tim backend pada tahap selanjutnya dapat mengganti implementasi method service menjadi fetch API/Supabase Client tanpa mengubah kode tampilan halaman.

---

## ADR-006: Enkapsulasi Mode Demo di Balik Flag Environment

- **Konteks:** Fitur role switcher, credential picker, dan tombol simulasi koordinat GPS penting untuk pengujian frontend mandiri, namun tidak boleh bocor atau dapat disalahgunakan di lingkungan production.
- **Keputusan:**
  - `IS_DEMO_MODE` dikontrol secara deklaratif melalui environment (`import.meta.env.DEV` dan `VITE_ENABLE_DEMO_MODE`).
  - Komponen `DemoModeBanner`, tombol simulasi GPS pada `GeofencePreview`, dan akun cepat pada `LoginPage` disembunyikan jika `!IS_DEMO_MODE`.
  - Service `authService.switchRole()` dan `switchUser()` melempar exception jika dipanggil di luar mode demo.
- **Dampak:** Menghindari celah privilege escalation melalui kontrol antarmuka di production.

---

## ADR-007: Non-Destructive Mutations & Audit Integrity pada Koreksi Presensi

- **Konteks:** Koreksi administratif oleh Operator Desa tidak boleh menghapus catatan asli kehadiran aparatur desa (PRD Section 11 & 43).
- **Keputusan:** Formulir koreksi mencatat `originalCheckIn`, `originalCheckOut`, dan `originalStatus`, serta mewajibkan alasan koreksi yang dicatat ke dalam audit trail. Rekaman presensi diberi flag `isCorrected: true` dan catatan korektor.
- **Dampak:** Menjaga transparansi hukum dan integritas laporan keuangan/kehadiran desa.

---

## ADR-008: Pemisahan Identitas, Struktur Jabatan Organisasi, dan Role Aplikasi KADESA

- **Konteks:** Terdapat koreksi aturan bisnis bahwa peran `OPERATOR_DESA` tidak terikat mati pada jabatan "Kaur Tata Usaha & Umum". Role merupakan hak akses aplikasi yang dapat ditugaskan kepada aparatur dengan posisi jabatan mana pun.
- **Keputusan:**
  1. **Pemisahan Tiga Dimensi:**
     - **Identitas:** Akun pengguna (`id`, `authUserId`, `nama`, `nik`, `nipd`, `fotoReference`).
     - **Jabatan:** Posisi dalam struktur pemerintahan desa (`jabatanId`, `jabatanNama`).
     - **Role:** Hak akses wewenang dalam aplikasi (`role`: `SUPER_ADMIN`, `OPERATOR`, `KEPALA_DESA`, `SEKRETARIS_DESA`, `PERANGKAT_DESA`).
  2. **Independensi Mutasi:** Perubahan jabatan tidak otomatis mengubah role; penugasan role tidak otomatis mengubah jabatan.
  3. **Batasan Otorisasi Operator Desa:**
     - Operator tidak dapat mengubah role akunnya sendiri (`actorId === targetId`).
     - Operator tidak dapat menetapkan role `OPERATOR_DESA` atau `SUPER_ADMIN` kepada siapa pun.
     - Operator tidak dapat membuat akun baru dengan role `OPERATOR_DESA` atau `SUPER_ADMIN`.
     - Operator tidak dapat mengedit, mengubah, atau menonaktifkan akun `SUPER_ADMIN`.
     - Operator tetap berwenang mengelola data aparatur lainnya (`PERANGKAT_DESA`, `SEKRETARIS_DESA`, `KEPALA_DESA`) sesuai matriks kewenangan.
  4. **Catatan Backend Readiness:** Validasi frontend dan service layer bertindak sebagai pertahanan awal UI/UX; keamanan mutlak penegakan RBAC wajib diimplementasikan ulang di level backend Supabase RLS / RPC pada fase Backend.
- **Dampak:** Memenuhi tata kelola pemerintahan desa yang dinamis tanpa membocorkan celah eskalasi hak akses sistem.

---

## ADR-009: PostgreSQL Database Foundation, Supabase Client Singleton, dan Row-Level Security (RLS) (Backend Tahap 1)

- **Konteks:** Sesuai rencana arsitektur KADESA (1 deployment = 1 desa = 1 proyek Supabase), backend dan database harus menjadi Single Source of Truth bagi autentikasi, hak akses, data operasional, dan integritas bisnis.
- **Keputusan:**
  1. **Struktur DDL Relasional 14 Tabel:** Migrasi `20261009000001_initial_schema.sql` menetapkan skema relasional lengkap untuk 14 tabel (`villages`, `positions`, `users`, `system_settings`, `work_schedules`, `holidays`, `attendance_records`, `dl_assignments`, `dl_locations`, `dl_evidence`, `absence_requests`, `attendance_corrections`, `audit_logs`, `notifications`) dengan UUIDv4, foreign key berintegritas tinggi, trigger otomatis `updated_at`, dan indeks performa.
  2. **Row Level Security (RLS) & RBAC Guard:** Migrasi `20261009000002_row_level_security.sql` mengaktifkan RLS pada seluruh 14 tabel tanpa terkecuali, dengan fungsi helper PostgreSQL `get_current_user_role()`, `is_super_admin()`, `is_operator()`. Aturan otorisasi PRD ditegakkan di database: Operator dilarang mengubah role sendiri, dilarang memberi role Operator/Super Admin, dilarang membuat akun ber-role Operator/Super Admin, dan dilarang mengedit Super Admin.
  3. **Immutability Audit Log:** Tabel `audit_logs` dilindungi model WORM (Write Once, Read Many); operasi UPDATE dan DELETE ditolak secara mutlak pada tingkat RLS dan kebijakan database.
  4. **Supabase Client Abstraction:** Modul `src/services/supabaseClient.ts` bertindak sebagai client singleton aman dengan fungsi pendeteksi `isSupabaseConfigured()`. Jika environment Supabase belum dikonfigurasi, sistem beralih ke fallback terisolir tanpa menyebabkan aplikasi crash.
  5. **Keamanan Kredensial:** `.env.example` disediakan tanpa membocorkan secret/service_role keys. File `.gitignore` memastikan kredensial lokal dan file environment tidak terlacak Git.
- **Dampak:** Menghilangkan celah eskalasi hak akses browser, menjamin integritas hukum audit aparatur desa, dan mempersiapkan integrasi live database yang aman.

---

## ADR-010: `PULANG_CEPAT` Sebagai Atribut Transaksi Check-Out dan Bukan Status Primer Presensi Harian

- **Konteks:** Terdapat ambiguitas semantik saat `PULANG_CEPAT` diletakkan sebagai nilai enum pada status harian primer (`attendance_status_enum`). Aparatur yang check-in tepat waktu dan bekerja lebih dari separuh jam dinas kemudian pulang lebih awal tidak boleh dihapus fakta kehadirannya menjadi status yang terpisah, melainkan tetap berstatus sah `HADIR` (atau `TERLAMBAT` jika masuk terlambat).
- **Keputusan:**
  1. Status harian resmi KADESA dikunci mutlak pada 8 status baseline: `HADIR`, `TERLAMBAT`, `IZIN`, `SAKIT`, `DINAS_LUAR`, `CUTI`, `ALPHA`, `LIBUR`.
  2. `PULANG_CEPAT` dikeluarkan dari tipe data `attendance_status_enum`.
  3. Kepulangan lebih awal dimodelkan sebagai atribut transaksi check-out pada tabel `attendance_records`:
     - `is_early_leave BOOLEAN NOT NULL DEFAULT FALSE`
     - `early_leave_reason TEXT NULL`
     - `early_leave_minutes INTEGER NULL CHECK (early_leave_minutes >= 0)`
  4. Perhitungan menit kepulangan awal didasarkan pada selisih waktu check-out terhadap jam selesai kerja efektif (`WORK_END_TIME`) menggunakan zona waktu resmi sistem (`TIMEZONE`).
  5. Pengajuan check-out sebelum jam kerja berakhir mewajibkan pengisian alasan kepulangan awal.
  6. Migrasi rekonsiliasi berurutan disediakan pada `20261009000004_early_leave_attributes.sql`.
- **Dampak:** Menjamin keadilan pencatatan rekapitulasi kehadiran harian dan bulanan tanpa distorsi penghitungan persentase aparatur.

---

## ADR-011: Hak Eksklusif `SUPER_ADMIN` dalam Pemberian dan Pencabutan Peran `OPERATOR_DESA`

- **Konteks:** Penugasan hak akses `OPERATOR_DESA` memiliki dampak krusial terhadap integritas data master dan pengaturan presensi seluruh aparatur desa. Celah eskalasi hak akses dapat terjadi jika pengguna biasa atau sesama Operator dapat menunjuk atau mencabut peran Operator Desa.
- **Keputusan:**
  1. Hanya `SUPER_ADMIN` yang berhak memberikan (`grant`) maupun mencabut (`revoke`) peran `OPERATOR_DESA`.
  2. Ditegakkan secara berlapis (defense-in-depth):
     - **Database Trigger:** Trigger `prevent_unauthorized_user_tampering()` membatalkan transaksi (`RAISE EXCEPTION`) jika non-SuperAdmin mencoba mengubah peran pengguna menjadi atau dari `OPERATOR_DESA`, baik pada operasi `INSERT` maupun `UPDATE`.
     - **RLS Policy:** `users_insert_policy` dan `users_update_policy` menolak pembuatan atau kenaikan peran ke `OPERATOR_DESA` oleh non-SuperAdmin.
     - **Service Layer:** `masterService.updateApparatus` memvalidasi `actorRole === 'SUPER_ADMIN'` sebelum memperbarui peran `OPERATOR_DESA`.
  3. Operator dilarang keras mengubah peran miliknya sendiri, membuat akun Operator/Admin baru, dan menyentuh akun Super Admin.
- **Dampak:** Menjaga pemisahan kewenangan keamanan teknis tingkat tinggi dari dinamika birokrasi harian desa dan menutup seluruh celah privilege escalation.

---

## ADR-012: Fail-Safe Validasi Geofence Kantor Desa Sebelum Konfirmasi Koordinat Resmi Lapangan

- **Konteks:** Koordinat kantor desa yang tersedia pada fase awal (`-6.4828, 106.8436`) merupakan data contoh simulasi pengujian dan belum diverifikasi secara resmi di lapangan untuk Desa Sukamaju. Mengaktifkan geofence produksi dengan koordinat contoh dapat menyebabkan seluruh aparatur tertolak saat presensi atau sebaliknya menerima presensi di lokasi yang keliru.
- **Keputusan:**
  1. Parameter `OFFICE_COORDINATES_CONFIRMED` ditambahkan pada `system_settings` dengan nilai awal `false`.
  2. Koordinat contoh pada mock dan seed diberi label eksplisit sebagai simulasi yang menunggu konfirmasi lapangan.
  3. Pemisahan mode yang tegas:
     - **Mode Demo / Development (`IS_DEMO_MODE = true`):** Simulasi geofence tetap berjalan menggunakan koordinat contoh untuk kenyamanan pengembangan dan demonstrasi.
     - **Mode Operasional Produksi (`IS_DEMO_MODE = false`):** Jika `isOfficeCoordinatesConfirmed()` bernilai `false`, sistem menerapkan prinsip **fail-safe**: presensi kantor ditolak secara aman dengan pesan informatif `OFFICE_LOCATION_UNCONFIRMED`, tanpa membiarkan bypass atau menebak lokasi.
  4. Antarmuka `PresensiRegulerPage`, `MasterDesaPage`, dan `SystemSettingsPage` menampilkan banner peringatan transparan mengenai status koordinat simulasi.
- **Dampak:** Mencegah kesalahan presensi massal di lingkungan live sebelum koordinat resmi kantor desa disurvei dan disahkan oleh Administrator.


