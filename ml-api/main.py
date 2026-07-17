"""
main.py -- Orkestrator pipeline ML prediksi banjir rob SIPERAH-RoB.

Mode CLI (Fase 3 roadmap):
  python main.py --mode fetch     Unduh data historis Open-Meteo -> data/raw/*.csv
  python main.py --mode train     Bangun fitur + label, latih model, simpan artefak
  python main.py --mode predict   Muat model, prakiraan 30 hari, tulis ke DB (default)

Tanpa argumen = predict (kompatibel dengan pemanggilan lama dari Laravel).
Jika model belum ada saat predict, training dijalankan otomatis terlebih dahulu.
"""

import argparse
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
DB_DATABASE = os.getenv("DB_DATABASE", "siperah_rob")
DB_USERNAME = os.getenv("DB_USERNAME", "root")
DB_PASSWORD = os.getenv("DB_PASSWORD", "")

# Offset datum pasut (cm). tidal_data internal memakai meter relatif MSL sensor;
# kalibrasikan terhadap datum ambang rob BIG bila sudah ada data resmi.
TIDE_DATUM_OFFSET_CM = float(os.getenv("ML_TIDE_DATUM_OFFSET_CM", 100))
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


def load_tide_model(conn):
    """Fit model harmonik dari tabel tidal_data; fallback simulasi bila kosong."""
    cursor = conn.cursor()
    cursor.execute("SELECT recorded_at, tidal_height FROM tidal_data ORDER BY recorded_at ASC")
    rows = cursor.fetchall()
    cursor.close()

    t0 = beta = None
    is_simulated = False
    if rows:
        df_tide = pd.DataFrame(rows, columns=["recorded_at", "tidal_height"])
        series = pd.to_datetime(df_tide["recorded_at"])
        if series.dt.tz is not None:
            series = series.dt.tz_convert("UTC").dt.tz_localize(None)
        df_tide["recorded_at"] = series
        # Kolom numeric Postgres tiba sebagai Decimal; lstsq butuh float murni.
        df_tide["tidal_height"] = pd.to_numeric(df_tide["tidal_height"], errors="coerce").astype(float)
        df_tide = df_tide.dropna(subset=["tidal_height"])
        t0, beta = fit_harmonic_model(df_tide)

    if t0 is None or beta is None:
        print("[INFO] Memakai model pasut fallback (simulasi).")
        t0 = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
        beta = np.array([0.6, 0.35, 0.12, 0.28, 0.08, 0.18, 0.06, 0.12, 0.04])
        is_simulated = True

    t0 = strip_timezone(t0.to_pydatetime() if isinstance(t0, pd.Timestamp) else t0)
    return t0, beta, is_simulated


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

