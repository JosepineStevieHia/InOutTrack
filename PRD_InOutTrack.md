# INOUTTRACK

Product Requirements Document (PRD) --- Revisi

Aplikasi Web Pemantauan Barang Masuk dan Keluar di Lingkungan Perusahaan
Manufaktur

Versi: 1.1 \| Status: Draft revisi untuk dasar analisis, desain, dan
pengembangan

## 1. Overview

InOutTrack adalah aplikasi web untuk mencatat dan memantau pergerakan
barang masuk dan barang keluar di lingkungan perusahaan manufaktur.
Aplikasi memusatkan informasi waktu transaksi, nama barang, jumlah dan
satuan, pihak pengantar/pengambil, pihak penerima/pemberi, asal/tujuan,
jenis pekerjaan, deskripsi pekerjaan, serta foto barang dalam satu
sistem.

Sistem menyediakan pencatatan barang masuk dan keluar, riwayat transaksi
gabungan, pencarian dan filter, ringkasan pencatatan, pengelolaan akun,
serta ekspor riwayat ke PDF dan Excel khusus Staf Administrasi (Admin).
Foto transaksi dapat diperoleh melalui kamera perangkat atau dengan
mengunggah file foto yang sudah tersedia.

Fokus MVP adalah kebutuhan pencatatan dan penelusuran pergerakan barang
di lingkungan perusahaan manufaktur. Potensi penggunaan di sektor lain
belum menjadi fokus dan perlu divalidasi terpisah.

## 2. Tujuan dan Metrik Keberhasilan

| Tujuan \| Metrik keberhasilan \| Catatan \|

| --- \| --- \| --- \|

| Mempercepat pencatatan barang \| 80% transaksi masuk/keluar selesai
  kurang dari 2 menit sejak form dibuka, termasuk penambahan foto. \|
  Target awal/asumsi; dievaluasi setelah uji coba. \|

| Meningkatkan kelengkapan data \| 95% transaksi memiliki seluruh field
  wajib terisi, termasuk foto. \| Target awal/asumsi; dievaluasi setelah
  uji coba. \|

| Mempermudah penelusuran riwayat \| 90% pencarian menemukan data dalam
  kurang dari 30 detik sejak halaman riwayat dibuka. \| Target
  awal/asumsi. \|

| Mempermudah pelaporan administrasi \| Admin dapat mengekspor data
  sesuai filter aktif ke PDF atau Excel. Ekspor 1.000 baris ditargetkan
  selesai kurang dari 10 detik. \| Target performa awal/asumsi. \|

## 3. Target Pengguna dan Persona

### 3.1 Persona 1 --- Staf Administrasi (Admin)

-   Peran: mengelola aplikasi dan akun pengguna, memantau seluruh
    transaksi, mengoreksi data transaksi yang salah, serta mengekspor
    laporan.

-   Kebutuhan utama: melihat seluruh transaksi; mencari dan memfilter
    riwayat; melihat ringkasan; membuat, mengubah, menonaktifkan, dan
    menghapus akun; mengubah atau menghapus transaksi; mengekspor
    riwayat ke PDF dan Excel; meninjau log audit.

-   Pain point: data tersebar dan sulit dilacak; sulit memastikan siapa
    yang menerima atau mengambil barang dan untuk pekerjaan apa;
    penyusunan laporan membutuhkan penelusuran catatan secara manual.

### 3.2 Persona 2 --- Petugas Store dan Security

-   Peran: melakukan pencatatan barang masuk dan barang keluar sesuai
    aktivitas penerimaan atau pengeluaran barang.

-   Kebutuhan utama: form pencatatan yang sederhana dan cepat; dapat
    mengisi data transaksi; dapat menambahkan foto melalui kamera
    perangkat atau mengunggah foto dari galeri/folder perangkat; dapat
    melihat, mencari, dan memfilter riwayat transaksi untuk membantu
    penelusuran.

-   Batasan akses: tidak dapat mengelola akun, mengubah atau menghapus
    transaksi, melihat/mengelola log audit, maupun mengekspor riwayat.

