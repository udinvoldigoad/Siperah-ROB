"""
import_worldpop_population.py
Isi regions.population dari raster resmi WorldPop 2020 (UN-adjusted,
constrained 100 m) lewat zonal statistics per poligon kelurahan/desa BIG.

Sumber data (publik, CC BY 4.0, standar di analisis kebencanaan):
  https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/2020/BSGM/IDN/
  File: idn_ppp_2020_UNadj_constrained.tif  (unduh dulu ke data/raw/)

Aturan provenance:
- population_provenance_status = 'estimated' (estimasi ilmiah, BUKAN angka BPS
  resmi â€” impor BPS via `php artisan data:import-population` menimpanya dan
  menandai 'official').
- Baris berstatus 'official' TIDAK PERNAH ditimpa skrip ini.
- Setiap run tercatat di data_import_runs (dataset_type='population').

Pakai:  python import_worldpop_population.py [--dry-run] [--coastal-only]
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import uuid
from datetime import datetime
from pathlib import Path

import numpy as np
import psycopg2
import rasterio
from dotenv import load_dotenv
from rasterio.features import geometry_mask
from rasterio.windows import from_bounds
from shapely.geometry import shape

BASE_DIR = Path(__file__).resolve().parent
RASTER_PATH = BASE_DIR / "data" / "raw" / "idn_ppp_2020_UNadj_constrained.tif"
SOURCE_NAME = "WorldPop 2020 UN-adjusted constrained 100m (zonal per poligon BIG)"
SOURCE_REF = ("https://data.worldpop.org/GIS/Population/Global_2000_2020_Constrained/"
              "2020/BSGM/IDN/idn_ppp_2020_UNadj_constrained.tif")

load_dotenv(dotenv_path=BASE_DIR.parent / "backend" / ".env")


def get_conn():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "127.0.0.1"),
        port=int(os.getenv("DB_PORT", "5432")),
        database=os.getenv("DB_DATABASE", "saibar"),
        user=os.getenv("DB_USERNAME", "postgres"),
        password=os.getenv("DB_PASSWORD", ""),
        connect_timeout=20,
    )


def zonal_population(src: rasterio.DatasetReader, geom) -> int | None:
    """Jumlah populasi piksel WorldPop di dalam poligon (nodata diabaikan)."""
    minx, miny, maxx, maxy = geom.bounds
    window = from_bounds(minx, miny, maxx, maxy, src.transform)
    window = window.round_offsets().round_lengths()
    if window.width <= 0 or window.height <= 0:
        return None
    data = src.read(1, window=window, boundless=True, fill_value=src.nodata or -99999)
    transform = src.window_transform(window)
    mask = geometry_mask([geom.__geo_interface__], out_shape=data.shape,
                         transform=transform, invert=True, all_touched=False)
    values = data[mask]
    if src.nodata is not None:
        values = values[values != src.nodata]
    values = values[values > 0]
    if values.size == 0:
        # Poligon lebih kecil dari 1 piksel ATAU tanpa permukiman terdeteksi:
        # coba lagi dengan all_touched agar desa mungil tetap dapat nilai.
        mask = geometry_mask([geom.__geo_interface__], out_shape=data.shape,
                             transform=transform, invert=True, all_touched=True)
        values = data[mask]
        if src.nodata is not None:
            values = values[values != src.nodata]
        values = values[values > 0]
    return int(round(float(values.sum()))) if values.size else 0


def main() -> None:
    parser = argparse.ArgumentParser(description="Impor populasi WorldPop per kelurahan")
    parser.add_argument("--dry-run", action="store_true", help="Hitung tanpa menulis DB")
    parser.add_argument("--coastal-only", action="store_true", help="Hanya wilayah coastal_flag=true")
    args = parser.parse_args()

    if not RASTER_PATH.exists():
        print(f"[ERROR] Raster tidak ditemukan: {RASTER_PATH}\n"
              f"        Unduh dulu dari: {SOURCE_REF}")
        sys.exit(1)

    conn = get_conn()
    cur = conn.cursor()
    where = "geometry IS NOT NULL"
    if args.coastal_only:
        where += " AND coastal_flag = true"
    cur.execute(f"""
        SELECT id, village, regency, ST_AsGeoJSON(geometry, 6),
               COALESCE(population_provenance_status, '')
        FROM regions WHERE {where}
    """)
    rows = cur.fetchall()
    print(f"[INFO] {len(rows)} wilayah dengan geometri akan dihitung "
          f"({'pesisir saja' if args.coastal_only else 'semua'}).")

    run_id = str(uuid.uuid4())
    if not args.dry_run:
        cur.execute(
            """INSERT INTO data_import_runs
               (id, source, dataset_type, status, source_reference, started_at)
               VALUES (%s, %s, 'population', 'running', %s, now())""",
            (run_id, SOURCE_NAME, SOURCE_REF),
        )
        conn.commit()

    updated = skipped_official = failed = zero_pop = 0
    with rasterio.open(RASTER_PATH) as src:
        for index, (region_id, village, regency, geojson, provenance) in enumerate(rows, 1):
            if provenance == "official":
                skipped_official += 1
                continue
            try:
                geom = shape(json.loads(geojson))
                population = zonal_population(src, geom)
            except Exception as error:  # noqa: BLE001 â€” satu poligon rusak jangan mematikan run
                print(f"[WARNING] {village}/{regency}: {error}")
                failed += 1
                continue
            if population is None:
                failed += 1
                continue
            if population == 0:
                zero_pop += 1
            if not args.dry_run:
                cur.execute(
                    """UPDATE regions SET population = %s, population_source = %s,
                       population_source_reference = %s, population_provenance_status = 'estimated',
                       updated_at = now() WHERE id = %s""",
                    (population, SOURCE_NAME, SOURCE_REF, region_id),
                )
            updated += 1
            if index % 200 == 0:
                if not args.dry_run:
                    conn.commit()
                print(f"[INFO] {index}/{len(rows)} diproses...")

    if not args.dry_run:
        conn.commit()
        cur.execute(
            """UPDATE data_import_runs SET status='completed', fetched_count=%s,
               valid_count=%s, inserted_count=%s, invalid_count=%s,
               error_summary=%s, completed_at=now() WHERE id=%s""",
            (len(rows), updated, updated, failed,
             json.dumps({"skipped_official": skipped_official, "zero_population": zero_pop,
                         "generated_at": datetime.now().isoformat()}),
             run_id),
        )
        conn.commit()

    cur.close()
    conn.close()
    print(f"[SUCCESS] {updated} wilayah terisi populasi ({zero_pop} bernilai 0/"
          f"tanpa permukiman terdeteksi), {skipped_official} dilewati (official BPS), "
          f"{failed} gagal. Mode: {'DRY-RUN' if args.dry_run else 'tulis DB'}.")


if __name__ == "__main__":
    main()


