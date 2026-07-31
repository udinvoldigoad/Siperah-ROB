"""Uji feature_engineering: proxy fase bulan & pemetaan fitur harian.

Fitur yang dibangun di sini dipakai BOTH saat training dan inferensi
(build_daily_features vs predict_forecast.generate_forecast) — selisih kecil
di keduanya akan menurunkan kualitas prediksi secara diam-diam, jadi mapping
kolom dan satuan perlu dikunci lewat tes.
"""

import pandas as pd
import pytest

from files.feature_engineering import build_daily_features, is_full_moon_period

REF_FULL_MOON = pd.Timestamp("2024-01-25")


def test_is_full_moon_period_window():
    # Siklus 29.53 hari; jendela aktif = hari 0-2 dan 28-29 siklus (modulo).
    for days in [0, 1, 2, 28, 29, 30, 31]:
        date = REF_FULL_MOON + pd.Timedelta(days=days)
        assert bool(is_full_moon_period(pd.Series([date])).iloc[0]), f"{date} harus True"
    # Kuarter siklus harus False (termasuk hari 27, sebelum jendela hari-28).
    for days in [5, 7, 20, 22, 27]:
        date = REF_FULL_MOON + pd.Timedelta(days=days)
        assert not bool(is_full_moon_period(pd.Series([date])).iloc[0]), f"{date} harus False"


def _tide_and_weather():
    tide = pd.DataFrame({
        "date": pd.to_datetime(["2024-01-01", "2024-01-01", "2024-01-02"]),
        "tide_height_cm": [100.0, 120.0, 90.0],
    })
    weather = pd.DataFrame({
        "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
        "rainfall_mm": [5.0, 15.0],
        "wind_speed_ms": [2.0, 4.0],
        "wind_direction_deg": [180.0, 90.0],
    })
    return tide, weather


def test_build_daily_features_maps_columns_and_units():
    tide, weather = _tide_and_weather()
    marine = pd.DataFrame({
        "date": pd.to_datetime(["2024-01-01", "2024-01-02"]),
        "wave_height_max_m": [0.8, 1.2],
    })

    out = build_daily_features(tide, weather, marine)
    assert len(out) == 2
    assert list(out.columns[:5]) == ["date", "max_tide_height_cm", "rainfall_mm", "wind_speed_ms", "wind_direction_deg"]

    row = out[out["date"] == pd.Timestamp("2024-01-01")].iloc[0]
    # Pasang harian = nilai tertinggi dalam hari itu.
    assert row["max_tide_height_cm"] == 120.0
    # Prediksi Tinggi Muka Laut dalam meter (cm -> m).
    assert row["Prediksi Tinggi Muka Laut"] == pytest.approx(1.2)
    # Kecepatan Angin m/s -> km/h (x3.6).
    assert row["Kecepatan Angin"] == pytest.approx(7.2)
    # Gangguan Cuaca biner: hujan > 10mm.
    assert row["Gangguan Cuaca"] == 0
    assert row["Gelombang"] == pytest.approx(0.8)
    # Angin 180° dari laut ke darat (135..225).
    assert row["Angin Onshore"] == 1
    # 2024-01-01 = 24 hari sebelum purnama rujukan -> di luar jendela.
    assert row["Peristiwa Astronomi"] == 0

    second = out[out["date"] == pd.Timestamp("2024-01-02")].iloc[0]
    assert second["Gangguan Cuaca"] == 1
    assert second["Angin Onshore"] == 0


def test_build_daily_features_defaults_without_marine_or_direction():
    tide, weather = _tide_and_weather()
    weather = weather.drop(columns=["wind_direction_deg"])

    out = build_daily_features(tide, weather)
    assert len(out) == 2
    assert out["Gelombang"].tolist() == [0.0, 0.0]
    assert out["Arah Angin"].tolist() == [0.0, 0.0]
    assert out["Angin Onshore"].tolist() == [0, 0]
