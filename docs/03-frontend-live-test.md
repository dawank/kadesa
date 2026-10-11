# Panduan & Log Live Test Frontend KADESA

**Tanggal Pelaksanaan:** 09 Oktober 2026  
**Lingkungan Pengujian:** Local Development Environment (Node.js runtime, Vite Dev Server)  
**Status Workflow:**
- Planning: **CLOSED** (Terkunci)
- Frontend: **LIVE TEST READY** (Dev Server Aktif)
- Backend: **PENDING** (Mock Adapter Aktif)
- Integration: **PENDING**
- Deployment: **PENDING**

---

## 1. URL Lokal Aktual & Status Server

* **Status Server:** **RUNNING (ACTIVE)** *(Proses daemon background tetap aktif)*
* **URL Lokal Aktual:** [`http://localhost:5173/`](http://localhost:5173/)
* **Vite Version:** v8.3.4
* **Mode:** Development (`import.meta.env.DEV = true`) — **Mode Demo Aktif**

> [!NOTE]
> Server dijalankan dengan skrip `npm run dev` dan melayani bundle React 19 + TypeScript 5.8 secara langsung. URL di atas siap dibuka melalui web browser apa pun di komputer penguji.

---

## 2. Perintah yang Dijalankan & Hasil Verifikasi

Seluruh pemeriksaan kondisi dasar telah dijalankan sebelum server development dinyalakan:

1. **Pemeriksaan Tipe (Static Typecheck):**
   ```bash
   npm run typecheck
   # Output: tsc --noEmit
   # Hasil: Exit Code 0 (0 error)
   ```
2. **Automated Test Suite (Vitest):**
   ```bash
   npm run test
   # Hasil: 7 test files passed, 21 tests passed (Exit Code 0)
   ```
3. **Validasi Bundle Production:**
   ```bash
   npm run build
   # Hasil: tsc && vite build sukses menghasilkan dist/ (Exit Code 0)
   ```
4. **Menjalankan Server Development:**
   ```bash
   npm run dev
   # Output: VITE v8.3.4 ready in 469 ms -> Local: http://localhost:5173/
   ```

---

## 3. Cara Membuka Aplikasi & Mengakses Mode Demo

1. Buka browser dan arahkan ke alamat: [`http://localhost:5173/`](http://localhost:5173/)
2. Halaman pertama yang muncul adalah **Halaman Login KADESA**:
   * Di bagian bawah form login, terdapat panel **Pilih Akun Demo untuk Pengujian**.
   * Klik salah satu dari 5 akun demo untuk mengisi username & kata sandi secara otomatis:
     * **Siti Rahmawati, S.Kom** — Role: `OPERATOR` (Default Admin Desa)
     * **Drs. H. Ahmad Dahlan** — Role: `KEPALA_DESA`
     * **Bambang Wijaya, S.IP** — Role: `SEKRETARIS_DESA`
     * **Dewi Lestari, S.E.** — Role: `PERANGKAT_DESA`
     * **Budi Santoso** — Role: `SUPER_ADMIN`
   * Klik tombol **Masuk ke Aplikasi**.
3. Setelah masuk, di bagian paling atas aplikasi terdapat banner hijau **MODE DEMO FRONTEND**:
   * Penguji dapat berganti role secara instan kapan saja menggunakan dropdown **Simulasi Role** di kanan banner tanpa perlu logout ulang.

---

## 4. Daftar Skenario yang Siap Diuji Secara Manual

Berikut skenario alur kerja nyata yang telah disiapkan untuk pengujian manual:

### Skenario 1: Presensi Reguler Aparatur Desa
* **Peran:** `PERANGKAT_DESA` atau `OPERATOR`
* **Navigasi:** Menu **Presensi Masuk / Pulang** (`/attendance/presensi`)
* **Pengujian:**
  1. Perhatikan jam resmi server yang berdetik secara real-time.
  2. Perhatikan radar geofence kantor desa. Pada mode demo, tombol simulasi tersedia:
     * Klik **Di Kantor (Jarak ~15m)** untuk menguji posisi valid di dalam radius.
     * Klik **Di Luar Kantor (Jarak ~450m)** untuk menguji penolakan lokasi di luar geofence.
  3. Klik **Catat Presensi Masuk (Check-In)**.
  4. Coba tekan Check-In kembali untuk memverifikasi penolakan duplikasi.
  5. Coba lakukan Check-Out sebelum jam 15:30: sistem mewajibkan pengisian alasan kepulangan awal (*Early Leave Reason*).

### Skenario 2: Alur Surat Tugas & Presensi Dinas Luar (DL)
* **Peran:** `PERANGKAT_DESA` (Pemohon) → `SEKRETARIS_DESA` (Verifikator) → `KEPALA_DESA` (Ratifikasi)
* **Navigasi:** Menu **Dinas Luar** (`/dl`)
* **Pengujian:**
  1. Klik **+ Ajukan Dinas Luar**: isi tujuan, tanggal, dan tambahkan lokasi penugasan.
  2. Buka rincian DL yang baru dibuat (status `PENDING`).
  3. Beralih role ke `SEKRETARIS_DESA`: tombol **Verifikasi Berkas** dan **Setujui Tugas** akan aktif.
  4. Setujui surat tugas: status berubah menjadi `APPROVED` dan countdown ratifikasi 72 jam mulai berjalan.
  5. Beralih role ke `KEPALA_DESA`: klik tombol **Ratifikasi (Kepala Desa)** untuk meratifikasi secara sah.
  6. Buka tombol **Presensi DL**: uji coba kamera live selfie (atau tombol unggah file foto) dan validasi lokasi penugasan.

### Skenario 3: Alur Pengajuan Cuti Berjenjang
* **Peran:** `PERANGKAT_DESA` → `SEKRETARIS_DESA` → `KEPALA_DESA`
* **Navigasi:** Menu **Cuti Aparatur** (`/absence/cuti`)
* **Pengujian:**
  1. Ajukan permohonan Cuti Tahunan.
  2. Verifikasi berkas oleh Sekretaris Desa.
  3. Persetujuan akhir mutlak oleh Kepala Desa.
  4. Periksa linimasa status dan jejak aktor pada detail pengajuan.

### Skenario 4: Monitoring Kehadiran & Koreksi Presensi
* **Peran:** `OPERATOR`
* **Navigasi:** Menu **Monitoring Kehadiran** (`/attendance/monitoring`)
* **Pengujian:**
  1. Filter daftar kehadiran berdasarkan tanggal dan status.
  2. Klik salah satu aparatur untuk membuka dialog rincian transaksi.
  3. Klik tombol **Koreksi Presensi Administratif**:
     * Ubah jam masuk atau jam pulang.
     * Isi alasan koreksi wajib.
     * Simpan dan pastikan flag `(Dikoreksi)` muncul dengan catatan audit tanpa merusak jam asli.

### Skenario 5: Laporan & Ekspor Multiformat
* **Peran:** Seluruh Role
* **Navigasi:** Menu **Laporan & Rekapitulasi** (`/reports`)
* **Pengujian:**
  1. Beralih antara tab **Laporan Harian** dan **Rekapitulasi Bulanan**.
  2. Uji tombol **CSV**: mengunduh file `.csv`.
  3. Uji tombol **Export Excel**: mengunduh file spreadsheet `.xls` yang dapat dibuka di MS Excel / LibreOffice.
  4. Uji tombol **PDF**: membuka jendela cetak dokumen resmi ber-kop Pemerintah Desa Sukamaju dan kolom tanda tangan Kepala Desa.

### Skenario 6: Pembatasan Menu & Laporan Perangkat Desa
* **Peran:** `PERANGKAT_DESA` (misal login sebagai: Dewi Lestari)
* **Navigasi:** Sidebar menu & halaman `/reports`
* **Pengujian:**
  1. Periksa sidebar navigasi: kelompok menu **DATA MASTER DESA** (Wilayah Kerja & Jam Kerja, Data Aparatur, Jabatan) **tidak ditampilkan sama sekali**.
  2. Buka menu **Laporan & Rekap**: judul otomatis berubah menjadi **Laporan Kehadiran Saya**, data harian dan rekap bulanan hanya memuat data kehadiran Dewi Lestari sendiri (bukan seluruh desa).
  3. Coba akses langsung URL `/master/aparatur` atau `/master/desa`: akses ditolak dan diarahkan kembali.

### Skenario 7: Perlindungan Akun Super Admin & Pengelolaan Role oleh Operator Desa
* **Peran:** `OPERATOR` (misal login sebagai: Siti Rahmawati)
* **Navigasi:** Menu **Data Aparatur Desa** (`/master/aparatur`)
* **Pengujian:**
  1. **Perlindungan Akun Super Admin:** Cari akun dengan role `SUPER_ADMIN` (Budi Santoso). Perhatikan kolom aksi: tombol **Edit** dan tombol **Nonaktifkan** digantikan oleh label badge abu-abu **Terkunci (Super Admin)**.
  2. **Larangan Membuat Akun Operator/Super Admin:** Klik tombol **+ Tambah Aparatur Baru**, periksa pilihan dropdown **Peran Aplikasi (Role)**. Opsi `Super Admin` dan `Operator Desa` disembunyikan bagi Operator (hanya Super Admin yang dapat membuat/menetapkan Operator).
  3. **Larangan Mengubah Role Akun Sendiri:** Buka modal Edit pada akun Siti Rahmawati (akun operator itu sendiri). Dropdown **Peran Aplikasi (Role)** terkunci (disabled) dengan petunjuk bahwa Operator tidak dapat mengubah peran akun sendiri.
  4. **Kemandirian Jabatan dan Role:** Pilih aparatur lain (misal Dewi Lestari), ubah jabatannya menjadi posisi lain (misal Kaur Perencanaan) lalu simpan: periksa bahwa role tetap `PERANGKAT_DESA`. Sebaliknya, penugasan role tidak mengubah jabatan aparatur bersangkutan.

### Skenario 8: Pengubahan Foto Profil & Logo KADESA
* **Peran:** Seluruh Role
* **Navigasi:** Menu **Profil Saya** (`/profile`), **Data Aparatur** (`/master/aparatur`), dan Layar **Login**
* **Pengujian:**
  1. Masuk ke menu **Profil Saya**: klik ikon kamera bundar di samping foto profil untuk mengunggah foto baru (format JPG, PNG, atau WebP, maks 2MB).
  2. Foto profil langsung diperbarui secara real-time pada avatar profil, topbar navbar, dan tabel data.
  3. Jika foto profil sudah ada, tombol **Hapus Foto** tersedia untuk mengembalikan ke inisial nama.
  4. Periksa logo resmi KADESA yang kini tampil di favicon tab browser, pojok kiri atas login form, sidebar kiri atas, dan topbar navbar.

### Skenario 9: Pembuatan Password Baru & Reset Password Aparatur (Jika Lupa Password)
* **Peran:** `SUPER_ADMIN` atau `OPERATOR`
* **Navigasi:** Menu **Master Data** → **Data Aparatur** (`/master/aparatur`)
* **Pengujian:**
  1. **Pembuatan Password Saat Tambah Aparatur:**
     - Klik tombol **+ Tambah Aparatur Baru**.
     - Periksa kolom input **Kata Sandi Awal (Password Login)**: Anda dapat menentukan password login awal (minimal 6 karakter) dengan tombol toggle intip password (ikon mata).
     - Simpan data aparatur baru. Coba logout dan login menggunakan username dan password baru tersebut.
  2. **Fitur Reset Password (Jika Pengguna Lupa Password):**
     - Pada tabel Data Aparatur, perhatikan tombol berikon kunci (`KeyRound`) di samping tombol Edit pada kolom Aksi.
     - Klik tombol kunci tersebut untuk membuka modal **Reset Kata Sandi — [Nama Aparatur]**.
     - Masukkan password baru dan konfirmasi password baru (minimal 6 karakter).
     - Klik **Simpan Kata Sandi Baru**. Notifikasi sukses akan muncul dan aktivitas tercatat pada Audit Log.
     - Pengguna yang lupa password kini dapat langsung login menggunakan password baru hasil reset tersebut.
  3. **Proteksi Wewenang:**
     - Jika Anda login sebagai `OPERATOR`, akun Super Admin tetap terkunci dan tidak dapat direset oleh Operator.
     - Operator dilarang mereset password akunnya sendiri melalui fitur admin reset (diarahkan menggunakan menu Profil Saya).

### Skenario 10: Pengaturan Foto Background Halaman Login & Logo Desa (Overwrite)
* **Peran:** `SUPER_ADMIN` atau `OPERATOR`
* **Navigasi:**
  - Halaman Login: [`/login`](http://localhost:5173/login)
  - Master Data Profil Desa: [`/master/desa`](http://localhost:5173/master/desa)
  - Pengaturan Sistem: [`/settings`](http://localhost:5173/settings) → Tab **6. Branding & Tampilan (Logo & Background)**
* **Pengujian:**
  1. **Tampilan Background Foto di Halaman Login:**
     - Buka halaman login di [`http://localhost:5173/login`](http://localhost:5173/login).
     - Perhatikan foto latar belakang pemandangan instansi desa dengan overlay gradien hijau tua gelap yang elegan dan kontras teks yang tajam.
  2. **Pengaturan Background Foto di Pengaturan Sistem:**
     - Login sebagai Operator atau Super Admin, buka menu **Pengaturan Sistem** (`/settings`), pilih tab **6. Branding & Tampilan**.
     - Perhatikan kartu **Foto Latar Belakang Halaman Login** dengan pratinjau live form login.
     - Anda dapat mengunggah foto kustom (JPG/PNG/WebP maks 3MB), memilih salah satu galeri cepat (Kantor Balai Desa, Persawahan & Alam, Gedung Pemerintahan Modern), atau memasukkan URL kustom.
     - Setiap unggahan foto baru akan langsung meng-*overwrite* latar belakang sebelumnya.
     - Klik tautan **Lihat Login** untuk memeriksa hasil perubahan secara langsung di halaman login.
  3. **Pengaturan & Overwrite Logo Resmi Desa:**
     - Buka menu **Master Data** → **Profil Desa** (`/master/desa`) atau tab **6. Branding & Tampilan** di Pengaturan Sistem.
     - Perhatikan kotak preview logo desa dengan tombol kamera/upload overlay.
     - Klik ikon kamera / tombol **Ganti Logo (Overwrite)** lalu pilih file logo baru (JPG/PNG/WebP maks 2MB).
     - Logo lama akan otomatis tertimpa (*overwritten*) dan seketika ter-update pada Topbar Navbar, Sidebar Menu, form Login, dan Profil Desa tanpa perlu me-refresh browser.
     - Tombol **Reset ke Bawaan** tersedia untuk mengembalikan logo ke `/logo-kadesa.png`.

---

## 5. Keterbatasan Mock Data & Catatan Teknis

1. **Persistensi In-Memory:** Seluruh penambahan transaksi baru disimpan di memori browser dan service runtime mock. Melakukan *hard refresh* (Ctrl+F5) akan mengembalikan data ke seed bawaan di `src/mock/mockData.ts`.
2. **Koneksi Backend:** Aplikasi saat ini **belum** terhubung ke database PostgreSQL atau Supabase live (tahap Backend masih PENDING).
3. **Kamera & Geolocation:** Berjalan menggunakan API browser bawaan (`getUserMedia` dan `geolocation`). Jika browser memblokir izin kamera/lokasi, gunakan tombol fallback simulasi yang telah disediakan pada mode demo.

---

## 6. Langkah Lanjutan

Server development saat ini **tetap aktif dan berjalan di background**. Silakan buka [`http://localhost:5173/`](http://localhost:5173/) di browser Anda untuk memulai pengujian manual.
