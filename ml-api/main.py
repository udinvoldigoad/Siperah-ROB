"""
main.py -- Orkestrator pipeline ML prediksi banjir rob SAIBA.

Mode CLI (Fase 3 roadmap):
  python main.py --mode fetch     Unduh data historis Open-Meteo -> data/raw/*.csv
  python main.py --mode train     Bangun fitur + label, latih model, simpan artefak
  python main.py --mode predict   Muat model, prakiraan 30 hari, tulis ke DB (default)

Tanpa argumen = predict (kompatibel dengan pemanggilan lama dari Laravel).
Jika model belum ada saat predict, training dijalankan otomatis terlebih dahulu.
"""

import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator, ValidationError

from files import data_fetcher, feature_engineering, labeler, predict_forecast, train_model

class PredictionContract(BaseModel):
    risk_probability: float = Field(ge=0.0, le=100.0)
    risk_class: str
    confidence_score: float = Field(ge=0.0, le=100.0)
    max_tidal_height: float
    peak_time: str

    @field_validator("risk_class")
    @classmethod
    def check_risk_class(cls, v: str) -> str:
        allowed = {"rendah", "sedang", "tinggi", "sangat_tinggi"}
        if v not in allowed:
            raise ValueError(f"risk_class harus salah satu dari {allowed}, got {v}")
        return v

# 1. Environment ---------------------------------------------------------------
base_dir = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=base_dir / "backend" / ".env")