-   Pain point: pencatatan manual memakan waktu dan rawan terlewat,
    terutama saat beberapa pengiriman datang atau barang keluar dalam
    waktu berdekatan.

## 4. Ruang Lingkup

### 4.1 In Scope --- MVP

-   Autentikasi login dan logout dengan dua role: Admin (Staf
    Administrasi) dan Petugas Store/Security.

-   Manajemen akun pengguna oleh Admin.

-   Pencatatan barang masuk dengan foto melalui kamera atau unggah file.

-   Pencatatan barang keluar dengan foto melalui kamera atau unggah
    file.

-   Riwayat transaksi gabungan untuk Admin dan Petugas.

-   Pencarian dan filter berdasarkan nama barang, petugas, jenis
    transaksi, jenis pekerjaan, serta rentang tanggal.

-   Ringkasan jumlah pencatatan total, masuk, dan keluar.

-   Ekspor riwayat ke PDF dan Excel yang hanya dapat dilakukan Admin.

-   Perubahan dan soft delete transaksi oleh Admin.

-   Log audit untuk aksi perubahan dan penghapusan transaksi.

-   Master data jenis pekerjaan untuk digunakan pada form transaksi.

### 4.2 Out of Scope

-   Manajemen stok/inventori, saldo stok, dan stok minimum.

-   Integrasi ERP, barcode/QR scanner, atau sistem akuntansi.

-   Aplikasi mobile native.

-   Notifikasi email atau WhatsApp.

-   Alur persetujuan (approval) multi-level.

-   Dukungan multi-perusahaan/multi-tenant.

-   Mode offline penuh.

## 5. Kebutuhan Fungsional

| ID \| Kebutuhan \|

| --- \| --- \|

| FR-001 \| Sistem menyediakan login menggunakan username/email dan
  password serta logout. Sesi pengguna berakhir sesuai konfigurasi
  keamanan. \|

| FR-002 \| Sistem menyediakan dua role, yaitu Admin (Staf Administrasi)
  dan Petugas Store/Security, dengan hak akses berbeda. \|

| FR-003 \| Admin dapat membuat, melihat, mengubah, menonaktifkan, dan
  menghapus akun pengguna serta menetapkan role. \|

| FR-004 \| Petugas dapat mencatat barang masuk dengan tanggal-jam
  kedatangan, nama barang, jumlah, satuan, jenis pekerjaan, deskripsi
  pekerjaan, asal barang, nama pengantar, nama penerima otomatis dari
  akun login, dan foto. \|

| FR-005 \| Petugas dapat mencatat barang keluar dengan tanggal-jam
  keluar, nama barang, jumlah, satuan, jenis pekerjaan, deskripsi
  pekerjaan, tujuan, nama pengambil, nama pemberi otomatis dari akun
  login, dan foto. \|

| FR-006 \| Foto transaksi dapat ditambahkan dengan mengambil foto
  langsung melalui kamera browser atau mengunggah foto dari perangkat.
  \|

| FR-007 \| Admin dan Petugas dapat melihat riwayat transaksi gabungan,
  termasuk detail transaksi dan foto. \|

| FR-008 \| Admin dan Petugas dapat mencari dan memfilter riwayat
  berdasarkan nama barang, petugas, jenis transaksi, jenis pekerjaan,
  rentang tanggal, dan pencarian teks bebas. \|

| FR-009 \| Sistem menampilkan ringkasan jumlah pencatatan: total,
  barang masuk, dan barang keluar berdasarkan periode/filter yang
  dipilih. \|

| FR-010 \| Hanya Admin yang dapat mengekspor hasil riwayat sesuai
  filter aktif ke PDF dan Excel. Petugas tidak memiliki akses ke fungsi
  maupun endpoint ekspor. \|

| FR-011 \| Hanya Admin yang dapat mengubah atau menghapus transaksi.
  Penghapusan dilakukan dengan soft delete. \|

