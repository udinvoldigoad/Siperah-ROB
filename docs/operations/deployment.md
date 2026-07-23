# SIPERAH-RoB Production Deployment Guide

Dokumen ini berisi panduan *deployment* aplikasi SIPERAH-RoB ke lingkungan produksi menggunakan arsitektur nyata: **Hostinger Shared Hosting + Supabase Database + GitHub Actions**.

---

## 1. Arsitektur Produksi (Production Stack)
Aplikasi tidak lagi menggunakan VPS/Redis/Nginx yang kompleks. Arsitektur final yang digunakan adalah:
* **Frontend SPA & Backend API**: Dihosting di **Hostinger Shared Hosting** (subdomain: `siperah-rob.girimulyo.com`, PHP 8.4).
* **Database Oseanografi & Wilayah**: **Supabase (PostgreSQL 17 + PostGIS)** Singapura via session pooler (port 5432).
* **Pipeline Machine Learning (ML) & Migrasi**: **GitHub Actions** (menjalankan inferensi ML harian pukul 06:00 WIB, migrasi otomatis, dan pengisian data pasut historis).
* **Antrean / Queue Worker**: Menggunakan **Database Queue** (dikuras setiap menit menggunakan command `queue:work --stop-when-empty` yang dijalankan oleh Laravel Scheduler).

---

## 2. Persyaratan Server (Hostinger Shared)
* PHP >= 8.4 (aktifkan ekstensi `pdo_pgsql` dan `pgsql` di panel hPanel).
* SSH Access diaktifkan pada hPanel.
* Composer v2 terinstal di server.
* Node.js >= 20 (hanya untuk build frontend lokal sebelum deploy).

---

## 3. Langkah Deployment Awal & Harian

Deployment dilakukan dari komputer lokal menggunakan skrip otomatis [deploy-hostinger.sh](file:///c:/laragon/www/Siperah-ROB/scripts/deploy-hostinger.sh).

### Langkah 1: Salin Kredensial Deploy
Buat berkas `scripts/deploy.env` (jangan di-commit ke Git karena berkas ini berisi rahasia) dari template `deploy.env.example`:
```bash
SSH_HOST="username@ip_address"
SSH_PORT="65002"
REMOTE_APP="~/domains/siperah-rob.girimulyo.com"
SITE_URL="https://siperah-rob.girimulyo.com"
```

### Langkah 2: Jalankan Skrip Deploy
Jalankan perintah berikut di root folder proyek lokal Anda:
```bash
bash scripts/deploy-hostinger.sh
```

Skrip ini akan otomatis melakukan:
1. Mem-build aset frontend React secara lokal (`npm run build`).
2. Menghubungi server Hostinger via SSH untuk menarik kode backend terbaru (`git pull --ff-only`).
3. Mengunggah folder frontend build ke `backend/public` server.
4. Menjalankan `composer install --no-dev --optimize-autoloader` menggunakan PHP 8.4 resmi Hostinger.
5. Mengoptimasi cache Laravel (`php artisan optimize`).
6. Melakukan *smoke test* koneksi frontend dan API.

---

## 4. Konfigurasi Environment (`.env` Produksi)
Kunci konfigurasi penting pada berkas `.env` di server Hostinger:
```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://siperah-rob.girimulyo.com

# Database Supabase
DB_CONNECTION=pgsql
DB_HOST=aws-0-ap-southeast-1.pooler.supabase.com
DB_PORT=5432
DB_DATABASE=postgres
DB_USERNAME=postgres.xxxx
DB_PASSWORD=xxxx

# Queue Driver (Wajib database karena shared hosting)
QUEUE_CONNECTION=database

# Nonaktifkan scheduler ml:predict di Hostinger (dijalankan di GitHub Actions)
ML_SCHEDULE_ENABLED=false
BACKUP_SCHEDULE_ENABLED=false
```

---

## 5. Scheduler & Queue Worker di Hostinger
Karena Hostinger tidak dapat menjalankan worker daemon persisten (seperti Supervisor/Redis), antrean diproses menggunakan scheduler harian.

1. **Jadwalkan Laravel Cron** di hPanel Hostinger untuk berjalan **setiap menit**:
   ```bash
   * * * * * /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql ~/domains/siperah-rob.girimulyo.com/backend/artisan schedule:run >> /dev/null 2>&1
   ```
2. **Kuras Antrean Otomatis**: Di dalam [bootstrap/app.php](file:///c:/laragon/www/Siperah-ROB/backend/bootstrap/app.php), scheduler telah dikonfigurasi untuk menjalankan worker antrean database secara aman setiap menit:
   ```php
   $schedule->command('queue:work --stop-when-empty --tries=3 --max-time=50')
       ->everyMinute()
       ->withoutOverlapping()
       ->when(fn (): bool => config('queue.default') === 'database');
   ```

---

## 6. Prosedur Rollback (Rollback Plan)

Jika terjadi kendala kritis pada sistem pasca-deploy, lakukan langkah-langkah berikut:

### A. Rollback Kode & Frontend
1. Kembalikan branch `main` ke commit stabil sebelumnya secara lokal:
   ```bash
   git checkout <commit_stabil_sebelumnya>
   ```
2. Jalankan kembali skrip deploy untuk membuild ulang dan mengunggah kode stabil:
   ```bash
   bash scripts/deploy-hostinger.sh
   ```

### B. Rollback Database (Migrasi)
Jika deploy menyertakan migrasi database yang merusak (*breaking migrations*):
1. Masuk ke server Hostinger via SSH.
2. Jalankan perintah rollback migrasi Laravel (sesuaikan jumlah langkah rollback yang diinginkan):
   ```bash
   /opt/alt/php84/usr/bin/php -d extension=pdo_pgsql -d extension=pgsql artisan migrate:rollback --step=1
   ```

### C. Restore Database dari Backup Terakhir
Jika database mengalami kerusakan data parah, lakukan pemulihan (*restore*) menggunakan langkah di [backup-database.md](backup-database.md#L61-L68):
```bash
pg_restore -h aws-0-ap-southeast-1.pooler.supabase.com -p 5432 -U postgres.xxxx -d postgres --no-owner --no-privileges --clean --if-exists siperah-YYYY-MM-DD.dump
```
