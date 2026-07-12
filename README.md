# SIPERAH-RoB

Sistem Informasi Prediksi Risiko Banjir Rob Terpadu Provinsi Lampung.

## Stack

- Frontend: React + Vite + TypeScript + Tailwind CSS
- WebGIS: MapLibre GL JS
- Chart: ECharts
- Backend: Laravel API + Sanctum
- Database: PostgreSQL + PostGIS
- Storage: local disk first, S3-compatible later

## Struktur

```txt
backend/        Laravel API boundary
frontend/       React application boundary
database/       Bootstrap SQL awal dan data reference
docs/           architecture notes
.desain-awal/   UI reference prototype
```

## Check

```bash
node scripts/architecture-smoke.mjs
```

Skipped: dependency install, Redis, S3, and real provider integrations. Add when the API skeleton is ready to run against PostgreSQL.