| FR-012 \| Sistem mencatat aksi perubahan dan penghapusan transaksi ke
  log audit, termasuk pengguna, waktu, jenis aksi, dan detail perubahan.
  \|

| FR-013 \| Admin dapat mengelola master data jenis pekerjaan yang
  tersedia pada form pencatatan. \|

## 6. Validasi dan Penanganan Kondisi Khusus

-   Field wajib transaksi: nama barang, jumlah, satuan, tanggal-jam,
    asal/tujuan, nama pengantar/pengambil, jenis pekerjaan, dan minimal
    satu foto. Deskripsi pekerjaan opsional dengan batas maksimal 500
    karakter.

-   Jumlah harus berupa angka lebih dari 0. Nilai desimal diperbolehkan
    hingga dua digit untuk satuan seperti kg atau meter.

-   Tanggal-jam secara default menggunakan waktu saat ini dan tidak
    boleh berada di masa depan. Petugas dapat mengubah waktu ke belakang
    maksimal 24 jam (asumsi awal), sedangkan Admin dapat mengubahnya
    tanpa batas sesuai kebutuhan operasional.

-   Foto yang diterima: JPG, JPEG, PNG, atau WEBP; maksimal 5 MB per
    file; maksimal 3 foto per transaksi (asumsi awal). Sistem dapat
    mengompresi gambar di sisi klien. Validasi format dan ukuran tetap
    wajib dilakukan di server.

-   Jika izin kamera ditolak atau perangkat tidak memiliki kamera,
    pengguna tetap dapat memilih opsi unggah file.

-   Tombol simpan dinonaktifkan selama proses penyimpanan untuk mencegah
    submit ganda.

-   Jika koneksi terputus saat penyimpanan, sistem menampilkan pesan
    gagal dan mempertahankan data form selama halaman masih terbuka agar
    pengguna dapat mencoba kembali.

-   Hasil pencarian kosong menampilkan pesan "Data tidak ditemukan".

-   Ekspor lebih dari 10.000 baris ditolak dan sistem meminta Admin
    mempersempit filter (asumsi awal).

-   Akun nonaktif tidak dapat login, tetapi transaksi lama tetap
    menyimpan keterkaitan dengan akun tersebut.

-   Penghapusan transaksi menggunakan soft delete agar jejak audit tetap
    tersedia.

-   Petugas yang mencoba mengakses halaman atau endpoint khusus Admin
    harus ditolak oleh backend dengan respons 403.

## 7. Kebutuhan Non-Fungsional

| Aspek \| Kebutuhan \|

| --- \| --- \|

| Performa \| Halaman utama ditargetkan terbuka kurang dari 2 detik pada
  koneksi 4G; pencarian riwayat kurang dari 2 detik untuk 50.000 data;
  unggah foto 5 MB kurang dari 5 detik. \|

| Keamanan \| Password di-hash; kontrol akses berbasis role diterapkan
  di backend; validasi input dan file di server; perlindungan SQL
  injection, XSS, dan CSRF sesuai mekanisme autentikasi yang digunakan;
  pembatasan percobaan login. \|

| Ketersediaan \| Target uptime 99% per bulan dan backup database harian
  dengan retensi 30 hari setelah aplikasi ditempatkan di server produksi
  (target/asumsi). \|

| Kompatibilitas \| Mendukung Chrome, Edge, Firefox, dan Safari versi
  dua rilis terakhir; responsif untuk ponsel, tablet, dan desktop. \|

| Kamera \| Akses kamera browser memerlukan izin pengguna dan umumnya
  membutuhkan HTTPS pada lingkungan produksi. Pada localhost, browser
  modern mengizinkan konteks pengembangan tertentu. \|

| Skalabilitas \| Target awal minimal 50 pengguna aktif dan 500
  transaksi per hari (asumsi). \|

| Auditabilitas \| Aksi ubah dan hapus transaksi tercatat dengan
  identitas pengguna, waktu, dan ringkasan perubahan. \|

## 8. Fitur Inti dan Kriteria Penerimaan

### 8.1 Pencatatan Barang Masuk

