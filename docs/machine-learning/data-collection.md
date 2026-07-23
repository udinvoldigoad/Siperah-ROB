# Skrip Pengambilan Data — ML Prediksi Banjir Rob

> **File terkait:** `ml-api/files/data_fetcher.py`  
> **Tujuan:** Mengambil data historis dan prakiraan dari sumber eksternal untuk training & inferensi model.

---

## Daftar Isi
1. [Persiapan & Instalasi](#1-persiapan--instalasi)
2. [Open-Meteo — Data Historis Cuaca (Training)](#2-open-meteo--data-historis-cuaca-training)
3. [Open-Meteo — Data Historis Gelombang Laut (Training)](#3-open-meteo--data-historis-gelombang-laut-training)
4. [BMKG — Prakiraan Cuaca (Inferensi Harian)](#4-bmkg--prakiraan-cuaca-inferensi-harian)
5. [Cara Menjalankan](#5-cara-menjalankan)
6. [Output yang Dihasilkan](#6-output-yang-dihasilkan)

---

## 1. Persiapan & Instalasi

Jalankan perintah berikut dari direktori `ml-api/`:

```bash
pip install openmeteo-requests requests-cache retry-requests pandas numpy
```

Atau update `requirements.txt` dan jalankan:
```bash
pip install -r requirements.txt
```

**`requirements.txt` (versi terbaru):**
```
mysql-connector-python
psycopg2-binary
scikit-learn>=1.4.0
imbalanced-learn>=0.12.0
pandas>=2.1.0
numpy>=1.25.2
python-dotenv==1.2.1
joblib>=1.3.0
openmeteo-requests>=0.3.0
requests-cache>=1.2.1
retry-requests>=2.0.0
```

---

## 2. Open-Meteo — Data Historis Cuaca (Training)

**File:** `ml-api/files/data_fetcher.py`

```python
"""
data_fetcher.py
Mengambil data historis cuaca dan gelombang dari Open-Meteo API
serta prakiraan cuaca dari BMKG untuk keperluan training dan inferensi.
"""

import openmeteo_requests
import requests_cache
from retry_requests import retry
import pandas as pd
import numpy as np
import requests
from pathlib import Path

# ─── Koordinat Wilayah Pesisir Lampung ──────────────────────────────────────
# Dapat ditambahkan lebih banyak titik untuk region lain
STATIONS = {
    "teluk_betung":  {"lat": -5.4500, "lon": 105.2600, "label": "Telukbetung Selatan"},
    "panjang":       {"lat": -5.5100, "lon": 105.2000, "label": "Panjang"},
    "kalianda":      {"lat": -5.5800, "lon": 105.5900, "label": "Kalianda"},
    "bakauheni":     {"lat": -5.8700, "lon": 105.7800, "label": "Bakauheni"},
}

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def _make_openmeteo_client():
    """Buat client Open-Meteo dengan caching agar tidak re-download data."""
    cache_session = requests_cache.CachedSession(".cache", expire_after=-1)
    retry_session = retry(cache_session, retries=5, backoff_factor=0.2)
    return openmeteo_requests.Client(session=retry_session)


def fetch_historical_weather(
    lat: float,
    lon: float,
    start_date: str = "2015-01-01",
    end_date: str = "2025-12-31",
) -> pd.DataFrame:
    """
    Mengambil data cuaca historis harian dari Open-Meteo Archive API.
    Gratis, tanpa API Key, data dari reanalisis ERA5.

    Parameter:
        lat, lon     : Koordinat titik pantau
        start_date   : Format YYYY-MM-DD
        end_date     : Format YYYY-MM-DD

    Return:
        DataFrame dengan kolom:
          date, precipitation_sum_mm, wind_speed_max_ms,
          wind_direction_dominant_deg, surface_pressure_mean_hpa
    """
    client = _make_openmeteo_client()

    url = "https://archive.open-meteo.com/v1/archive"
    params = {
        "latitude":     lat,
        "longitude":    lon,
        "start_date":   start_date,
        "end_date":     end_date,
        "daily": [
            "precipitation_sum",
            "wind_speed_10m_max",
            "wind_direction_10m_dominant",
            "surface_pressure_mean",
        ],
        "timezone": "Asia/Jakarta",
    }

    responses = client.weather_api(url, params=params)
    response  = responses[0]
    daily     = response.Daily()

    df = pd.DataFrame({
        "date": pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left",
        ).strftime("%Y-%m-%d"),
        "precipitation_sum_mm":          daily.Variables(0).ValuesAsNumpy(),
        "wind_speed_max_ms":             daily.Variables(1).ValuesAsNumpy(),
        "wind_direction_dominant_deg":   daily.Variables(2).ValuesAsNumpy(),
        "surface_pressure_mean_hpa":     daily.Variables(3).ValuesAsNumpy(),
    })

    return df
```

---

## 3. Open-Meteo — Data Historis Gelombang Laut (Training)

Tambahkan fungsi berikut ke file `data_fetcher.py`:

```python
def fetch_historical_marine(
    lat: float,
    lon: float,
    start_date: str = "2015-01-01",
    end_date: str = "2025-12-31",
) -> pd.DataFrame:
    """
    Mengambil data gelombang laut historis dari Open-Meteo Marine API.
    Gelombang signifikan dan alun (swell) sangat berpengaruh terhadap rob.

    Return:
        DataFrame dengan kolom:
          date, wave_height_max_m, swell_wave_height_max_m
    """
    client = _make_openmeteo_client()

    url = "https://marine-api.open-meteo.com/v1/marine"
    params = {
        "latitude":   lat,
        "longitude":  lon,
        "start_date": start_date,
        "end_date":   end_date,
        "daily": [
            "wave_height_max",
            "swell_wave_height_max",
        ],
        "timezone": "Asia/Jakarta",
    }

    responses = client.weather_api(url, params=params)
    response  = responses[0]
    daily     = response.Daily()

    df = pd.DataFrame({
        "date": pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left",
        ).strftime("%Y-%m-%d"),
        "wave_height_max_m":       daily.Variables(0).ValuesAsNumpy(),
        "swell_wave_height_max_m": daily.Variables(1).ValuesAsNumpy(),
    })

    return df
```

---

## 4. BMKG — Prakiraan Cuaca (Inferensi Harian)

Tambahkan fungsi berikut ke `data_fetcher.py` untuk mengambil data prakiraan **real-time** saat model sedang berjalan di produksi:

```python
# Kode ADM4 BMKG untuk wilayah pesisir Lampung
# Cari kode lengkap via: https://api.bmkg.go.id/publik/prakiraan-cuaca?adm3=18.71.01
BMKG_ADM4_CODES = {
    "teluk_betung": "18.71.01.1001",  # PERLU DIKONFIRMASI via API
    "panjang":      "18.71.04.1001",  # PERLU DIKONFIRMASI via API
    "kalianda":     "18.01.17.2001",  # PERLU DIKONFIRMASI via API
}


def fetch_bmkg_forecast(adm4_code: str) -> pd.DataFrame:
    """
    Mengambil prakiraan cuaca 3-harian dari BMKG Open API.
    Digunakan saat inferensi (prediksi harian operasional), BUKAN untuk training.

    Parameter:
        adm4_code : Kode wilayah ADM4 Kemendagri (misal "18.71.01.1001")

    Return:
        DataFrame dengan kolom:
          local_datetime, rainfall_mm, wind_speed_ms, humidity_pct
    """
    url = f"https://api.bmkg.go.id/publik/prakiraan-cuaca?adm4={adm4_code}"

    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as e:
        print(f"[ERROR] Gagal mengambil data BMKG untuk {adm4_code}: {e}")
        return pd.DataFrame()

    records = []
    for day_block in raw.get("data", [{}])[0].get("cuaca", []):
        for slot in day_block:
            records.append({
                "local_datetime": slot.get("local_datetime"),
                "rainfall_mm":    slot.get("tp", 0),       # tp = total precipitation (mm)
                "wind_speed_ms":  slot.get("ws", 0),       # ws = wind speed (knot, perlu konversi)
                "humidity_pct":   slot.get("hu", 0),       # hu = humidity (%)
                "weather_code":   slot.get("weather", 0),
                "weather_desc":   slot.get("weather_desc", ""),
            })

    df = pd.DataFrame(records)
    if df.empty:
        return df

    df["local_datetime"] = pd.to_datetime(df["local_datetime"])
    # Konversi kecepatan angin dari knot ke m/s (1 knot = 0.514 m/s)
    df["wind_speed_ms"] = df["wind_speed_ms"] * 0.514

    # Agregasi per hari (ambil total hujan harian, rata-rata angin)
    df["date"] = df["local_datetime"].dt.date
    daily = df.groupby("date").agg(
        rainfall_mm   = ("rainfall_mm",  "sum"),
        wind_speed_ms = ("wind_speed_ms", "mean"),
        humidity_pct  = ("humidity_pct",  "mean"),
    ).reset_index()

    return daily


def fetch_openmeteo_forecast_fallback(lat: float, lon: float, days: int = 7) -> pd.DataFrame:
    """
    Fallback: jika BMKG API tidak tersedia, gunakan Open-Meteo Forecast API.
    Gratis, akurasi setara BMKG untuk wilayah Indonesia.
    """
    client = _make_openmeteo_client()

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude":   lat,
        "longitude":  lon,
        "forecast_days": days,
        "daily": [
            "precipitation_sum",
            "wind_speed_10m_max",
            "surface_pressure_mean",
        ],
        "timezone": "Asia/Jakarta",
    }

    responses = client.weather_api(url, params=params)
    response  = responses[0]
    daily     = response.Daily()

    df = pd.DataFrame({
        "date": pd.date_range(
            start=pd.to_datetime(daily.Time(), unit="s", utc=True),
            end=pd.to_datetime(daily.TimeEnd(), unit="s", utc=True),
            freq=pd.Timedelta(seconds=daily.Interval()),
            inclusive="left",
        ).strftime("%Y-%m-%d"),
        "rainfall_mm":   daily.Variables(0).ValuesAsNumpy(),
        "wind_speed_ms": daily.Variables(1).ValuesAsNumpy(),
        "pressure_hpa":  daily.Variables(2).ValuesAsNumpy(),
    })

    return df
```

---

## 5. Fungsi Utama — Jalankan Semua Pengambilan Data

Tambahkan di bagian bawah `data_fetcher.py`:

```python
def fetch_all_historical(start_date: str = "2015-01-01", end_date: str = "2025-12-31"):
    """
    Jalankan pengambilan semua data historis untuk semua stasiun Lampung.
    Hasilnya disimpan sebagai CSV di ml-api/data/raw/
    """
    print(f"[INFO] Mengambil data historis dari {start_date} hingga {end_date}...")

    all_weather = []
    all_marine  = []

    for station_key, station in STATIONS.items():
        lat = station["lat"]
        lon = station["lon"]
        label = station["label"]

        print(f"  → Cuaca: {label} ({lat}, {lon})")
        df_w = fetch_historical_weather(lat, lon, start_date, end_date)
        df_w["station"] = station_key
        all_weather.append(df_w)

        print(f"  → Gelombang: {label} ({lat}, {lon})")
        df_m = fetch_historical_marine(lat, lon, start_date, end_date)
        df_m["station"] = station_key
        all_marine.append(df_m)

    # Gabungkan semua stasiun
    weather_combined = pd.concat(all_weather, ignore_index=True)
    marine_combined  = pd.concat(all_marine,  ignore_index=True)

    # Simpan ke CSV
    out_weather = OUTPUT_DIR / "weather_historical.csv"
    out_marine  = OUTPUT_DIR / "marine_historical.csv"

    weather_combined.to_csv(out_weather, index=False)
    marine_combined.to_csv(out_marine, index=False)

    print(f"\n[OK] Data cuaca disimpan: {out_weather} ({len(weather_combined)} baris)")
    print(f"[OK] Data gelombang disimpan: {out_marine} ({len(marine_combined)} baris)")

    return weather_combined, marine_combined


def fetch_daily_forecast_for_inference():
    """
    Ambil prakiraan hari ini untuk semua stasiun (untuk inferensi model harian).
    Coba BMKG dulu, fallback ke Open-Meteo jika BMKG gagal.
    """
    forecasts = {}

    for station_key, station in STATIONS.items():
        adm4 = BMKG_ADM4_CODES.get(station_key)
        label = station["label"]

        df = pd.DataFrame()

        # Coba BMKG terlebih dahulu
        if adm4:
            print(f"  → BMKG prakiraan: {label}")
            df = fetch_bmkg_forecast(adm4)

        # Fallback ke Open-Meteo jika BMKG gagal
        if df.empty:
            print(f"  → Fallback Open-Meteo: {label}")
            df = fetch_openmeteo_forecast_fallback(
                station["lat"], station["lon"], days=7
            )

        forecasts[station_key] = df

    return forecasts


# ─── Entry Point ─────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Siperah-ROB Data Fetcher")
    parser.add_argument(
        "--mode",
        choices=["historical", "forecast"],
        required=True,
        help="historical = unduh data latih, forecast = ambil prakiraan hari ini"
    )
    parser.add_argument("--start", default="2015-01-01", help="Tanggal mulai (YYYY-MM-DD)")
    parser.add_argument("--end",   default="2025-12-31", help="Tanggal akhir (YYYY-MM-DD)")

    args = parser.parse_args()

    if args.mode == "historical":
        fetch_all_historical(args.start, args.end)

    elif args.mode == "forecast":
        result = fetch_daily_forecast_for_inference()
        for station, df in result.items():
            print(f"\n=== {station} ===")
            print(df.to_string(index=False))
```

---

## 5. Cara Menjalankan

### A. Unduh Data Historis (untuk Training — lakukan SEKALI SAJA)
```bash
# Dari direktori ml-api/
python -m files.data_fetcher --mode=historical --start=2015-01-01 --end=2025-12-31
```

Proses ini memakan waktu **~2–5 menit** (pertama kali). Hasilnya akan di-*cache* otomatis di folder `.cache/`.

### B. Ambil Prakiraan Hari Ini (untuk Inferensi Harian)
```bash
python -m files.data_fetcher --mode=forecast
```

Jalankan perintah ini di dalam CRON job Laravel atau task scheduler harian.

---

## 6. Output yang Dihasilkan

```
ml-api/
└── data/
    └── raw/
        ├── weather_historical.csv     ← Cuaca harian 2015–2025 (4 stasiun)
        └── marine_historical.csv      ← Gelombang laut harian 2015–2025 (4 stasiun)
```

### Struktur `weather_historical.csv`

| date | precipitation_sum_mm | wind_speed_max_ms | wind_direction_dominant_deg | surface_pressure_mean_hpa | station |
|---|---|---|---|---|---|
| 2015-01-01 | 12.5 | 6.2 | 180 | 1009.3 | teluk_betung |
| 2015-01-02 | 0.0 | 3.1 | 270 | 1011.0 | teluk_betung |

### Struktur `marine_historical.csv`

| date | wave_height_max_m | swell_wave_height_max_m | station |
|---|---|---|---|
| 2015-01-01 | 0.85 | 0.42 | teluk_betung |
| 2015-01-02 | 1.10 | 0.67 | teluk_betung |

---

## Catatan Penting

> [!WARNING]
> **Kode ADM4 BMKG** di bagian `BMKG_ADM4_CODES` perlu dikonfirmasi manual. Cara carinya:
> ```
> GET https://api.bmkg.go.id/publik/prakiraan-cuaca?adm3=18.71.01
> ```
> Ganti `18.71.01` dengan kode kecamatan yang dicari, lihat respons JSON-nya untuk `adm4` yang sesuai.

> [!NOTE]
> Data Open-Meteo menggunakan model reanalisis **ERA5** dari ECMWF — ini adalah standar ilmiah yang digunakan para peneliti iklim global, sehingga kualitasnya sangat terpercaya untuk keperluan ML.

> [!TIP]
> Setelah data historis berhasil diunduh, lanjutkan ke langkah berikutnya:
> ```bash
> python -m files.feature_engineering   # Buat fitur lengkap
> python -m files.train_model            # Latih model Random Forest
> python main.py --mode=predict          # Generate prediksi
> ```
