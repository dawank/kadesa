# KADESA — AUDIT MENYELURUH SISTEM BERBASIS MATRIKS KETERLACAKAN (RTM)

## 1. Informasi Audit
- **Nama Produk:** KADESA (Sistem Kehadiran Aparatur Desa)
- **Repository Utama:** `https://github.com/dawank/kadesa`
- **Branch / Baseline Commit:** `main` @ `993371aefd026edaaad2b714b7afab1be3d963e8`
- **Target Deployment Produksi:** `https://kadesa.vercel.app`
- **Database Engine / Backend:** Supabase Cloud PostgreSQL (Project Ref: `qjiwxtvhzeitjtznhkdc`)
- **Tanggal Audit:** 11 Oktober 2026
- **Prinsip Utama:** Audit berbasis bukti empiris (*evidence-based*), bukan asumsi.

---

## 2. Ruang Lingkup Audit
Audit mencakup seluruh lapisan sistem:
1. **Frontend & UI/UX:** React 19, TypeScript, routing (`react-router-dom`), layout, state management, guards, navigasi, dan kontrol inline.
2. **Lapisan Layanan (Service Layer):** 12 modul service TypeScript (`src/services/`), penanganan API PostgREST, RPC Supabase, dan error handling.
3. **Database & Migrasi:** 14 tabel relasional, tipe ENUM, foreign key, index, trigger PostgreSQL, stored function/RPC, dan 12 berkas migrasi SQL (`supabase/migrations/`).
4. **Keamanan & Otorisasi:** Supabase Auth, Row Level Security (RLS) policies, penegakan hak akses berbasis peran (RBAC), proteksi password, immutability audit log, dan isolasi storage bucket.
5. **Integritas Bisnis:** Presensi kantor reguler (geofence haversine server-side), penugasan Dinas Luar (state machine & ratifikasi), pengajuan Izin/Sakit/Cuti, koreksi presensi non-destruktif, dan pembukuan waktu resmi server.
6. **Pengujian & QA:** Suite pengujian otomatis Vitest (15 file, 84 skenario test), static analysis (TypeScript compiler & ESLint), dan pengujian integrasi live.

---

## 3. Dokumen Hasil Audit Terkait
Seluruh artefak audit disimpan secara terstruktur di dalam direktori `docs/audit/`:
- [`requirements-traceability-matrix.md`](requirements-traceability-matrix.md) — Matriks Keterlacakan Kebutuhan (RTM) lengkap.
- [`requirements-traceability-matrix.csv`](requirements-traceability-matrix.csv) — Versi tabular CSV untuk analisis data dan spreadsheet.
- [`module-inventory.md`](module-inventory.md) — Inventarisasi dependency, routes, komponen, service, dan skema database.
- [`frontend-backend-data-flow.md`](frontend-backend-data-flow.md) — Pemetaan alur data lengkap lintas lapisan (UI $\rightarrow$ Service $\rightarrow$ DB $\rightarrow$ RLS).
- [`role-permission-matrix.md`](role-permission-matrix.md) — Matriks otorisasi peran (*Role $\times$ Action*) dan penegakannya.
- [`test-matrix.md`](test-matrix.md) — Matriks pengujian berbasis kebutuhan dan hasil eksekusi pengujian aktual.
- [`findings.md`](findings.md) — Klasifikasi temuan audit berdasarkan tingkat keparahan (P0, P1, P2, P3).
- [`remediation-log.md`](remediation-log.md) — Log tindakan perbaikan teknis dan uji regresi.
- [`final-audit-report.md`](final-audit-report.md) — Laporan audit final komprehensif 13 bagian.

---

## 4. Batasan & Lingkungan Pengujian
1. **Lingkungan Host:** Sistem berjalan pada lingkungan pengembang Windows tanpa daemon Docker lokal; pengujian integrasi live dijalankan langsung terhadap instance Supabase Cloud yang terkonfigurasi pada `.env.local`.
2. **Koneksi Supabase Cloud:** Terverifikasi aktif via HTTPS REST API dan WebSocket Auth.
3. **Pengiriman Email Nyata (SMTP):** Alur reset password diuji pada tingkat token auth dan pengiriman instruksi kontak WhatsApp; pengiriman email live bergantung pada konfigurasi SMTP penyedia pihak ketiga di dashboard Supabase.