Form untuk mencatat barang yang datang, termasuk informasi asal,
pengantar, penerima, jenis pekerjaan, deskripsi, serta foto barang.

-   Nama penerima otomatis diambil dari akun Petugas yang login dan
    tidak dapat diedit.

-   Data hanya tersimpan jika seluruh field wajib valid dan minimal satu
    foto tersedia.

-   Petugas dapat mengambil foto dari kamera atau memilih file gambar
    dari perangkat. Foto ditampilkan sebagai pratinjau sebelum disimpan.

-   File yang tidak sesuai format/ukuran ditolak dengan pesan yang mudah
    dipahami.

### 8.2 Pencatatan Barang Keluar

Form untuk mencatat barang yang dikeluarkan, termasuk tujuan, nama
pengambil, pemberi, jenis pekerjaan, deskripsi, serta foto barang.

-   Nama pemberi otomatis diambil dari akun Petugas yang login dan tidak
    dapat diedit.

-   Nama pengambil dan tujuan wajib diisi.

-   Transaksi tersimpan dengan tipe KELUAR dan muncul pada riwayat.

### 8.3 Riwayat Transaksi

-   Admin dan Petugas dapat membuka satu halaman riwayat yang memuat
    transaksi masuk dan keluar, diurutkan dari yang terbaru.

-   Tabel memuat jenis transaksi, tanggal-jam, nama barang,
    jumlah/satuan, asal/tujuan, petugas, dan jenis pekerjaan.

-   Klik baris atau aksi detail menampilkan informasi lengkap dan foto
    transaksi.

-   Admin melihat aksi ubah/hapus dan ekspor; Petugas tidak melihat aksi
    tersebut.

### 8.4 Pencarian dan Filter

-   Pencarian teks bebas dan filter dapat digunakan bersamaan dengan
    logika AND.

-   Filter meliputi nama barang, petugas, jenis transaksi, jenis
    pekerjaan, dan rentang tanggal.

-   Pencarian tidak sensitif terhadap huruf besar/kecil. Tombol Reset
    mengembalikan filter ke kondisi awal.

### 8.5 Ringkasan dan Ekspor

-   Dashboard menampilkan total transaksi, jumlah masuk, dan jumlah
    keluar untuk periode yang dipilih.

-   Hanya Admin yang dapat menggunakan ekspor PDF dan Excel.

-   Isi file mengikuti filter aktif, menyertakan header kolom dan
    informasi periode.

-   Jika tidak ada data, sistem memberi pemberitahuan dan tidak membuat
    file kosong.

### 8.6 Manajemen Akun dan Jenis Pekerjaan

-   Admin dapat membuat akun Admin atau Petugas, mengubah data akun,
    menonaktifkan akun, dan menghapus akun sesuai aturan sistem.

-   Username harus unik dan password awal minimal 8 karakter.

-   Admin dapat mengelola daftar jenis pekerjaan yang digunakan pada
    form transaksi.

## 9. Use Case

### UC-1 --- Mencatat Barang Masuk

Aktor: Petugas Store/Security. Petugas membuka menu Barang Masuk,
mengisi data, menambahkan foto melalui kamera atau unggah file, lalu
menyimpan. Sistem memvalidasi, menyimpan transaksi, dan menampilkan
notifikasi berhasil.

### UC-2 --- Mencatat Barang Keluar

Aktor: Petugas Store/Security. Petugas membuka menu Barang Keluar,
mengisi data barang, tujuan, pengambil, jenis pekerjaan, menambahkan
foto melalui kamera atau unggah file, lalu menyimpan.

### UC-3 --- Melihat Riwayat Transaksi

Aktor: Admin dan Petugas. Pengguna membuka Riwayat, melihat daftar
transaksi terbaru, lalu membuka detail transaksi beserta foto.

### UC-4 --- Mencari dan Menyaring Riwayat

Aktor: Admin dan Petugas. Pengguna memasukkan kata kunci dan/atau
filter; sistem menampilkan hasil yang sesuai. Jika kosong, sistem
menampilkan pesan dan pilihan Reset.

