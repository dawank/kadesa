PRD — KADESA

Sistem Kehadiran Aparatur Desa

Status: FINAL IMPLEMENTATION BASELINE — PRODUCTION RELEASE GATED BY RELEASE CHECKLIST
Versi: 1.3.0 (Finalized Specification; Production Acceptance Pending)
Tanggal Pembaruan: 10 Oktober 2026
Produk: KADESA
Platform: Responsive Web Application / PWA-ready
Model deployment MVP: 1 deployment = 1 desa; 1 Supabase project = 1 desa

STATUS DAN ATURAN PEMBACAAN DOKUMEN

Dokumen ini adalah spesifikasi produk final untuk perilaku bisnis KADESA. Status “final” berarti requirement dan aturan bisnis dalam dokumen ini dikunci sebagai acuan implementasi; status tersebut TIDAK berarti deployment, konfigurasi desa, keamanan produksi, atau uji lapangan otomatis dinyatakan lulus.

Gerbang produksi tetap harus dibuktikan melalui release checklist pada bagian 41 dan pengujian nyata. Jangan menyatakan KADESA siap digunakan secara resmi sebelum seluruh gerbang wajib lulus.

Urutan otoritas dokumen dan implementasi:
1. Invariant keamanan, constraint integritas, dan aturan wajib yang secara eksplisit dikunci dalam PRD ini.
2. Aturan bisnis dan workflow final dalam PRD ini.
3. Konfigurasi efektif dan master data yang sah untuk tanggal/waktu transaksi.
4. Implementasi fisik database yang benar-benar telah diterapkan, diverifikasi melalui migration ledger dan introspeksi schema remote.
5. UI hanya menyajikan state; UI tidak boleh menggantikan keputusan server/database.

Catatan schema: spesifikasi tabel konseptual pada dokumen ini tidak boleh dipakai untuk menebak atau mengganti nama tabel remote secara otomatis. Sebelum migrasi, bandingkan PRD dengan seluruh migration yang sudah diterapkan dan schema aktual. Migrasi hanya menambah/mengubah struktur yang memang diperlukan; tidak boleh membuat schema paralel, menghapus data, atau melakukan rename/drop secara destruktif. Jika nama tabel/kolom dalam contoh konseptual berbeda dari schema yang telah diterapkan, migration ledger + introspeksi database menjadi acuan untuk perubahan fisik, sedangkan aturan perilaku PRD tetap wajib dipenuhi melalui pemetaan yang terdokumentasi.

Aturan konfigurasi: default adalah nilai awal, bukan kebijakan permanen. Business rule yang dapat berubah wajib disimpan dalam Master Data/System Settings/policy configuration dengan validasi, audit, dan effective date bila berdampak pada histori. Jangan diam-diam menggunakan fallback ketika konfigurasi wajib hilang, invalid, atau konflik; transaksi terkait harus ditolak dengan error yang jelas.

---

1. Overview

KADESA adalah aplikasi web untuk mengelola kehadiran aparatur desa secara terstruktur, aman, dapat diaudit, dan berbasis bukti kehadiran aktual.

Sistem menangani:

autentikasi dan akun pengguna;

master data desa, aparatur, dan jabatan;

kalender kerja, hari libur, dan jam kerja;

Check-In dan Check-Out reguler;

Dinas Luar (DL) dengan workflow verifikasi, approval, dan ratifikasi;

Izin, Sakit, dan Cuti;

Attendance Correction;

monitoring kehadiran;

notifikasi in-app;

laporan dan export;

audit log dan security event;

backup, retention, dan reliability.

Prinsip utama

Role berbeda dengan Jabatan. Role menentukan kewenangan aplikasi; Jabatan adalah posisi organisasi.

Presensi aktual adalah evidence utama. Pengajuan atau surat tugas tidak otomatis berarti hadir.

Official time berasal dari server/database, bukan jam perangkat.

KADESA adalah configuration-driven application. Aturan bisnis dan operasional yang dapat berubah harus berasal dari Master Data atau System Settings, bukan konstanta tersebar di kode.

Histori tidak boleh berubah secara retroaktif. Perubahan konfigurasi berlaku berdasarkan effective date.

Security invariant dan database integrity boleh ditegakkan secara hard-code.

Security dan validasi business-critical dilakukan server/database.

Tidak ada klaim deteksi Fake GPS 100%.

Prinsip Configuration-Driven Business Rules

Semua aturan KADESA diklasifikasikan menjadi:

Kategori

Contoh

Pengelolaan

Immutable / Security Invariant

password hashing, server-side authorization, no duplicate attendance, no destructive history deletion, official server time

hard-code + database constraint bila relevan

System Configuration

jam kerja, tolerance, radius, timezone, retention, upload limit

System Settings, effective-dated

Master Data

jabatan, jenis cuti, jenis ketidakhadiran, hari kerja, hari libur

Master Data, effective-dated bila memengaruhi histori

Workflow / Authority Policy

approval authority, deadline ratifikasi, cancellation policy

configuration/policy, bukan konstanta UI

Aturan:

Frontend bukan source of truth business rule.

Backend/service/RPC membaca konfigurasi aktif berdasarkan tanggal/jam efektif transaksi.

Configuration memiliki effective_from dan bila diperlukan effective_to.

Perubahan konfigurasi tidak boleh mengubah hasil histori yang sudah sah.

Perubahan konfigurasi wajib diaudit.

Nilai default hanya seed/initial configuration, bukan policy permanen.

Configuration invalid atau konflik harus ditolak, bukan diam-diam memakai fallback.

Modul bisnis menggunakan satu Config Resolver agar tidak muncul magic number/magic string yang berbeda antar modul.

Jika diperlukan untuk audit, transaksi menyimpan referensi/versi konfigurasi yang dipakai.

2. Problem Statement

Kehadiran aparatur desa membutuhkan pencatatan yang konsisten dan dapat dipertanggungjawabkan. Proses manual atau sistem yang hanya mencatat status tanpa evidence dapat menimbulkan:

kesulitan memonitor siapa yang hadir;

kesalahan pencatatan jam masuk/pulang;

konflik antara presensi reguler, izin, dan Dinas Luar;

sulitnya melakukan koreksi tanpa merusak histori;

kurangnya jejak audit;

risiko manipulasi lokasi/waktu;

laporan yang tidak konsisten ketika data master berubah.

KADESA menyelesaikan masalah tersebut dengan satu sumber data terstruktur untuk transaksi kehadiran, workflow ketidakhadiran, evidence lokasi, koreksi, approval, audit, dan pelaporan.

3. Product Goals

3.1 Goals MVP

Mencatat Check-In dan Check-Out dengan waktu server.

Memvalidasi lokasi berdasarkan geofence.

Menentukan status harian secara konsisten.

Menangani DL sebagai workflow terpisah namun terintegrasi dengan attendance.

Menangani Izin, Sakit, dan Cuti.

Menyediakan monitoring real-time berdasarkan data transaksi.

Menyediakan koreksi yang tidak merusak histori.

Menyediakan laporan harian/bulanan dan export.

Menyediakan audit log immutable untuk aktivitas penting.

Menyediakan security baseline dan mekanisme backup/recovery.

3.2 Non-goals MVP

Tidak termasuk:

selfie untuk presensi reguler;

QR attendance;

fingerprint;

facial recognition;

liveness detection;

background GPS tracking;

WhatsApp API;

email/push notification sebagai dependensi;

