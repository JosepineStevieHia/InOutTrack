# InOutTrack — Sistem Pemantauan Barang Masuk & Keluar

**InOutTrack** adalah aplikasi web untuk mencatat, memantau, menelusuri, dan melaporkan pergerakan **Barang Masuk** dan **Barang Keluar** di lingkungan perusahaan manufaktur. Sistem memusatkan informasi waktu transaksi, nama barang, jumlah dan satuan, pihak pengantar/pengambil, pihak penerima/pemberi otomatis, asal/tujuan barang, jenis pekerjaan, deskripsi pekerjaan, foto dokumentasi (kamera atau unggah file), riwayat gabungan dengan pencarian & filter, ringkasan dashboard, ekspor PDF & Excel, manajemen akun/master data, serta log audit.

---

## Arsitektur & Teknologi

Aplikasi menggunakan arsitektur **client-server** terpisah:

| Lapisan | Teknologi | Direktori | Port Default (Dev) |
| --- | --- | --- | --- |
| **Frontend** | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 | `frontend/` | `http://localhost:3000` |
| **Backend REST API** | Laravel 12, PHP 8.2+, Laravel Sanctum (SPA Cookie Auth), DomPDF, OpenSpout | `backend/` | `http://localhost:8000` |
| **Database** | MySQL / MariaDB (XAMPP) | Database `inouttrack_db` | `127.0.0.1:3306` |

---

## Prasyarat Sistem

Pastikan perangkat Anda telah terpasang:
1. **XAMPP** (untuk layanan MySQL / MariaDB dan phpMyAdmin).
2. **PHP >= 8.2** (ekstensi `pdo_mysql`, `mbstring`, `openssl`, `fileinfo`, `xml`, `zip`).
3. **Composer** (`>= 2.x`).
4. **Node.js** (`>= 20.x`) dan **npm**.

---

## Panduan Instalasi & Menjalankan Aplikasi (Lokal)

### 1. Siapkan Database MySQL (XAMPP)
1. Buka **XAMPP Control Panel** dan jalankan layanan **MySQL** (pastikan berjalan di port `3306`).
2. Buat database baru bernama `inouttrack_db` melalui phpMyAdmin (`http://localhost/phpmyadmin`) atau terminal MySQL:
   ```sql
   CREATE DATABASE IF NOT EXISTS inouttrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```

### 2. Konfigurasi & Jalankan Backend Laravel (`backend/`)
1. Masuk ke folder `backend/`:
   ```bash
   cd backend
   ```
2. Pasang dependensi PHP:
   ```bash
   composer install
   ```
3. Salin file `.env.example` menjadi `.env` dan generate application key:
   ```bash
   cp .env.example .env
   php artisan key:generate
   ```
   *(Di Windows PowerShell gunakan `Copy-Item .env.example .env`)*
4. Pastikan konfigurasi database dan integrasi SPA di `backend/.env` sesuai:
   ```env
   APP_URL=http://localhost:8000
   APP_TIMEZONE=Asia/Jakarta

   DB_CONNECTION=mariadb
   DB_HOST=127.0.0.1
   DB_PORT=3306
   DB_DATABASE=inouttrack_db
   DB_USERNAME=root
   DB_PASSWORD=

   SESSION_DRIVER=database
   FRONTEND_URL=http://localhost:3000
   SANCTUM_STATEFUL_DOMAINS=localhost,localhost:3000,localhost:8000,127.0.0.1,127.0.0.1:8000
   SESSION_SAME_SITE=lax
   ```
   *(Jika menggunakan driver MySQL standar alih-alih MariaDB, Anda dapat memakai `DB_CONNECTION=mysql`.)*
5. Jalankan migrasi tabel dan seeder awal (akun & jenis pekerjaan default):
   ```bash
   php artisan migrate --seed
   ```
6. Buat symbolic link agar foto bukti transaksi dapat diakses melalui URL publik `/storage/...`:
   ```bash
   php artisan storage:link
   ```
7. Jalankan server API Laravel pada port `8000`:
   ```bash
   php artisan serve --host=localhost --port=8000
   ```

