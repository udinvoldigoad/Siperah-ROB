# Backend

Laravel API boundary untuk SIPERAH-RoB.

## Modul

- Auth dan RBAC
- Peta publik dan Mode Awam
- Laporan ground truth
- Dashboard BPBD operator/provinsi
- Admin user management
- Audit log
- Portal peneliti dan API key
- Notifikasi

## Install

```bash
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

Skipped: Redis queue, S3, WhatsApp/SMS provider. Add when local API and PostGIS path sudah stabil.
