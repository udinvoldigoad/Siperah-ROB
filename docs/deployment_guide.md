# SIPERAH-RoB Deployment Guide

Dokumen ini berisi panduan ringkas untuk *deployment* aplikasi SIPERAH-RoB ke lingkungan produksi.

## Persyaratan Server
- PHP >= 8.3
- PostgreSQL >= 14
- Redis Server (wajib untuk Queue/Antrean)
- Nginx / Apache
- Node.js >= 20 (Untuk mem-build Frontend)

## Langkah Instalasi

1. **Clone & Install Dependencies**
   ```bash
   git clone https://github.com/udinvoldigoad/Siperah-RoB.git
   cd Siperah-RoB/backend
   composer install --optimize-autoloader --no-dev
   cd ../frontend
   npm install && npm run build
   ```

2. **Konfigurasi Environment (.env)**
   Pastikan Anda mengatur beberapa variabel kunci di `backend/.env`:
   - `APP_ENV=production`
   - `APP_DEBUG=false`
   - `APP_URL=https://[domain-anda]`
   - `QUEUE_CONNECTION=redis`
   - `REDIS_CLIENT=predis`
   - `LOG_CHANNEL=daily`
   - `LOG_MAX_FILES=14`

3. **Database & Storage**
   ```bash
   php artisan migrate --force
   php artisan storage:link
   php artisan config:cache
   php artisan route:cache
   php artisan view:cache
   ```

## Cronjob (Scheduler)
Laravel membutuhkan *Cronjob* agar bisa menjalankan jadwal harian secara otomatis (sinkronisasi BIG, prediksi ML harian, backup otomatis).
Tambahkan *entry* berikut ke server (`crontab -e`):
```bash
* * * * * cd /path-to-your-project/backend && php artisan schedule:run >> /dev/null 2>&1
```

## Supervisor (Queue Worker)
Karena `QUEUE_CONNECTION=redis` aktif, Anda harus menjalankan *Queue Worker* di *background* untuk menangani notifikasi dan email agar tidak memblokir antarmuka pengguna.
Gunakan **Supervisor** di Ubuntu/Debian:
1. Buat file `/etc/supervisor/conf.d/siperah-worker.conf`:
```ini
[program:siperah-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /path-to-your-project/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=4
redirect_stderr=true
stdout_logfile=/path-to-your-project/backend/storage/logs/worker.log
stopwaitsecs=3600
```
2. Nyalakan Supervisor:
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start siperah-worker:*
```

## Spatie Backup
Aplikasi sudah terkonfigurasi untuk mem-backup *database* setiap hari pukul `01:30` WIB.
Anda bisa menjalankannya secara manual untuk menguji:
```bash
php artisan backup:run
```
