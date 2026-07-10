# Arsitektur SIPERAH-RoB

## Prinsip

- Satu modul per kebutuhan PRD/SKPL: publik, mode awam, laporan, BPBD, admin, audit, peneliti, notifikasi.
- Backend menjadi sumber kebenaran untuk RBAC, audit log, validasi upload, API key, dan data spasial.
- Frontend hanya mengelola state layar dan memanggil REST API.
- Database memakai PostGIS untuk wilayah dan titik laporan, bukan koordinat string di app code.

## Boundary

```txt
frontend/src/features/*  -> layar dan state per modul
frontend/src/shared/*    -> API client, komponen umum, tipe domain
backend/routes/api.php   -> kontrak endpoint
backend/app/Http/*       -> controller dan middleware
database/schema.sql      -> kontrak tabel dan tipe data
```

## Role

- public: peta publik, mode awam, onboarding
- warga: membuat laporan, melihat laporan sendiri, notifikasi
- bpbd_operator: validasi laporan wilayah kerja
- bpbd_provinsi: dashboard provinsi dan ekspor monitoring
- peneliti: dataset, API key, dokumentasi API
- admin: user management, role, audit log

## Data Flow

1. Model prediksi eksternal mengisi `predictions`.
2. Peta publik membaca `regions`, `predictions`, `tidal_data`, dan laporan tervalidasi.
3. Warga membuat `ground_truth_reports` dan `report_photos`.
4. Operator memvalidasi atau menolak laporan.
5. Aksi penting masuk `audit_logs`.
6. Peneliti mengambil `datasets` atau endpoint API key.

## API Prefix

- `/api/auth/*`
- `/api/public/*`
- `/api/reports/*`
- `/api/dashboard/*`
- `/api/admin/*`
- `/api/research/*`
- `/api/notifications/*`

Skipped: CQRS/event sourcing. Add only if audit and import pipeline become hard to reason about with plain Laravel controllers.
