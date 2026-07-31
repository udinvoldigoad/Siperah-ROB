"""Uji model pasang surut harmonik di main.py (M2/S2/K1/O1).

Model harmonik adalah dasar proyeksi pasut 30 hari: bila fit/prediksinya
salah, seluruh prediksi (termasuk peak_time dan max_tidal_height) ikut salah.
Data sintetis dibuat dari model yang sama, jadi rekonstruksi harus nyaris
sempurna.
"""

from datetime import datetime, timedelta
from decimal import Decimal

import numpy as np
import pandas as pd
import pytest

from main import CONSTITUENTS, _prepare_tide_frame, daily_max_tide_cm, fit_harmonic_model, predict_tide_heights, strip_timezone

N_HOURS = 720  # 30 hari per jam


def _synthetic_tide(n_hours: int = N_HOURS, base=datetime(2024, 1, 1)):
    ts = pd.date_range(start=base, periods=n_hours, freq="h")
    hours = (ts - ts[0]).total_seconds() / 3600.0
    beta = np.array([0.0, 0.8, -0.3, 0.5, 0.2, -0.6, 0.4, 0.9, 0.1])
    parts = [np.ones(len(hours))]
    for omega in CONSTITUENTS.values():
        parts.append(np.cos(omega * hours))
        parts.append(np.sin(omega * hours))
    X = np.column_stack(parts)
    df = pd.DataFrame({"recorded_at": ts, "tidal_height": X @ beta})
    return df, ts[0], beta


def test_fit_and_predict_harmonic_recovers_signal():
    df, t0, beta = _synthetic_tide()
    fit_t0, fit_beta = fit_harmonic_model(df)
    assert fit_t0 is not None

    end = df["recorded_at"].max() + timedelta(days=5)
    pred = predict_tide_heights(fit_t0, fit_beta, t0, end)
    assert len(pred) > N_HOURS

    merged = pred.merge(df, on="recorded_at", how="inner", suffixes=("_pred", "_act"))
    residual = np.abs(merged["tidal_height_pred"] - merged["tidal_height_act"])
    assert residual.max() < 1e-6


def test_fit_harmonic_returns_none_for_too_few_rows():
    small = pd.DataFrame({
        "recorded_at": pd.date_range("2024-01-01", periods=5, freq="h"),
        "tidal_height": [1.0] * 5,
    })
    assert fit_harmonic_model(small) == (None, None)


def test_daily_max_tide_cm_aggregates_peak_per_day(monkeypatch):
    monkeypatch.setattr("main.TIDE_DATUM_OFFSET_CM", 0.0)
    df, t0, beta = _synthetic_tide()
    start = df["recorded_at"].min()
    end = df["recorded_at"].max()

    daily = daily_max_tide_cm(t0, beta, start, end)
    assert len(daily) == (end - start).days + 1
    assert daily["tide_height_cm"].max() > 0
    assert daily["peak_time"].str.match(r"^\d{2}:\d{2}$").all()
    assert daily["date"].is_monotonic_increasing


def test_prepare_tide_frame_strips_tz_and_coerces_decimal():
    rows = [
        (pd.Timestamp("2024-01-01T00:00:00+07:00"), Decimal("1.25")),
        (pd.Timestamp("2024-01-01T01:00:00+07:00"), Decimal("1.30")),
        (pd.Timestamp("2024-01-01T02:00:00+07:00"), None),
    ]
    out = _prepare_tide_frame(rows)
    assert len(out) == 2
    assert out["tidal_height"].dtype == float
    assert out["tidal_height"].iloc[0] == pytest.approx(1.25)
    assert out["recorded_at"].dt.tz is None


def test_strip_timezone():
    assert strip_timezone(None) is None
    aware = pd.Timestamp("2024-01-01T00:00:00+07:00").to_pydatetime()
    assert strip_timezone(aware).tzinfo is None
    naive = datetime(2024, 1, 1)
    assert strip_timezone(naive) is naive
