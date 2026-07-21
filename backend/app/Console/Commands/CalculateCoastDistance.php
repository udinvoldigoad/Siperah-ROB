<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class CalculateCoastDistance extends Command
{
    protected $signature = 'data:calculate-coast-distance';
    protected $description = 'Menghitung jarak dari setiap desa pesisir ke garis pantai terdekat menggunakan PostGIS';

    public function handle(): int
    {
        $this->info('Menghitung jarak wilayah pesisir ke garis pantai (ST_Distance)...');

        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();

        if (!$postgis) {
            $this->error('Ekstensi PostGIS tidak ditemukan! Perhitungan jarak geometri presisi dibatalkan.');
            return self::FAILURE;
        }

        // To make it fast, we use the PostGIS spatial index operator (<->) in a CROSS JOIN LATERAL
        // which guarantees a K-Nearest Neighbor (KNN) index scan in O(log N).
        $sql = "
            UPDATE regions r
            SET 
                distance_to_coast_m = subquery.dist,
                updated_at = now()
            FROM (
                SELECT r2.id, c_closest.dist
                FROM regions r2
                CROSS JOIN LATERAL (
                    SELECT ST_Distance(r2.geometry::geography, c.geometry::geography) as dist
                    FROM coastlines c
                    ORDER BY c.geometry <-> r2.geometry
                    LIMIT 1
                ) AS c_closest
                WHERE r2.coastal_flag = true
            ) AS subquery
            WHERE r.id = subquery.id
        ";

        try {
            DB::statement($sql);
            
            $count = DB::table('regions')->where('coastal_flag', true)->whereNotNull('distance_to_coast_m')->count();
            $this->info("Berhasil menghitung dan memperbarui jarak untuk {$count} wilayah pesisir.");
            return self::SUCCESS;
        } catch (\Exception $e) {
            $this->error("Gagal menghitung jarak: " . $e->getMessage());
            return self::FAILURE;
        }
    }
}
