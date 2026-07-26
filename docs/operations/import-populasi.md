# Impor Populasi Resmi per Desa/Kelurahan

Dashboard provinsi menghitung "Warga Terdampak Potensial" dari `regions.population`.
Angka ini **hanya boleh berasal dari sumber resmi yang bisa diaudit** — impor tanpa
`--source` dan `--reference` ditolak oleh command.

## Status provenance populasi

Kolom di tabel `regions` (migrasi `2026_07_26_000000`):

| Kolom | Isi |
|---|---|
| `population_source` | Nama sumber resmi, mis. "BPS - Kecamatan Panjang Dalam Angka 2025" |
| `population_source_reference` | URL/nomor publikasi BPS |
| `population_provenance_status` | `official` (dari impor bersumber) / `unverified` (entri manual lama) |

Nilai populasi lama yang dientri manual tanpa sumber otomatis berstatus
`unverified` sejak migrasi — angkanya tidak dihapus, tapi tidak lagi dihitung
sebagai resmi di `population_audit` dashboard provinsi.

## Estimasi dasar: WorldPop (sudah terisi otomatis)

Seluruh wilayah (2.640 kelurahan/desa, termasuk 309 pesisir) sudah terisi
estimasi populasi dari **WorldPop 2020 UN-adjusted constrained 100 m**
(CC BY 4.0, standar internasional analisis kebencanaan) lewat zonal statistics
terhadap poligon resmi BIG:

```bash
cd ml-api
pip install rasterio shapely   # hanya untuk skrip ini, tidak dipakai pipeline harian
# unduh raster (51 MB, sekali saja) sesuai URL di header skrip, lalu:
python import_worldpop_population.py            # semua wilayah
python import_worldpop_population.py --dry-run  # hitung tanpa menulis
```

Status provenance nilai ini `estimated` — bukan angka resmi BPS. Sanity check:
total seluruh kelurahan Kota Bandar Lampung ≈ 1,11 juta jiwa (cocok dengan
publikasi BPS ±1,1 juta). Wilayah bernilai 0 adalah poligon tanpa permukiman
terdeteksi (pulau kecil/mangrove). Skrip TIDAK PERNAH menimpa baris berstatus
`official` — impor BPS di bawah selalu menang.

## Sumber resmi yang dipakai

1. **BPS "Kecamatan Dalam Angka" (KCDA)** — terbit tiap tahun per kecamatan,
   memuat tabel *Jumlah Penduduk menurut Desa/Kelurahan*. Unduh dari situs BPS
   kabupaten/kota masing-masing (menu Publikasi):
   - Kota Bandar Lampung: https://bandarlampungkota.bps.go.id/publication.html
   - Lampung Selatan: https://lampungselatankab.bps.go.id/publication.html
   - Pesawaran: https://pesawarankab.bps.go.id/publication.html
   - Tanggamus: https://tanggamuskab.bps.go.id/publication.html
   - Pesisir Barat: https://pesisirbaratkab.bps.go.id/publication.html
   - Lampung Timur: https://lampungtimurkab.bps.go.id/publication.html
   - Tulang Bawang: https://tulangbawangkab.bps.go.id/publication.html
   - Mesuji: https://mesujikab.bps.go.id/publication.html
2. **BPS WebAPI** (https://webapi.bps.go.id) — butuh API key gratis
   (registrasi akun BPS). Ekspor tabel dinamis kependudukan ke CSV, lalu impor
   dengan command yang sama.

## Format CSV

Header fleksibel (alias dikenali): `kabupaten`, `kecamatan` (opsional),
`desa`/`kelurahan`, `jumlah_penduduk`. Contoh:

```csv
kabupaten,kecamatan,kelurahan,jumlah_penduduk
Kota Bandar Lampung,Panjang,Panjang Utara,10758
Kota Bandar Lampung,Panjang,Panjang Selatan,12429
```

## Menjalankan

```bash
# Validasi dulu tanpa menulis (lihat baris tak cocok/ambigu):
php artisan data:import-population storage/imports/penduduk-panjang-2025.csv \
  --source="BPS - Kecamatan Panjang Dalam Angka 2025" \
  --reference="https://bandarlampungkota.bps.go.id/publication/..." \
  --dry-run

# Impor sungguhan:
php artisan data:import-population storage/imports/penduduk-panjang-2025.csv \
  --source="BPS - Kecamatan Panjang Dalam Angka 2025" \
  --reference="https://bandarlampungkota.bps.go.id/publication/..."
```

Pencocokan nama dinormalisasi (prefiks Kabupaten/Kota dibuang, case-insensitive).
Baris yang tidak cocok atau ambigu **dilaporkan dan dilewati** — tidak pernah
ditebak. Setiap run tercatat di `data_import_runs` (`dataset_type=population`).

Prioritaskan 309 wilayah `coastal_flag=true` (delapan kabupaten/kota pesisir) —
itulah yang mengisi KPI dashboard provinsi.
