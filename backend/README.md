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

## Sinkronisasi data resmi

```bash
php artisan data:sync-big-regions --province=Lampung --dry-run
php artisan data:sync-big-regions --province=Lampung
php artisan data:sync-big-coastlines --dry-run
php artisan data:sync-big-coastlines
php artisan data:classify-coastal-regions --distance-meters=1000 --dry-run
```

Sinkronisasi garis pantai tetap dapat menyimpan GeoJSON pada development tanpa PostGIS. Klasifikasi pesisir
memerlukan PostGIS karena menggunakan `ST_DWithin` berbasis geography.

## Research API key

Endpoint `/api/v1/*` tidak memakai token login Sanctum. Kirim API key melalui header:

```http
X-API-Key: spr_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Scope yang tersedia: `predictions:read`, `reports:read`, dan `tidal:read`. API key lengkap hanya
ditampilkan sekali ketika dibuat melalui `POST /api/research/api-keys`.
