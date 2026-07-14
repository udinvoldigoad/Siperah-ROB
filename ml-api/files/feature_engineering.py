"""
feature_engineering.py
Mengubah data mentah (pasang surut, cuaca, gelombang) menjadi tabel fitur
harian siap pakai untuk training/inferensi model Random Forest.

FEATURE_COLS di file ini adalah SATU-SATUNYA sumber kebenaran daftar fitur --
train_model.py dan predict_forecast.py mengimpor dari sini agar training dan
inferensi tidak pernah berbeda skema.
"""

from __future__ import annotations

import pandas as pd
import numpy as np

# Daftar fitur final (Fase 2.1 roadmap). Urutan dijaga konsisten.
FEATURE_COLS = [
    # pasang surut
    "max_tide_height_cm", "tide_anomaly_cm", "is_king_tide",
    # cuaca
    "rainfall_mm", "rainfall_3d_avg", "rainfall_7d_avg", "rainfall_14d_avg",
    "consecutive_rain_days", "wind_speed_ms", "pressure_hpa",
    # laut
    "wave_height_max_m", "swell_wave_height_max_m",
    # interaksi
    "tide_x_rainfall", "tide_x_wave", "rain_x_wind",
    # waktu
    "month", "is_wet_season", "is_full_moon_period",
]

RAIN_WET_DAY_MM = 1.0  # hari dianggap "hujan" untuk hitungan hari berturut-turut


def is_full_moon_period(dates: pd.Series) -> pd.Series:
    """
    Proxy fase bulan purnama/bulan baru (pasang purnama/perbani).
    Siklus sinodik 29.53 hari dari referensi purnama 2024-01-25.
    Dipakai identik oleh training dan inferensi.
    """
    ref_full_moon = pd.Timestamp("2024-01-25")
    days_since = (pd.to_datetime(dates) - ref_full_moon).dt.days % 29.53
    return (
        (days_since <= 2) | (days_since >= 27.53)
        | ((days_since >= 12.77) & (days_since <= 16.77))
    )


def _consecutive_rain_days(rainfall: pd.Series) -> pd.Series:
    """Jumlah hari hujan (>= RAIN_WET_DAY_MM) berturut-turut sampai hari itu."""
    wet = (rainfall >= RAIN_WET_DAY_MM).astype(int)
    streaks = wet.groupby((wet != wet.shift()).cumsum()).cumsum()
    return streaks * wet


def build_daily_features(tide_df: pd.DataFrame, weather_df: pd.DataFrame,
                         marine_df: pd.DataFrame | None = None) -> pd.DataFrame:
    """
    tide_df   : ['date', 'tide_height_cm'] (bisa >1 observasi/hari -> agregasi max)
    weather_df: ['date', 'rainfall_mm', 'wind_speed_ms', 'pressure_hpa']
    marine_df : ['date', 'wave_height_max_m', 'swell_wave_height_max_m'] (opsional)
    """
    # 1. Agregasi pasang harian -> nilai tertinggi per hari
    tide_daily = (
        tide_df.groupby("date")["tide_height_cm"]
        .max()
        .reset_index()
        .rename(columns={"tide_height_cm": "max_tide_height_cm"})
    )

    # 2. Gabung dengan cuaca (dan gelombang bila ada)
    df = pd.merge(tide_daily, weather_df, on="date", how="inner")
    if marine_df is not None and not marine_df.empty:
        df = pd.merge(df, marine_df, on="date", how="left")
    if "wave_height_max_m" not in df.columns:
        df["wave_height_max_m"] = 0.0
    if "swell_wave_height_max_m" not in df.columns:
        df["swell_wave_height_max_m"] = 0.0
    df[["wave_height_max_m", "swell_wave_height_max_m"]] = (
        df[["wave_height_max_m", "swell_wave_height_max_m"]].fillna(0.0)
    )
    df["rainfall_mm"] = df["rainfall_mm"].fillna(0.0)
    df = df.sort_values("date").reset_index(drop=True)

    # 3. Rolling curah hujan (efek kumulatif)
    df["rainfall_3d_avg"] = df["rainfall_mm"].rolling(window=3, min_periods=1).mean()
    df["rainfall_7d_avg"] = df["rainfall_mm"].rolling(window=7, min_periods=1).mean()
    df["rainfall_14d_avg"] = df["rainfall_mm"].rolling(window=14, min_periods=1).mean()
    df["consecutive_rain_days"] = _consecutive_rain_days(df["rainfall_mm"])

    # 4. Fitur waktu
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.month
    df["is_wet_season"] = df["month"].isin([11, 12, 1, 2, 3]).astype(int)
    df["is_full_moon_period"] = is_full_moon_period(df["date"]).astype(int)

    # 5. Anomali & king tide (relatif terhadap pola bulanannya sendiri)
    monthly_avg = df.groupby("month")["max_tide_height_cm"].transform("mean")
    df["tide_anomaly_cm"] = df["max_tide_height_cm"] - monthly_avg
    king_tide_threshold = df["max_tide_height_cm"].quantile(0.95)
    df["is_king_tide"] = (df["max_tide_height_cm"] >= king_tide_threshold).astype(int)

    # 6. Fitur interaksi (kombinasi penyebab utama rob)
    df["tide_x_rainfall"] = df["max_tide_height_cm"] * df["rainfall_mm"]
    df["tide_x_wave"] = df["max_tide_height_cm"] * df["wave_height_max_m"]
    df["rain_x_wind"] = df["rainfall_mm"] * df["wind_speed_ms"]

    return df


def create_proxy_label(df: pd.DataFrame, tide_threshold_cm: float = 185,
                       rainfall_threshold_mm: float = 25) -> pd.DataFrame:
    """Kompatibilitas mundur -- delegasi ke labeler.apply_proxy_labels."""
    from . import labeler
    return labeler.apply_proxy_labels(df, tide_threshold_cm, rainfall_threshold_mm)


if __name__ == "__main__":
    dates = pd.date_range("2024-01-01", periods=60, freq="D")
    tide_dummy = pd.DataFrame({
        "date": np.repeat(dates, 4),
        "tide_height_cm": np.random.uniform(100, 220, size=60 * 4),
    })
    weather_dummy = pd.DataFrame({
        "date": dates,
        "rainfall_mm": np.random.uniform(0, 40, size=60),
        "wind_speed_ms": np.random.uniform(1, 8, size=60),
        "pressure_hpa": np.random.uniform(1005, 1015, size=60),
    })
    marine_dummy = pd.DataFrame({
        "date": dates,
        "wave_height_max_m": np.random.uniform(0.2, 2.0, size=60),
        "swell_wave_height_max_m": np.random.uniform(0.1, 1.2, size=60),
    })

    features = build_daily_features(tide_dummy, weather_dummy, marine_dummy)
    print(features[FEATURE_COLS].head(8).to_string())
    missing = [col for col in FEATURE_COLS if col not in features.columns]
    print(f"\nKolom fitur hilang: {missing or 'tidak ada -- lengkap'}")
