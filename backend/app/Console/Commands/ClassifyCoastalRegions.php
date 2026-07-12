<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class ClassifyCoastalRegions extends Command
{
    protected $signature = 'data:classify-coastal-regions
        {--distance-meters=1000 : Jarak maksimum polygon wilayah dari garis pantai}
        {--province=Lampung}
        {--dry-run}';
    protected $description = 'Klasifikasikan wilayah pesisir berdasarkan jarak ke garis pantai BIG';

    public function handle(): int
    {
        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        if (!$postgis || !\Illuminate\Support\Facades\Schema::hasColumn('coastlines', 'geometry')) {
            $this->error('Klasifikasi pesisir memerlukan PostGIS dan kolom geometry garis pantai. GeoJSON tetap dapat disinkronkan untuk validasi.');
            return self::FAILURE;
        }
        $distance = max(0, (int) $this->option('distance-meters'));
        $province = (string) $this->option('province');
        $count = DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province])
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('coastlines')->whereRaw(
                'ST_DWithin(regions.geometry::geography, coastlines.geometry::geography, ?)', [$distance]
            ))->count();

        $this->info("{$count} wilayah terklasifikasi pesisir (jarak {$distance} meter)." );
        if ($this->option('dry-run')) return self::SUCCESS;

        DB::transaction(function () use ($province, $distance): void {
            DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province])->update(['coastal_flag' => false]);
            DB::update(
                'UPDATE regions SET coastal_flag=true, updated_at=now() WHERE LOWER(province)=LOWER(?) AND EXISTS (
                 SELECT 1 FROM coastlines WHERE ST_DWithin(regions.geometry::geography, coastlines.geometry::geography, ?))',
                [$province, $distance],
            );
        });
        return self::SUCCESS;
    }
}