def simulated_historical(days: int = 730) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Data cuaca/gelombang sintetis (fallback offline). Provenance: simulated."""
    print("[WARNING] Memakai data cuaca SIMULASI -- hanya untuk pengembangan/demo.")
    frames_w, frames_m = [], []
    dates = pd.date_range(end=datetime.now().date(), periods=days, freq="D")
    rng = np.random.default_rng(42)
    for key in data_fetcher.STATIONS:
        frames_w.append(pd.DataFrame({
            "date": dates.strftime("%Y-%m-%d"),
            "rainfall_mm": rng.gamma(0.9, 8.0, len(dates)).clip(0, 120),
            "wind_speed_ms": rng.uniform(1, 9, len(dates)),
            "wind_direction_deg": rng.uniform(0, 360, len(dates)),
            "pressure_hpa": rng.uniform(1005, 1015, len(dates)),
            "station": key,
        }))
        frames_m.append(pd.DataFrame({
            "date": dates.strftime("%Y-%m-%d"),
            "wave_height_max_m": rng.gamma(2.0, 0.35, len(dates)).clip(0.05, 4),
            "swell_wave_height_max_m": rng.gamma(2.0, 0.22, len(dates)).clip(0.02, 3),
            "station": key,
        }))
    return pd.concat(frames_w, ignore_index=True), pd.concat(frames_m, ignore_index=True)


def build_training_frame(conn, simulate: bool = False):
    """Gabungkan pasut (harmonik), cuaca, gelombang per stasiun + label."""
    if simulate:
        weather, marine = simulated_historical()
        data_source = "simulated"
    else:
        weather, marine = data_fetcher.load_cached_historical()
        if weather is None:
            print("[INFO] CSV historis belum ada -- mengunduh dari Open-Meteo...")
            weather, marine = data_fetcher.fetch_all_historical()
        data_source = "openmeteo_era5"

    t0, beta, tide_simulated = load_tide_model(conn)
    start = pd.to_datetime(weather["date"]).min()
    end = pd.to_datetime(weather["date"]).max() + timedelta(days=1)
    tide_daily = daily_max_tide_cm(t0, beta, start, end)

    frames = []
    for key in weather["station"].unique():
        w = weather[weather["station"] == key].copy()
        w["date"] = pd.to_datetime(w["date"])
        m = None
        if marine is not None and not marine.empty:
            m = marine[marine["station"] == key].copy()
            m["date"] = pd.to_datetime(m["date"])
            m = m.drop(columns=["station"])
        tide = tide_daily[["date", "tide_height_cm"]]
        features = feature_engineering.build_daily_features(tide, w.drop(columns=["station"]), m)
        features["station"] = key
        frames.append(features)

    df = pd.concat(frames, ignore_index=True)
    df = labeler.apply_proxy_labels(df)
    df = labeler.merge_ground_truth_labels(df, labeler.fetch_validated_report_dates(conn))
    print(f"[INFO] Dataset: {len(df)} baris fitur. Label: {labeler.label_summary(df)}")

    tide_stats = {
        "monthly_avg": tide_daily.assign(month=tide_daily["date"].dt.month)
                                  .groupby("month")["tide_height_cm"].mean().to_dict(),
        "p95": float(tide_daily["tide_height_cm"].quantile(0.95)),
    }
    return df, tide_stats, data_source, (t0, beta, tide_simulated)


def run_train(conn, simulate: bool = False, tune: bool = False):
    df, _, data_source, _ = build_training_frame(conn, simulate)
    if df["label_rob"].nunique() < 2:
        print("[ERROR] Semua label satu kelas -- model tidak bisa dilatih. "
              "Periksa ambang labeler (ML_TIDE_THRESHOLD_CM / ML_RAINFALL_THRESHOLD_MM) "
              "atau offset datum pasut (ML_TIDE_DATUM_OFFSET_CM).")
        sys.exit(1)
    train_df, _val_df, test_df = train_model.time_based_split(df)
    print(f"[INFO] Split: train={len(train_df)} val={len(_val_df)} test={len(test_df)}")
    model = train_model.train_random_forest(train_df, tune=tune)
    metrics = train_model.evaluate_model(model, test_df)
    metrics["data_source"] = data_source
    metrics["trained_rows"] = int(len(train_df))
    train_model.save_model(model, metrics)
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


def run_predict(conn, simulate: bool = False):
    cursor = conn.cursor()
    print("[INFO] Mengambil wilayah pesisir...")
    cursor.execute("SELECT id, regency, district, village FROM regions WHERE coastal_flag = true")
    regions = cursor.fetchall()
    print(f"[INFO] {len(regions)} wilayah pesisir ditemukan.")
    if not regions:
        print("[ERROR] Tidak ada wilayah pesisir. Jalankan migrasi/seeder backend dahulu.")
        sys.exit(1)

    model = train_model.load_model()
    if model is None:
        print("[INFO] Model tersimpan belum ada -- menjalankan training terlebih dahulu...")
        model = run_train(conn, simulate=simulate)

    # Pasang surut 30 hari ke depan (harmonik dari tidal_data)
    t0, beta, tide_simulated = load_tide_model(conn)
    today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0, tzinfo=None)
    tide_daily = daily_max_tide_cm(t0, beta, today, today + timedelta(days=31))
    tide_forecast = tide_daily.rename(columns={"tide_height_cm": "max_tide_height_cm"})

    # Statistik pasut (anomali/king tide) dari backcast 2 tahun agar konsisten training
    tide_hist = daily_max_tide_cm(t0, beta, today - timedelta(days=730), today)
    tide_stats = {
        "monthly_avg": tide_hist.assign(month=tide_hist["date"].dt.month)
                                 .groupby("month")["tide_height_cm"].mean().to_dict(),
        "p95": float(tide_hist["tide_height_cm"].quantile(0.95)),
    }

    # Prakiraan cuaca + gelombang per stasiun
    if simulate:
        forecasts = {}
        rng = np.random.default_rng()
        horizon = pd.date_range(today, periods=8, freq="D").strftime("%Y-%m-%d")
        for key in data_fetcher.STATIONS:
            forecasts[key] = {
                "weather": pd.DataFrame({"date": horizon,
                                          "rainfall_mm": rng.gamma(0.9, 8.0, len(horizon)).clip(0, 80),
                                          "wind_speed_ms": rng.uniform(1, 8, len(horizon)),
                                          "pressure_hpa": rng.uniform(1006, 1014, len(horizon))}),
                "marine": pd.DataFrame({"date": horizon,
                                         "wave_height_max_m": rng.gamma(2.0, 0.35, len(horizon)),
                                         "swell_wave_height_max_m": rng.gamma(2.0, 0.22, len(horizon))}),
            }
        weather_hist = marine_hist = None
        data_source = "MLPipeline-Simulated"
    else:
        print(f"[INFO] Mengambil prakiraan cuaca & gelombang ({WEATHER_SOURCE})...")
        forecasts = data_fetcher.fetch_daily_forecast_for_inference(days=8, weather_source=WEATHER_SOURCE)
        weather_hist, marine_hist = data_fetcher.load_cached_historical()
        data_source = "MLPipeline-OpenMeteo"
    if tide_simulated:
        data_source += "+SimTide"

    # Prediksi per stasiun (sekali per stasiun, dipakai semua region di dalamnya)
    station_results: dict[str, pd.DataFrame] = {}
    for key in data_fetcher.STATIONS:
        frames = forecasts.get(key, {})
        weather_fc = frames.get("weather", pd.DataFrame())
        if weather_fc is None or weather_fc.empty:
            print(f"[WARNING] Tidak ada prakiraan cuaca untuk stasiun {key} -- dilewati.")
            continue
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

    tide_lookup = tide_daily.set_index(tide_daily["date"].dt.date)
    generated_at = datetime.now()
    default_station = "bandar_lampung"
    written = 0
    pending_rows: list[tuple] = []
    station_hits: dict[str, int] = {}

    for region in regions:
        region_id, regency = region[0], region[1]
        station_key = labeler._normalize_regency(regency)
        if station_key not in station_results:
            station_key = default_station if default_station in station_results else next(iter(station_results))
        station_hits[station_key] = station_hits.get(station_key, 0) + 1
        result = station_results[station_key]

        for _, row in result.iterrows():
            pred_date = row["date"]
            if pred_date not in tide_lookup.index:
                continue
            tide_row = tide_lookup.loc[pred_date]

            raw_prob = round(max(max(2.0, (float(tide_row["tide_height_cm"]) - 100) / 10.0), min(98.0, float(row["prob_rob"]) * 100)), 2)
            
            try:
                contract = PredictionContract(
                    risk_probability=raw_prob,
                    risk_class=row["risk_class"],
                    confidence_score=float(row["confidence"]),
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
                "official" if not simulate else "demo",
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
    cursor.close()

    print(f"[SUCCESS] {written} prediksi ditulis/diperbarui "
          f"({len(station_results)} stasiun, pemetaan: {station_hits}).")
    print(f"[VERIFY] Total prediksi di DB mulai hari ini: {total} baris.")


def main():
    parser = argparse.ArgumentParser(description="Pipeline ML Prediksi Banjir Rob SIPERAH-RoB")
    parser.add_argument("--mode", choices=["fetch", "train", "predict"], default="predict")
    parser.add_argument("--start", default="2015-01-01", help="Awal data historis (mode fetch)")
    parser.add_argument("--end", default=datetime.now().strftime("%Y-%m-%d"), help="Akhir data historis (mode fetch)")
    parser.add_argument("--tune", action="store_true", help="Hyperparameter tuning saat training")
    parser.add_argument("--simulate", action="store_true",
                        help="Pakai data cuaca simulasi (offline/demo, provenance 'estimated')")
    parser.add_argument("--only-if-astronomical", action="store_true",
                        help="Keluar tanpa aksi kecuali hari ini dalam jendela pasang purnama/bulan baru (refresh sore ekstra)")
    args = parser.parse_args()

    if args.only_if_astronomical:
        import pandas as pd
        from files.feature_engineering import is_full_moon_period
        if not bool(is_full_moon_period(pd.Series([datetime.now()])).iloc[0]):
            print("[INFO] Hari ini di luar jendela pasang purnama/bulan baru — refresh sore dilewati.")
            return
        print("[INFO] Jendela pasang purnama/bulan baru aktif — menjalankan refresh ekstra.")

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
            run_train(conn, simulate=args.simulate, tune=args.tune)
        else:
            run_predict(conn, simulate=args.simulate)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
