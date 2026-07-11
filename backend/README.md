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

## PostGIS wajib

Fitur Mode Awam dan penentuan wilayah laporan memakai `ST_Covers`/`ST_DWithin`.
Pastikan paket PostGIS terpasang pada server PostgreSQL, lalu aktifkan pada database:

```sql
CREATE EXTENSION postgis;
```

Setelah itu jalankan `php artisan migrate` untuk menerapkan geometri SRID 4326 dan
spatial index. Migrasi tidak akan berjalan bila binary ekstensi PostGIS belum dipasang
pada server database.

Skipped: Redis queue, S3, WhatsApp/SMS provider. Add when local API and PostGIS path sudah stabil.