SSO/Google login;

2FA/OTP;

AI anomaly detection;

multi-desa dalam satu deployment;

multi-shift;

advanced custom role/permission.

4. User Roles

4.1 Super Admin

Kewenangan sistem tingkat tertinggi sesuai authority system.

Digunakan untuk:

administrasi sistem;

pengelolaan konfigurasi yang memang menjadi kewenangannya;

bantuan operasional/teknis;

review security event;

tindakan administratif khusus sesuai aturan.

Super Admin bukan subjek attendance default.

4.2 Operator Desa / Admin Desa

Operator Desa (`OPERATOR_DESA`) adalah peran otorisasi sistem aplikasi, yang independen dari posisi jabatan organisasi struktural desa.

Kewenangan utama:

mengelola master data (Desa, Aparatur, Jabatan) sesuai batas wewenang;

monitoring kehadiran harian aparatur;

memproses verifikasi/approval izin dan DL sesuai jenjang wewenang;

melakukan Attendance Correction secara non-destruktif;

mengelola laporan dan export rekapitulasi;

mengatur konfigurasi sistem operasional (jam kerja, toleransi, radius geofence, kop surat resmi);

menetapkan kata sandi awal saat registrasi aparatur dan mereset kata sandi aparatur biasa yang lupa sandi.

Batasan & Kebijakan Keamanan Khusus (ADR-008 & ADR-011):

Hak Eksklusif SUPER_ADMIN: Hanya `SUPER_ADMIN` yang berhak memberikan (`grant`) dan mencabut (`revoke`) peran `OPERATOR_DESA`.

Operator DILARANG mengubah peran akun miliknya sendiri (`actorId === targetId`).

Operator DILARANG menetapkan atau menaikkan peran pengguna mana pun menjadi `OPERATOR_DESA` atau `SUPER_ADMIN`.

Operator DILARANG membuat akun baru dengan peran `OPERATOR_DESA` atau `SUPER_ADMIN`.

Operator DILARANG mengedit, mengubah status, atau menonaktifkan akun `SUPER_ADMIN`.

Operator DILARANG mereset kata sandi akun `SUPER_ADMIN` atau akun miliknya sendiri melalui fitur reset administratif (ADR-014).

Seluruh batasan di atas ditegakkan secara berlapis (defense-in-depth) pada tingkat antarmuka UI, service logic, PostgreSQL Row Level Security (RLS), dan trigger database (`prevent_unauthorized_user_tampering`).

4.3 Kepala Desa

Kewenangan utama:

monitoring;

approval;

final ratification DL;

direct approval DL sesuai workflow;

approval final Cuti;

review transaksi sesuai kewenangan.

4.4 Sekretaris Desa

Kewenangan utama:

monitoring;

approval;

verifikasi DL;

approval DL sesuai kewenangan;

verifikasi Cuti;

proses workflow lain sesuai permission.

4.5 Perangkat Desa

Kewenangan utama:

melihat dashboard pribadi;

Check-In/Check-Out;

mengajukan DL untuk diri sendiri;

mengajukan Izin/Sakit/Cuti;

melihat histori pribadi;

melihat notifikasi;

mengajukan kebutuhan administratif sesuai workflow.

Aturan Role vs Jabatan

Contoh:

Role = Perangkat Desa

Jabatan = Kaur Keuangan

Kepala Desa memiliki:

Role = Kepala Desa

Jabatan = Kepala Desa

Role tidak boleh diinferensikan dari Jabatan.

5. Permission Matrix

Fitur

Super Admin

Operator

Kepala Desa

Sekdes

Perangkat

Login

✓

✓

✓

✓

✓

Dashboard

✓

✓

✓

✓

✓

Master Desa

✓

✓*

lihat

lihat

-

Master Aparatur

✓

✓

lihat

lihat

profil sendiri

Master Jabatan

✓

✓

lihat

lihat

-

Monitoring Attendance

✓

✓

✓

✓

sendiri

Check-In/Out reguler

-

sesuai status subjek

✓

✓

✓

Attendance Correction

authority

✓

-

-

-

Izin/Sakit

authority

✓

✓

✓

submit sendiri

Cuti

authority

verify

final approval

verify

submit sendiri

DL self-submit

-

✓

✓

✓

✓

DL assign untuk orang lain

authority

✓

✓

✓

-

DL verification

✓*

✓

✓ takeover

✓

-

DL approval

✓*

✓

✓

✓

-

DL ratification

-

-

✓

-

-

Laporan

✓

✓

✓

✓

pribadi

Audit / Security Log

✓

✓

✓

✓

-

Reset Password Aparatur

✓

✓*

-

-

-

Kop Surat Resmi & Branding

✓

✓

lihat

lihat

-

* Catatan Otorisasi Khusus:
1. Operator Desa dapat mengelola dan mereset password aparatur biasa, namun dilarang mereset akun Super Admin dan akun miliknya sendiri (ADR-014).
2. Hak baca Audit Log diperluas untuk Kepala Desa dan Sekretaris Desa untuk transparansi pengawasan pemerintahan desa (Migration 20261010000001_audit_rls_policy).
3. Seluruh hak akses ditegakkan mutlak di server dan PostgreSQL RLS, bukan sekadar kontrol antarmuka UI.

6. Master Data

6.1 Desa

Field minimum:

nama desa;

kecamatan;

kabupaten;

provinsi;

kode pos;

alamat;

latitude;

longitude;

logo desa.

Koordinat desa menjadi referensi geofence kantor/desa.

6.2 Perangkat Desa

Field:

foto profil — optional;

NIK — mandatory;

NIPD — optional/nullable;

nama — mandatory;

jabatan — relation ke Master Jabatan;

nomor WhatsApp — mandatory;

username — mandatory;

status aktif — mandatory.

NIPD tidak boleh dibuat globally mandatory karena Kepala Desa dapat tidak memiliki NIPD.

Foto profil bukan evidence attendance.

Aturan foto profil

satu foto profil aktif per record pengguna;

upload baru menggantikan foto lama;

validasi foto baru dilakukan sebelum referensi lama diganti;

jika upload gagal, foto lama tetap aman;

foto tidak menjadi histori file;

perubahan foto dapat dicatat dalam audit log;

MIME/type/size harus divalidasi;

file disimpan aman dan tidak dieksekusi;

database menyimpan reference/path/file ID, bukan binary image.

6.3 Master Jabatan

Master jabatan harus mendukung:

tambah;

edit;

inactive/soft delete.

Jabatan yang sudah digunakan histori tidak boleh dihapus secara destructive.

7. Authentication & Account

MVP harus mendukung:

login;

logout;

active/inactive account;

change password;

reset password;

profile;

session management;

session timeout;

active-account check;

secure credential handling.

Security minimum:

password hashing;

HTTPS;

rate limiting login;

temporary lockout;

secure reset;

session invalidation;

server-side authorization;

CSRF protection jika session-based;

XSS prevention;

SQL injection prevention;

IDOR/BOLA prevention;

secure headers.

8. Dashboard

8.1 Perangkat Desa

Menampilkan:

status kehadiran hari ini;

jam Check-In;

jam Check-Out;

tombol Check-In/Out sesuai state;

pending submission;

histori terbaru;

notifikasi.

Dashboard harus menampilkan:

foto;

nama;

jabatan;

status attendance;

waktu masuk/keluar bila tersedia.

8.2 Operator

Menampilkan:

jumlah HADIR;

TERLAMBAT;

IZIN;

SAKIT;

DL;

CUTI;

ALPHA;

LIBUR;

transaksi/pengajuan yang membutuhkan tindakan;

monitoring aparatur hari ini.

8.3 Kepala Desa / Sekretaris Desa

Menampilkan:

monitoring hari ini;

statistik status;

pending approval;

pending DL;

laporan;

notifikasi workflow.

9. Regular Attendance

9.1 Check-In

Check-In:

hanya satu kali per hari;

menggunakan server timestamp;

membutuhkan GPS/geofence;

tidak membutuhkan selfie;

validasi dilakukan server/database;

tetap diperbolehkan meskipun terlambat.

Jam kerja adalah referensi status, bukan lock tombol.

Contoh:
Jam mulai 07:30, Check-In 07:47:

transaksi tetap berhasil jika valid;

status = TERLAMBAT.

9.2 Check-Out

Check-Out:

hanya jika ada Check-In valid;

hanya satu kali;

tidak boleh dilakukan ulang;

official time server;

tidak otomatis dibuat jika pengguna lupa.

Check-Out keesokan hari bukan transaksi normal untuk hari sebelumnya.

Lupa Check-Out diselesaikan melalui Attendance Correction.

Aturan Kepulangan Awal (Early Leave / ADR-010):

Sesuai ADR-010, kepulangan lebih awal dari jam selesai kerja kantor BUKAN merupakan status primer presensi harian terpisah. Aparatur yang telah melakukan check-in sah dan bekerja tetap mempertahankan status primer `HADIR` (atau `TERLAMBAT` jika masuk terlambat).

Kepulangan lebih awal dimodelkan sebagai atribut transaksi check-out:
- `is_early_leave = true` (dihitung otomatis berdasarkan selisih waktu check-out terhadap jam selesai kerja efektif);
- `early_leave_minutes` (jumlah menit kepulangan sebelum jam selesai kerja);
- `early_leave_reason` (wajib diisi oleh aparatur saat melakukan check-out sebelum jam kerja berakhir).

9.3 Concurrency

Sistem harus melindungi dari:

double-click;

retry akibat network;

duplicate request;

race condition.

Protection wajib berada di database transaction/concurrency layer, bukan UI saja.

10. Geofence & Location Evidence

Setiap attendance menyimpan sekurang-kurangnya:

latitude;

longitude;

GPS accuracy;

server timestamp;

client timestamp sebagai evidence;

distance;

geofence validation result;

anomaly/fraud assessment jika tersedia.

Lokasi harus divalidasi terhadap radius yang dikonfigurasi.

Penegakan Geofence di Server (Server-Side Geofence Enforcement / ADR-014):

Validasi jarak geofence tidak hanya dilakukan di sisi frontend (client-side), tetapi ditegakkan secara mutlak pada level database PostgreSQL melalui trigger `trg_enforce_geofence_attendance_records`. Database menghitung formula Haversine matematis secara otoritatif dan membatalkan transaksi (`RAISE EXCEPTION`) jika jarak check-in melebihi radius aktif kantor desa (20–500m, default 100m).

Fail-Safe Koordinat Lapangan (`OFFICE_COORDINATES_CONFIRMED` / ADR-012):

Pada mode produksi (`IS_DEMO_MODE = false`), jika parameter sistem `OFFICE_COORDINATES_CONFIRMED` bernilai `false`, sistem menerapkan prinsip fail-safe dengan menolak presensi kantor secara aman (`OFFICE_LOCATION_UNCONFIRMED`) hingga Administrator melakukan survei GPS lapangan dan mengonfirmasi koordinat resmi kantor desa.

Sistem tidak boleh menyatakan bahwa Fake GPS dapat dideteksi 100%.

Kategori hasil:

REJECT

FLAG / REVIEW

ACCEPT + WARNING

Validasi objektif seperti koordinat invalid, accuracy invalid, atau lokasi di luar geofence ditolak otomatis oleh database trigger.

Anomali yang belum cukup kuat tidak boleh otomatis ditolak.

Tidak ada background GPS tracking.

11. Status Attendance Harian

Urutan evaluasi:

LIBUR

bukan hari kerja aktif atau tercatat sebagai hari libur.

IZIN / SAKIT / CUTI

hanya APPROVED yang memengaruhi status resmi.

DINAS LUAR

DL APPROVED + valid DL Check-In.

HADIR

regular Check-In valid sesuai jam kerja/toleransi.

TERLAMBAT

Check-In valid setelah jam mulai + toleransi.

ALPHA

hari kerja aktif;

tidak ada absence approved;

tidak ada DL valid;

tidak ada presensi valid sampai akhir hari kerja.

Kasus khusus

DL APPROVED + tidak Check-In → ALPHA + DL APPROVED - TIDAK PRESENSI.

Check-In tanpa Check-Out → tetap HADIR/TERLAMBAT + BELUM CHECK-OUT.

absence PENDING tidak mengubah status resmi.

absence REJECTED setelah tanggal lewat → hitung kondisi aktual.

absence yang kemudian sah disetujui → status laporan dapat dihitung ulang secara transparan untuk periode tersebut, dengan menyimpan histori keputusan/status sebelumnya dan alasan perubahan; jangan menimpa transaksi attendance asli.

hari libur tidak otomatis menjadi hari kerja hanya karena ada transaksi.

DL pada hari libur tidak otomatis mengubah kalender menjadi hari kerja.

12. Dinas Luar (DL)

DL adalah pengecualian lokasi, bukan pengecualian kewajiban attendance.

Aparatur tetap wajib:

Check-In;

Check-Out.

DL tidak memperpendek jam kerja.

12.1 Subject

Subjek attendance dapat mencakup:

Kepala Desa;

aparatur dengan attendance_required = true.

Super Admin bukan subject attendance default.

12.2 Pengajuan

Perangkat dapat self-submit.

Kepala Desa, Sekretaris Desa, Operator, dan Super Admin dapat membuat/menugaskan DL untuk orang lain sesuai authority.

12.3 State Machine

PENDING → VERIFIED → APPROVED → RATIFIED

Verification

Dapat dilakukan oleh:

Sekretaris Desa;

Operator;

Kepala Desa sebagai takeover sesuai kewenangan;

Super Admin sesuai authority system.

Approval

Sekdes/Operator dapat approve sesuai kewenangan.

Approval tersebut menghasilkan APPROVED + deadline ratifikasi 72 jam.

Kepala Desa dapat direct approve dan langsung menjadi RATIFIED.

Ratification

hanya Kepala Desa;

overdue tidak membatalkan DL;

RATIFICATION_OVERDUE tetap dapat diratifikasi.

12.4 Editing

PENDING: pemohon/authority dapat edit.

VERIFIED: pemohon tidak dapat mengubah langsung; authority dapat return ke proses.

APPROVED: locked.

RATIFIED: locked.

Perubahan substansial setelah approval menggunakan cancellation/new assignment, bukan silent edit.

12.5 Cancellation

PENDING: requester/authority.

VERIFIED: authority.

APPROVED/RATIFIED tanpa Check-In: authority sesuai kewenangan.

Setelah Check-In: histori tidak boleh dihapus destructive.

13. DL Locations

Satu DL assignment dapat memiliki banyak lokasi.

Setiap lokasi menyimpan:

latitude;

longitude;

radius;

status active.

Konfigurasi radius:

minimum 25 m;

default 100 m;

maksimum 500 m.

Nilai tersebut adalah konfigurasi awal/operasional sesuai business rule dan tidak boleh dianggap sebagai aturan permanen yang di-hard-code.

14. DL Check-In / Check-Out

14.1 DL Check-In

Wajib:

GPS;

selfie evidence.

Valid jika berada di dalam radius salah satu lokasi DL aktif yang disetujui.

14.2 DL Check-Out

Wajib:

GPS;

selfie evidence.

Valid jika:

berada di salah satu lokasi DL yang valid; atau

berada di geofence kantor/desa.

14.3 Early Leave

Jika Check-Out sebelum jam kerja selesai, catat atribut `is_early_leave = true`, durasi menit lebih awal, dan alasan wajib. `EARLY_LEAVE` bukan status primer harian; status primer tetap `HADIR` atau `TERLAMBAT` sesuai Check-In yang sah.

Check-Out setelah jam kerja selesai dapat menjadi ON_TIME selama geofence valid.

DL tidak mengubah atau memperpendek jam kerja.

15. Selfie Evidence DL

Selfie hanya digunakan untuk DL.

Ketentuan:

wajah harus cukup terlihat;

bukan facial recognition;

bukan liveness detection;

format JPEG/PNG/WebP;

maksimum default 5 MB;

MIME, extension, dan size divalidasi;

compression diperbolehkan;

storage private;

bukan public URL;

akses owner + authority yang berwenang;

secure/private access atau signed URL;

pengguna tidak dapat destructive-delete.

Retensi default 2 tahun dan configurable.

Evidence yang sedang review/audit tidak boleh dihapus sebelum proses selesai.

16. Konflik DL & Regular Attendance

DL PENDING tidak mengubah status.

DL PENDING + datang ke kantor → regular Check-In boleh.

DL APPROVED + regular Check-In di kantor → regular attendance tetap valid.

DL APPROVED + tidak Check-In → ALPHA.

Surat tugas tanpa presensi bukan evidence kehadiran.

Satu aparatur tidak boleh memiliki dua attendance status aktif yang saling bertentangan pada periode sama.

17. Izin

Fitur:

self-submit;

periode tanggal;

alasan;

status;

cancellation.

Hanya APPROVED yang memengaruhi daily attendance.

PENDING tidak mengubah status resmi.

Past-date submission dapat tersedia melalui mekanisme administratif. Batasnya configurable jika diterapkan.

Approved request tidak boleh diedit diam-diam.

18. Sakit

Fitur:

self-submit;

periode tanggal penuh;

alasan;

status;

approval.

Bukti sakit tidak wajib secara default.

Sakit lebih dari satu hari didukung.

Setengah hari tidak termasuk MVP.

19. Cuti

Jenis:

Tahunan;

Melahirkan;

Alasan Penting;

Besar.

Workflow:
SUBMITTED/PENDING → VERIFIED → APPROVED/REJECTED

Verifikasi: Operator/Sekretaris Desa.

Final approval: Kepala Desa.

Lampiran hanya jika diperlukan sesuai jenis/aturan.

Approved Cuti tidak boleh diedit diam-diam.

20. Absence Conflict

Approved absence dan Approved DL tidak boleh aktif overlap pada periode yang sama.

Conflict harus diselesaikan sebelum kedua transaksi menjadi aktif.

Sistem harus melakukan validasi conflict di server/database.

21. Attendance Correction

Correction hanya dapat dilakukan oleh Operator sesuai kewenangan.

Use case:

lupa Check-Out;

kesalahan transaksi;

koreksi administratif yang sah.

Correction wajib menyimpan:

nilai asli;

nilai koreksi;

alasan;

actor;

timestamp;

referensi transaksi.

Correction tidak mengubah atau menghapus histori asli.

Tidak boleh digunakan untuk membuat histori palsu.

22. Monitoring

Operator, Kepala Desa, dan Sekretaris Desa dapat melihat monitoring sesuai permission.

Minimum:

daftar attendance hari ini;

filter tanggal;

filter status;

filter aparatur;

detail Check-In/Out;

lokasi;

correction history;

DL status;

absence status.

Tampilan aparatur sebaiknya memuat:

foto;

nama;

jabatan;

status;

jam masuk;

jam keluar.

23. Notifications

MVP menggunakan in-app notification.

Minimum event:

DL baru;

DL perlu verifikasi;

DL perlu ratifikasi;

approaching DL deadline;

DL overdue;

Izin/Sakit/Cuti perlu diproses;

Correction perlu diproses;

Correction approved;

Correction rejected;

security event perlu review.

Database/workflow adalah source of truth; notifikasi bukan sumber kebenaran transaksi.

WhatsApp API tidak wajib.

24. Reports & Export

Laporan minimum:

harian;

bulanan;

per aparatur;

keterlambatan;

izin;

sakit;

DL;

cuti;

alpha.

Output:

Excel;

PDF;

print langsung.

Histori laporan harus mengikuti effective-date master data, bukan kondisi master data saat ini.

25. Effective-Dated Master Data

Perubahan:

nama;

jabatan;

wilayah;

status aktif;

operator assignment;

harus memiliki effective date dan tidak mengubah histori secara retroaktif.

Contoh:

Januari–Juni: Jabatan A.

Juli: Jabatan B.

Laporan Januari–Juni tetap menggunakan Jabatan A.

Attendance, DL, correction, absence, audit, dan security event tidak boleh berubah hanya karena master berubah.

26. Audit Log

Audit wajib untuk:

login;

logout;

failed login;

password change/reset;

account create/edit/activate/deactivate;

apparatus create/edit/deactivate;

jabatan change;

schedule change;

attendance;

attendance correction;

approval/rejection/cancellation;

DL workflow;

system settings;

radius change;

village location change;

role/permission change;

profile photo change;

critical security event.

Audit/security log harus immutable dan tidak dapat diedit/delete manual.

Audit log dan security event tidak boleh dihapus melalui UI atau oleh Super Admin. Jika kewajiban hukum/retensi mengharuskan pemusnahan di masa depan, perlakukan sebagai prosedur governance terpisah dengan otorisasi, bukti, dan audit yang sesuai; jangan membuat job penghapusan otomatis tanpa kebijakan retensi yang disahkan.

27. Security

Minimum:

password hashing;

HTTPS;

server-side authorization;

role-based access;

cross-role protection;

cross-record protection;

tenant/village isolation;

secure session/token;

session timeout;

login rate limiting;

temporary account lock;

secure password reset;

CSRF protection jika session-based;

SQL injection prevention;

XSS prevention;

IDOR/BOLA prevention;

secure headers;

secure file upload;

server timestamp;

server-side geofence validation;

anti-spoofing/anomaly signals;

audit trail;

encrypted backups;

dependency/security scanning;

DB access restriction;

suspicious activity monitoring.

Tidak boleh mengklaim Fake GPS detection 100%.

28. Reliability, Backup & Recovery

Mandatory:

database backup;

automated/routine backup;

backup retention;

backup verification;

restore testing;

recovery procedure;

application error monitoring;

transaction integrity;

health checks;

DB monitoring;

backup failure alert;

disaster recovery procedure;

log rotation;

resource monitoring.

Backup bukan pengganti histori/audit database.

Attendance tidak auto-delete.

Retention default:

non-attendance: 2 tahun;

selfie evidence: 2 tahun;

configurable bila diperlukan.

