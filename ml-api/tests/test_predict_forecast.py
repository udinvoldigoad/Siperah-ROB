"""Uji predict_forecast: ambang kelas risiko & generate_forecast.

generate_forecast adalah inti inferensi harian: prakiraan H+1..H+7 memakai
cuaca/gelombang aktual, H+8..H+30 memakai klimatologi bulanan. Ambang kelas
risiko harus SELARAS dengan enum backend (sangat_tinggi/tinggi/sedang/rendah).
"""

import numpy as np
import pandas as pd
import pytest

from files.predict_forecast import RISK_THRESHOLDS, generate_forecast, risk_class_from_probability


@pytest.mark.parametrize(("prob", "expected"), [
    (0.75, "sangat_tinggi"),
    (0.80, "sangat_tinggi"),
    (0.74, "tinggi"),
    (0.55, "tinggi"),
    (0.54, "sedang"),
    (0.30, "sedang"),
    (0.29, "rendah"),
    (0.0, "rendah"),
])
def test_risk_class_thresholds(prob, expected):
    assert risk_class_from_probability(prob) == expected


def test_risk_thresholds_cover_whole_range():
    # Tidak boleh ada celah probabilitas yang tidak terklasifikasi.
    assert RISK_THRESHOLDS[-1][0] == 0.00
    for (hi, _label), (lo, _next) in zip(RISK_THRESHOLDS, RISK_THRESHOLDS[1:]):
        assert lo < hi


class _FakeModel:
    """Model deterministik: prob_rob selalu 0.6 -> kelas tinggi, confidence 60."""

    def predict_proba(self, X):
        n = len(X)
        return np.column_stack([np.zeros(n), np.full(n, 0.6)])


def _inputs():
    today = pd.Timestamp.today().normalize()
    horizon = pd.date_range(today, periods=31, freq="D")
    tide = pd.DataFrame({
        "date": horizon,
        "max_tide_height_cm": [100.0 + (i % 5) * 10 for i in range(31)],
    })
    weather = pd.DataFrame({
        "date": horizon[:8],
        "rainfall_mm": [5.0] * 8,
        "wind_speed_ms": [3.0] * 8,
        "pressure_hpa": [1010.0] * 8,
    })
    clim = pd.DataFrame({
        "month": list(range(1, 13)),
        "avg_rainfall_mm": [12.0] * 12,
        "avg_wind_speed_ms": [4.0] * 12,
    })
    return tide, weather, clim


def test_generate_forecast_splits_short_and_long_horizon():
    tide, weather, clim = _inputs()
    out = generate_forecast(_FakeModel(), tide, weather, clim, recent_rainfall_avg_7d=5.0)

    assert len(out) == 31
    short = out[out["horizon_type"] == "short_term"]
    long_ = out[out["horizon_type"] == "long_term_outlook"]
    assert len(short) == 8
    assert len(long_) == 23

    # Probalitas model deterministik -> semua prediksi identik.
    assert (out["prob_rob"] == 0.6).all()
    assert (out["confidence"] == 60.0).all()
    assert (out["risk_class"] == "tinggi").all()


def test_generate_forecast_long_term_uses_climatology_fallback():
    tide, weather, clim = _inputs()
    # Klimatologi kosong -> fallback konstan (hujan 10mm, angin 4 m/s).
    empty_clim = pd.DataFrame(columns=["month", "avg_rainfall_mm", "avg_wind_speed_ms"])
    out = generate_forecast(_FakeModel(), tide, weather, empty_clim, recent_rainfall_avg_7d=5.0)
    assert len(out) == 31
    assert (out[out["horizon_type"] == "long_term_outlook"]["prob_rob"] == 0.6).all()


def test_generate_forecast_skips_dates_missing_from_tide():
    tide, weather, clim = _inputs()
    # Potong tabel pasut hanya 10 hari -> hanya 10 tanggal punya prediksi.
    tide = tide.iloc[:10]
    out = generate_forecast(_FakeModel(), tide, weather, clim, recent_rainfall_avg_7d=5.0)
    assert len(out) == 10
