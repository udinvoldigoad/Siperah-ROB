"""
labeler.py
Sistem pelabelan data historis untuk training model prediksi rob.

Sumber label, digabung dengan prioritas (yang di bawah menimpa yang di atas):
1. Proxy statistik : ambang PERSENTIL PER STASIUN dari distribusi data pasut &
                     hujan stasiun itu sendiri — bukan konstanta tetap. Pasangan
                     persentil dipilih lewat kalibrasi grid-search terhadap
                     kejadian rob riil (lihat calibrate_proxy_thresholds).
2. Episode terkurasi: data/raw/ground_truth_2020.csv — episode rob Teluk
                     Lampung 2020-2021 terdokumentasi (label 0 DAN 1, harian).
3. Kejadian DIBI    : data/raw/ground_truth_events.csv — kejadian rob/gelombang
                     pasang resmi BNPB DIBI per kabupaten, dengan kode identitas
                     bencana sebagai referensi audit. Selalu label 1.
4. Laporan BPBD     : ground_truth_reports.status='divalidasi' di database.
                     Selalu label 1 (menang atas semuanya).
"""

from __future__ import annotations

from pathlib import Path

import pandas as pd

DATA_RAW_DIR = Path(__file__).resolve().parent.parent / "data" / "raw"
DIBI_EVENTS_CSV = DATA_RAW_DIR / "ground_truth_events.csv"
CURATED_DAILY_CSV = DATA_RAW_DIR / "ground_truth_2020.csv"
# Episode 2020-2021 pada CSV terkurasi berasal dari dataset rob Teluk Lampung
# (Kota Bandar Lampung) yang menjadi dasar skema fitur Excel proyek ini.
CURATED_DAILY_STATION = "bandar_lampung"

# Grid kandidat persentil untuk kalibrasi. Ini DAFTAR PENCARIAN, bukan ambang:
# nilai akhirnya dipilih berdasarkan kecocokan dengan kejadian riil.
TIDE_QUANTILE_GRID = [0.80, 0.85, 0.90, 0.95, 0.98]
RAIN_QUANTILE_GRID = [0.70, 0.80, 0.85, 0.90, 0.95]


def _normalize_regency(name: str | None) -> str:
    """'Kota Bandar Lampung' -> 'bandar_lampung' (cocok dg kunci STATIONS)."""
    if not name:
        return ""
    cleaned = name.lower().replace("kabupaten", "").replace("kota", "").strip()
    return "_".join(cleaned.split())


# ─── 1. Proxy persentil per stasiun ──────────────────────────────────────────

def station_thresholds(df: pd.DataFrame, tide_q: float, rain_q: float) -> pd.DataFrame:
    """Ambang per stasiun dari distribusi data stasiun itu sendiri."""
    return (
        df.groupby("station")
        .agg(tide_thr_cm=("max_tide_height_cm", lambda s: float(s.quantile(tide_q))),
             rain_thr_mm=("rainfall_mm", lambda s: float(s.quantile(rain_q))))
        .reset_index()
    )


def apply_proxy_labels(df: pd.DataFrame, tide_q: float, rain_q: float) -> pd.DataFrame:
    """
    Label proxy = 1 jika pasang harian >= persentil tide_q stasiun DAN curah
    hujan >= persentil rain_q stasiun, pada hari yang sama.
    Kolom wajib: station, max_tide_height_cm, rainfall_mm.
    """
    df = df.copy()
    thresholds = station_thresholds(df, tide_q, rain_q)
    df = df.merge(thresholds, on="station", how="left")
    df["label_rob"] = (
        (df["max_tide_height_cm"] >= df["tide_thr_cm"])
        & (df["rainfall_mm"] >= df["rain_thr_mm"])
    ).astype(int)
    df["label_source"] = "proxy_percentile"
    return df


# ─── 2 & 3. Ground truth eksternal (file terkurasi) ─────────────────────────

def load_curated_daily_labels() -> pd.DataFrame:
    """Episode harian terkurasi (label 0 dan 1). Return: date, station, label."""
    if not CURATED_DAILY_CSV.exists():
        return pd.DataFrame(columns=["date", "station", "label"])
    raw = pd.read_csv(CURATED_DAILY_CSV)
    return pd.DataFrame({
        "date": pd.to_datetime(raw["date"]).dt.strftime("%Y-%m-%d"),
        "station": CURATED_DAILY_STATION,
        "label": raw["label_rob"].astype(int),
    })


def load_dibi_events() -> pd.DataFrame:
    """Kejadian rob/gelombang pasang resmi BNPB DIBI. Return: date, station."""
    if not DIBI_EVENTS_CSV.exists():
        return pd.DataFrame(columns=["date", "station"])
    raw = pd.read_csv(DIBI_EVENTS_CSV)
    raw = raw[raw["label"].astype(int) == 1]
    return pd.DataFrame({
        "date": pd.to_datetime(raw["date"]).dt.strftime("%Y-%m-%d"),
        "station": raw["station"].astype(str),
    }).drop_duplicates()