29. Architecture

Arsitektur konseptual:

flowchart TD
    A[User Browser / PWA] --> B[Web UI]
    B --> C[Server/API Boundary]
    C --> D[Authentication]
    C --> E[Business Rules]
    C --> F[Database / PostgreSQL]
    C --> G[Private Evidence Storage]

    E --> H[Attendance Engine]
    E --> I[DL Workflow]
    E --> J[Absence Workflow]
    E --> K[Correction]
    E --> L[Notification]
    E --> M[Reporting]

    F --> N[Audit Log / Security Events]
    G --> N

Prinsip arsitektur

PostgreSQL menjadi target production sejak awal.

Official time berasal dari PostgreSQL server.

Identity berasal dari auth.uid().

Business-critical mutation melalui RPC/server boundary.

Config Resolver menjadi jalur standar pembacaan System Settings dan policy configuration.

Geofence berasal dari database configuration.

Business rule configurable tidak boleh tersebar sebagai magic number/magic string.

Konfigurasi yang efektif pada transaksi harus dapat direkonstruksi untuk audit bila diperlukan.

Perubahan configuration diperlakukan sebagai data bisnis dan diaudit.

Audit immutable.

Evidence storage private.

Tidak ada background GPS.

1 deployment = 1 desa.

1 Supabase project = 1 desa.

Tidak menggunakan fake production data.

30. Database Model High-Level (Spesifikasi Skema Database Terkini)

Struktur skema basis data KADESA dirancang berbasis PostgreSQL / Supabase untuk 1 deployment = 1 desa. Struktur ini telah diselaraskan dengan seluruh aturan bisnis, batasan keamanan, pemisahan role/jabatan, koordinat peta interaktif, manajemen password, serta pemisahan identitas visual logo aplikasi vs logo desa.

### 30.1. Klarifikasi Identitas Visual & Aset Brand
1. **Logo Aplikasi KADESA (`/logo-kadesa.png`)**:
   - Merupakan identitas visual software aplikasi KADESA.
   - Ditampilkan permanen pada Sidebar menu brand, Topbar Navbar, form Login header, dan Favicon browser.
   - **Logo aplikasi TIDAK disimpan di database desa** dan **TIDAK PERNAH digantikan oleh logo desa**.
2. **Logo Resmi Desa (`villages.logo_desa`)**:
   - Merupakan lambang/emblem resmi pemerintah desa setempat.
   - Disimpan pada tabel `villages` (`logo_desa TEXT NULL`).
   - Digunakan khusus untuk **media cetak resmi (Kop Surat Laporan Presensi Bulanan/Harian PDF dan Berkas Cetak Fisik)**.
   - Penggantian logo desa memakai mekanisme *overwrite* (menimpa logo desa sebelumnya tanpa mempengaruhi logo aplikasi KADESA).

---

### 30.2. Model data dan pemetaan schema aktual

Entitas bisnis yang wajib didukung oleh model data KADESA meliputi:

- profil/identitas desa dan kantor/geofence;
- akun autentikasi dan profil aparatur;
- jabatan organisasi;
- otoritas sistem dan penugasan Operator bila digunakan oleh implementasi;
- konfigurasi sistem dan jadwal kerja;
- hari libur;
- transaksi attendance reguler;
- penugasan DL dan lokasi DL;
- evidence presensi DL;
- permohonan ketidakhadiran;
- koreksi attendance;
- audit log dan security event;
- notifikasi in-app.

Daftar di atas adalah daftar entitas logis, bukan perintah untuk membuat tabel baru dengan nama yang sama. Nama tabel, nama kolom, tipe, FK, constraint, index, trigger, RLS, RPC, dan jumlah tabel fisik harus mengikuti migration yang benar-benar sudah diterapkan dan schema remote yang diverifikasi. Jangan mengimplementasikan tabel `users`/`attendance_records` hanya karena muncul pada rancangan lama jika schema aktual menggunakan pemetaan berbeda. Jangan menyimpan password hash aplikasi sendiri apabila identitas dikelola Supabase Auth. Kredensial harus dikelola Supabase Auth; tabel profil hanya menyimpan relasi identitas dan atribut profil yang diperlukan.

Sebelum perubahan schema, wajib lakukan: (1) inventaris seluruh migration, (2) verifikasi migration yang sudah diterapkan, (3) introspeksi schema remote, (4) pemetaan entitas logis ke tabel/kolom aktual, (5) pemeriksaan RLS/policy/trigger/function/privilege, dan (6) rencana migration non-destruktif. Hasil pemetaan harus disimpan sebagai dokumentasi schema aktual yang dihasilkan dari database, bukan ditulis berdasarkan asumsi.

### 30.3. Integritas database dan migrasi

- Foreign key harus menjaga histori; jangan gunakan cascade delete untuk transaksi attendance, correction, audit, atau security event. Cascade hanya boleh dipakai pada child data yang memang tidak memiliki nilai historis mandiri, setelah dampaknya ditinjau.
- Gunakan unique/check constraints untuk invariant yang relevan, termasuk satu attendance reguler per aparatur per tanggal bila sesuai model transaksi.
- Check-In dan Check-Out harus transaksional dan tahan race condition; proteksi tidak boleh hanya mengandalkan pemeriksaan frontend.
- Check-Out harus atomic dan hanya berhasil jika attendance milik pengguna yang terautentikasi masih belum memiliki Check-Out. Periksa jumlah row yang berubah; zero rows berarti gagal, bukan sukses.
- RPC berprivilege tinggi wajib memvalidasi `auth.uid()`, memiliki `search_path` yang aman, privilege EXECUTE minimal, dan tidak membuka jalur privilege escalation.
- RLS aktif pada seluruh tabel yang dapat diakses melalui API; tabel audit/security append-only untuk pengguna aplikasi.
- Schema migration harus dapat ditelusuri dan non-destruktif. Jangan menjalankan DROP/rename/drop-column atau reset database untuk menyamakan schema dengan contoh dokumen.
- Index dipilih berdasarkan query nyata dan pola filter/pagination; jangan mengklaim index geospatial hanya karena koordinat disimpan sebagai angka.

31. State Machines

Attendance

NO_ATTENDANCE → CHECKED_IN → CHECKED_OUT

Daily status dapat menjadi:
LIBUR | HADIR | TERLAMBAT | IZIN | SAKIT | DINAS_LUAR | CUTI | ALPHA

DL

PENDING → VERIFIED → APPROVED → RATIFIED

Additional:
APPROVED → RATIFICATION_OVERDUE

Rejection/cancellation harus menghasilkan histori state transition dan tidak menghapus record.

Absence

PENDING → APPROVED
atau
PENDING → REJECTED

Cancellation harus menghasilkan histori.

Correction

REQUESTED → APPROVED
atau
REQUESTED → REJECTED

32. User Flows

Regular Attendance

User login.

Sistem memeriksa account active.

User membuka dashboard.

Sistem membaca state attendance hari ini.

User menekan Check-In.

Client mengirim location evidence.

Server mengambil official timestamp.

Server/database validasi account, duplicate, geofence, dan anomaly.

Jika valid, transaksi dibuat.

Daily status diperbarui menjadi HADIR/TERLAMBAT.

Audit event dicatat.

Check-Out tersedia.

User Check-Out.

Server memvalidasi Check-In dan location.

Transaksi selesai.

DL

User/authority membuat DL.

State PENDING.

