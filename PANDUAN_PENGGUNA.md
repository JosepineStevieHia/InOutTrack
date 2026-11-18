# Panduan Pengguna InOutTrack

Dokumen ini menjelaskan cara menggunakan aplikasi **InOutTrack** bagi dua kelompok pengguna utama di lingkungan perusahaan manufaktur: **Petugas Store/Security** dan **Staf Administrasi (Admin)**.

---

## 1. Masuk (Login) dan Keluar (Logout)

### Cara Masuk (Login)
1. Buka alamat aplikasi di browser (pada lingkungan lokal: `http://localhost:3000`).
2. Masukkan **Username atau Email** dan **Password** Anda pada halaman **Masuk ke InOutTrack**.
3. *(Opsional)* Centang **Ingat sesi saya** bila menggunakan perangkat kerja pribadi.
4. Klik tombol **Masuk**.
   - Bila berhasil, Anda diarahkan ke **Dashboard**.
   - Bila password salah sebanyak **5 kali** berturut-turut, akun/sesi dibatasi sementara (rate limiting) selama beberapa detik demi keamanan.
   - Akun yang berstatus **Nonaktif** tidak dapat login dan akan melihat pemberitahuan untuk menghubungi Staf Administrasi.

### Cara Keluar (Logout)
1. Klik tombol **Keluar** pada bagian atas kanan navbar atau bagian bawah sidebar.
2. Konfirmasikan keluar pada dialog yang muncul agar sesi cookie diakhiri dengan aman.

---

## 2. Panduan untuk Petugas Store & Security

Petugas memiliki akses ke modul operasional berikut: **Dashboard**, **Barang Masuk**, **Barang Keluar**, dan **Riwayat Transaksi**.

### A. Mencatat Barang Masuk (`/transactions/in`)
1. Pilih menu **Barang Masuk** pada sidebar.
2. Periksa **Waktu Kedatangan**: secara bawaan sudah terisi waktu saat ini. Petugas hanya dapat menyesuaikan waktu ke belakang maksimal **24 jam** dan tidak boleh memilih waktu di masa depan.
3. Isi seluruh kolom wajib:
   - **Nama Barang** (contoh: `Kabel NYM 3x2.5`)
   - **Jumlah** (angka lebih dari `0`, boleh desimal hingga 2 angka di belakang koma, contoh: `12.5`)
   - **Satuan** (contoh: `Roll`, `Pcs`, `Kg`, `Unit`, `Meter`)
   - **Jenis Pekerjaan** (pilih dari daftar jenis pekerjaan aktif)
   - **Asal Barang** (nama supplier/vendor/asal pengiriman)
   - **Nama Pengantar** (nama kurir/sopir pengantar)
   - **Deskripsi Pekerjaan** *(opsional, maksimal 500 karakter)*
4. Perhatikan kolom **Nama Penerima (Otomatis)**: kolom ini terisi otomatis sesuai nama akun login Anda dan terkunci agar pencatatan tetap akuntabel.
5. **Tambahkan Foto Bukti Barang (Wajib 1–3 Foto)**:
   - Klik **Ambil dari Kamera** untuk memotret barang secara langsung melalui kamera browser (`getUserMedia`). Jika perangkat memiliki kamera depan & belakang, gunakan tombol ganti kamera.
   - Atau klik **Unggah Foto** (atau seret file ke area unggah) untuk memilih file gambar dari perangkat.
   - Format yang diterima: **JPG, JPEG, PNG, WEBP** dengan ukuran maksimal **5 MB per foto**.
   - Jika kamera tidak tersedia atau izin kamera ditolak browser, gunakan tombol **Unggah Foto** sebagai alternatif.
   - Sebelum menyimpan, Anda dapat melihat pratinjau foto, mengganti foto, atau menghapus foto tertentu.
6. Klik **Simpan Barang Masuk**. Tombol simpan otomatis nonaktif selama pengiriman berlangsung untuk mencegah pencatatan ganda.