### UC-5 --- Melihat Ringkasan dan Mengekspor Riwayat

Aktor: Admin. Admin memilih periode/filter, melihat ringkasan, lalu
memilih Ekspor PDF atau Ekspor Excel. Sistem menghasilkan file sesuai
filter aktif. Petugas hanya dapat melihat ringkasan jika memang
ditampilkan pada dashboard, dan tidak dapat mengekspor.

### UC-6 --- Mengelola Akun Pengguna

Aktor: Admin. Admin membuka Manajemen Akun, menambah atau mengubah akun,
menetapkan role, menonaktifkan atau menghapus akun. Sistem memvalidasi
data dan status akun.

### UC-7 --- Mengubah atau Menghapus Transaksi

Aktor: Admin. Admin membuka detail transaksi, memilih Ubah atau Hapus,
lalu menyimpan perubahan atau mengonfirmasi soft delete. Sistem mencatat
log audit.

### UC-8 --- Mengelola Jenis Pekerjaan

Aktor: Admin. Admin menambah, melihat, mengubah, atau menonaktifkan
jenis pekerjaan yang tersedia pada form transaksi.

## 10. User Flow Ringkas

1.  Pengguna membuka aplikasi dan login.

2.  Sistem memvalidasi akun dan mengarahkan pengguna ke dashboard sesuai
    role.

3.  Petugas memilih Barang Masuk atau Barang Keluar.

4.  Petugas mengisi form, menambahkan foto dari kamera atau unggahan
    perangkat, kemudian menyimpan transaksi.

5.  Sistem memvalidasi dan menyimpan data; transaksi baru muncul di
    riwayat.

6.  Admin dan Petugas membuka riwayat, mencari, memfilter, dan melihat
    detail transaksi sesuai hak akses.

7.  Admin dapat mengelola akun, jenis pekerjaan, mengubah/menghapus
    transaksi, melihat log audit, dan mengekspor riwayat ke PDF/Excel.

8.  Pengguna logout.

## 11. Arsitektur dan Teknologi

Arsitektur yang digunakan adalah frontend dan backend terpisah
(client-server) dengan komunikasi melalui REST API.

| Lapisan \| Teknologi \| Tanggung jawab \|

| --- \| --- \| --- \|

| Frontend \| Next.js \| Halaman login, dashboard, form transaksi,
  kamera/unggah foto, riwayat, filter, dan tampilan sesuai role. \|

| Backend/API \| Laravel \| REST API, autentikasi, otorisasi role,
  validasi data, penyimpanan transaksi, pengelolaan file foto, ekspor
  PDF/Excel, dan audit log. \|

| Database \| MySQL \| Menyimpan data akun, jenis pekerjaan, transaksi,
  foto, dan audit log. \|

| Lingkungan lokal \| XAMPP \| Menjalankan layanan MySQL dan menyediakan
  phpMyAdmin untuk administrasi database. Laravel dijalankan menggunakan
  PHP Artisan. \|

| Penyimpanan foto \| Laravel local public storage untuk pengembangan \|
  File foto disimpan pada storage Laravel dan diakses melalui URL/path
  yang dikelola backend. Untuk produksi, strategi backup dan storage
  perlu disiapkan. \|

| Version control \| Git dan GitHub \| Mencatat perubahan kode, branch,
  commit, dan kolaborasi. \|

Alur komunikasi: Browser pengguna → Next.js → REST API Laravel → MySQL
dan penyimpanan foto → Laravel mengirim respons JSON → Next.js
menampilkan hasil kepada pengguna.

Catatan implementasi: XAMPP digunakan terutama untuk layanan MySQL.
Jangan menjalankan dua server MySQL pada port yang sama. Laravel tetap
dijalankan melalui PHP/Composer dan perintah php artisan serve atau
konfigurasi web server yang dipilih.

## 12. Rancangan Database Awal

