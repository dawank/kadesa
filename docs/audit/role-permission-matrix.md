# MATRIKS OTORISASI DAN HAK AKSES PERAN KADESA

**Tanggal:** 11 Oktober 2026  
**Baseline Commit:** `993371aefd026edaaad2b714b7afab1be3d963e8`  
**Prinsip Desain:**
1. **Pemisahan Prinsipil:** *Role* menentukan hak akses aplikasi sistem KADESA; *Jabatan* adalah posisi dalam struktur organisasi pemerintahan desa. Role tidak boleh diinferensikan dari Jabatan.
2. **Pertahanan Berlapis (*Defense-in-Depth*):** Otorisasi diatur di tingkat antarmuka UI (`ProtectedRoute` & `hasPermission`), diverifikasi pada level Service TypeScript, dan ditegakkan secara mutlak (*enforced*) di database melalui Supabase PostgreSQL Row Level Security (RLS) serta Triggers.

---

## 1. Definisi 5 Role Resmi Sistem

| Role | Kode Sistem | Cakupan Kewenangan Utama |
|---|---|---|
| **Super Admin** | `SUPER_ADMIN` | Administrator teknis sistem: Pengaturan sistem, pemeliharaan basis data, manajemen akun & reset kata sandi, audit log, konfigurasi desa. Bukan subjek presensi default. |
| **Operator Desa** | `OPERATOR_DESA` | Pengelola operasional harian: Koreksi presensi kehadiran, pengelolaan master aparatur dan jabatan, verifikasi izin/sakit/cuti, penugasan DL. |
| **Kepala Desa** | `KEPALA_DESA` | Pimpinan eksekutif desa: Otorisasi final ratifikasi penugasan Dinas Luar (DL), persetujuan akhir cuti, monitoring presensi aparatur, pengesahan laporan resmi. |
| **Sekretaris Desa** | `SEKRETARIS_DESA` | Verifikator administrasi: Verifikasi awal surat cuti dan izin sakit, verifikasi/rekomendasi penugasan Dinas Luar, monitoring kehadiran harian. |
| **Perangkat Desa** | `PERANGKAT_DESA` | Aparatur pelaksana: Presensi mandiri (Check-In & Check-Out kantor dan Dinas Luar), pengajuan permohonan Izin/Sakit/Cuti, melihat histori dan profil mandiri. |

---

## 2. Matriks Operasional Lengkap: Role × Modul

Keterangan Aksi:
- **R (Read):** Melihat / Menampilkan data
- **C (Create):** Membuat data baru
- **U (Update):** Mengubah data yang sudah ada
- **D (Delete):** Menghapus data
- **A (Approve / Ratify):** Menyetujui, memvalidasi, atau meratifikasi alur kerja
- **X (Export):** Mengunduh berkas laporan (PDF/Excel)
- **- (No Access):** Tidak memiliki hak akses

| Modul Sistem | SUPER_ADMIN | OPERATOR_DESA | KEPALA_DESA | SEKRETARIS_DESA | PERANGKAT_DESA |
|---|:---:|:---:|:---:|:---:|:---:|
| **Dashboard** | R | R | R | R | R (Personal) |
| **Presensi Reguler** | - | R, C, U (Self) | R, C, U (Self) | R, C, U (Self) | R, C, U (Self) |
| **Monitoring Presensi** | R | R | R | R | - |
| **Koreksi Presensi** | R | R, C, U, A | R | R | - |
| **Dinas Luar (Pengajuan)** | R, C | R, C | R, C | R, C | R, C (Self) |
| **Dinas Luar (Verifikasi)**| R, A | R, A | R | R, A | - |
| **Dinas Luar (Approval)** | R, A | - | R, A | R, A | - |
| **Dinas Luar (Ratifikasi)**| - | - | **R, A (Eksklusif)**| - | - |
| **Izin & Sakit (Pengajuan)**| - | R, C (Self) | R, C (Self) | R, C (Self) | R, C (Self) |
| **Izin & Sakit (Approval)** | R, A | R, A | R, A | R, A | - |
| **Cuti (Pengajuan)** | - | R, C (Self) | R, C (Self) | R, C (Self) | R, C (Self) |
| **Cuti (Verifikasi)** | R, A | R, A | R, A | R, A | - |
| **Cuti (Approval Final)** | - | - | **R, A (Eksklusif)**| - | - |
| **Master Desa** | R, C, U | R, C, U | R | R | - |
| **Master Aparatur** | R, C, U, D | R, C, U, D | R | R | - |
| **Master Jabatan** | R, C, U, D | R, C, U, D | R | R | - |
| **Pengaturan Sistem** | R, C, U | R, C, U | - | - | - |
| **Audit Log & Security** | R | R | R | R | - |
| **Laporan & Ekspor** | R, X | R, X | R, X | R, X | R, X (Personal) |