Authority melakukan verification.

State VERIFIED.

Approval dilakukan.

State APPROVED + deadline 72 jam, atau direct RATIFIED oleh Kepala Desa.

User melakukan DL Check-In dengan GPS + selfie.

Sistem memvalidasi lokasi dan evidence.

User melakukan DL Check-Out.

Evidence dan attendance tersimpan.

Kepala Desa melakukan ratifikasi jika diperlukan.

Semua transisi dicatat.

Correction

Operator memilih attendance.

Sistem menampilkan nilai asli.

Operator memasukkan koreksi + alasan.

Server memvalidasi permission.

Correction transaction dibuat.

Original history dipertahankan.

Audit log dibuat.

Daily status dihitung ulang bila diperlukan.

33. Acceptance Criteria

Configuration & Settings

Admin berwenang dapat mengubah parameter configurable tanpa perubahan kode.

Perubahan memiliki effective date.

Sistem menggunakan konfigurasi aktif berdasarkan tanggal transaksi.

Konfigurasi baru tidak mengubah histori yang sudah sah.

Konfigurasi invalid ditolak.

Effective date overlap untuk key yang sama ditolak.

Perubahan configuration tercatat di audit log.

Frontend tidak dapat membypass server-side configuration.

Tidak ada magic number untuk parameter yang sudah dinyatakan configurable.

Jika sebuah aturan belum diputuskan configurable atau immutable, statusnya ditandai TBD dan tidak boleh diam-diam di-hard-code.

Attendance

Check-In hanya satu kali per hari.

Check-Out hanya setelah Check-In valid.

Check-Out kedua ditolak.

Check-In kedua ditolak.

Double request tidak menghasilkan duplicate.

Jam berasal dari server.

Check-In terlambat tetap berhasil jika valid.

Geofence invalid ditolak.

Forget Check-Out tidak menghasilkan fake Check-Out.

Correction tidak menghapus histori asli.

Daily Status

Hari libur tanpa attendance = LIBUR.

Workday tanpa attendance/approved absence = ALPHA.

Check-In dalam batas = HADIR.

Check-In setelah tolerance = TERLAMBAT.

Approved absence mengubah status sesuai tipe.

Pending absence tidak mengubah status.

Approved DL + valid DL Check-In = DINAS LUAR.

Approved DL tanpa Check-In = ALPHA + indicator.

Check-In tanpa Check-Out = status tetap + BELUM CHECK-OUT.

DL

DL harus melalui workflow.

APPROVED dari Sekdes/Operator memiliki deadline 72 jam.

Overdue tidak auto-cancel.

Hanya Kepala Desa dapat ratify.

APPROVED/RATIFIED locked.

Setelah Check-In tidak boleh destructive-delete.

DL Check-In/Out membutuhkan GPS + selfie.

Check-In valid di salah satu DL location.

Check-Out valid di DL location atau village geofence.

Early Check-Out membutuhkan alasan.

Absence

Pending tidak mengubah official daily status.

Approved absence dan approved DL tidak boleh overlap.

Cuti final approval oleh Kepala Desa.

Approved request tidak boleh silent edit.

Past-date submission tidak mengubah timestamp attendance.

Security

User tidak dapat mengakses record di luar authority.

Role UI bukan satu-satunya authorization layer.

Audit event tercatat untuk critical mutation.

Evidence tidak public.

Evidence tidak dapat destructive-delete oleh user.

Failed login dapat dimonitor.

Security event dapat direview.

34. QA / Test Scenarios

Minimum test suite harus mencakup:

Attendance

normal Check-In;

late Check-In;

duplicate Check-In;

Check-Out without Check-In;

duplicate Check-Out;

double-click;

network retry;

Check-In outside geofence;

invalid accuracy;

missing GPS;

server/client timestamp mismatch;

forgot Check-Out;

next-day Check-Out attempt.

Daily Status

workday no attendance;

holiday;

pending absence;

approved absence;

rejected past absence;

approved DL with Check-In;

approved DL without Check-In;

regular Check-In while DL pending;

regular Check-In while DL approved.

DL

self submit;

assignment by authority;

verification;

approval;

direct ratification;

overdue;

rejection;

cancellation;

edit before verification;

lock after approval;

multiple locations;

invalid location;

selfie invalid;

selfie oversized;

early Check-Out;

Check-Out at village office.

Security

cross-user access;

cross-role access;

IDOR;

unauthorized correction;

unauthorized approval;

unauthorized evidence access;

malicious upload;

rate limiting;

session expiry;

inactive account login;

audit tampering attempt.

Data Integrity

transaction rollback;

concurrent Check-In;

concurrent approval;

duplicate unique key;

foreign-key violation;

state transition violation;

backup/restore test.

35. Non-Functional Requirements

Performance

Target baseline:

normal authenticated page response should be responsive under expected village-scale load;

attendance mutation should provide clear success/failure feedback;

critical mutation must be atomic.

Exact performance SLA remains TBD after deployment sizing.

Availability

MVP should include:

health check;

monitoring;

backup;

recovery procedure;

error logging.

Exact uptime SLA = TBD.

Security

Security requirements in Section 27 are mandatory baseline.

Auditability

Critical transaction harus dapat ditelusuri:
who → what → when → before → after → reason.

Privacy

Location/evidence/profile data hanya dapat diakses sesuai scope.

Selfie evidence private by default.

36. Configuration & Settings Architecture

36.1 Tujuan

KADESA harus dapat menyesuaikan kebijakan desa tanpa perubahan kode untuk perubahan operasional yang wajar.

System Settings bukan sekadar halaman UI, tetapi merupakan sumber konfigurasi resmi yang dibaca oleh business-rule engine.

36.2 Parameter yang wajib configurable

Kalender & jam kerja

hari kerja;

jam mulai kerja;

jam selesai kerja;

toleransi keterlambatan;

hari libur;

timezone.

Geofence

koordinat kantor/desa;

radius presensi reguler;

radius lokasi DL;

batas minimum/maksimum radius jika kebijakan tersebut digunakan.

Workflow

authority approval;

DL ratification deadline;

aturan cancellation;

batas submission tanggal lampau;

policy evidence bila memang configurable.

Data & evidence

batas ukuran selfie;

format file;

retention non-attendance;

retention selfie evidence;

retention lain yang memang diizinkan.

Notifikasi

event yang menimbulkan notifikasi;

prioritas;

reminder/deadline;

enabled/disabled per kategori.

Security

session timeout;

batas percobaan login;

durasi lockout;

password policy yang memang diizinkan untuk dikonfigurasi.

Branding & Tampilan (Kategori: BRANDING)

logo resmi desa untuk media cetak (disimpan terpisah dan tidak menggantikan logo aplikasi KADESA);

foto latar belakang visual halaman login (mendukung unggahan gambar overwrite, rekomendasi galeri, dan tautan custom).

Pengaturan Kop Surat Resmi Media Cetak (Kategori Terpisah: LETTERHEAD)

pemisahan kategori mandiri dari branding umum aplikasi;

pilihan template preset dinas siap pakai (Standar Pemda, Modern Sans, Bookman Elegan, Dua Logo Simetris);

tata letak kop surat (logo kiri teks tengah, logo kiri teks kiri, dua logo kiri & kanan, logo tengah);

jenis huruf naskah dinas (Times New Roman, Arial, Bookman Old Style, Georgia, Tahoma);

