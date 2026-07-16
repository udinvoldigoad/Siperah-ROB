<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

final class AuditRegionData extends Command
{
    protected $signature = 'data:audit-regions {--province=Lampung}';
    protected $description = 'Audit cakupan, provenance, kode, geometry, populasi, dan status pesisir wilayah';

    /** Kabupaten/kota pesisir resmi = 8 stasiun pipeline ML (ml-api/files/data_fetcher.py), keputusan 2026-07-16. */
    private const COASTAL_REGENCIES = [
        'Kota Bandar Lampung',
        'Lampung Selatan',
        'Pesawaran',
        'Tanggamus',
        'Pesisir Barat',
        'Lampung Timur',
        'Tulang Bawang',
        'Mesuji',
    ];

    public function handle(): int
    {
        $province = (string) $this->option('province');
        $base = DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province]);
        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();

        $metrics = [
            ['Total', (clone $base)->count()],
            ['Official', (clone $base)->where('provenance_status', 'official')->count()],
            ['Demo', (clone $base)->where('provenance_status', 'demo')->count()],
            ['Tanpa kode', (clone $base)->whereNull('region_code')->count()],
            ['Tanpa Geometri', (clone $base)->whereNull('geometry')->count()],
            ['Pesisir', (clone $base)->where('coastal_flag', true)->count()],
            ['Tanpa populasi', (clone $base)->whereNull('population')->count()],
            ['PostGIS', $postgis ? 'terpasang' : 'TIDAK terpasang (geometry text/WKT, validasi spasial dilewati)'],
        ];
        $this->table(['Metric', 'Count'], $metrics);

        $this->auditCoastalCoverage($base);
        $this->auditBoundaryStatus($base);
        $this->auditGeometryQuality($base, $postgis);

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

    private function auditCoastalCoverage(object $base): void
    {
        $rows = (clone $base)
            ->select('regency', DB::raw('COUNT(*) as total'), DB::raw('COUNT(*) FILTER (WHERE coastal_flag) as pesisir'))
            ->groupBy('regency')
            ->orderBy('regency')
            ->get()
            ->keyBy('regency');

        $this->info('Cakupan pesisir vs 8 kabupaten stasiun ML:');
        $table = [];
        foreach (self::COASTAL_REGENCIES as $regency) {
            $row = $rows->get($regency);
            $pesisir = $row->pesisir ?? 0;
            $table[] = [$regency, $row->total ?? 0, $pesisir, $pesisir > 0 ? 'OK' : 'KOSONG'];
        }
        $this->table(['Kab/Kota (stasiun ML)', 'Total wilayah', 'Pesisir', 'Status'], $table);

        $unexpected = $rows->except(self::COASTAL_REGENCIES)->filter(fn ($r) => $r->pesisir > 0);
        if ($unexpected->isNotEmpty()) {
            $this->warn('Kabupaten di luar 8 stasiun ML tetapi punya baris pesisir:');
            $this->table(['Kab/Kota', 'Pesisir'], $unexpected->map(fn ($r) => [$r->regency, $r->pesisir])->values()->all());
        }
    }

    private function auditBoundaryStatus(object $base): void
    {
        $rows = (clone $base)
            ->select(DB::raw("COALESCE(boundary_status, 'NULL') as status"), DB::raw('COUNT(*) as total'))
            ->groupBy('boundary_status')
            ->orderByDesc(DB::raw('COUNT(*)'))
            ->get();
        $this->info('Sebaran boundary_status:');
        $this->table(['boundary_status', 'Jumlah'], $rows->map(fn ($r) => [(string) $r->status, $r->total])->all());
    }

    private function auditGeometryQuality(object $base, bool $postgis): void
    {
        if ($postgis) {
            $invalid = (clone $base)->whereRaw('NOT ST_IsValid(geometry::geometry)')->count();
            $empty = (clone $base)->whereRaw('ST_IsEmpty(geometry::geometry)')->count();
            $this->info("Geometri invalid: {$invalid}, geometri kosong: {$empty} (via PostGIS).");

            return;
        }

        // Tanpa PostGIS: audit format penyimpanan. GeoJSON = batas asli BIG,
        // WKT kotak = placeholder demo, lainnya = perlu diperiksa manual.
        $geojson = (clone $base)->whereRaw("geometry ~ '^\\s*\\{'")->count();
        $wkt = (clone $base)->whereRaw("geometry ~ '^MULTIPOLYGON'")->count();
        $total = (clone $base)->whereNotNull('geometry')->count();
        $other = $total - $geojson - $wkt;
        $this->info("Format geometri: GeoJSON BIG={$geojson}, WKT placeholder demo={$wkt}, lainnya={$other} (total {$total}).");
        if ($wkt > 0 || $other > 0) {
            $this->warn('Baris WKT/lainnya bukan batas asli BIG - ganti via sinkronisasi BIG sebelum production.');
        }
    }
}
