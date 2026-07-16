"""
data_fetcher.py
Mengambil data historis cuaca & gelombang dari Open-Meteo API serta prakiraan
cuaca (Open-Meteo/BMKG) untuk keperluan training dan inferensi model.

Catatan implementasi:
- Dipakai REST JSON Open-Meteo langsung via `requests` (bukan SDK
  openmeteo-requests/FlatBuffers) agar dependensi minimal dan respons mudah
  diinspeksi. Endpoint dan parameter sama persis dengan dokumentasi.
- Satuan dinormalisasi eksplisit: angin m/s (`wind_speed_unit=ms`),
  hujan mm, tekanan hPa, gelombang meter. Konsistensi satuan antara data
  training (Open-Meteo) dan inferensi adalah prioritas.
- Semua request historis di-cache (requests-cache) supaya tidak re-download.
"""

from __future__ import annotations

import time
from pathlib import Path

import pandas as pd
import requests

try:  # cache opsional -- tetap jalan tanpa requests_cache
    import requests_cache
    _HAS_CACHE = True
except ImportError:
    _HAS_CACHE = False

# ─── Titik pantau: satu per kabupaten/kota pesisir Lampung ───────────────────
# lat/lon   : titik darat pesisir (untuk cuaca)
# marine    : titik laut terdekat (untuk gelombang; digeser sedikit lepas pantai)
STATIONS = {
    "bandar_lampung": {"lat": -5.4500, "lon": 105.2600, "marine": (-5.5500, 105.3200), "label": "Kota Bandar Lampung (Teluk Lampung)"},
    "lampung_selatan": {"lat": -5.7200, "lon": 105.5900, "marine": (-5.8000, 105.6200), "label": "Lampung Selatan (Kalianda, Selat Sunda)"},
    "pesawaran": {"lat": -5.5700, "lon": 105.0700, "marine": (-5.6500, 105.1200), "label": "Pesawaran (Teluk Lampung)"},
    "tanggamus": {"lat": -5.6200, "lon": 104.6200, "marine": (-5.7500, 104.6800), "label": "Tanggamus (Kota Agung, Teluk Semaka)"},
    "pesisir_barat": {"lat": -5.1900, "lon": 103.9300, "marine": (-5.2500, 103.8500), "label": "Pesisir Barat (Krui, Samudra Hindia)"},
    "lampung_timur": {"lat": -5.1100, "lon": 105.8500, "marine": (-5.1200, 105.9500), "label": "Lampung Timur (Labuhan Maringgai, Laut Jawa)"},
    "tulang_bawang": {"lat": -4.4800, "lon": 105.8000, "marine": (-4.4500, 105.9500), "label": "Tulang Bawang (Kuala Teladas, Laut Jawa)"},
    "mesuji": {"lat": -4.0500, "lon": 105.7500, "marine": (-4.0500, 105.9000), "label": "Mesuji (pesisir timur, Laut Jawa)"},
}

# Kode ADM4 BMKG (Kemendagri). PERLU DIKONFIRMASI via
#   GET https://api.bmkg.go.id/publik/prakiraan-cuaca?adm3=<kode-kecamatan>
# Kosongkan/None untuk memakai Open-Meteo saja.
BMKG_ADM4_CODES: dict[str, str | None] = {
    "bandar_lampung": "18.71",
    "lampung_selatan": "18.01",
    "pesawaran": "18.09",
    "tanggamus": "18.06",
    "pesisir_barat": "18.13",
    "lampung_timur": "18.07",
    "tulang_bawang": "18.05",
    "mesuji": "18.11",
}

BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_DIR = BASE_DIR / "data" / "raw"

# Catatan: hostname yang benar adalah archive-api.open-meteo.com
# (dokumen perencanaan menulis archive.open-meteo.com -- domain itu tidak ada).
ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
MARINE_URL = "https://marine-api.open-meteo.com/v1/marine"
FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
BMKG_URL = "https://api.bmkg.go.id/publik/prakiraan-cuaca"


def _make_session(cache_name: str = "openmeteo_cache") -> requests.Session:
    """Session dengan cache permanen (data historis tidak berubah)."""
    if _HAS_CACHE:
        return requests_cache.CachedSession(
            str(BASE_DIR / ".cache" / cache_name), expire_after=-1,
            allowed_methods=["GET"],
        )
    return requests.Session()


def _get_json(session: requests.Session, url: str, params: dict, retries: int = 4) -> dict:
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            resp = session.get(url, params=params, timeout=60)
            resp.raise_for_status()
            return resp.json()
        except Exception as error:  # noqa: BLE001 - retry semua error jaringan
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise ConnectionError(f"Gagal mengambil {url} setelah {retries} percobaan: {last_error}")


# ─── Data historis (training) ────────────────────────────────────────────────