gaya garis pembatas (garis ganda / double line resmi, garis solid tebal, tipis, tanpa garis);

ukuran logo di kop surat dan opsi tampil/sembunyi;

pengaturan independen di setiap baris (Baris 1 s/d Baris 4: teks, ukuran font dalam pt, ketebalan, gaya miring/italic, kapitalisasi, dan spasi huruf);

integrasi langsung ke generator dokumen PDF laporan harian dan bulanan.

36.3 Effective-Dated Configuration

Configuration yang memengaruhi hasil bisnis harus mendukung effective date.

Contoh:

Periode

Jam masuk

Toleransi

Jan–Jun

07:30

15 menit

Jul–Des

08:00

10 menit

Attendance bulan Juni tidak boleh dihitung memakai konfigurasi Juli.

36.4 Configuration Validation

Sebelum disimpan:

tipe data benar;

rentang nilai valid;

effective date tidak overlap;

dependency antar-setting valid;

authority configuration tidak melanggar security invariant;

perubahan dapat diaudit.

36.5 Configuration Precedence

Urutan sumber aturan:

security invariant / database integrity;

active system configuration;

master data;

transaction-specific data;

UI display preference.

UI tidak boleh mengalahkan server-side rule.

36.6 Configuration Versioning & Audit

Perubahan penting minimal mencatat:

siapa;

kapan;

parameter;

nilai sebelum;

nilai sesudah;

effective date;

alasan bila policy mewajibkannya.

Configuration historis tidak diubah secara destructive.

36.7 Configuration Resolver

Secara konseptual seluruh modul meminta konfigurasi melalui resolver terpusat:

getActiveSetting(key, transaction_date)

Tujuan:

menghindari magic number;

mencegah aturan berbeda antar modul;

konsisten dengan effective date;

memudahkan testing dan audit.

36.8 Default Values

Default adalah initial setup/seed.

Default boleh berupa:

radius awal;

jam kerja awal;

timezone awal;

retention awal.

Default dapat diubah melalui pengaturan jika parameter tersebut configurable.

Default bukan hard-coded business policy.

36.9 Yang Tetap Boleh Hard-Code

Hanya invariant, misalnya:

password tidak boleh plaintext;

authorization wajib server-side;

tidak boleh ada dua Check-In valid pada hari yang sama;

Check-Out membutuhkan Check-In valid;

audit kritis tidak boleh diedit manual;

histori tidak boleh dihapus destructive;

official time dari server/database;

evidence private by default;

database foreign key/integrity constraint;

security boundary dan anti-bypass control.

37. Technical Constraints

PostgreSQL digunakan sebagai target production dari awal.

Supabase dapat digunakan sebagai platform database/auth/storage bila dipilih.

Server/database menjadi source of truth.

auth.uid() menjadi identity reference.

Business-critical mutation melalui server boundary/RPC.

Evidence storage private.

Tidak ada background GPS.

Tidak ada fake production data.

Tidak ada destructive mutation untuk menghapus histori.

Audit log immutable.

RLS/authorization harus membatasi akses record.

Geospatial validation dilakukan server/database.

Concurrency protection wajib berada pada transaction/database layer.

Business rule configurable harus dibaca melalui configuration layer/resolver.

Parameter configurable tidak boleh diduplikasi sebagai hard-coded constant di banyak modul.

Effective-dated configuration digunakan ketika perubahan policy dapat memengaruhi hasil historis.

Configuration change harus auditable.

38. Deployment Model

MVP:

1 deployment = 1 desa

1 Supabase project = 1 desa

Tidak ada multi-tenant/multi-desa dalam satu project.

Keuntungan:

isolasi data lebih sederhana;

RLS lebih sederhana;

konfigurasi lebih sederhana;

risiko pencampuran data lebih kecil.

Multi-desa hanya menjadi proyek arsitektur baru jika kebutuhan muncul.

39. Out of Scope

selfie regular attendance;

QR attendance;

fingerprint;

facial recognition;

liveness detection;

background GPS;

WhatsApp API;

email/push provider;

SSO;

2FA/OTP;

AI anomaly detection;

native mobile app sebagai requirement MVP;

multi-shift;

multi-desa/multi-tenant;

advanced custom roles;

advanced permission builder.

40. Keputusan Arsitektur & Status TBD

40.1 Keputusan yang Telah Ditetapkan & Divalidasi (Closed & Validated Decisions):

1. Desain UI & Branding Visual: Selesai ditetapkan. Logo aplikasi `/logo-kadesa.png` bersifat permanen di UI; `villages.logo_desa` digunakan khusus dokumen cetak/PDF; foto latar belakang login dinamis.
2. Pengaturan Kop Surat Dinas (Letterhead): Selesai ditetapkan sebagai kategori konfigurasi mandiri (`LETTERHEAD`) dengan 4 baris teks dinamis, konfigurasi garis batas (`border_style`), pratinjau live WYSIWYG, dan integrasi cetak laporan PDF.
3. Hak Akses & Penugasan Operator Desa (ADR-008 & ADR-011): Selesai ditetapkan. Peran `OPERATOR_DESA` independen dari jabatan organisasi. Hak penugasan (`grant`) dan pencabutan (`revoke`) peran Operator Desa adalah wewenang eksklusif `SUPER_ADMIN`. Operator dilarang keras mengubah peran sendiri, membuat akun Operator/Super Admin, dan mengedit Super Admin.
4. Manajemen Kata Sandi Aparatur (ADR-014): Selesai ditetapkan. Super Admin & Operator Desa dapat menetapkan kata sandi awal (min 6 karakter) saat registrasi dan mereset kata sandi aparatur biasa jika lupa sandi. Operator dilarang mereset akun Super Admin dan akun miliknya sendiri.
5. Status Kepulangan Awal (Early Leave / ADR-010): Selesai ditetapkan. Status primer harian dikunci pada 8 nilai (`HADIR`, `TERLAMBAT`, `ALPHA`, `IZIN`, `SAKIT`, `DINAS_LUAR`, `CUTI`, `LIBUR`). Kepulangan lebih awal dicatat sebagai atribut transaksi check-out: `is_early_leave`, `early_leave_minutes`, dan `early_leave_reason`.
6. Penegakan Geofence di Server (Server-Side Enforcement / ADR-014): Selesai ditetapkan dan ditegakkan secara mutlak di database melalui trigger PostgreSQL `trg_enforce_geofence_attendance_records` menggunakan formula matematis Haversine.
7. Fail-Safe Koordinat Lapangan (ADR-012): Selesai ditetapkan. Parameter `OFFICE_COORDINATES_CONFIRMED` melindungi lingkungan operasional produksi dari salah presensi sebelum koordinat kantor desa disurvei dan disahkan secara resmi.
8. Immutability Audit Log (WORM Model): Selesai ditetapkan. Tabel `audit_logs` dilarang di-UPDATE atau di-DELETE secara mutlak oleh trigger `trg_deny_audit_logs_mutation`, dan pencatatan audit menggunakan fungsi stored procedure `record_system_audit_event()`.
9. Resiliensi sesi Supabase: gunakan pola sesi resmi Supabase yang sesuai dengan arsitektur Next.js (cookie/session pada server bila SSR). Jangan menambahkan persistensi token atau fallback Bearer buatan hanya untuk melewati trigger. Setiap RPC tetap harus memperoleh identitas dari sesi terverifikasi dan `auth.uid()`; bila mekanisme sesi dan trigger tidak kompatibel, perbaiki integrasi autentikasi/otorisasi, bukan melemahkan kontrol keamanan.
10. Daftar key System Settings: nama key teknis dan schema konfigurasi dijaga oleh aplikasi/migration agar konsisten, tetapi nilai operasional yang memang configurable dapat diubah oleh otoritas yang berwenang. Menambah key baru memerlukan perubahan kode/schema yang ditinjau; pengguna biasa tidak dapat mengubah struktur key atau menghapus konfigurasi yang sedang dipakai histori.
11. Format Export Laporan: Selesai ditetapkan. Mendukung Excel XML Spreadsheet dan PDF print layout dinamis terintegrasi kop surat desa aktif (orientasi Portrait & Landscape serta penomoran halaman otomatis).

