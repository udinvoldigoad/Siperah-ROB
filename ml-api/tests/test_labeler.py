"""Uji labeler: normalisasi wilayah, proxy persentil, dan penggabungan ground truth.

Pelabelan menentukan target yang dilatih model. Ambang persentil DIPILIH lewat
kalibrasi terhadap kejadian riil (bukan konstanta), jadi perilaku grid-search
dan aturan "yang lebih prioritas menimpa yang lebih rendah" harus dikunci.
"""

import pandas as pd
import pytest

from files import labeler


def test_normalize_regency():
    assert labeler._normalize_regency("Kota Bandar Lampung") == "bandar_lampung"
    assert labeler._normalize_regency("Kabupaten Lampung Selatan") == "lampung_selatan"
    assert labeler._normalize_regency("Pesisir Barat") == "pesisir_barat"
    assert labeler._normalize_regency("Kabupaten Pesisir Barat") == "pesisir_barat"
    assert labeler._normalize_regency(None) == ""
    assert labeler._normalize_regency("") == ""


def test_station_thresholds_are_per_station():
    df = pd.DataFrame({
        "station": ["a"] * 10 + ["b"] * 10,
        "max_tide_height_cm": list(range(100, 200, 10)) + list(range(200, 300, 10)),
        "rainfall_mm": list(range(0, 100, 10)) + list(range(100, 200, 10)),
    })
    thr = labeler.station_thresholds(df, tide_q=0.9, rain_q=0.8)
    a = thr[thr["station"] == "a"].iloc[0]
    b = thr[thr["station"] == "b"].iloc[0]
    # Interpolasi linear pandas (bukan numpy default) di baris ini.
    assert a["tide_thr_cm"] == pytest.approx(pd.Series(range(100, 200, 10)).quantile(0.9))
    assert a["rain_thr_mm"] == pytest.approx(pd.Series(range(0, 100, 10)).quantile(0.8))
    assert b["tide_thr_cm"] == pytest.approx(pd.Series(range(200, 300, 10)).quantile(0.9))
    assert b["rain_thr_mm"] == pytest.approx(pd.Series(range(100, 200, 10)).quantile(0.8))
    assert b["tide_thr_cm"] > a["tide_thr_cm"]


def test_apply_proxy_labels_requires_tide_and_rain_together():
    df = pd.DataFrame({
        "station": ["s"] * 4,
        "max_tide_height_cm": [150, 150, 10, 10],
        "rainfall_mm": [50, 0, 50, 0],
    })
    out = labeler.apply_proxy_labels(df, tide_q=0.5, rain_q=0.5)
    # tide_thr = 80, rain_thr = 25 -> hanya baris pasang TINGGI + hujan TINGGI.
    assert out["label_rob"].tolist() == [1, 0, 0, 0]
    assert (out["label_source"] == "proxy_percentile").all()


def test_external_truth_table_merges_and_event_wins(tmp_path, monkeypatch):
    daily = tmp_path / "ground_truth_2020.csv"
    daily.write_text("date,label_rob\n2020-01-01,1\n2020-01-02,0\n")
    events = tmp_path / "ground_truth_events.csv"
    # Konflik tanggal+stasiun dengan label harian: kejadian (1) harus menang.
    events.write_text("date,station,label\n2020-01-02,bandar_lampung,1\n2020-01-03,pesisir_barat,1\n")
    monkeypatch.setattr(labeler, "CURATED_DAILY_CSV", daily)
    monkeypatch.setattr(labeler, "DIBI_EVENTS_CSV", events)

    truth = labeler.external_truth_table()
    assert len(truth) == 3
    conflict = truth[(truth["date"] == "2020-01-02") & (truth["station"] == "bandar_lampung")]
    assert conflict["label"].iloc[0] == 1
    assert set(truth["station"]) == {"bandar_lampung", "pesisir_barat"}


def test_merge_external_labels_overrides_proxy(monkeypatch):
    truth = pd.DataFrame({
        "date": ["2024-03-01", "2024-03-02"],
        "station": ["s", "s"],
        "label": [1, 0],
    })
    monkeypatch.setattr(labeler, "external_truth_table", lambda: truth)
    df = pd.DataFrame({
        "date": pd.to_datetime(["2024-03-01", "2024-03-02", "2024-03-03"]),
        "station": ["s"] * 3,
        "label_rob": [0, 1, 0],
        "label_source": ["proxy_percentile"] * 3,
    })
    out = labeler.merge_external_labels(df)
    assert out["label_rob"].tolist() == [1, 0, 0]
    assert out["label_source"].tolist() == ["ground_truth_external", "ground_truth_external", "proxy_percentile"]


def test_merge_ground_truth_labels_forces_positive():
    validated = pd.DataFrame({
        "date": ["2024-03-01"],
        "station": ["s"],
    })
    df = pd.DataFrame({
        "date": pd.to_datetime(["2024-03-01", "2024-03-02"]),
        "station": ["s", "s"],
        "label_rob": [0, 0],
        "label_source": ["proxy_percentile", "proxy_percentile"],
    })
    out = labeler.merge_ground_truth_labels(df, validated)
    assert out["label_rob"].tolist() == [1, 0]
    assert out["label_source"].tolist() == ["bpbd_validated", "proxy_percentile"]


def _calibrate_df():
    dates = pd.date_range("2024-01-01", periods=60, freq="D")
    rainfall = [5.0] * 55 + [50.0] * 5
    return pd.DataFrame({
        "date": dates,
        "station": ["s"] * 60,
        "max_tide_height_cm": [150.0] * 60,
        "rainfall_mm": rainfall,
    })


def test_calibrate_proxy_thresholds_picks_high_rain_quantile(monkeypatch):
    df = _calibrate_df()
    # 5 hari terakhir = kejadian riil (label 1), hari pertama = bukan kejadian.
    truth = pd.DataFrame({
        "date": list(df["date"].tail(5).dt.strftime("%Y-%m-%d")) + [df["date"].iloc[0].strftime("%Y-%m-%d")],
        "station": ["s"] * 6,
        "label": [1] * 5 + [0],
    })
    monkeypatch.setattr(labeler, "external_truth_table", lambda: truth)

    cal = labeler.calibrate_proxy_thresholds(df)
    # Hanya rain_q=0.95 yang ambangnya 50mm -> tepat memisahkan kejadian riil.
    assert cal["rain_quantile"] == 0.95
    assert cal["f1_vs_truth"] == pytest.approx(1.0)
    assert cal["station_thresholds"]["s"]["rain_thr_mm"] == pytest.approx(50.0)


def test_calibrate_proxy_thresholds_raises_without_intersection(monkeypatch):
    monkeypatch.setattr(
        labeler, "external_truth_table",
        lambda: pd.DataFrame(columns=["date", "station", "label"]),
    )
    with pytest.raises(ValueError):
        labeler.calibrate_proxy_thresholds(_calibrate_df())
