"""Uji parsing respons Open-Meteo di data_fetcher.

Memastikan kolom & satuan yang dihasilkan data_fetcher persis seperti yang
diharapkan pemanggil (feature_engineering/predict_forecast). Tidak ada akses
jaringan — respons API di-stub.
"""

import pandas as pd
import pytest

from files import data_fetcher


def test_fetch_openmeteo_forecast_parses_daily(monkeypatch):
    canned = {"daily": {
        "time": ["2026-07-01", "2026-07-02"],
        "precipitation_sum": [0.0, 5.5],
        "wind_speed_10m_max": [3.2, 4.1],
        "wind_direction_10m_dominant": [180, 90],
        "surface_pressure_mean": [1011.2, 1010.0],
    }}
    monkeypatch.setattr(data_fetcher, "_get_json", lambda *a, **k: canned)

    out = data_fetcher.fetch_openmeteo_forecast(-5.45, 105.26, days=2)
    assert list(out.columns) == ["date", "rainfall_mm", "wind_speed_ms", "wind_direction_deg", "pressure_hpa"]
    assert len(out) == 2
    assert out.iloc[0]["rainfall_mm"] == pytest.approx(0.0)
    assert out.iloc[1]["rainfall_mm"] == pytest.approx(5.5)
    assert out.iloc[0]["wind_speed_ms"] == pytest.approx(3.2)


def test_fetch_historical_marine_parses_daily(monkeypatch):
    canned = {"daily": {
        "time": ["2026-07-01", "2026-07-02"],
        "wave_height_max": [0.9, 1.4],
        "swell_wave_height_max": [0.5, 0.8],
    }}
    monkeypatch.setattr(data_fetcher, "_get_json", lambda *a, **k: canned)

    out = data_fetcher.fetch_historical_marine(-5.55, 105.32, "2026-07-01", "2026-07-02")
    assert list(out.columns) == ["date", "wave_height_max_m", "swell_wave_height_max_m"]
    assert out.iloc[1]["wave_height_max_m"] == pytest.approx(1.4)


def test_fetch_historical_weather_sets_wind_unit(monkeypatch):
    canned = {"daily": {
        "time": ["2026-07-01"],
        "precipitation_sum": [3.0],
        "wind_speed_10m_max": [2.5],
        "wind_direction_10m_dominant": [200],
        "surface_pressure_mean": [1009.5],
    }}
    monkeypatch.setattr(data_fetcher, "_get_json", lambda *a, **k: canned)

    out = data_fetcher.fetch_historical_weather(-5.45, 105.26, "2026-07-01", "2026-07-01")
    assert out.iloc[0]["wind_speed_ms"] == pytest.approx(2.5)
    assert out.iloc[0]["pressure_hpa"] == pytest.approx(1009.5)