40.2 Keputusan yang tidak termasuk business-rule blocker MVP

- Target SLA jaringan pada area blank spot/sinyal lemah: belum dijanjikan sebagai SLA angka. Aplikasi harus memberi error yang jelas, tidak membuat transaksi seolah berhasil, dan mendukung retry yang aman.
- Integrasi otomatis kalender hari libur kabupaten/provinsi: di luar MVP; hari libur dikelola melalui master data sampai integrasi eksternal disetujui.
- Kebijakan retensi jangka panjang untuk audit/security log dan backup off-site: wajib ditetapkan oleh pemilik operasional sebelum penggunaan resmi. Sampai kebijakan tersebut disahkan, jangan mengaktifkan penghapusan otomatis audit/security log.

Tidak ada nilai bisnis yang boleh ditebak oleh developer. Parameter operasional yang belum diisi harus tampil sebagai `PENDING CONFIGURATION` dan memblokir hanya fitur/transaksi yang bergantung langsung padanya.

41. Product Principles / Definition of Done

Fitur KADESA dianggap siap bukan hanya ketika UI selesai.

Untuk fitur business-critical, Definition of Done minimal:

Requirement/Business Rule jelas.

Permission jelas.

State transition jelas.

Database integrity tersedia.

Server-side validation tersedia.

Audit event tersedia.

Error state ditangani.

Concurrency diperhitungkan.

Security test tersedia.

Acceptance criteria lulus.

Tidak merusak histori.

Tidak menggunakan fake production data.

42. Architecture Quality Gate

Sebelum fitur business-critical siap implementasi, reviewer harus memastikan:

Aturan diklasifikasikan sebagai business rule, security invariant, master data, atau transaction-specific rule.

Business rule yang dapat berubah tidak di-hard-code.

Configuration yang berubah terhadap waktu memiliki effective date.

Histori tetap reproducible setelah configuration berubah.

Frontend bukan source of truth.

Server/database menegakkan aturan.

Configuration change diaudit.

Tidak ada magic number/string untuk parameter configurable.

State transition memakai configuration aktif yang benar.

Rollback configuration tidak mengubah histori.

Jika belum jelas, fitur belum architecture-ready.

43. Source of Truth dan aturan perubahan

1. Invariant keamanan/integritas yang ditetapkan dalam PRD ini.
2. Aturan bisnis, status, workflow, dan acceptance criteria dalam PRD ini.
3. System Settings/Master Data yang valid dan efektif untuk waktu transaksi.
4. Migration ledger + schema remote yang terverifikasi untuk bentuk fisik database.
5. Kode aplikasi sebagai implementasi dari aturan di atas, bukan sebagai otoritas yang dapat mengubahnya diam-diam.

Jika PRD dan database aktual tidak cocok, jangan menebak dan jangan langsung melakukan migration destruktif. Buat daftar mismatch, jelaskan dampak, dan lakukan perubahan migration non-destruktif yang menyelaraskan schema aktual dengan perilaku wajib PRD. Jika perubahan menyentuh aturan bisnis yang belum diputuskan, tandai `PENDING CONFIGURATION` atau minta keputusan pemilik produk sebelum mengaktifkannya.

Perubahan terhadap PRD harus memiliki nomor versi, tanggal, ringkasan perubahan, dampak terhadap database/API/UI, dan rencana regresi. Dokumen ini menggantikan versi PRD KADESA sebelumnya untuk implementasi berikutnya, kecuali jika suatu keputusan eksplisit telah disepakati setelah tanggal versi dokumen ini.


44. Production Release Gate — Wajib Sebelum Pemakaian Resmi

KADESA hanya boleh dinyatakan siap produksi operasional setelah seluruh item berikut diverifikasi dengan bukti yang dapat diperiksa:

- [ ] Repository/commit yang dideploy sesuai dengan source code yang telah diuji.
- [ ] Vercel Production deployment aktif dan URL HTTPS benar-benar dapat diakses.
- [ ] Environment variable production terisi sesuai arsitektur; secret hanya berada di server dan tidak muncul di bundle/log/browser.
- [ ] Aplikasi tersambung ke Supabase project yang benar; tidak menggunakan project Supabase otomatis dari integrasi Vercel secara tidak sengaja bila target database yang dimaksud berbeda.
- [ ] Migration ledger dan schema remote telah direkonsiliasi; RLS, policy, RPC, trigger, grants, dan Storage policies telah diperiksa.
- [ ] Seluruh placeholder identitas desa telah diganti dengan data resmi.
- [ ] Koordinat kantor telah diukur di lapangan, diverifikasi, disimpan, dan ditandai terkonfirmasi.
- [ ] Radius geofence, jadwal, toleransi, timezone, hari libur, retensi, dan parameter wajib lain telah ditetapkan oleh pihak berwenang.
- [ ] Akun Super Admin awal bukan akun test dan dikelola secara aman; akun uji/ephemeral dan data uji sudah dibersihkan.
- [ ] Akun aparatur dibuat melalui proses resmi; tidak ada akun atau attendance dummy di lingkungan produksi.
- [ ] Login/logout/reset/change password, role authorization, route protection, RLS, dan direct mutation rejection lulus tes.
- [ ] Check-In/Check-Out diuji dengan GPS nyata di dalam dan di luar geofence; server time dan concurrency terbukti benar.
- [ ] DL multi-lokasi, GPS+selfie, approval, ratifikasi, deadline, cancellation, dan konflik dengan attendance diuji sesuai state machine.
- [ ] Izin/Sakit/Cuti, correction, audit/security log, laporan, print/PDF, dan Excel diuji dengan data yang sah.
- [ ] Backup aktif, retensi backup terdokumentasi, restore diuji, dan prosedur pemulihan diketahui pengelola.
- [ ] Uji smartphone fisik pada jaringan desa dilakukan dan hasilnya dicatat.
- [ ] Tidak ada blocker keamanan, data integrity, atau business workflow yang belum ditutup.

Jika satu item wajib belum lulus, status harus `PRE-PRODUCTION` atau `BLOCKED`, bukan `PRODUCTION READY`. Laporan test otomatis bukan pengganti uji koordinat kantor nyata, pemeriksaan konfigurasi resmi, dan penerimaan pengguna lapangan.

45. Change Log

- v1.3.0 — Menegaskan status PRD sebagai acuan implementasi final tanpa mengklaim peluncuran produksi sudah lulus; menetapkan aturan precedence sumber kebenaran; mengoreksi konflik antara skema konseptual dan schema/migration aktual; menegaskan penggunaan Supabase Auth tanpa password hash lokal; memperkuat kebijakan sesi, audit/retensi, effective-dated configuration, dan production release gate.
