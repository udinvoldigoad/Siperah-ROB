# Roadmap Pengembangan ML Prediksi Banjir Rob — Siperah-ROB

> **Versi:** 1.0 · **Terakhir diperbarui:** Juli 2026  
> **Konteks:** Dokumen ini merupakan kelanjutan dan penjabaran implementasi dari `planning_ml_prediksi_rob_lampung (1).md`.  
> Pendekatan: **Dua model paralel** — klasifikasi biner (Rob/Tidak Rob) + regresi probabilitas ketinggian air laut.

---

## Ringkasan Eksekutif

Pipeline ML Siperah-ROB akan mengintegrasikan **3 sumber data eksternal** (BMKG, Open-Meteo, BIG) ke dalam satu sistem pelatihan dan inferensi yang terhubung langsung ke `ml-api` yang sudah ada. Sistem dirancang bertahap (4 fase) dari pengumpulan data mentah hingga model hidup di produksi.

---

## Fase 0: Persiapan Lingkungan (Minggu 1)

### 0.1 Pengaturan Environment Python

```bash
# Dari direktori /ml-api
pip install openmeteo-requests requests-cache retry-requests pandas numpy scikit-learn imbalanced-learn joblib psycopg2-binary fastapi uvicorn
```

Tambahkan ke `ml-api/requirements.txt`:
```
openmeteo-requests==0.3.0
requests-cache==1.2.1
retry-requests==2.0.0
scikit-learn>=1.4.0
imbalanced-learn>=0.12.0
joblib>=1.3.0
```

### 0.2 Struktur Direktori Target

```
ml-api/
├── main.py                     # (Sudah ada) Entry point pipeline
├── requirements.txt
├── models/                     # [BARU] Artefak model .joblib tersimpan di sini
│   ├── flood_classifier_v1.joblib
│   └── scaler_v1.joblib
├── data/                       # [BARU] Data mentah dan data olahan
│   ├── raw/
│   │   ├── tide_historical.csv
│   │   └── weather_historical.csv
│   └── processed/
│       └── training_features.csv
├── files/
│   ├── feature_engineering.py  # (Sudah ada, akan dikembangkan)
│   ├── train_model.py           # (Sudah ada, akan diperbarui)
│   ├── predict_forecast.py      # (Sudah ada, akan diperbarui)
│   ├── data_fetcher.py          # [BARU] Pengambil data dari API eksternal
│   └── labeler.py               # [BARU] Sistem pelabelan data historis
└── notebooks/                   # [BARU] Analisis eksplorasi EDA
    └── 01_eda_exploration.ipynb
```

---

## Fase 1: Akuisisi & Pelabelan Data Historis (Minggu 1–2)

### 1.1 Open-Meteo — Data Cuaca & Gelombang Historis (GRATIS, Tanpa API Key)

Ini adalah sumber data historis **utama dan paling mudah** untuk fase training. Koordinat yang digunakan: wilayah pesisir Lampung (Teluk Betung: `-5.45, 105.26`).

**Endpoint:**
```
https://archive.open-meteo.com/v1/archive
  ?latitude=-5.45&longitude=105.26
  &start_date=2015-01-01
  &end_date=2025-12-31
  &daily=precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,surface_pressure_mean
  &timezone=Asia%2FJakarta
```

**Marine API (Gelombang Laut):**
```
https://marine-api.open-meteo.com/v1/marine
  ?latitude=-5.45&longitude=105.26
  &start_date=2015-01-01&end_date=2025-12-31
  &daily=wave_height_max,swell_wave_height_max
```

**Variabel yang ditarik untuk fitur ML:**

| Variabel | Field API | Keterangan |
|---|---|---|
| Curah hujan harian | `precipitation_sum` | Satuan mm, fitur utama |
| Kecepatan angin maks | `wind_speed_10m_max` | m/s |
| Arah angin dominan | `wind_direction_10m_dominant` | derajat |
| Tekanan permukaan | `surface_pressure_mean` | hPa, penurunan = badai |
| Tinggi gelombang maks | `wave_height_max` | meter |
| Tinggi alun (swell) | `swell_wave_height_max` | meter, indikator rob jauh |

### 1.2 BMKG — Data Prakiraan Real-time (Untuk Inferensi)

API BMKG (`api.bmkg.go.id/publik/prakiraan-cuaca`) digunakan saat **model sudah terlatih** untuk mengambil input fitur prediksi masa depan.

Kode wilayah pesisir Lampung yang perlu dicari via API:

| Lokasi | Cara Cari Kode ADM4 |
|---|---|
| Telukbetung Selatan | `api.bmkg.go.id/publik/prakiraan-cuaca?adm3=18.71.01` |
| Panjang | `api.bmkg.go.id/publik/prakiraan-cuaca?adm3=18.71.04` |
| Kalianda | `api.bmkg.go.id/publik/prakiraan-cuaca?adm3=18.01.17` |

### 1.3 BIG/Pushidrosal — Data Pasang Surut

Untuk data pasang surut historis, gunakan dua pendekatan (dari yang termudah):

**Opsi A (Rekomendasi — sudah ada di codebase):** Gunakan model harmonik yang sudah ada di `ml-api/main.py` (fungsi `fit_harmonic_model`) berbasis data sensor IoT internal dari tabel `datasets` di database Siperah-ROB. Proyeksikan ke depan menggunakan konstanta harmonik yang sudah dikalibrasi.

**Opsi B (Data Eksternal):** Unduh arsip pasut historis dari UHSLC (University of Hawaii Sea Level Center) untuk stasiun Pelabuhan Panjang, Lampung:
```
https://uhslc.soest.hawaii.edu/data/csv/fd/uhslc_fd011.csv
```

### 1.4 Strategi Pelabelan Data

Karena data historis kejadian rob dari BPBD sangat terbatas, digunakan **Proxy Labeling** dua level:

```python
# Ambang batas SEMENTARA — wajib divalidasi dengan BPBD/BMKG Lampung
TIDE_THRESHOLD_CM   = 185   # Pasang > 185 cm di atas MSL
RAINFALL_THRESHOLD  = 25    # Curah hujan > 25 mm/hari

# Label = 1 (Rob) jika KEDUANYA terpenuhi bersamaan
label = (max_tide_cm >= TIDE_THRESHOLD_CM) AND (rainfall_mm >= RAINFALL_THRESHOLD)
```

**Validasi Silang:** Cocokkan hasil pelabelan proxy dengan:
- Laporan tervalidasi di tabel `ground_truth_reports` (status = `divalidasi`)
- Berita lokal (Tribun Lampung, Radar Lampung) dari tahun 2015–2025

---

## Fase 2: Feature Engineering & Training Pipeline (Minggu 2–3)

### 2.1 Fitur Baru yang Akan Ditambahkan ke `feature_engineering.py`

Fitur dasar yang sudah ada diperluas dengan:

| Kategori | Fitur Baru | Cara Hitung |
|---|---|---|
| **Pasang Surut** | `tide_anomaly_cm` | `max_tide_cm - monthly_avg_tide` |
| **Pasang Surut** | `is_king_tide` | 1 jika max_tide > persentil 95% historis |
| **Cuaca** | `rainfall_14d_avg` | Rolling window 14 hari |
| **Cuaca** | `consecutive_rain_days` | Berapa hari hujan berturut-turut |
| **Laut** | `wave_height_max` | Dari Open-Meteo Marine API |
| **Laut** | `swell_wave_height` | Alun dari luar (indikator rob jauh) |
| **Interaksi** | `tide_x_wave` | `max_tide_cm * wave_height_max` |
| **Interaksi** | `rain_x_wind` | `rainfall_mm * wind_speed_max` |
| **Waktu** | `is_wet_season` | 1 untuk bulan Nov–Mar (musim hujan) |
| **Topografi** | `elevation_m` | Elevasi titik dari DEMNAS (fitur statis per region) |

### 2.2 Pipeline Training Lengkap

```
Raw Data (Open-Meteo + Pasut Internal)
    ↓
Pembersihan & Sinkronisasi Timestamp (harian)
    ↓
Feature Engineering (tambah rolling, interaksi, bulan)
    ↓
Proxy Labeling (+ validasi laporan BPBD)
    ↓
Time-based Split:
  Train: 2015–2022 (70%)
  Validation: 2023 (15%)
  Test: 2024–2025 (15%)
    ↓
SMOTE Oversampling (hanya pada data training)
    ↓
RandomForestClassifier + GridSearchCV (TimeSeriesSplit k=5)
    ↓
Evaluasi: Recall, F1-Score, ROC-AUC, PR-AUC
    ↓
Simpan artefak model → models/flood_classifier_v1.joblib
```

### 2.3 Target Performa Minimum