---

## 3. Perbedaan Penegakan UI vs Backend Database (Enforcement Gap Analysis)

| Area Fungsional | Kontrol Antarmuka UI (Frontend) | Penegakan Sisi Server (RLS & Triggers) | Evaluasi Integritas |
|---|---|---|---|
| **Navigasi Menu** | Menu tersembunyi via `Sidebar.tsx` dan dicegat oleh `ProtectedRoute` jika role tidak sesuai. | Pemanggilan langsung ke PostgREST API difilter ketat oleh RLS `USING (auth.uid() = ... OR role IN (...))`. | **Kuat (Tervalidasi)**: Mencoba bypass URL langsung menghasilkan 403 Forbidden di UI dan 401/Empty set di database. |
| **Koreksi Presensi** | Hanya `OPERATOR_DESA` yang memiliki tombol aksi koreksi di UI. | Trigger `enforce_attendance_geofence_safety` dan RPC `apply_attendance_correction` menolak modifikasi waktu check-in/out tanpa dokumen koreksi berstatus `APPROVED`. | **Kuat (Tervalidasi)**: Manipulasi langsung tabel `attendance_records` ditolak trigger SQL. |
| **Ratifikasi Dinas Luar** | Tombol Ratifikasi hanya aktif untuk akun dengan role `KEPALA_DESA`. | Trigger `enforce_approval_workflow_integrity` pada tabel `dl_assignments` memastikan `ratified_by` hanya boleh diisi oleh akun dengan role `KEPALA_DESA` dan state sebelumnya harus `APPROVED`. | **Kuat (Tervalidasi)**: State transition dilindungi constraint state machine di level database. |
| **Approval Final Cuti** | Tombol persetujuan akhir hanya muncul pada dashboard/halaman cuti `KEPALA_DESA`. | Trigger `enforce_approval_workflow_integrity` pada tabel `absence_requests` memastikan status `APPROVED` untuk cuti hanya sah jika `approved_by` memiliki role `KEPALA_DESA`. | **Kuat (Tervalidasi)**: Operator atau Sekdes dilarang mengubah status menjadi `APPROVED` secara sepihak. |
| **Pemberian Role Operator** | Form edit aparatur mengunci role `SUPER_ADMIN` dan `OPERATOR_DESA` agar tidak bisa dibuat/diubah sembarangan oleh operator lain. | Kebijakan RLS tabel `users` (Migrasi 002 & Migrasi 005) menolak pemberian atau pencabutan role `OPERATOR_DESA` kecuali aktor adalah `SUPER_ADMIN`. | **Kuat (Tervalidasi)**: Uji coba eskalasi hak istimewa (privilege escalation) terbukti digagalkan oleh RLS database. |

---

## 4. Matriks Akses Langsung API / RPC (Backend Enforcement)

| Endpoint / RPC | Akses Anonim | PERANGKAT_DESA | SEKRETARIS_DESA / KEPALA_DESA | OPERATOR_DESA | SUPER_ADMIN |
|---|:---:|:---:|:---:|:---:|:---:|
| `GET /rest/v1/villages` | Boleh (Read-Only) | Boleh | Boleh | Boleh | Boleh |
| `PATCH /rest/v1/villages` | Ditolak | Ditolak | Ditolak | Boleh | Boleh |
| `GET /rest/v1/system_settings` | Boleh (Read-Only) | Boleh | Boleh | Boleh | Boleh |
| `PATCH /rest/v1/system_settings` | Ditolak | Ditolak | Ditolak | Boleh | Boleh |
| `POST /rest/v1/attendance_records` | Ditolak (Trigger Exception) | Milik Sendiri | Milik Sendiri | Milik Sendiri | Ditolak |
| `rpc/apply_attendance_correction` | Ditolak | Ditolak | Ditolak | **Boleh** | **Boleh** |
| `POST /rest/v1/audit_logs` | Ditolak | Insert Otomatis | Insert Otomatis | Insert Otomatis | Insert Otomatis |
| `DELETE /rest/v1/audit_logs` | **Ditolak Mutlak** | **Ditolak Mutlak** | **Ditolak Mutlak** | **Ditolak Mutlak** | **Ditolak Mutlak** |