### B. Mencatat Barang Keluar (`/transactions/out`)
1. Pilih menu **Barang Keluar** pada sidebar.
2. Kolom **Nama Pemberi (Otomatis)** terisi otomatis dari akun login Anda dan tidak dapat diubah.
3. Isi seluruh kolom wajib: **Waktu Keluar**, **Nama Barang**, **Jumlah**, **Satuan**, **Jenis Pekerjaan**, **Tujuan Barang**, **Nama Pengambil**, serta **Deskripsi Pekerjaan** *(opsional)*.
4. Lampirkan **minimal 1 foto** (maksimal 3 foto) melalui kamera atau unggahan file.
5. Klik **Simpan Barang Keluar**.

### C. Melihat, Mencari, & Menyaring Riwayat Transaksi (`/transactions`)
1. Buka menu **Riwayat Transaksi** untuk melihat daftar gabungan barang masuk dan barang keluar yang diurutkan dari waktu transaksi terbaru (20 data per halaman).
2. Gunakan kolom **Pencarian Bebas** maupun filter spesifik:
   - **Filter Nama Barang**
   - **Filter Petugas**
   - **Filter Jenis Transaksi** (`Semua`, `Barang Masuk`, atau `Barang Keluar`)
   - **Filter Jenis Pekerjaan**
   - **Rentang Tanggal** (`Dari Tanggal` dan `Sampai Tanggal`)
3. Seluruh filter dapat digabungkan sekaligus (logika **AND**). Klik **Reset Filter** untuk mengembalikan daftar ke kondisi awal.
4. Klik salah satu baris atau tombol detail untuk membuka **Modal Detail Transaksi** dan meninjau seluruh informasi beserta galeri foto bukti. Klik foto untuk memperbesar tampilan (lightbox).

---

## 3. Panduan untuk Staf Administrasi (Admin)

Selain seluruh menu operasional di atas, **Admin** memiliki kewenangan penuh atas pengawasan data, koreksi transaksi, pelaporan, master data, dan jejak audit.

### A. Dashboard Ringkasan & Filter Periode (`/dashboard`)
1. Lihat metrik utama: **Total Transaksi**, **Total Barang Masuk**, dan **Total Barang Keluar**.
2. Pilih preset periode (`Semua Periode`, `Hari Ini`, `7 Hari Terakhir`, `30 Hari Terakhir`, `Bulan Ini`) atau masukkan rentang tanggal kustom untuk melihat ringkasan pada periode tertentu.
3. Klik **Reset Periode** untuk kembali ke ringkasan keseluruhan data.

### B. Mengekspor Laporan PDF & Excel (`/exports` atau dari `/transactions`)
1. Buka menu **Ekspor Laporan** (atau gunakan filter aktif di halaman **Riwayat Transaksi** lalu klik **Ekspor**).
2. Atur filter yang diinginkan (pencarian, jenis transaksi, petugas, jenis pekerjaan, rentang tanggal). Data yang diekspor **selalu mengikuti filter yang sedang aktif**.
3. Klik **Unduh Laporan PDF** untuk menghasilkan dokumen `.pdf` siap cetak, atau **Unduh Laporan Excel (.xlsx)** untuk analisis lanjutan.
4. Setiap file menyertakan header kolom yang jelas serta informasi periode/filter.
5. Batas maksimal sekali ekspor adalah **10.000 baris**. Jika hasil pencarian kosong (`0` data) atau melebihi `10.000` baris, sistem akan menampilkan pemberitahuan tanpa membuat file kosong.

### C. Mengubah Transaksi & Foto serta Soft Delete (`/transactions`)
1. Pada halaman **Riwayat Transaksi** (atau melalui modal Detail Transaksi), Admin melihat tombol **Edit** dan **Hapus**.
2. **Edit Transaksi & Foto**:
   - Klik tombol **Edit** pada transaksi yang ingin dikoreksi.
   - Admin dapat mengubah waktu transaksi (tanpa batasan 24 jam, namun tetap tidak boleh di masa depan), detail barang, pihak terkait, serta jenis pekerjaan.
   - Pada bagian **Foto Bukti Transaksi**: Admin dapat menandai foto lama untuk dihapus (**Hapus Foto** / **Batal Hapus**) maupun menambah foto pengganti melalui kamera/unggah perangkat, dengan menjaga total foto tetap **1 sampai 3 foto**.
   - Klik **Simpan Perubahan**.
3. **Hapus Transaksi (Soft Delete)**:
   - Klik tombol **Hapus** pada transaksi terkait.
   - Konfirmasikan penghapusan pada dialog **Hapus Transaksi?**.
   - Transaksi disembunyikan dari riwayat aktif dan ringkasan dashboard, namun **tidak dihapus permanen dari database** agar jejak audit dan foto historis tetap terjaga.