| Metrik | Target Minimum | Alasan |
|---|---|---|
| **Recall (kelas Rob)** | ≥ 0.80 | Prioritas utama: jangan sampai miss kejadian rob |
| **Precision** | ≥ 0.60 | False alarm masih dapat ditoleransi |
| **F1-Score** | ≥ 0.70 | Keseimbangan secara keseluruhan |
| **PR-AUC** | ≥ 0.65 | Indikator andal untuk imbalanced dataset |

---

## Fase 3: Integrasi dengan Backend Siperah-ROB (Minggu 3–4)

### 3.1 Alur Inferensi Harian (Otomatis)

```
[CRON Job Harian — tiap pukul 06:00 WIB]
    ↓
Ambil prakiraan 7 hari dari BMKG API (per kode ADM4 per region)
    ↓
Proyeksikan tinggi pasang 7 hari (model harmonik di main.py)
    ↓
Jalankan feature engineering pada input baru
    ↓
Kirim ke model → output: [risk_class, risk_probability] per hari × per region
    ↓
Push hasil ke tabel `ml_predictions` di database
    ↓
Dashboard Operator & Mode Awam membaca dari database
```

### 3.2 Perubahan Backend Laravel yang Dibutuhkan

**Endpoint baru** (opsional — jika ingin ml-api PUSH via HTTP daripada tulis DB langsung):
```
POST /api/internal/predictions/ingest
Authorization: Bearer [INTERNAL_ML_API_KEY]
Body: { region_id, prediction_date, risk_class, risk_probability, ... }[]
```

**File `.env` backend** perlu menambahkan:
```
ML_API_KEY=your_secret_key_here
ML_API_URL=http://127.0.0.1:8001
```

### 3.3 Schedule CRON di Laravel

Tambahkan di `app/Console/Commands/RefreshOperationalData.php` yang sudah ada:
```php
// Panggil script ml-api untuk regenerasi prediksi
$output = shell_exec('python /path/to/ml-api/main.py --mode=inference');
```

Atau daftarkan sebagai task CRON terpisah di server.

---

## Fase 4: Monitoring & Iterasi Model (Bulan 2+)

### 4.1 Ground Truth Feedback Loop

Laporan warga tervalidasi di `ground_truth_reports` (status = `divalidasi`) digunakan secara berkala untuk:
1. **Evaluasi Model:** Bandingkan prediksi H-1 dengan kejadian nyata laporan warga
2. **Re-labeling:** Perbaiki threshold proxy label jika ada banyak false negative/positive
3. **Re-training:** Lakukan re-training model setiap **6 bulan**

### 4.2 Rencana Upgrade Model (Jangka Panjang)

| Versi | Target | Algoritma |
|---|---|---|
| **v1** (sekarang) | Klasifikasi biner, 7 hari, per region | Random Forest |
| **v2** | Multi-kelas (Rendah/Sedang/Tinggi/Sangat Tinggi), regresi ketinggian air | XGBoost / LightGBM |
| **v3** | Prediksi per titik koordinat (spasial tinggi) | Gradient Boosting + Spatial features |
| **v4** | Nowcasting real-time (< 1 jam) dari sensor IoT | LSTM / Online Learning |

---

## Timeline Ringkas

| Minggu | Aktivitas | Output |
|:---:|---|---|
| **1** | Setup env, akuisisi data Open-Meteo (2015–2025) & data pasut dari DB internal | `data/raw/*.csv` siap |
| **2** | Feature engineering, pelabelan, EDA notebook | `data/processed/training_features.csv` |
| **3** | Training model, hyperparameter tuning, evaluasi | `models/flood_classifier_v1.joblib` |
| **4** | Integrasi inferensi harian ke CRON, integrasi ke Laravel, testing end-to-end | Prediksi live di dashboard |
| **5+** | Monitoring, pengumpulan ground truth, laporan performa | Siklus re-training berkelanjutan |

---

## Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Data pasut historis Lampung tidak tersedia | Tinggi | Gunakan model harmonik internal (`main.py`) + data UHSLC |
| Threshold proxy label tidak akurat | Tinggi | Kalibrasi dengan ≥ 20 laporan tervalidasi BPBD |
| Open-Meteo rate limit / downtime | Rendah | Cache data lokal setelah download pertama |
| BMKG API tidak tersedia saat inferensi | Menengah | Fallback ke Open-Meteo forecast jika BMKG error |
| Class imbalance ekstrem (rob vs normal) | Tinggi | SMOTE + `class_weight='balanced'` + threshold tuning |

---

> 📌 Dokumen ini bersifat hidup (*living document*). Perbarui setiap ada perubahan arsitektur atau sumber data baru.
