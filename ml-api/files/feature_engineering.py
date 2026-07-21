"""
feature_engineering.py
Mengubah data mentah menjadi tabel fitur harian siap pakai untuk model Random Forest.
Di-update untuk menyesuaikan fitur dengan dataset nyata dari Excel.
"""

from __future__ import annotations
import pandas as pd
import numpy as np

# Daftar fitur yang sesuai dengan dataset Excel (digunakan saat inferensi)
FEATURE_COLS = [
    "Prediksi Tinggi Muka Laut",
    "Kecepatan Angin",
    "Gangguan Cuaca",
    "Gelombang",
    "Peristiwa Astronomi"
]

def is_full_moon_period(dates: pd.Series) -> pd.Series:
    """Proxy fase bulan purnama/bulan baru (pasang purnama/perbani)."""
    ref_full_moon = pd.Timestamp("2024-01-25")
    days_since = (pd.to_datetime(dates) - ref_full_moon).dt.days % 29.53
    return (
        (days_since <= 2) | (days_since >= 27.53)
        | ((days_since >= 12.77) & (days_since <= 16.77))
    )

def build_daily_features(tide_df: pd.DataFrame, weather_df: pd.DataFrame,
                         marine_df: pd.DataFrame | None = None) -> pd.DataFrame:
    """
    Mapping data ramalan (OpenMeteo/Harmonik) ke format fitur Excel untuk inferensi.
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
    df["wave_height_max_m"] = df["wave_height_max_m"].fillna(0.0)
    df["rainfall_mm"] = df["rainfall_mm"].fillna(0.0)
    df = df.sort_values("date").reset_index(drop=True)
    df["date"] = pd.to_datetime(df["date"])

    # 3. MAPPING KE KOLOM EXCEL
    # Prediksi Tinggi Muka Laut (meter)
    df["Prediksi Tinggi Muka Laut"] = df["max_tide_height_cm"] / 100.0
    
    # Kecepatan Angin (m/s diubah ke km/h atau asumsi sejenis)
    df["Kecepatan Angin"] = df["wind_speed_ms"] * 3.6
    
    # Gangguan Cuaca (Biner: Hujan deras > 10mm)
    df["Gangguan Cuaca"] = (df["rainfall_mm"] > 10.0).astype(int)
    
    # Gelombang (meter)
    df["Gelombang"] = df["wave_height_max_m"]
    
    # Peristiwa Astronomi (Biner: Bulan Purnama/Baru)
    df["Peristiwa Astronomi"] = is_full_moon_period(df["date"]).astype(int)

    return df
