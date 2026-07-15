<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class AuditRegionData extends Command
{
    protected $signature = 'data:audit-regions {--province=Lampung}';
    protected $description = 'Audit cakupan, provenance, kode, geometry, populasi, dan status pesisir wilayah';

    public function handle(): int
    {
        $province = (string) $this->option('province');
        $base = DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province]);
        $metrics = [
            ['Total', (clone $base)->count()],
            ['Official', (clone $base)->where('provenance_status', 'official')->count()],
            ['Demo', (clone $base)->where('provenance_status', 'demo')->count()],
            ['Tanpa kode', (clone $base)->whereNull('region_code')->count()],
            ['Tanpa Geometri', (clone $base)->whereNull('geometry')->count()],
            ['Pesisir', (clone $base)->where('coastal_flag', true)->count()],
            ['Tanpa populasi', (clone $base)->whereNull('population')->count()],
        ];
        $this->table(['Metric', 'Count'], $metrics);

        $demo = (clone $base)->where('provenance_status', 'demo')
            ->get(['id', 'regency', 'district', 'village']);
        if ($demo->isNotEmpty()) {
            $this->warn('Wilayah demo yang belum cocok dengan kode BIG:');
            $this->table(['ID', 'Kab/Kota', 'Kecamatan', 'Desa/Kelurahan'], $demo->map(fn ($r) => (array) $r)->all());
        }

        $duplicates = (clone $base)
            ->select('regency', 'district', 'village', DB::raw('COUNT(*) as total'))
            ->groupBy('regency', 'district', 'village')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        if ($duplicates->isNotEmpty()) {
            $this->error('Ditemukan duplikasi nama kelurahan di kecamatan yang sama:');
            $this->table(['Kab/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Jumlah'], $duplicates->map(fn ($r) => (array) $r)->all());
        }

        return self::SUCCESS;
    }
}