def external_truth_table() -> pd.DataFrame:
    """
    Gabungan semua hari berlabel pasti dari sumber eksternal:
    kurasi harian (0/1) + kejadian DIBI (1). Return: date, station, label.
    """
    daily = load_curated_daily_labels()
    events = load_dibi_events().assign(label=1)
    combined = pd.concat([daily, events[["date", "station", "label"]]], ignore_index=True)
    if combined.empty:
        return combined
    # Bila tanggal+stasiun sama muncul di dua sumber, kejadian (label 1) menang.
    return combined.sort_values("label").drop_duplicates(["date", "station"], keep="last")


# ─── Kalibrasi persentil terhadap kejadian riil ──────────────────────────────

def calibrate_proxy_thresholds(df: pd.DataFrame) -> dict:
    """
    Pilih pasangan persentil (tide_q, rain_q) yang paling cocok dengan hari-hari
    berlabel pasti (F1 pada subset hari tersebut). Tie-break: laju positif
    keseluruhan terendah, agar proxy tidak mengembang tanpa bukti.

    Return dict berisi persentil terpilih, skor, dan ambang cm/mm per stasiun
    yang dihasilkan — disimpan ke models/label_calibration.json oleh caller.
    """
    truth = external_truth_table()
    base = df.copy()
    base["_date_str"] = pd.to_datetime(base["date"]).dt.strftime("%Y-%m-%d")

    best: dict | None = None
    for tide_q in TIDE_QUANTILE_GRID:
        for rain_q in RAIN_QUANTILE_GRID:
            labeled = apply_proxy_labels(base, tide_q, rain_q)
            merged = truth.merge(
                labeled[["_date_str", "station", "label_rob"]],
                left_on=["date", "station"], right_on=["_date_str", "station"],
                how="inner",
            )
            if merged.empty:
                continue
            tp = int(((merged["label"] == 1) & (merged["label_rob"] == 1)).sum())
            fp = int(((merged["label"] == 0) & (merged["label_rob"] == 1)).sum())
            fn = int(((merged["label"] == 1) & (merged["label_rob"] == 0)).sum())
            precision = tp / (tp + fp) if (tp + fp) else 0.0
            recall = tp / (tp + fn) if (tp + fn) else 0.0
            f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
            positive_rate = float(labeled["label_rob"].mean())
            candidate = {
                "tide_quantile": tide_q,
                "rain_quantile": rain_q,
                "f1_vs_truth": round(f1, 4),
                "precision_vs_truth": round(precision, 4),
                "recall_vs_truth": round(recall, 4),
                "truth_days_matched": int(len(merged)),
                "overall_positive_rate": round(positive_rate, 5),
            }
            if (best is None
                    or candidate["f1_vs_truth"] > best["f1_vs_truth"]
                    or (candidate["f1_vs_truth"] == best["f1_vs_truth"]
                        and positive_rate < best["overall_positive_rate"])):
                best = candidate

    if best is None:
        raise ValueError(
            "Kalibrasi gagal: tidak ada hari berlabel pasti yang beririsan dengan "
            "dataset fitur. Pastikan ground_truth_events.csv/ground_truth_2020.csv ada "
            "dan rentang data historis mencakup tanggal kejadian.")

    thresholds = station_thresholds(df, best["tide_quantile"], best["rain_quantile"])
    best["station_thresholds"] = {
        row["station"]: {"tide_thr_cm": round(row["tide_thr_cm"], 2),
                         "rain_thr_mm": round(row["rain_thr_mm"], 2)}
        for _, row in thresholds.iterrows()
    }
    best["truth_positives"] = int((external_truth_table()["label"] == 1).sum())
    best["truth_negatives"] = int((external_truth_table()["label"] == 0).sum())
    return best


# ─── Penggabungan label ──────────────────────────────────────────────────────

def merge_external_labels(df: pd.DataFrame) -> pd.DataFrame:
    """
    Timpa label proxy dengan hari berlabel pasti dari sumber eksternal
    (dua arah: 0 maupun 1).
    """
    truth = external_truth_table()
    if truth.empty:
        return df

    df = df.copy()
    df["_date_str"] = pd.to_datetime(df["date"]).dt.strftime("%Y-%m-%d")
    truth_map = {(row["date"], row["station"]): int(row["label"]) for _, row in truth.iterrows()}

    applied = 0
    for idx, row in df.iterrows():
        key = (row["_date_str"], row.get("station", ""))
        if key in truth_map:
            df.at[idx, "label_rob"] = truth_map[key]
            df.at[idx, "label_source"] = "ground_truth_external"
            applied += 1
    df = df.drop(columns=["_date_str"])
    print(f"[INFO] Ground truth eksternal (DIBI BNPB + episode terkurasi): "
          f"{len(truth_map)} hari berlabel pasti, {applied} baris fitur ditimpa.")
    return df


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
    Timpa label dengan ground truth BPBD: tanggal+stasiun yang punya laporan
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
