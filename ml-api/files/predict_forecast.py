"""
predict_forecast.py
Menghasilkan prediksi/outlook rob untuk 30 hari ke depan dengan pendekatan 2 tingkat:

  H+1 s/d H+7  -> "short_term": prediksi harian presisi
                   (tide forecast + prakiraan cuaca & gelombang aktual)
  H+8 s/d H+30 -> "long_term_outlook": tingkat risiko kasar
                   (tide forecast + rata-rata klimatologi bulanan)

Alasan: pasang surut deterministik secara astronomis (bisa diproyeksikan jauh),
sedangkan cuaca/gelombang hanya andal ~7-10 hari ke depan.
"""

from __future__ import annotations

import pandas as pd
import numpy as np

from .feature_engineering import FEATURE_COLS, is_full_moon_period

# Ambang kelas risiko dari probabilitas model (selaras enum backend:
# sangat_tinggi / tinggi / sedang / rendah).
RISK_THRESHOLDS = [
    (0.75, "sangat_tinggi"),
    (0.55, "tinggi"),
    (0.30, "sedang"),
    (0.00, "rendah"),
]


def risk_class_from_probability(prob: float) -> str:
    for threshold, label in RISK_THRESHOLDS:
        if prob >= threshold:
            return label
    return "rendah"


def generate_forecast(
    model,
    tide_forecast_df: pd.DataFrame,    # ['date', 'max_tide_height_cm'] -- 30 hari
    weather_forecast_df: pd.DataFrame,  # ['date', 'rainfall_mm', 'wind_speed_ms', 'pressure_hpa'] -- H+1..H+7
    climatology_df: pd.DataFrame,       # ['month', 'avg_rainfall_mm', 'avg_wind_speed_ms']
    recent_rainfall_avg_7d: float,      # rata-rata hujan 7 hari terakhir (kontinuitas rolling)
    marine_forecast_df: pd.DataFrame | None = None,   # ['date', 'wave_height_max_m', 'swell_wave_height_max_m'] -- H+1..H+7
    wave_climatology_df: pd.DataFrame | None = None,  # ['month', 'avg_wave_height_m', 'avg_swell_height_m']
    tide_stats: dict | None = None,     # {'monthly_avg': {bulan: cm}, 'p95': cm} dari data training
) -> pd.DataFrame:

    tide_forecast_df = tide_forecast_df.copy()
    tide_forecast_df["date"] = pd.to_datetime(tide_forecast_df["date"])
    if marine_forecast_df is not None and not marine_forecast_df.empty:
        marine_forecast_df = marine_forecast_df.copy()
        marine_forecast_df["date"] = pd.to_datetime(marine_forecast_df["date"])
    weather_forecast_df = weather_forecast_df.copy()
    if not weather_forecast_df.empty:
        weather_forecast_df["date"] = pd.to_datetime(weather_forecast_df["date"])

    today = pd.Timestamp.today().normalize()
    horizon_dates = pd.date_range(today, periods=31, freq="D")  # H+0 s/d H+30

    monthly_tide_avg = (tide_stats or {}).get("monthly_avg", {})
    tide_p95 = (tide_stats or {}).get("p95")
    if tide_p95 is None:
        tide_p95 = float(tide_forecast_df["max_tide_height_cm"].quantile(0.95))

    results = []
    rolling_rain: list[float] = []
    for i, date in enumerate(horizon_dates):
        tide_row = tide_forecast_df[tide_forecast_df["date"] == date]
        if tide_row.empty:
            continue
        max_tide = float(tide_row["max_tide_height_cm"].values[0])
        month = int(date.month)

        wave = swell = 0.0
        if i <= 7:
            # --- SHORT TERM: prakiraan cuaca & gelombang aktual ---
            horizon_type = "short_term"
            w_row = weather_forecast_df[weather_forecast_df["date"] == date] if not weather_forecast_df.empty else pd.DataFrame()
            if w_row.empty:
                continue
            rainfall = float(w_row["rainfall_mm"].values[0])
            wind = float(w_row["wind_speed_ms"].values[0])
            pressure = float(w_row["pressure_hpa"].values[0])
            if marine_forecast_df is not None and not marine_forecast_df.empty:
                m_row = marine_forecast_df[marine_forecast_df["date"] == date]
                if not m_row.empty:
                    wave = float(m_row["wave_height_max_m"].values[0] or 0)
                    swell = float(m_row["swell_wave_height_max_m"].values[0] or 0)
            rolling_rain.append(rainfall)
            window_3d = rolling_rain[-3:]
            rainfall_3d = float(np.mean(window_3d)) if window_3d else rainfall
            rainfall_7d = float(np.mean([recent_rainfall_avg_7d] + rolling_rain[-6:]))
        else:
            # --- LONG TERM OUTLOOK: klimatologi bulanan ---
            horizon_type = "long_term_outlook"
            clim_row = climatology_df[climatology_df["month"] == month]
            rainfall = float(clim_row["avg_rainfall_mm"].values[0]) if not clim_row.empty else 10.0
            wind = float(clim_row["avg_wind_speed_ms"].values[0]) if not clim_row.empty else 4.0
            pressure = 1010.0
            if wave_climatology_df is not None and not wave_climatology_df.empty:
                wave_row = wave_climatology_df[wave_climatology_df["month"] == month]
                if not wave_row.empty:
                    wave = float(wave_row["avg_wave_height_m"].values[0] or 0)
                    swell = float(wave_row["avg_swell_height_m"].values[0] or 0)
            rainfall_3d = rainfall
            rainfall_7d = rainfall

        month_avg_tide = float(monthly_tide_avg.get(month, tide_forecast_df["max_tide_height_cm"].mean()))
        features = {
            "Prediksi Tinggi Muka Laut": max_tide / 100.0,
            "Kecepatan Angin": wind * 3.6,
            "Gangguan Cuaca": int(rainfall > 10.0),
            "Gelombang": wave,
            "Peristiwa Astronomi": int(is_full_moon_period(pd.Series([date])).iloc[0]),
        }
        X = pd.DataFrame([features])[FEATURE_COLS]
        prob_rob = float(model.predict_proba(X)[0, 1])

        results.append({
            "date": date.date(),
            "horizon_type": horizon_type,
            "prob_rob": round(prob_rob, 4),
            "risk_class": risk_class_from_probability(prob_rob),
            # confidence jujur dari margin probabilitas model (bukan angka hash)
            "confidence": round(max(prob_rob, 1.0 - prob_rob) * 100, 2),
        })

    return pd.DataFrame(results)