def fetch_historical_weather(lat: float, lon: float, start_date: str = "2015-01-01",
                             end_date: str = "2025-12-31") -> pd.DataFrame:
    """Cuaca harian historis dari Open-Meteo Archive API (reanalisis ERA5)."""
    session = _make_session()
    data = _get_json(session, ARCHIVE_URL, {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "precipitation_sum,wind_speed_10m_max,wind_direction_10m_dominant,surface_pressure_mean",
        "wind_speed_unit": "ms",
        "timezone": "Asia/Jakarta",
    })
    daily = data["daily"]
    return pd.DataFrame({
        "date": daily["time"],
        "rainfall_mm": daily["precipitation_sum"],
        "wind_speed_ms": daily["wind_speed_10m_max"],
        "wind_direction_deg": daily["wind_direction_10m_dominant"],
        "pressure_hpa": daily["surface_pressure_mean"],
    })


def fetch_historical_marine(lat: float, lon: float, start_date: str = "2015-01-01",
                            end_date: str = "2025-12-31") -> pd.DataFrame:
    """Gelombang laut harian historis dari Open-Meteo Marine API."""
    session = _make_session("marine_cache")
    data = _get_json(session, MARINE_URL, {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "daily": "wave_height_max,swell_wave_height_max",
        "timezone": "Asia/Jakarta",
    })
    daily = data["daily"]
    return pd.DataFrame({
        "date": daily["time"],
        "wave_height_max_m": daily["wave_height_max"],
        "swell_wave_height_max_m": daily["swell_wave_height_max"],
    })


