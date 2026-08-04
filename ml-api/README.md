# ml-api â€” Pipeline ML Prediksi Banjir Rob

Pipeline Machine Learning SAIBAR: klasifikasi risiko rob harian per
wilayah pesisir Lampung (8 kabupaten/kota pesisir), horizon H+0 s/d H+30.

## Arsitektur

```
Open-Meteo Archive (ERA5, 2015-kini)     â”€â”
Open-Meteo Marine (gelombang)            â”€â”¼â”€> data/raw/*.csv â”€> feature_engineering â”€> labeler â”€> train_model â”€> models/flood_classifier_v1.joblib
tidal_data internal (harmonik/stasiun)   â”€â”˜                     (proxy persentil terkalibrasi + ground truth
                                                                 DIBI BNPB + episode terkurasi + laporan BPBD)

Open-Meteo/BMKG Forecast (H+1..H+7)      â”€â”
Klimatologi bulanan (H+8..H+30)          â”€â”¼â”€> predict_forecast â”€> tabel `predictions` â”€> dashboard/peta
Proyeksi pasut harmonik/stasiun 30 hari  â”€â”˜
```

## Setup

```bash
cd ml-api
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # Windows
```

Koneksi DB dibaca dari `../backend/.env` (DB_CONNECTION, DB_HOST, dst).

## Pemakaian

```bash
# 1) Unduh data historis (sekali; ~2-5 menit, di-cache)
.venv/Scripts/python main.py --mode fetch --start 2015-01-01 --end 2026-07-14

# 2) Latih model (tambah --tune untuk hyperparameter search)
.venv/Scripts/python main.py --mode train

# 3) Prediksi harian -> tulis ke tabel predictions (default; dipanggil CRON)
.venv/Scripts/python main.py --mode predict

# Refresh sore hanya saat jendela pasang purnama/bulan baru:
.venv/Scripts/python main.py --mode predict --only-if-astronomical
```

## Konfigurasi (environment variable)

| Variabel | Default | Keterangan |
|---|---|---|
| `ML_TIDE_DATUM_OFFSET_CM` | 0 | Pipeline bekerja native di datum MSL (Open-Meteo Marine FES). Isi HANYA bila ada datum resmi BIG/BMKG hasil pengukuran |
| `ML_WEATHER_SOURCE` | `openmeteo` | `openmeteo` \| `bmkg` (BMKG butuh kode ADM4 di `data_fetcher.py`) |

Ambang label proxy TIDAK lagi berupa konstanta env: persentil pasang/hujan per
stasiun dikalibrasi otomatis terhadap kejadian rob riil saat training, dan
hasilnya tersimpan di `models/label_calibration.json` (bisa diaudit).

## Catatan penting

- **Satuan konsisten**: seluruh angin m/s (`wind_speed_unit=ms`), hujan mm,
  tekanan hPa, gelombang meter â€” sama antara training dan inferensi.
- **Endpoint arsip** yang benar: `archive-api.open-meteo.com` (dokumen
  perencanaan lama menulis `archive.open-meteo.com` â€” domain itu tidak ada).
- **Label** (prioritas menaik): (1) proxy persentil per stasiun â€” pasangan
  persentil pasang/hujan dipilih grid-search yang memaksimalkan F1 terhadap
  hari-hari kejadian riil; (2) episode harian terkurasi
  `data/raw/ground_truth_2020.csv` (label 0 dan 1); (3) kejadian rob/gelombang
  pasang resmi BNPB DIBI `data/raw/ground_truth_events.csv` (dengan kode
  identitas bencana); (4) laporan warga tervalidasi BPBD
  (`ground_truth_reports.status='divalidasi'`).
- **Datum pasut**: `tidal_data` = `sea_level_height_msl` Open-Meteo Marine
  (model FES), meter relatif MSL. `max_tidal_height` di tabel `predictions`
  juga meter di atas MSL â€” tanpa offset karangan.
- **Pasut per stasiun**: model harmonik (M2/S2/K1/O1) di-fit per stasiun â€”
  fase Samudra Hindia (Pesisir Barat) â‰  Laut Jawa (Tulang Bawang/Mesuji)
  â‰  Teluk Lampung.
- **Confidence** per prediksi = margin probabilitas model (bukan angka statis).
- Kelas risiko dari probabilitas: â‰¥0.75 sangat_tinggi, â‰¥0.55 tinggi,
  â‰¥0.30 sedang, <0.30 rendah (`predict_forecast.RISK_THRESHOLDS`).
- Metrik evaluasi tersimpan di `models/metrics_flood_classifier_v1.json`;
  target minimum roadmap: Recall â‰¥0.80, Precision â‰¥0.60, F1 â‰¥0.70, PR-AUC â‰¥0.65.

