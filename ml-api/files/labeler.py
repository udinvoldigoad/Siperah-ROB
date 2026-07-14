"""
labeler.py
Sistem pelabelan data historis untuk training model prediksi rob.

Dua sumber label, digabung dengan prioritas:
1. Proxy label  : threshold pasang + hujan (Fase 1.4 roadmap). Ambang bersifat
                  SEMENTARA dan wajib divalidasi dengan BPBD/BMKG Lampung.
2. Ground truth : laporan warga tervalidasi BPBD (`ground_truth_reports`
                  status = 'divalidasi') -- selalu menang atas proxy (label 1).
"""

from __future__ import annotations

import os

import pandas as pd

# Ambang SEMENTARA (roadmap Fase 1.4) -- bisa dioverride via environment.
TIDE_THRESHOLD_CM = float(os.getenv("ML_TIDE_THRESHOLD_CM", 185))
RAINFALL_THRESHOLD_MM = float(os.getenv("ML_RAINFALL_THRESHOLD_MM", 25))


def apply_proxy_labels(df: pd.DataFrame,
                       tide_threshold_cm: float = TIDE_THRESHOLD_CM,
                       rainfall_threshold_mm: float = RAINFALL_THRESHOLD_MM) -> pd.DataFrame:
    """
    Label = 1 (Rob) jika pasang maksimum DAN curah hujan sama-sama melewati
    ambang pada hari yang sama. Kolom wajib: max_tide_height_cm, rainfall_mm.
    """
    df = df.copy()
    df["label_rob"] = (
        (df["max_tide_height_cm"] >= tide_threshold_cm)
        & (df["rainfall_mm"] >= rainfall_threshold_mm)
    ).astype(int)
    df["label_source"] = "proxy_threshold"
    return df


def _normalize_regency(name: str | None) -> str:
    """'Kota Bandar Lampung' -> 'bandar_lampung' (cocok dg kunci STATIONS)."""
    if not name:
        return ""
    cleaned = name.lower().replace("kabupaten", "").replace("kota", "").strip()
    return "_".join(cleaned.split())


def fetch_validated_report_dates(conn) -> pd.DataFrame:
    """
    Ambil tanggal kejadian laporan warga yang sudah divalidasi BPBD,
    beserta stasiun (kabupaten/kota) tempat kejadian.

    Return: DataFrame ['date', 'station'] (unik).
    """
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT g.incident_time::date, r.regency
        FROM ground_truth_reports g
        LEFT JOIN regions r ON r.id = g.region_id
        WHERE g.status = 'divalidasi'
        """
    )
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        return pd.DataFrame(columns=["date", "station"])

    records = [
        {"date": pd.Timestamp(row[0]).strftime("%Y-%m-%d"), "station": _normalize_regency(row[1])}
        for row in rows
        if row[0] is not None
    ]
    return pd.DataFrame(records).drop_duplicates()


def merge_ground_truth_labels(df: pd.DataFrame, validated: pd.DataFrame) -> pd.DataFrame:
    """
    Timpa label proxy dengan ground truth: tanggal+stasiun yang punya laporan
    tervalidasi dipaksa label 1. df wajib punya kolom 'date' dan 'station'.
    """
    if validated.empty:
        return df

    df = df.copy()
    df["_date_str"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    validated_keys = set(zip(validated["date"], validated["station"]))

    mask = df.apply(lambda row: (row["_date_str"], row.get("station", "")) in validated_keys, axis=1)
    overridden = int((mask & (df["label_rob"] == 0)).sum())
    df.loc[mask, "label_rob"] = 1
    df.loc[mask, "label_source"] = "bpbd_validated"
    df = df.drop(columns=["_date_str"])

    print(f"[INFO] Ground truth BPBD: {len(validated_keys)} kejadian tervalidasi, "
          f"{overridden} label proxy dinaikkan menjadi 1.")
    return df


def label_summary(df: pd.DataFrame) -> str:
    total = len(df)
    positives = int(df["label_rob"].sum())
    pct = (positives / total * 100) if total else 0
    return f"{positives}/{total} hari berlabel Rob ({pct:.1f}%)"