DB_CONN = os.getenv("DB_CONNECTION", "mysql")
DB_HOST = os.getenv("DB_HOST", "127.0.0.1")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_DATABASE = os.getenv("DB_DATABASE", "saiba")
DB_USERNAME = os.getenv("DB_USERNAME", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Datum pasut: tidal_data memakai sea_level_height_msl Open-Meteo Marine (model
# FES), yaitu meter RELATIF MSL. Seluruh pipeline bekerja native di datum MSL â€”
# tidak ada offset karangan. Env ini hanya diisi bila kelak ada nilai datum
# resmi BIG/BMKG hasil pengukuran (default 0 = tetap MSL).
TIDE_DATUM_OFFSET_CM = float(os.getenv("ML_TIDE_DATUM_OFFSET_CM", 0))
WEATHER_SOURCE = os.getenv("ML_WEATHER_SOURCE", "openmeteo")  # openmeteo | bmkg


def get_db_connection():
    # connect_timeout wajib: tanpa ini koneksi yang paketnya di-drop diam-diam
    # (firewall/pooler) menggantung tanpa batas, bukan gagal dengan error.
    if DB_CONN == "pgsql":
        import psycopg2
        print(f"[INFO] Koneksi DB pgsql -> {DB_HOST}:{DB_PORT} ...", flush=True)
        conn = psycopg2.connect(host=DB_HOST, port=int(DB_PORT), database=DB_DATABASE,
                                user=DB_USERNAME, password=DB_PASSWORD, connect_timeout=20)
        print("[INFO] Koneksi DB berhasil.", flush=True)
        return conn
    import mysql.connector
    return mysql.connector.connect(host=DB_HOST, port=int(DB_PORT), database=DB_DATABASE,
                                   user=DB_USERNAME, password=DB_PASSWORD,
                                   connection_timeout=20)


# 2. Model pasang surut harmonik -------------------------------------------------
CONSTITUENTS = {
    "M2": 2 * np.pi / 12.4206012,
    "S2": 2 * np.pi / 12.0,
    "K1": 2 * np.pi / 23.9344696,
    "O1": 2 * np.pi / 25.8193417,
}


def fit_harmonic_model(df_tide):
    if len(df_tide) < 10:
        print("[WARNING] Data pasut historis < 10 baris. Memakai koefisien fallback.")
        return None, None
    t0 = df_tide["recorded_at"].min()
    df_tide = df_tide.copy()
    df_tide["hours"] = (df_tide["recorded_at"] - t0).dt.total_seconds() / 3600.0
    X_parts = [np.ones(len(df_tide))]
    for omega in CONSTITUENTS.values():
        X_parts.append(np.cos(omega * df_tide["hours"]))
        X_parts.append(np.sin(omega * df_tide["hours"]))
    beta, _, _, _ = np.linalg.lstsq(np.column_stack(X_parts), df_tide["tidal_height"].values, rcond=None)
    return t0, beta


def predict_tide_heights(t0, beta, start_date, end_date):
    times = pd.date_range(start=start_date, end=end_date, freq="h")
    hours = (times - pd.Timestamp(t0)).total_seconds() / 3600.0
    X_parts = [np.ones(len(hours))]
    for omega in CONSTITUENTS.values():
        X_parts.append(np.cos(omega * hours))
        X_parts.append(np.sin(omega * hours))
    return pd.DataFrame({"recorded_at": times,
                         "tidal_height": np.dot(np.column_stack(X_parts), beta)})


def strip_timezone(dt):
    if dt is None:
        return None
    if hasattr(dt, "tzinfo") and dt.tzinfo is not None:
        try:
            return dt.astimezone(None).replace(tzinfo=None)
        except Exception:
            return dt.replace(tzinfo=None)
    return dt


def _prepare_tide_frame(rows) -> pd.DataFrame:
    df_tide = pd.DataFrame(rows, columns=["recorded_at", "tidal_height"])
    series = pd.to_datetime(df_tide["recorded_at"])
    if series.dt.tz is not None:
        series = series.dt.tz_convert("UTC").dt.tz_localize(None)
    df_tide["recorded_at"] = series
    # Kolom numeric Postgres tiba sebagai Decimal; lstsq butuh float murni.
    df_tide["tidal_height"] = pd.to_numeric(df_tide["tidal_height"], errors="coerce").astype(float)
    return df_tide.dropna(subset=["tidal_height"])


def load_tide_models(conn) -> dict[str, tuple]:
    """
    Fit model harmonik PER STASIUN dari tabel tidal_data.

    Fase & amplitudo pasut berbeda nyata antar perairan (Samudra Hindia di
    Pesisir Barat vs Laut Jawa di Tulang Bawang/Mesuji vs Teluk Lampung) â€”
    satu model gabungan mencampur fase semua stasiun dan meratakan sinyal.
    """
    cursor = conn.cursor()
    cursor.execute(
        "SELECT station_code, recorded_at, tidal_height FROM tidal_data ORDER BY recorded_at ASC")
    rows = cursor.fetchall()
    cursor.close()

    if not rows:
        raise ValueError(
            "Data historis pasang surut (tidal_data) kosong. "
            "Jalankan 'php artisan data:fetch-tidal-sealevel' terlebih dahulu.")

    all_rows = pd.DataFrame(rows, columns=["station_code", "recorded_at", "tidal_height"])
    models: dict[str, tuple] = {}
    for station, group in all_rows.groupby("station_code"):
        df_tide = _prepare_tide_frame(group[["recorded_at", "tidal_height"]].values.tolist())
        t0, beta = fit_harmonic_model(df_tide)
        if t0 is None or beta is None:
            print(f"[WARNING] Stasiun {station}: data pasut < 10 baris â€” dilewati.")
            continue
        t0 = strip_timezone(t0.to_pydatetime() if isinstance(t0, pd.Timestamp) else t0)
        models[station] = (t0, beta)

    if not models:
        raise ValueError("Tidak ada stasiun dengan data pasut cukup untuk fit harmonik.")
    print(f"[INFO] Model harmonik pasut per stasiun: {sorted(models)}")
    return models


def tide_model_for(models: dict[str, tuple], station: str) -> tuple:
    """Model stasiun; fallback ke stasiun pertama bila stasiun tak punya data."""
    if station in models:
        return models[station]
    fallback = next(iter(sorted(models)))
    print(f"[WARNING] Stasiun {station} tidak punya model pasut â€” memakai {fallback}.")
    return models[fallback]


def daily_max_tide_cm(t0, beta, start, end) -> pd.DataFrame:
    """Backcast/forecast pasut per jam -> agregasi maksimum harian dalam cm."""
    hourly = predict_tide_heights(t0, beta, start, end)
    hourly["date"] = hourly["recorded_at"].dt.date
    idx_max = hourly.groupby("date")["tidal_height"].idxmax()
    daily = hourly.loc[idx_max].copy()
    daily["peak_time"] = daily["recorded_at"].dt.strftime("%H:%M")
    daily["tide_height_cm"] = daily["tidal_height"] * 100 + TIDE_DATUM_OFFSET_CM
    daily["date"] = pd.to_datetime(daily["date"])
    return daily[["date", "tide_height_cm", "peak_time"]]


# 3. Penyusunan dataset training --------------------------------------------------

def build_training_frame(conn):
    """Gabungkan pasut (harmonik per stasiun), cuaca, gelombang + label terkalibrasi."""
    weather, marine = data_fetcher.load_cached_historical()
    if weather is None:
        print("[INFO] CSV historis belum ada -- mengunduh dari Open-Meteo...")
        weather, marine = data_fetcher.fetch_all_historical()
    data_source = "openmeteo_era5"

    tide_models = load_tide_models(conn)
    start = pd.to_datetime(weather["date"]).min()
    end = pd.to_datetime(weather["date"]).max() + timedelta(days=1)

    frames = []
    for key in weather["station"].unique():
        w = weather[weather["station"] == key].copy()
        w["date"] = pd.to_datetime(w["date"])
        m = None
        if marine is not None and not marine.empty:
            m = marine[marine["station"] == key].copy()
            m["date"] = pd.to_datetime(m["date"])
            m = m.drop(columns=["station"])
        t0, beta = tide_model_for(tide_models, key)
        tide_daily = daily_max_tide_cm(t0, beta, start, end)
        tide = tide_daily[["date", "tide_height_cm"]]
        features = feature_engineering.build_daily_features(tide, w.drop(columns=["station"]), m)
        features["station"] = key
        frames.append(features)

    df = pd.concat(frames, ignore_index=True)

    # Ambang proxy dikalibrasi terhadap kejadian riil (DIBI BNPB + episode
    # terkurasi) â€” bukan konstanta tetap. Hasil kalibrasi disimpan ke models/.
    calibration = labeler.calibrate_proxy_thresholds(df)
    print(f"[INFO] Kalibrasi ambang proxy: tide_q={calibration['tide_quantile']} "
          f"rain_q={calibration['rain_quantile']} "
          f"(F1 vs kejadian riil={calibration['f1_vs_truth']}, "
          f"recall={calibration['recall_vs_truth']})")
    df = labeler.apply_proxy_labels(df, calibration["tide_quantile"], calibration["rain_quantile"])
    df = labeler.merge_external_labels(df)
    df = labeler.merge_ground_truth_labels(df, labeler.fetch_validated_report_dates(conn))
    print(f"[INFO] Dataset: {len(df)} baris fitur. Label: {labeler.label_summary(df)}")

    return df, data_source, calibration


def run_train(conn, tune: bool = True):
    print("[INFO] Menyusun dataset training dari database & API historis...")
    df, data_source, calibration = build_training_frame(conn)
    
    # Menyelaraskan nama kolom target dengan target yang diharapkan train_model (Rob)
    df = df.rename(columns={"label_rob": "Rob"})
    
    if df["Rob"].nunique() < 2:
        print("[ERROR] Semua label satu kelas -- model tidak bisa dilatih.")
        sys.exit(1)
        
    train_df, _val_df, test_df = train_model.time_based_split(df)
    print(f"[INFO] Split: train={len(train_df)} val={len(_val_df)} test={len(test_df)}")
    
    if train_df["Rob"].nunique() < 2:
        print("[ERROR] Data latih (train_df) setelah split hanya memiliki satu kelas. Silakan turunkan ambang batas pasut/cuaca.")
        sys.exit(1)
        
    model = train_model.train_xgboost(train_df, tune=tune)
    metrics = train_model.evaluate_model(model, test_df)
    metrics["data_source"] = data_source
    metrics["trained_rows"] = int(len(train_df))
    metrics["label_calibration"] = calibration
    train_model.save_model(model, metrics)

    calibration_path = train_model.MODELS_DIR / "label_calibration.json"
    calibration_path.write_text(json.dumps(calibration, indent=2))
    print(f"[OK] Kalibrasi label disimpan: {calibration_path}")
    return model


# 4. Inferensi & penulisan prediksi ------------------------------------------------

def climatology_from_history(weather: pd.DataFrame | None, marine: pd.DataFrame | None, station: str):
    """Klimatologi bulanan per stasiun dari CSV historis; default bila tak ada."""
    if weather is not None and not weather.empty:
        w = weather[weather["station"] == station].copy()
        if not w.empty:
            w["month"] = pd.to_datetime(w["date"]).dt.month
            clim = w.groupby("month").agg(avg_rainfall_mm=("rainfall_mm", "mean"),
                                          avg_wind_speed_ms=("wind_speed_ms", "mean")).reset_index()
        else:
            clim = None
    else:
        clim = None
    if clim is None:
        clim = pd.DataFrame({"month": range(1, 13),
                             "avg_rainfall_mm": [12.0] * 12,
                             "avg_wind_speed_ms": [4.0] * 12})

    wave_clim = None
    if marine is not None and not marine.empty:
        m = marine[marine["station"] == station].copy()
        if not m.empty:
            m["month"] = pd.to_datetime(m["date"]).dt.month
            wave_clim = m.groupby("month").agg(avg_wave_height_m=("wave_height_max_m", "mean"),
                                               avg_swell_height_m=("swell_wave_height_max_m", "mean")).reset_index()
    return clim, wave_clim


def run_predict(conn):
    cursor = conn.cursor()
    print("[INFO] Mengambil wilayah pesisir...")
    cursor.execute("SELECT id, regency, district, village, distance_to_coast_m, avg_elevation_m FROM regions WHERE coastal_flag = true")
    regions = cursor.fetchall()
    print(f"[INFO] {len(regions)} wilayah pesisir ditemukan.")
    if not regions:
        print("[ERROR] Tidak ada wilayah pesisir. Jalankan migrasi/seeder backend dahulu.")
        sys.exit(1)

    model = train_model.load_model()
    if model is None:
        print("[INFO] Model tersimpan belum ada -- menjalankan training terlebih dahulu...")
        model = run_train(conn)

    # Pasang surut 30 hari ke depan â€” harmonik PER STASIUN dari tidal_data
    tide_models = load_tide_models(conn)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)

    # Prakiraan cuaca + gelombang per stasiun
    print(f"[INFO] Mengambil prakiraan cuaca & gelombang ({WEATHER_SOURCE})...")
    forecasts = data_fetcher.fetch_daily_forecast_for_inference(days=8, weather_source=WEATHER_SOURCE)
    weather_hist, marine_hist = data_fetcher.load_cached_historical()
    data_source = "MLPipeline-OpenMeteo"

    # Prediksi per stasiun (sekali per stasiun, dipakai semua region di dalamnya)
    station_results: dict[str, pd.DataFrame] = {}
    station_tide_daily: dict[str, pd.DataFrame] = {}
    for key in data_fetcher.STATIONS:
        frames = forecasts.get(key, {})
        weather_fc = frames.get("weather", pd.DataFrame())
        if weather_fc is None or weather_fc.empty:
            print(f"[WARNING] Tidak ada prakiraan cuaca untuk stasiun {key} -- dilewati.")
            continue

        t0, beta = tide_model_for(tide_models, key)
        tide_daily = daily_max_tide_cm(t0, beta, today, today + timedelta(days=31))
        station_tide_daily[key] = tide_daily
        tide_forecast = tide_daily.rename(columns={"tide_height_cm": "max_tide_height_cm"})

        # Statistik pasut (anomali/king tide) dari backcast 2 tahun stasiun ybs.
        tide_hist = daily_max_tide_cm(t0, beta, today - timedelta(days=730), today)
        tide_stats = {
            "monthly_avg": tide_hist.assign(month=tide_hist["date"].dt.month)
                                     .groupby("month")["tide_height_cm"].mean().to_dict(),
            "p95": float(tide_hist["tide_height_cm"].quantile(0.95)),
        }

        clim, wave_clim = climatology_from_history(weather_hist, marine_hist, key)
        recent_rain = float(pd.to_numeric(weather_fc["rainfall_mm"], errors="coerce").fillna(0).mean())
        station_results[key] = predict_forecast.generate_forecast(
            model=model,
            tide_forecast_df=tide_forecast[["date", "max_tide_height_cm"]],
            weather_forecast_df=weather_fc,
            climatology_df=clim,
            recent_rainfall_avg_7d=recent_rain,
            marine_forecast_df=frames.get("marine"),
            wave_climatology_df=wave_clim,
            tide_stats=tide_stats,
        )
    if not station_results:
        print("[ERROR] Tidak ada hasil prediksi stasiun sama sekali (cek koneksi API).")
        sys.exit(1)

    # Tulis ke tabel predictions ---------------------------------------------------
    if DB_CONN == "pgsql":
        insert_query = """
            INSERT INTO predictions (
                id, region_id, prediction_date, risk_probability, risk_class,
                confidence_score, max_tidal_height, peak_time, model_version,
                generated_at, data_source, source_reference, provenance_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (region_id, prediction_date) DO UPDATE SET
                risk_probability = EXCLUDED.risk_probability,
                risk_class = EXCLUDED.risk_class,
                confidence_score = EXCLUDED.confidence_score,
                max_tidal_height = EXCLUDED.max_tidal_height,
                peak_time = EXCLUDED.peak_time,
                model_version = EXCLUDED.model_version,
                generated_at = EXCLUDED.generated_at,
                data_source = EXCLUDED.data_source,
                source_reference = EXCLUDED.source_reference,
                provenance_status = EXCLUDED.provenance_status
        """
    else:
        insert_query = """
            INSERT INTO predictions (
                id, region_id, prediction_date, risk_probability, risk_class,
                confidence_score, max_tidal_height, peak_time, model_version,
                generated_at, data_source, source_reference, provenance_status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                risk_probability = VALUES(risk_probability),
                risk_class = VALUES(risk_class),
                confidence_score = VALUES(confidence_score),
                max_tidal_height = VALUES(max_tidal_height),
                peak_time = VALUES(peak_time),
                model_version = VALUES(model_version),
                generated_at = VALUES(generated_at),
                data_source = VALUES(data_source),
                source_reference = VALUES(source_reference),
                provenance_status = VALUES(provenance_status)
        """

    tide_lookups = {
        key: daily.set_index(daily["date"].dt.date)
        for key, daily in station_tide_daily.items()
    }
    generated_at = datetime.now()
    default_station = "bandar_lampung"
    written = 0
    pending_rows: list[tuple] = []
    station_hits: dict[str, int] = {}

    for region in regions:
        region_id, regency, district, village = region[0], region[1], region[2], region[3]
        dist_raw = region[4]
        elev_raw = region[5]
        spatial_missing = dist_raw is None or elev_raw is None

        if spatial_missing:
            # Data spasial hilang: probabilitas risiko tidak boleh maksimal.
            # Pakai nilai konservatif (elevasi 2m, jarak 500m) â†’ faktor ~0.37
            # agar wilayah ini TIDAK tampak lebih berisiko daripada yang datanya
            # lengkap, dan tandai provenance_status agar operator bisa memprioritaskan.
            avg_elevation_m = 2.0
            dist_to_coast_m = 500.0
        else:
            dist_to_coast_m = float(dist_raw)
            avg_elevation_m = float(elev_raw)
        
        station_key = labeler._normalize_regency(regency)
        if station_key not in station_results:
            station_key = default_station if default_station in station_results else next(iter(station_results))
        station_hits[station_key] = station_hits.get(station_key, 0) + 1
        result = station_results[station_key]
        tide_lookup = tide_lookups[station_key]

        # Logika Spasial: Probabilitas turun eksponensial seiring tingginya elevasi dan jauhnya dari pantai
        # Elevasi 5m = exp(-2.5) = ~8% probabilitas asli. Elevasi 0m (nol valid) = 100%.
        spatial_factor = np.exp(-avg_elevation_m * 0.5) * np.exp(-dist_to_coast_m / 1000.0)

        for _, row in result.iterrows():
            pred_date = row["date"]
            if pred_date not in tide_lookup.index:
                continue
            tide_row = tide_lookup.loc[pred_date]

            # Skor ML Murni dikalikan faktor keruangan
            base_prob = float(row["prob_rob"])
            final_prob = base_prob * spatial_factor
            
            raw_prob = round(final_prob * 100.0, 2)
            # confidence dari model mencerminkan prob_rob mentah â€” skalakan
            # sebanding agar tetap sejalan dengan final_prob yang sudah
            # disesuaikan secara spasial.
            adj_confidence = float(row["confidence"]) * spatial_factor
            
            try:
                contract = PredictionContract(
                    risk_probability=raw_prob,
                    risk_class=predict_forecast.risk_class_from_probability(final_prob),
                    confidence_score=round(adj_confidence, 2),
                    max_tidal_height=round(float(tide_row["tide_height_cm"]) / 100, 3),
                    peak_time=tide_row["peak_time"]
                )
            except ValidationError as e:
                print(f"[WARNING] Validasi kontrak gagal untuk region_id {region_id} pada {pred_date}: {e}")
                continue

            pending_rows.append((
                str(uuid.uuid4()), region_id, pred_date,
                contract.risk_probability,
                contract.risk_class,
                contract.confidence_score,
                contract.max_tidal_height,
                contract.peak_time,
                train_model.MODEL_VERSION,
                generated_at,
                data_source,
                f"{train_model.MODEL_VERSION} - {row['horizon_type']} - stasiun {station_key}",
                "partial" if spatial_missing else "official",
            ))

    # Batch insert: satu roundtrip per ratusan baris. Insert per baris memakan
    # ~300 md/roundtrip ke DB lintas-benua (runner CI) -> ribuan baris = >13 menit.
    print(f"[INFO] Menulis {len(pending_rows)} prediksi ke database (batch)...", flush=True)
    if DB_CONN == "pgsql":
        from psycopg2.extras import execute_batch
        execute_batch(cursor, insert_query, pending_rows, page_size=500)
    else:
        cursor.executemany(insert_query, pending_rows)
    written = len(pending_rows)

    conn.commit()
    cursor.execute("SELECT COUNT(*) FROM predictions WHERE prediction_date >= %s", (today.date(),))
    total = cursor.fetchone()[0]

    # Audit trail: catat run prediksi ke data_import_runs (kapan, versi model,
    # jumlah, sumber) â€” ml-api menulis langsung ke DB, jadi ini jejak resminya.
    _log_prediction_run(conn, written, data_source, False)
    cursor.close()

    print(f"[SUCCESS] {written} prediksi ditulis/diperbarui "
          f"({len(station_results)} stasiun, pemetaan: {station_hits}).")
    print(f"[VERIFY] Total prediksi di DB mulai hari ini: {total} baris.")


def _log_prediction_run(conn, written, data_source, tide_simulated):
    """Catat run prediksi ke data_import_runs sebagai audit trail."""
    try:
        cur = conn.cursor()
        cur.execute("SELECT to_regclass('public.data_import_runs')")
        if cur.fetchone()[0] is None:
            cur.close()
            return
        summary = json.dumps({
            "model_version": train_model.MODEL_VERSION,
            "data_source": data_source,
            "tide_simulated": bool(tide_simulated),
        })
        cur.execute(
            """INSERT INTO data_import_runs
               (id, source, dataset_type, status, source_reference,
                fetched_count, valid_count, inserted_count, error_summary,
                started_at, completed_at)
               VALUES (%s, %s, 'predictions', 'completed', %s, %s, %s, %s, %s, now(), now())""",
            (str(uuid.uuid4()), f"ML {train_model.MODEL_VERSION}", data_source,
             written, written, written, summary),
        )
        conn.commit()
        cur.close()
    except Exception as error:  # noqa: BLE001 - audit tak boleh menggagalkan prediksi
        print(f"[WARNING] Gagal mencatat audit run prediksi: {error}")


def main():
    parser = argparse.ArgumentParser(description="Pipeline Prediksi Banjir Rob SAIBA")
    parser.add_argument("--mode", choices=["fetch", "train", "predict"], default="predict",
                        help="Mode eksekusi (default: predict)")
    parser.add_argument("--start", default="2015-01-01", help="Awal data historis (mode fetch)")
    parser.add_argument("--end", default=datetime.now().strftime("%Y-%m-%d"), help="Akhir data historis (mode fetch)")
    parser.add_argument("--tune", action="store_true", help="Hyperparameter tuning saat training")
    parser.add_argument("--only-if-astronomical", action="store_true",
                        help="Keluar tanpa aksi kecuali hari ini dalam jendela pasang purnama/bulan baru (refresh sore ekstra)")
    args = parser.parse_args()

    if args.only_if_astronomical:
        import pandas as pd
        from files.feature_engineering import is_full_moon_period
        if not bool(is_full_moon_period(pd.Series([datetime.now()])).iloc[0]):
            print("[INFO] Hari ini di luar jendela pasang purnama/bulan baru â€” refresh sore dilewati.")
            return
        print("[INFO] Jendela pasang purnama/bulan baru aktif â€” menjalankan refresh ekstra.")

    if args.mode == "fetch":
        data_fetcher.fetch_all_historical(args.start, args.end)
        return

    try:
        conn = get_db_connection()
        print(f"[INFO] Terhubung ke database {DB_CONN} di {DB_HOST}:{DB_PORT}.")
    except Exception as error:
        print(f"[ERROR] Tidak bisa terhubung ke database: {error}")
        sys.exit(1)

    try:
        if args.mode == "train":
            run_train(conn, tune=args.tune)
        else:
            run_predict(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()