### 3. Konfigurasi & Jalankan Frontend Next.js (`frontend/`)
1. Buka terminal baru dan masuk ke folder `frontend/`:
   ```bash
   cd frontend
   ```
2. Pasang dependensi Node.js:
   ```bash
   npm install
   ```
3. Buat atau periksa file `frontend/.env.local`:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```
   > **Penting:** Gunakan hostname yang konsisten (`localhost` untuk frontend dan backend, jangan mencampur `localhost:3000` dengan `127.0.0.1:8000`) agar cookie autentikasi Laravel Sanctum dan CSRF (`XSRF-TOKEN`) terkirim dengan benar.
4. Jalankan server pengembangan Next.js:
   ```bash
   npm run dev
   ```
   *(Atau untuk mode produksi: `npm run build` lalu `npm run start`)*
5. Buka aplikasi melalui browser di **`http://localhost:3000`**.

---

## Akun Bawaan (Hasil Seeder)

Seeder (`DatabaseSeeder`) menyediakan tiga akun awal untuk pengujian dan operasional awal:

| Peran (Role) | Nama | Username | Email | Password Bawaan |
| --- | --- | --- | --- | --- |
| **Admin (Staf Administrasi)** | Staf Administrasi | `admin` | `admin@inouttrack.local` | `Admin12345!` |
| **Petugas Store/Security** | Petugas Store | `petugas.store` | `store@inouttrack.local` | `Petugas12345!` |
| **Petugas Store/Security** | Petugas Security | `petugas.security` | `security@inouttrack.local` | `Petugas12345!` |

> **Catatan Keamanan:** Segera ubah kata sandi bawaan atau buat akun masing-masing staf melalui menu **Manajemen Akun** sebelum digunakan pada lingkungan operasional nyata.

Seeder juga mengisi 6 master **Jenis Pekerjaan** awal (`Produksi`, `Maintenance & Perbaikan`, `Logistik & Gudang`, `Proyek & Instalasi`, `Operasional & Umum (GA)`, dan `Quality Control / Lab`).

---

## Ringkasan Hak Akses Role

| Fitur | Admin (`admin`) | Petugas (`petugas`) |
| --- | :---: | :---: |
| Login & Logout (Username / Email) | Ya | Ya |
| Dashboard Ringkasan & Filter Periode | Ya | Ya |
| Catat Barang Masuk & Barang Keluar | Ya | Ya |
| Kamera Browser / Unggah Foto (1–3 foto, maks. 5 MB) | Ya | Ya |
| Waktu Transaksi Mundur | Tanpa batas (tidak boleh masa depan) | Maks. 24 jam ke belakang (tidak boleh masa depan) |
| Riwayat Transaksi Gabungan, Detail, Pencarian & Filter | Ya | Ya |
| Edit Transaksi & Foto, Soft Delete Transaksi | Ya | Tidak (`403`) |
| Ekspor Laporan PDF & Excel (.xlsx) | Ya | Tidak (`403`) |
| Manajemen Akun Pengguna & Jenis Pekerjaan | Ya | Tidak (`403`) |
| Log Audit Perubahan & Penghapusan Transaksi | Ya | Tidak (`403`) |

---

## Menjalankan Pengujian Otomatis

### Backend (PHPUnit Feature & Unit Tests)
```bash
cd backend
php artisan test
```
Suite pengujian mencakup autentikasi & rate limiting, manajemen akun & jenis pekerjaan, validasi & penyimpanan foto, pembuatan transaksi & anti-spoofing nama petugas, pencarian/filter riwayat, ekspor PDF & Excel, edit/soft delete/audit log, serta matriks keamanan endpoint dan konsistensi data QA (`QualityAssuranceAcceptanceTest`).

### Frontend (TypeScript, ESLint, & Production Build)
```bash
cd frontend
npx tsc --noEmit
npm run lint
npm run build
```

---

## Dokumentasi Terkait

- [PRD_InOutTrack.md](PRD_InOutTrack.md) — Dokumen Kebutuhan Produk (*Product Requirements Document*).
- [PANDUAN_PENGGUNA.md](PANDUAN_PENGGUNA.md) — Panduan operasional lengkap untuk **Petugas Store/Security** dan **Staf Administrasi (Admin)**.
