# ml-api — Pipeline ML Prediksi Banjir Rob

Pipeline Machine Learning SIPERAH-RoB: klasifikasi risiko rob harian per
wilayah pesisir Lampung (8 kabupaten/kota pesisir), horizon H+0 s/d H+30.

## Arsitektur

```
Open-Meteo Archive (ERA5, 2015-kini)  ─┐
Open-Meteo Marine (gelombang)         ─┼─> data/raw/*.csv ─> feature_engineering ─> labeler ─> train_model ─> models/flood_classifier_v1.joblib
tidal_data internal (model harmonik)  ─┘                     (proxy threshold + ground_truth_reports BPBD)

Open-Meteo/BMKG Forecast (H+1..H+7)   ─┐
Klimatologi bulanan (H+8..H+30)       ─┼─> predict_forecast ─> tabel `predictions` ─> dashboard/peta
Proyeksi pasut harmonik 30 hari       ─┘
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

# Offline/demo tanpa jaringan (provenance ditandai 'demo'):
.venv/Scripts/python main.py --mode train --simulate
.venv/Scripts/python main.py --mode predict --simulate
```

## Konfigurasi (environment variable)

| Variabel | Default | Keterangan |
|---|---|---|
| `ML_TIDE_THRESHOLD_CM` | 185 | Ambang pasang proxy label (SEMENTARA — validasi dg BPBD/BMKG) |
| `ML_RAINFALL_THRESHOLD_MM` | 25 | Ambang hujan proxy label |
| `ML_TIDE_DATUM_OFFSET_CM` | 100 | Offset datum sensor pasut internal → cm di atas datum ambang |
| `ML_WEATHER_SOURCE` | `openmeteo` | `openmeteo` \| `bmkg` (BMKG butuh kode ADM4 di `data_fetcher.py`) |

## Catatan penting

- **Satuan konsisten**: seluruh angin m/s (`wind_speed_unit=ms`), hujan mm,
  tekanan hPa, gelombang meter — sama antara training dan inferensi.
- **Endpoint arsip** yang benar: `archive-api.open-meteo.com` (dokumen
  perencanaan lama menulis `archive.open-meteo.com` — domain itu tidak ada).
- **Label**: proxy threshold (pasang ≥185cm DAN hujan ≥25mm) di-override oleh
  laporan warga tervalidasi BPBD (`ground_truth_reports.status='divalidasi'`).
- **Confidence** per prediksi = margin probabilitas model (bukan angka statis).
- Kelas risiko dari probabilitas: ≥0.75 sangat_tinggi, ≥0.55 tinggi,
  ≥0.30 sedang, <0.30 rendah (`predict_forecast.RISK_THRESHOLDS`).
- Metrik evaluasi tersimpan di `models/metrics_flood_classifier_v1.json`;
  target minimum roadmap: Recall ≥0.80, Precision ≥0.60, F1 ≥0.70, PR-AUC ≥0.65.
