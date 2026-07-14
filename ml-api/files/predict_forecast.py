"""
predict_forecast.py
Menghasilkan prediksi/outlook rob untuk 30 hari ke depan dengan pendekatan 2 tingkat:

  H+1 s/d H+7  -> "short_term": prediksi harian presisi
                   (pakai tide forecast aktual + prakiraan cuaca BMKG H+7)
  H+8 s/d H+30 -> "long_term_outlook": tingkat risiko kasar
                   (pakai tide forecast aktual + rata-rata curah hujan klimatologi bulanan)

Alasan: data tide bisa diprediksi akurat jauh ke depan (deterministik secara astronomis),
tapi curah hujan hanya reliable untuk ~7-10 hari ke depan.
"""

import pandas as pd
import numpy as np
import joblib

FEATURE_COLS = [
    "max_tide_height_cm", "rainfall_mm", "rainfall_3d_avg", "rainfall_7d_avg",
    "wind_speed_ms", "pressure_hpa", "month", "is_full_moon_period", "tide_x_rainfall"
]


def generate_forecast(
    model,
    tide_forecast_df: pd.DataFrame,       # kolom: ['date', 'max_tide_height_cm'] -- 30 hari ke depan, dari Pushidrosal/BIG
    weather_forecast_df: pd.DataFrame,     # kolom: ['date', 'rainfall_mm', 'wind_speed_ms', 'pressure_hpa'] -- H+1 s/d H+7 dari BMKG
    climatology_df: pd.DataFrame,          # kolom: ['month', 'avg_rainfall_mm', 'avg_wind_speed_ms']
    recent_rainfall_avg_7d: float,         # rata-rata curah hujan 7 hari terakhir (data aktual) untuk kontinuitas rolling avg
) -> pd.DataFrame:

    today = pd.Timestamp.today().normalize()
    horizon_dates = pd.date_range(today + pd.Timedelta(days=1), periods=30, freq="D")

    results = []
    for i, date in enumerate(horizon_dates, start=1):
        tide_row = tide_forecast_df[tide_forecast_df["date"] == date]
        if tide_row.empty:
            continue
        max_tide = tide_row["max_tide_height_cm"].values[0]
        month = date.month

        if i <= 7:
            # --- SHORT TERM: pakai prakiraan cuaca aktual dari BMKG ---
            horizon_type = "short_term"
            w_row = weather_forecast_df[weather_forecast_df["date"] == date]
            if w_row.empty:
                continue
            rainfall = w_row["rainfall_mm"].values[0]
            wind = w_row["wind_speed_ms"].values[0]
            pressure = w_row["pressure_hpa"].values[0]
            rainfall_3d = rainfall  # simplifikasi, idealnya hitung dari data H-2..H+1
            rainfall_7d = recent_rainfall_avg_7d

        else:
            # --- LONG TERM OUTLOOK: pakai rata-rata klimatologi bulanan ---
            horizon_type = "long_term_outlook"
            clim_row = climatology_df[climatology_df["month"] == month]
            rainfall = clim_row["avg_rainfall_mm"].values[0] if not clim_row.empty else np.nan
            wind = clim_row["avg_wind_speed_ms"].values[0] if not clim_row.empty else np.nan
            pressure = 1010  # nilai default rata-rata regional, sesuaikan
            rainfall_3d = rainfall
            rainfall_7d = rainfall

        is_full_moon = False  # TODO: hitung dari fungsi fase bulan yang sama seperti feature_engineering.py
        tide_x_rainfall = max_tide * rainfall

        X = pd.DataFrame([{
            "max_tide_height_cm": max_tide,
            "rainfall_mm": rainfall,
            "rainfall_3d_avg": rainfall_3d,
            "rainfall_7d_avg": rainfall_7d,
            "wind_speed_ms": wind,
            "pressure_hpa": pressure,
            "month": month,
            "is_full_moon_period": is_full_moon,
            "tide_x_rainfall": tide_x_rainfall,
        }])[FEATURE_COLS]

        prob_rob = model.predict_proba(X)[0, 1]

        if horizon_type == "short_term":
            label = "Rob" if prob_rob >= 0.5 else "Tidak Rob"
        else:
            # untuk outlook jangka panjang, tampilkan sebagai tingkat risiko, bukan keputusan biner
            if prob_rob >= 0.6:
                label = "Risiko Tinggi"
            elif prob_rob >= 0.3:
                label = "Risiko Sedang"
            else:
                label = "Risiko Rendah"

        results.append({
            "date": date.date(),
            "horizon_type": horizon_type,
            "prob_rob": round(float(prob_rob), 4),
            "predicted_label": label,
        })

    return pd.DataFrame(results)


if __name__ == "__main__":
    # Contoh pemakaian dengan data dummy
    model = joblib.load("../models/rf_rob_model.joblib")

    today = pd.Timestamp.today().normalize()
    horizon_dates = pd.date_range(today + pd.Timedelta(days=1), periods=30, freq="D")

    tide_forecast_dummy = pd.DataFrame({
        "date": horizon_dates,
        "max_tide_height_cm": np.random.uniform(140, 210, size=30)
    })
    weather_forecast_dummy = pd.DataFrame({
        "date": horizon_dates[:7],
        "rainfall_mm": np.random.uniform(0, 35, size=7),
        "wind_speed_ms": np.random.uniform(1, 7, size=7),
        "pressure_hpa": np.random.uniform(1006, 1014, size=7),
    })
    climatology_dummy = pd.DataFrame({
        "month": range(1, 13),
        "avg_rainfall_mm": np.random.uniform(5, 25, size=12),
        "avg_wind_speed_ms": np.random.uniform(2, 5, size=12),
    })

    forecast = generate_forecast(
        model, tide_forecast_dummy, weather_forecast_dummy,
        climatology_dummy, recent_rainfall_avg_7d=12.5
    )
    print(forecast.to_string(index=False))