def fetch_all_historical(start_date: str = "2015-01-01", end_date: str = "2025-12-31") -> tuple[pd.DataFrame, pd.DataFrame]:
    """Unduh data historis semua stasiun dan simpan CSV di data/raw/."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"[INFO] Mengambil data historis {start_date} s/d {end_date} untuk {len(STATIONS)} stasiun pesisir...")

    all_weather, all_marine, failures = [], [], []
    for key, station in STATIONS.items():
        try:
            print(f"  -> Cuaca    : {station['label']}")
            df_w = fetch_historical_weather(station["lat"], station["lon"], start_date, end_date)
            df_w["station"] = key
            all_weather.append(df_w)
        except ConnectionError as error:
            failures.append(f"cuaca/{key}: {error}")
        try:
            print(f"  -> Gelombang: {station['label']}")
            m_lat, m_lon = station["marine"]
            df_m = fetch_historical_marine(m_lat, m_lon, start_date, end_date)
            df_m["station"] = key
            all_marine.append(df_m)
        except ConnectionError as error:
            failures.append(f"marine/{key}: {error}")

    if failures:
        print("[WARNING] Sebagian stasiun gagal diunduh:")
        for failure in failures:
            print(f"  - {failure}")

    weather = pd.concat(all_weather, ignore_index=True) if all_weather else pd.DataFrame()
    marine = pd.concat(all_marine, ignore_index=True) if all_marine else pd.DataFrame()

    if not weather.empty:
        out = OUTPUT_DIR / "weather_historical.csv"
        weather.to_csv(out, index=False)
        print(f"[OK] Cuaca historis   : {out} ({len(weather)} baris)")
    if not marine.empty:
        out = OUTPUT_DIR / "marine_historical.csv"
        marine.to_csv(out, index=False)
        print(f"[OK] Gelombang historis: {out} ({len(marine)} baris)")

    if weather.empty:
        raise ConnectionError(
            "Tidak ada data cuaca historis yang berhasil diunduh. "
            "Cek koneksi ke archive.open-meteo.com lalu ulangi, "
            "atau jalankan training dengan --simulate untuk data sintetis."
        )
    return weather, marine


def load_cached_historical() -> tuple[pd.DataFrame | None, pd.DataFrame | None]:
    """Baca CSV historis dari data/raw/ tanpa akses jaringan."""
    weather_path = OUTPUT_DIR / "weather_historical.csv"
    marine_path = OUTPUT_DIR / "marine_historical.csv"
    weather = pd.read_csv(weather_path) if weather_path.exists() else None
    marine = pd.read_csv(marine_path) if marine_path.exists() else None
    return weather, marine


# ─── Prakiraan (inferensi harian) ────────────────────────────────────────────

def fetch_openmeteo_forecast(lat: float, lon: float, days: int = 7) -> pd.DataFrame:
    """Prakiraan cuaca harian Open-Meteo. Satuan konsisten dg data training."""
    session = requests.Session()  # prakiraan tidak boleh di-cache permanen
    data = _get_json(session, FORECAST_URL, {
        "latitude": lat,
        "longitude": lon,
        "forecast_days": days,
        "daily": "precipitation_sum,wind_speed_10m_max,surface_pressure_mean",
        "wind_speed_unit": "ms",
        "timezone": "Asia/Jakarta",
    })
    daily = data["daily"]
    return pd.DataFrame({
        "date": daily["time"],
        "rainfall_mm": daily["precipitation_sum"],
        "wind_speed_ms": daily["wind_speed_10m_max"],
        "pressure_hpa": daily["surface_pressure_mean"],
    })


def fetch_marine_forecast(lat: float, lon: float, days: int = 7) -> pd.DataFrame:
    """Prakiraan gelombang laut 7 hari dari Open-Meteo Marine API."""
    session = requests.Session()
    data = _get_json(session, MARINE_URL, {
        "latitude": lat,
        "longitude": lon,
        "forecast_days": days,
        "daily": "wave_height_max,swell_wave_height_max",
        "timezone": "Asia/Jakarta",
    })
    daily = data["daily"]
    return pd.DataFrame({
        "date": daily["time"],
        "wave_height_max_m": daily["wave_height_max"],
        "swell_wave_height_max_m": daily["swell_wave_height_max"],
    })


def fetch_bmkg_forecast(adm4_code: str) -> pd.DataFrame:
    """
    Prakiraan cuaca 3-jam-an BMKG, diagregasi harian.

    PERHATIAN SATUAN: field `ws` BMKG tidak konsisten terdokumentasi
    (knot vs km/jam). Default pipeline memakai Open-Meteo (m/s eksplisit,
    konsisten dengan data training); BMKG dipakai bila WEATHER_SOURCE=bmkg
    dan konversinya mengikuti asumsi knot -> m/s (x0.514) sesuai dokumen
    perencanaan. Validasi silang dengan Open-Meteo sebelum produksi.
    """
    try:
        resp = requests.get(BMKG_URL, params={"adm4": adm4_code}, timeout=15)
        resp.raise_for_status()
        raw = resp.json()
    except Exception as error:  # noqa: BLE001
        print(f"[WARNING] BMKG gagal untuk {adm4_code}: {error}")
        return pd.DataFrame()

    records = []
    for day_block in (raw.get("data") or [{}])[0].get("cuaca", []):
        for slot in day_block:
            records.append({
                "local_datetime": slot.get("local_datetime") or slot.get("datetime"),
                "rainfall_mm": slot.get("tp", 0) or 0,
                "wind_speed_raw": slot.get("ws", 0) or 0,
                "humidity_pct": slot.get("hu", 0) or 0,
            })

    df = pd.DataFrame(records)
    if df.empty:
        return df

    df["local_datetime"] = pd.to_datetime(df["local_datetime"])
    df["wind_speed_ms"] = df["wind_speed_raw"] * 0.514  # asumsi knot -> m/s
    df["date"] = df["local_datetime"].dt.strftime("%Y-%m-%d")
    daily = df.groupby("date").agg(
        rainfall_mm=("rainfall_mm", "sum"),
        wind_speed_ms=("wind_speed_ms", "mean"),
    ).reset_index()
    daily["pressure_hpa"] = 1010.0  # BMKG publik tidak menyediakan tekanan
    return daily


def fetch_daily_forecast_for_inference(days: int = 7, weather_source: str = "openmeteo") -> dict[str, dict[str, pd.DataFrame]]:
    """
    Prakiraan cuaca + gelombang per stasiun untuk inferensi harian.
    Return: {station_key: {"weather": DataFrame, "marine": DataFrame}}
    """
    result: dict[str, dict[str, pd.DataFrame]] = {}
    for key, station in STATIONS.items():
        print(f"[INFO]   prakiraan stasiun {key}...", flush=True)
        weather = pd.DataFrame()

        if weather_source == "bmkg":
            adm4 = BMKG_ADM4_CODES.get(key)
            if adm4:
                weather = fetch_bmkg_forecast(adm4)
        if weather.empty:
            try:
                weather = fetch_openmeteo_forecast(station["lat"], station["lon"], days)
            except ConnectionError as error:
                print(f"[WARNING] Prakiraan cuaca gagal untuk {key}: {error}")

        try:
            m_lat, m_lon = station["marine"]
            marine = fetch_marine_forecast(m_lat, m_lon, days)
        except ConnectionError as error:
            print(f"[WARNING] Prakiraan gelombang gagal untuk {key}: {error}")
            marine = pd.DataFrame()

        result[key] = {"weather": weather, "marine": marine}
    return result


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Siperah-ROB Data Fetcher")
    parser.add_argument("--mode", choices=["historical", "forecast"], required=True)
    parser.add_argument("--start", default="2015-01-01")
    parser.add_argument("--end", default="2025-12-31")
    args = parser.parse_args()

    if args.mode == "historical":
        fetch_all_historical(args.start, args.end)
    else:
        forecasts = fetch_daily_forecast_for_inference()
        for station_key, frames in forecasts.items():
            print(f"\n=== {station_key} ===")
            print(frames["weather"].to_string(index=False))
