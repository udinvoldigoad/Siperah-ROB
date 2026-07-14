"""
feature_engineering.py
Mengubah data mentah (tide, rainfall, dll) menjadi tabel fitur harian
siap pakai untuk training model Random Forest.
"""

import pandas as pd
import numpy as np


def build_daily_features(tide_df: pd.DataFrame, weather_df: pd.DataFrame) -> pd.DataFrame:
    """
    tide_df   : kolom ['date', 'tide_height_cm']  (bisa banyak observasi per hari -> diagregasi max)
    weather_df: kolom ['date', 'rainfall_mm', 'wind_speed_ms', 'pressure_hpa']
    """
    # 1. Agregasi tide harian -> ambil nilai pasang tertinggi per hari
    tide_daily = (
        tide_df.groupby("date")["tide_height_cm"]
        .max()
        .reset_index()
        .rename(columns={"tide_height_cm": "max_tide_height_cm"})
    )

    # 2. Gabungkan dengan data cuaca
    df = pd.merge(tide_daily, weather_df, on="date", how="inner")
    df = df.sort_values("date").reset_index(drop=True)

    # 3. Rolling average curah hujan (efek kumulatif hujan sebelumnya)
    df["rainfall_3d_avg"] = df["rainfall_mm"].rolling(window=3, min_periods=1).mean()
    df["rainfall_7d_avg"] = df["rainfall_mm"].rolling(window=7, min_periods=1).mean()

    # 4. Fitur waktu
    df["date"] = pd.to_datetime(df["date"])
    df["month"] = df["date"].dt.month

    # 5. Proxy fase bulan (purnama/perbani -> pasang cenderung lebih tinggi)
    # Pendekatan sederhana: gunakan siklus 29.53 hari sejak referensi bulan purnama
    ref_full_moon = pd.Timestamp("2024-01-25")  # sesuaikan dengan tanggal purnama referensi aktual
    days_since = (df["date"] - ref_full_moon).dt.days % 29.53
    # Anggap "periode purnama/perbani" jika dekat hari ke-0 atau ke-14.77 (dalam rentang +-2 hari)
    df["is_full_moon_period"] = (
        (days_since <= 2) | (days_since >= 27.53) |
        ((days_since >= 12.77) & (days_since <= 16.77))
    )

    # 6. Fitur interaksi: pasang tinggi * curah hujan tinggi (kombinasi penyebab utama rob)
    df["tide_x_rainfall"] = df["max_tide_height_cm"] * df["rainfall_mm"]

    return df


def create_proxy_label(df: pd.DataFrame, tide_threshold_cm: float = 180, rainfall_threshold_mm: float = 20) -> pd.DataFrame:
    """
    Jika data historis kejadian rob resmi (dari BPBD) terbatas, gunakan proxy labeling.
    SESUAIKAN threshold ini dengan konsultasi BMKG/BPBD setempat -- ini hanya contoh awal.
    """
    df["label_rob"] = (
        (df["max_tide_height_cm"] >= tide_threshold_cm) &
        (df["rainfall_mm"] >= rainfall_threshold_mm)
    ).astype(int)
    return df


if __name__ == "__main__":
    # Contoh dummy run
    dates = pd.date_range("2024-01-01", periods=60, freq="D")
    tide_dummy = pd.DataFrame({
        "date": np.repeat(dates, 4),
        "tide_height_cm": np.random.uniform(100, 220, size=60 * 4)
    })
    weather_dummy = pd.DataFrame({
        "date": dates,
        "rainfall_mm": np.random.uniform(0, 40, size=60),
        "wind_speed_ms": np.random.uniform(1, 8, size=60),
        "pressure_hpa": np.random.uniform(1005, 1015, size=60)
    })

    features = build_daily_features(tide_dummy, weather_dummy)
    features = create_proxy_label(features)
    print(features.head(10))
    print(f"\nJumlah hari label Rob=1: {features['label_rob'].sum()} dari {len(features)} hari")
