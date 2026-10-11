# KADESA — Sistem Kehadiran Aparatur Desa

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Production%20Live-black?style=flat&logo=vercel)](https://kadesa.vercel.app)
[![Supabase Database](https://img.shields.io/badge/Supabase-Connected-3ECF8E?style=flat&logo=supabase)](https://supabase.com)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat&logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat&logo=typescript)](https://www.typescriptlang.org)
[![Tests](https://img.shields.io/badge/Tests-71%20Passed-brightgreen?style=flat)](https://vitest.dev)

**KADESA** adalah platform sistem presensi digital dan manajemen operasional aparatur pemerintah desa berbasis web. Dirancang untuk menghadirkan pencatatan kehadiran yang akurat, transparan, dan akuntabel dengan dukungan validasi GPS Geofencing kantor desa, kamera swafoto (*selfie*), alur persetujuan surat tugas Dinas Luar (DL), pengajuan cuti berjenjang, jadwal kerja harian dinamis, dan zona waktu resmi Indonesia (WIB, WITA, WIT).

---

## Tautan Akses

- **Production Live**: [https://kadesa.vercel.app](https://kadesa.vercel.app)
- **Database Cloud**: Supabase Project (`qjiwxtvhzeitjtznhkdc.supabase.co`)
- **Dokumentasi Lengkap**: Tersedia di direktori [`docs/`](./docs)

---

## Fitur Utama

1. **Presensi Mandiri Terverifikasi (Check-In & Check-Out)**
   - Validasi radius jarak koordinat kantor desa (GPS Geofence).
   - Pengambilan foto bukti swafoto (*liveness snapshot*) melalui kamera perangkat.
   - Deteksi otomatis keterlambatan (*TERLAMBAT*) dan pencatatan alasan pulang awal (*EARLY LEAVE*).
2. **Jadwal Kerja & Jam Operasional Dinamis**
   - Penentuan hari kerja (`KERJA` vs `LIBUR`) fleksibel per hari (Senin s/d Minggu) melalui panel Administrator.
   - Pengaturan jam masuk, jam pulang, dan toleransi keterlambatan individual untuk masing-masing hari.
   - Pilihan Zona Waktu Indonesia Resmi: **WIB** (`Asia/Jakarta`), **WITA** (`Asia/Makassar`), dan **WIT** (`Asia/Jayapura`).
3. **Sidebar Desktop Responsif (Collapsible)**
   - Toggle memperkecil sidebar menjadi mode ringkas **72 px** pada layar desktop (> 768 px) dengan mempertahankan logo, ikon menu, dan tooltip modern.
   - Mode drawer penuh dengan latar overlay pada layar tablet dan ponsel (≤ 768 px).
4. **Tugas Dinas Luar (DL)**
   - Pengajuan surat tugas, verifikasi, ratifikasi oleh Kepala Desa/Sekretaris Desa.
   - Presensi di luar kantor desa dengan koordinat lokasi tujuan tugas.
5. **Manajemen Cuti & Izin Sakit**
   - Alur verifikasi bertingkat (*Submitted -> Verified -> Approved*).
6. **Master Data Pemerintahan Desa**
   - Profil desa, batas koordinat kantor desa, data aparatur, dan hierarki jabatan.
7. **Kustomisasi Kop Surat Resmi**
   - Generator kop surat dinamis 4 baris teks dengan logo instansi dan pratinjau cetak PDF.
8. **Audit Trail & Keamanan RLS**
   - Pencatatan seluruh mutasi data ke tabel `audit_logs`.
   - Penerapan ketat Supabase Row Level Security (RLS) berbasis role.

---

## Prasyarat Lingkungan (Prerequisites)

Sebelum menjalankan aplikasi, pastikan komputer Anda telah terpasang:

- **Node.js**: Versi `20.x` atau lebih baru (`Node.js 22.x LTS` direkomendasikan).
- **npm**: Versi `10.x` atau lebih baru (bawaan Node.js).
- **Git**: Untuk manajemen repositori.
- **Peramban Modern**: Google Chrome, Mozilla Firefox, Microsoft Edge, atau Safari dengan izin akses GPS/Kamera.

---

## Panduan Menjalankan Aplikasi (Quick Start)

### 1. Kloning Repositori
```bash
git clone https://github.com/dawank/kadesa.git
cd kadesa
```

### 2. Pasang Dependencies
```bash
npm install
```

### 3. Konfigurasi Environment Variable
Salin berkas template [`.env.example`](./.env.example) menjadi `.env.local`:
```bash
cp .env.example .env.local
```

Buka `.env.local` dan sesuaikan nilainya:
```env
# URL Project Supabase
VITE_SUPABASE_URL=https://qjiwxtvhzeitjtznhkdc.supabase.co

# Supabase Anon / Publishable Key
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Set false untuk terhubung langsung ke database Supabase Cloud
VITE_ENABLE_DEMO_MODE=false
```

> **Catatan Keamanan**: Jangan pernah menempelkan `service_role` key atau password administratif ke dalam berkas `.env.local` maupun source code.

### 4. Jalankan Server Pengembangan (Local Dev)
```bash
npm run dev
```
Setelah server menyala, buka peramban di:
👉 **[http://localhost:5173](http://localhost:5173)**

---

## Akun Uji Coba Operasional (Pilot Accounts)

Untuk kebutuhan evaluasi alur kerja dan matriks kewenangan role:

| Role Pengguna | Username | Kata Sandi Default | Hak Akses Utama |
|---|---|---|---|
| **Super Admin** | `superadmin` | `password123` | Konfigurasi sistem, reset password aparatur, audit log, manajemen database. |
| **Operator Desa** | `operator` | `password123` | Koreksi presensi, master data aparatur, manajemen jadwal harian. |
| **Kepala Desa** | `kades` | `password123` | Ratifikasi Dinas Luar (DL), persetujuan akhir cuti, monitoring presensi. |
| **Sekretaris Desa** | `sekdes` | `password123` | Verifikasi cuti & izin, ratifikasi DL alternatif, monitoring presensi. |
| **Perangkat Desa** | `dewi` | `password123` | Presensi reguler masuk/pulang, permohonan cuti, presensi Dinas Luar. |

---

## Perintah Perawatan & Kualitas Kode (Scripts)

Proyek ini dilengkapi dengan suite pengujian otomatis dan standardisasi kode:

```bash
# 1. Validasi tipe data TypeScript tanpa kompilasi
npm run typecheck

# 2. Pengecekan standar penulisan kode (ESLint)
npm run lint

# 3. Menjalankan seluruh rangkaian tes otomatis (71 tes unit & integrasi)
npm test

# 4. Menjalankan tes dalam mode watch interaktif
npm run test:watch

# 5. Kompilasi build bundel produksi
npm run build

# 6. Menjalankan pratinjau hasil build produksi secara lokal
npm run preview
```

---

## Struktur Direktori Proyek

```
kadesa/
├── docs/                      # Dokumentasi PRD, ADR, dan laporan audit
│   ├── PRD v1.3.0.md          # Spesifikasi fungsional dan aturan bisnis resmi
│   └── architecture-decisions.md # Catatan Keputusan Arsitektur (ADR)
├── public/                    # Aset statis (logo instansi, favicon)
├── src/
│   ├── components/            # Komponen UI modular
│   │   ├── common/            # Komponen bersama (Peta Leaflet, Kamera, Modal, Toast)
│   │   └── layout/            # Layout shell (Sidebar, Navbar, AppLayout)
│   ├── context/               # Global state (Auth, Branding, Toast)
│   ├── pages/                 # Halaman aplikasi per modul bisnis
│   │   ├── absence/           # Modul Cuti & Izin Sakit
│   │   ├── attendance/        # Modul Presensi Reguler & Monitoring
│   │   ├── audit/             # Modul Audit Trail Keamanan
│   │   ├── auth/              # Modul Login & Pemulihan Kata Sandi
│   │   ├── dashboard/         # Dashboard per role pengguna
│   │   ├── dl/                # Modul Dinas Luar
│   │   ├── master/            # Modul Master Data Desa, Aparatur, Jabatan
│   │   └── settings/          # Modul Pengaturan Sistem & Kop Surat
│   ├── services/              # Lapisan API, Supabase client, dan business logic
│   ├── styles/                # CSS kustom bertema Glassmorphism Slate Navy
│   ├── test/                  # Suite pengujian unit & integrasi (Vitest)
│   └── types/                 # Definisi tipe TypeScript terpusat
├── supabase/                  # Konfigurasi Backend Supabase
│   ├── functions/             # Deno Edge Functions (Admin Password Reset, Create User)
│   ├── migrations/            # Berkas DDL SQL migrasi skema database 001-006 & patch
│   └── tests/                 # SQL validation suites
├── .env.example               # Template variabel lingkungan aman
├── .gitignore                 # Filter proteksi berkas rahasia & build
├── package.json               # Konfigurasi dependensi proyek
└── vite.config.ts             # Konfigurasi build bundler Vite
```

---

## Panduan Deployment ke Production (Vercel)

Aplikasi telah diatur untuk deployment ke Vercel:

1. **Pastikan seluruh pengujian lulus**:
   ```bash
   npm run typecheck && npm run lint && npm test && npm run build
   ```
2. **Deploy ke Production**:
   ```bash
   npx vercel --prod --yes
   ```
3. **Environment Variables di Vercel Dashboard**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ENABLE_DEMO_MODE=false`

---

## Lisensi & Kepemilikan

Proyek aplikasi **KADESA (Sistem Kehadiran Aparatur Desa)** adalah milik Pemerintah Desa terkait dan dilindungi sebagai perangkat lunak berlisensi terbatas untuk operasional pemerintahan desa.