Rancangan awal menggunakan tabel berikut. Detail tipe data, indeks,
foreign key, dan aturan penghapusan akan dipastikan saat pembuatan ERD
dan migration Laravel.

| Tabel \| Kolom/isi utama \| Keterangan \|

| --- \| --- \| --- \|

| users \| id, name, username, email (opsional), password, role,
  is_active, timestamps \| Menyimpan akun Admin dan Petugas. \|

| work_types \| id, name, description (opsional), is_active, timestamps
  \| Master jenis pekerjaan. \|

| transactions \| id, type, transaction_datetime, item_name, quantity,
  unit, work_type_id, work_description, origin, destination,
  sender_name, recipient_name, taker_name, giver_user_id/recorded_by,
  created_by, updated_by, deleted_at, timestamps \| Satu tabel untuk
  transaksi masuk dan keluar; kolom spesifik arah transaksi dapat dibuat
  nullable. \|

| transaction_photos \| id, transaction_id, file_path, original_name,
  mime_type, file_size, timestamps \| Satu transaksi dapat memiliki
  beberapa foto. \|

| audit_logs \| id, user_id, transaction_id, action, old_values,
  new_values, created_at \| Mencatat aksi perubahan/penghapusan. \|

Catatan desain: rancangan tabel transaksi di atas masih konseptual. Saat
migration dibuat, perlu dipilih secara konsisten kolom asal/tujuan dan
pihak-pihak terkait agar data masuk dan keluar tidak ambigu. Untuk
transaksi MASUK, asal dan pengantar relevan; untuk KELUAR, tujuan dan
pengambil relevan. Pengguna pencatat tetap disimpan sebagai foreign key
ke users.

## 13. Risiko dan Dependensi

### Risiko

-   Adopsi rendah karena petugas terbiasa mencatat manual. Mitigasi:
    form ringkas, uji coba, pelatihan singkat, dan panduan.

-   Ukuran foto besar membebani jaringan dan penyimpanan. Mitigasi:
    batas ukuran, kompresi, validasi server, serta backup.

-   Koneksi internet tidak stabil di area gudang/pos jaga. Mitigasi MVP:
    pertahankan isian form saat permintaan gagal selama halaman masih
    terbuka; mode offline penuh tidak termasuk MVP.

-   Kesalahan input atau penyalahgunaan hak akses. Mitigasi: validasi,
    role authorization di backend, soft delete, dan audit log.

-   Kamera browser tidak tersedia atau izin ditolak. Mitigasi: sediakan
    opsi unggah file sebagai alternatif yang setara.

### Dependensi

-   Persetujuan dan keterlibatan pihak perusahaan untuk uji coba.

-   Daftar jenis pekerjaan dari pihak perusahaan.

-   Perangkat dengan browser modern; kamera bersifat opsional karena
    unggah file tersedia.

-   Server/hosting dan HTTPS untuk lingkungan produksi, khususnya akses
    kamera.

-   Pustaka Laravel untuk ekspor PDF dan Excel.

-   Strategi backup database dan file foto.

## 14. Batasan Desain

-   Antarmuka mobile-first karena Petugas dapat menggunakan ponsel atau
    tablet di lapangan.

-   Bahasa antarmuka adalah Bahasa Indonesia.

-   Nama penerima pada transaksi masuk dan nama pemberi pada transaksi
    keluar diambil otomatis dari akun login dan tidak dapat diedit
    Petugas.

-   Foto dapat berasal dari kamera browser maupun unggahan perangkat.

-   Data transaksi tidak dihapus permanen melalui antarmuka; gunakan
    soft delete.

-   Zona waktu harus ditentukan dan diterapkan konsisten. Zona waktu
    awal perlu dikonfirmasi dengan perusahaan (misalnya Asia/Jakarta
    atau Asia/Makassar sesuai lokasi operasional).

-   Aplikasi tidak mengelola saldo stok; hanya mendokumentasikan
    pergerakan barang.

-   Ekspor PDF/Excel hanya tersedia bagi Admin dan mengikuti filter
    aktif.

## 15. Pemetaan Modul Pengembangan