### D. Meninjau Log Audit (`/audit-logs`)
1. Buka menu **Log Audit** pada sidebar Administrasi.
2. Setiap aksi perubahan (`UPDATE`) maupun penghapusan (`DELETE`) tercatat otomatis dengan informasi:
   - **Waktu Perubahan**
   - **Pengguna Pelaku** (Nama & Username Admin)
   - **Jenis Tindakan** (`UPDATE` atau `DELETE`)
   - **Transaksi Terkait** (beserta penanda `Terhapus` apabila telah di-soft-delete)
3. Gunakan filter pencarian, jenis tindakan, pengguna, ID transaksi, atau rentang tanggal bila diperlukan.
4. Klik tombol **Detail Diff** pada salah satu baris untuk membandingkan **Data Sebelum Perubahan** dan **Data Setelah Perubahan** (termasuk perubahan pada lampiran foto).
5. Catatan log audit bersifat permanen (*append-only*) dan tidak dapat diubah maupun dihapus oleh siapa pun.

### E. Mengelola Akun Pengguna (`/users`)
1. Buka menu **Manajemen Akun**.
2. **Tambah Akun**: klik **Tambah Akun**, isi Nama Lengkap, Username unik, Email *(opsional)*, Password awal minimal **8 karakter**, Role (`Admin` atau `Petugas Store/Security`), dan status aktif.
3. **Ubah Akun / Reset Password**: klik **Edit** pada baris akun; kolom password dapat dikosongkan jika tidak ingin mengubah kata sandi.
4. **Nonaktifkan / Aktifkan Akun**: klik tombol toggle status. Akun yang dinonaktifkan langsung tidak dapat mengakses sistem lagi, sementara seluruh riwayat transaksi lama yang pernah dicatat akun tersebut tetap utuh.
5. **Hapus Akun**: hanya akun yang belum pernah memiliki keterkaitan dengan transaksi maupun log audit yang dapat dihapus permanen. Sistem juga mencegah Anda menonaktifkan, menurunkan role, atau menghapus akun Admin aktif terakhir maupun diri sendiri.

### F. Mengelola Jenis Pekerjaan (`/work-types`)
1. Buka menu **Jenis Pekerjaan**.
2. Admin dapat menambahkan jenis pekerjaan baru, mengubah nama/deskripsi, atau menonaktifkan jenis pekerjaan yang sudah tidak digunakan.
3. Jenis pekerjaan berstatus **Nonaktif** tidak akan muncul pada form transaksi baru, namun transaksi historis yang sudah memakainya tetap menampilkan nama jenis pekerjaan tersebut dengan utuh.

---

## 4. Penyelesaian Masalah Umum (Troubleshooting)

| Kendala | Penyebab Umum & Solusi |
| --- | --- |
| **Kamera tidak muncul atau izin ditolak** | Pastikan izin kamera browser diaktifkan untuk alamat situs (`localhost` atau HTTPS pada server produksi). Jika perangkat tidak memiliki kamera, gunakan tombol **Unggah Foto** untuk memilih gambar dari galeri/folder perangkat. |
| **Gagal login berulang / sesi tidak tersimpan** | Pastikan URL frontend dan backend memakai hostname yang konsisten (misalnya sama-sama `localhost`, bukan mencampur `localhost` dengan `127.0.0.1`) dan cookie browser tidak diblokir. |
| **Foto ditolak saat unggah** | Pastikan format file adalah **JPG, JPEG, PNG, atau WEBP** asli (bukan dokumen lain yang diganti ekstensi), ukuran tiap file maksimal **5 MB**, dan jumlah total per transaksi **1–3 foto**. |
| **Petugas ditolak saat mengubah tanggal transaksi** | Sesuai aturan operasional, Petugas hanya dapat mencatat transaksi dengan waktu paling lama **24 jam ke belakang** dari waktu sekarang. Untuk koreksi transaksi di atas 24 jam, hubungi **Staf Administrasi (Admin)**. |
| **Ekspor gagal karena data terlalu banyak / kosong** | Gunakan filter tanggal atau filter lainnya agar jumlah baris yang diekspor antara **1 hingga 10.000 baris**. |
