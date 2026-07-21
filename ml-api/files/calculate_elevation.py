import argparse
import sys
import os
import json
import logging
from pathlib import Path
import rasterio
from rasterio.mask import mask
import geopandas as gpd
from shapely.geometry import shape

from db import get_db_connection

logging.basicConfig(level=logging.INFO, format="[%(levelname)s] %(message)s")

DEM_PATH = Path(__file__).parent.parent / "data" / "LAMPUNG_DEMNAS.tif"

def main():
    parser = argparse.ArgumentParser(description="Calculate average elevation for coastal regions")
    parser.parse_args()

    if not DEM_PATH.exists():
        logging.error(f"File DEM Raster tidak ditemukan di {DEM_PATH}")
        logging.info("Harap unduh file GeoTIFF DEM untuk Lampung dan letakkan di folder 'data' dengan nama 'LAMPUNG_DEMNAS.tif'")
        # Untuk demo/dev, jika file tidak ada, kita bisa isi dengan nilai acak atau 0
        logging.warning("Menggunakan mode fallback (elevasi=2.5m) karena file DEM tidak ada.")
        fallback_mode = True
    else:
        fallback_mode = False

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        logging.info("Terkoneksi ke database.")
    except Exception as e:
        logging.error(f"Gagal koneksi DB: {e}")
        sys.exit(1)

    # Fetch coastal regions
    cursor.execute("SELECT id, ST_AsGeoJSON(geometry) as geojson FROM regions WHERE coastal_flag = true")
    regions = cursor.fetchall()

    if not regions:
        logging.info("Tidak ada wilayah pesisir yang ditemukan di database.")
        sys.exit(0)

    logging.info(f"Menghitung elevasi untuk {len(regions)} wilayah pesisir...")

    updates = []
    
    if not fallback_mode:
        with rasterio.open(DEM_PATH) as src:
            for row in regions:
                region_id = row['id']
                geom = json.loads(row['geojson'])
                
                try:
                    out_image, out_transform = mask(src, [geom], crop=True)
                    # out_image is a numpy array. nodata values might exist.
                    # Flatten and filter out nodata (usually very large negative numbers or defined in src.nodata)
                    nodata = src.nodata
                    if nodata is not None:
                        valid_data = out_image[out_image != nodata]
                    else:
                        valid_data = out_image
                    
                    if valid_data.size > 0:
                        avg_elev = float(valid_data.mean())
                        # If average elevation is ridiculously negative (ocean), cap it at 0
                        avg_elev = max(0.0, avg_elev)
                    else:
                        avg_elev = 0.0
                        
                    updates.append((avg_elev, region_id))
                except ValueError as e:
                    # Geometry might not overlap the raster
                    logging.warning(f"Region {region_id} tidak tumpang tindih dengan Raster DEM. Di-set ke 0.")
                    updates.append((0.0, region_id))
    else:
        for row in regions:
            updates.append((2.5, row['id']))

    if updates:
        cursor.executemany("UPDATE regions SET avg_elevation_m = %s WHERE id = %s", updates)
        conn.commit()
        logging.info(f"Berhasil memperbarui elevasi untuk {len(updates)} wilayah.")

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