### Modul 1 --- Setup Proyek dan Infrastruktur

Membuat repository, proyek Next.js, proyek Laravel, koneksi MySQL XAMPP,
konfigurasi environment, dan komunikasi API.

### Modul 2 --- Database dan Fondasi Backend

Membuat migration, model, relasi, seeder role, master jenis pekerjaan,
serta struktur API.

### Modul 3 --- Autentikasi dan Hak Akses

Login/logout, autentikasi API, middleware role Admin/Petugas, proteksi
route dan endpoint.

### Modul 4 --- Layout dan Fondasi Frontend

Layout responsif, navigasi, komponen umum, halaman login, dan
pengelolaan sesi/token sesuai strategi autentikasi.

### Modul 5 --- Manajemen Akun dan Jenis Pekerjaan

CRUD akun dan master jenis pekerjaan khusus Admin.

### Modul 6 --- Upload dan Kamera Foto

Komponen kamera, unggah file, preview, validasi ukuran/format,
penyimpanan Laravel, dan pengaitan foto dengan transaksi.

### Modul 7 --- Pencatatan Barang Masuk

Form, validasi, API create, penerima otomatis, dan pengujian.

### Modul 8 --- Pencatatan Barang Keluar

Form, validasi, API create, pemberi otomatis, dan pengujian.

### Modul 9 --- Riwayat, Detail, Pencarian, dan Filter

Daftar gabungan, detail transaksi, foto, pagination, pencarian, filter,
dan reset.

### Modul 10 --- Dashboard dan Ekspor Admin

Ringkasan transaksi, ekspor PDF/Excel, validasi role pada endpoint
ekspor.

### Modul 11 --- Edit/Hapus dan Audit Log

Edit transaksi, soft delete, pencatatan audit, dan halaman log untuk
Admin.

### Modul 12 --- Pengujian dan Peluncuran

Pengujian fungsional, role, unggah foto, browser/perangkat, UAT,
dokumentasi, deployment, HTTPS, dan backup.

## 16. Catatan Keputusan yang Masih Perlu Dikonfirmasi

Hal-hal berikut belum ditetapkan secara pasti dalam PRD awal. Sebaiknya
dikonfirmasi kepada pihak perusahaan sebelum dianggap sebagai aturan
final:

-   Apakah Petugas boleh melihat seluruh riwayat perusahaan atau hanya
    transaksi yang dibuatnya? PRD revisi sementara menetapkan Petugas
    dapat melihat riwayat transaksi gabungan.

-   Apakah ringkasan dashboard dapat dilihat Petugas atau hanya Admin?
    PRD awal menyebut semua pengguna dapat melihat ringkasan; perlu
    dipastikan apakah tetap demikian.

-   Apakah batas perubahan waktu mundur 24 jam untuk Petugas benar-benar
    sesuai SOP?

-   Apakah maksimal tiga foto per transaksi dan ukuran 5 MB per foto
    sudah sesuai kebutuhan?

-   Apakah Admin boleh menghapus akun secara permanen atau sebaiknya
    hanya menonaktifkan akun agar keterkaitan transaksi tetap aman?

-   Zona waktu operasional perusahaan yang harus digunakan.

-   Apakah satu transaksi wajib memiliki foto, atau foto hanya
    diwajibkan untuk kondisi tertentu?

-   Istilah dan daftar master jenis pekerjaan yang akan digunakan.

## 17. Definisi Selesai (MVP)

MVP dapat dianggap selesai apabila Admin dan Petugas dapat login sesuai
role; Petugas dapat mencatat transaksi masuk/keluar dengan foto dari
kamera atau unggahan; kedua role dapat melihat dan mencari riwayat
sesuai cakupan akses; Admin dapat mengelola akun dan master jenis
pekerjaan, mengubah/menghapus transaksi dengan audit log, melihat
ringkasan, serta mengekspor riwayat ke PDF/Excel; seluruh pembatasan hak
akses divalidasi di backend; dan alur utama telah diuji bersama
perwakilan pengguna.
