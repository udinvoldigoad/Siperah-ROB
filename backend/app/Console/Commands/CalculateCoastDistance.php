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

        // We use geography for accurate distance in meters over the earth's surface.
        // We find the minimum distance to ANY coastline geometry.
        // To make it fast, we can use a lateral join or a subquery.
        $sql = "
            UPDATE regions r
            SET 
                distance_to_coast_m = (
                    SELECT MIN(ST_Distance(r.geometry::geography, c.geometry::geography))
                    FROM coastlines c
                ),
                updated_at = now()
            WHERE coastal_flag = true
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
