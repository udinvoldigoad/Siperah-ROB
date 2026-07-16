# Hasil Audit Data Wilayah — 16 Juli 2026

Audit dijalankan dengan `php artisan data:audit-regions` (command diperluas pada tanggal yang sama). Perbaikan `coastal_flag` dijalankan dengan `php artisan data:classify-coastal-regions` (kini punya fallback Haversine non-PostGIS).

## Ringkasan

| Metrik | Nilai |
|---|---|
| Total wilayah | 2.648 (15 kabupaten/kota, semua level kelurahan/desa) |
| Provenance `official` (BIG) | 2.640 |
| Provenance `demo` (DemoSeeder) | 8 |
| Format geometri | 2.640 GeoJSON batas asli BIG, 8 WKT kotak placeholder |
| Wilayah pesisir (`coastal_flag`) | **321** (sebelumnya hanya 20 — diperbaiki hari ini) |
| Tanpa populasi | 2.628 (data BPS belum diimpor — tugas terpisah) |
| PostGIS | **TIDAK terpasang** di Postgres dev (18.3) — validasi `ST_IsValid` dilewati |

## Sebaran pesisir per kabupaten (ambang 1.000 m dari garis pantai BIG)

| Kabupaten (8 stasiun ML) | Total wilayah | Pesisir |
|---|---|---|
| Kota Bandar Lampung | 127 | 31 |
| Lampung Selatan | 261 | 57 |
| Pesawaran | 146 | 27 |
| Tanggamus | 303 | 66 |
| Pesisir Barat | 120 | 103 |
| Lampung Timur | 264 | 20 |
| Tulang Bawang | 151 | 16 |
| **Mesuji** | 106 | **0 — lihat temuan** |

Setelah klasifikasi, `php artisan ml:predict` menghasilkan 9.951 prediksi untuk seluruh 321 wilayah pantauan.

## Temuan yang masih terbuka

1. **Mesuji = 0 wilayah pesisir.** Polygon desa-desa Mesuji berhenti 8+ km dari garis pantai BIG yang terpetakan (wilayah muara/mangrove). Perlu keputusan: tandai manual desa pesisir Mesuji, atau perluas ambang khusus Mesuji, atau cek kelengkapan garis pantai BIG segmen Mesuji.
2. **Lampung Tengah = 1 wilayah tertandai pesisir** padahal bukan kabupaten pesisir — artefak aproksimasi bounding box pada fallback Haversine (polygon tidak beraturan yang bbox-nya mendekati pantai). Bisa diabaikan atau dikoreksi manual; akan hilang sendiri saat klasifikasi dijalankan via PostGIS (jarak polygon sesungguhnya).
3. **321 vs referensi "283 kelurahan pesisir" PRD** belum dicocokkan dengan daftar resmi BIG/BPS. Selisih wajar karena aproksimasi bbox + ambang 1 km, tetapi perlu verifikasi silang.
4. **8 baris DemoSeeder** (geometri kotak WKT, tanpa `region_code`, provenance `demo`) masih ada: Way Jambu, Sungai Sidang, Kota Karang, Hanura, Punduh Pidada, Rajabasa, Pasar Krui, Kelumbayan. Ganti dengan baris BIG asli via sinkronisasi, lalu hapus baris demo.
5. **PostGIS belum terpasang di database dev.** Kolom `geometry` masih `text`. Keputusan arsitektur "PostgreSQL + PostGIS wajib" belum terpenuhi di lingkungan dev; produksi wajib memasangnya (`CREATE EXTENSION postgis` setelah memasang bundel PostGIS untuk PostgreSQL 18 via Application Stack Builder / installer PostGIS Windows).
6. **`boundary_status` hanya berisi `reference`/NULL** — belum memakai taksonomi official/estimated/manual/invalid (tugas P2 terpisah).
7. **`requirements.txt` ml-api rusak encoding** (baris pydantic tertulis UTF-16 via PowerShell `Add-Content`) — sudah diperbaiki dan ditulis ulang UTF-8 hari ini.
