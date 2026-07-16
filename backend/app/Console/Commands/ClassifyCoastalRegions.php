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

    private const GRID_CELL_DEG = 0.05;
    private const VERTEX_SAMPLING = 10; // vertex BIG rapat (~20 m); sampling tiap 10 titik masih < 250 m

    public function handle(): int
    {
        $distance = max(0, (int) $this->option('distance-meters'));
        $province = (string) $this->option('province');

        $postgis = (bool) DB::table('pg_extension')->where('extname', 'postgis')->exists();
        $regionsSpatial = $this->columnIsGeometry('regions', 'geometry');
        if ($postgis && $regionsSpatial) {
            return $this->classifyWithPostgis($province, $distance);
        }

        $this->warn('PostGIS tidak tersedia; memakai fallback Haversine dari coastlines.geometry_geojson (aproksimasi bounding box wilayah).');

        return $this->classifyWithHaversine($province, $distance);
    }

    private function classifyWithPostgis(string $province, int $distance): int
    {
        // Garis pantai: pakai kolom geometry bila ada; kalau tidak, bangun dari
        // jsonb geometry_geojson. Temp table + simplifikasi ringan + GIST index
        // supaya join spasial 2.6k wilayah x 757 garis tidak kena statement timeout.
        $coastExpr = $this->columnIsGeometry('coastlines', 'geometry')
            ? 'geometry'
            : 'ST_GeomFromGeoJSON(geometry_geojson::text)';

        DB::statement('DROP TABLE IF EXISTS coast_classify_tmp');
        DB::statement("CREATE TEMP TABLE coast_classify_tmp AS SELECT ST_Simplify({$coastExpr}, 0.0001) AS g FROM coastlines");
        DB::statement('CREATE INDEX coast_classify_tmp_gix ON coast_classify_tmp USING gist (g)');
        DB::statement('ANALYZE coast_classify_tmp');

        // Prefilter bbox (&& memakai GIST) sebelum uji jarak geography yang mahal.
        $bboxPad = max(0.002, $distance / 111_320 * 1.5);
        $matchSql = 'SELECT DISTINCT r.id FROM regions r JOIN coast_classify_tmp c
            ON r.geometry && ST_Expand(c.g, ?) AND ST_DWithin(r.geometry::geography, c.g::geography, ?)
            WHERE LOWER(r.province)=LOWER(?)';

        $perRegency = DB::select(
            "SELECT regency, count(*) n FROM regions WHERE id IN ({$matchSql}) GROUP BY regency ORDER BY regency",
            [$bboxPad, $distance, $province],
        );
        $total = array_sum(array_map(fn ($r) => (int) $r->n, $perRegency));

        $this->info("{$total} wilayah terklasifikasi pesisir (jarak {$distance} meter, PostGIS polygon asli).");
        $this->table(['Kab/Kota', 'Wilayah pesisir'], array_map(fn ($r) => [$r->regency, $r->n], $perRegency));

        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($province, $matchSql, $bboxPad, $distance): void {
            DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province])->update(['coastal_flag' => false]);
            DB::update(
                "UPDATE regions SET coastal_flag=true, updated_at=now() WHERE id IN ({$matchSql})",
                [$bboxPad, $distance, $province],
            );
        });
        $this->info('coastal_flag diperbarui.');

        return self::SUCCESS;
    }

    private function columnIsGeometry(string $table, string $column): bool
    {
        return (bool) DB::table('information_schema.columns')
            ->where('table_schema', 'public')
            ->where('table_name', $table)
            ->where('column_name', $column)
            ->where('udt_name', 'geometry')
            ->exists();
    }

    private function classifyWithHaversine(string $province, int $distanceMeters): int
    {
        $grid = $this->buildCoastlineGrid();
        if ($grid === []) {
            $this->error('Tabel coastlines kosong. Jalankan data:sync-big-coastlines terlebih dahulu.');

            return self::FAILURE;
        }

        $coastalIds = [];
        $perRegency = [];
        DB::table('regions')
            ->whereRaw('LOWER(province)=LOWER(?)', [$province])
            ->orderBy('id')
            ->select(['id', 'regency', 'geometry'])
            ->chunk(500, function ($rows) use (&$coastalIds, &$perRegency, $grid, $distanceMeters): void {
                foreach ($rows as $row) {
                    $bbox = $this->geometryBoundingBox((string) $row->geometry);
                    if ($bbox === null) {
                        continue;
                    }
                    if ($this->bboxNearCoastline($bbox, $grid, $distanceMeters)) {
                        $coastalIds[] = $row->id;
                        $perRegency[$row->regency] = ($perRegency[$row->regency] ?? 0) + 1;
                    }
                }
            });

        ksort($perRegency);
        $this->info(count($coastalIds) . " wilayah terklasifikasi pesisir (jarak {$distanceMeters} meter, fallback Haversine).");
        $this->table(['Kab/Kota', 'Wilayah pesisir'], collect($perRegency)->map(fn ($n, $k) => [$k, $n])->values()->all());

        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }

        DB::transaction(function () use ($province, $coastalIds): void {
            DB::table('regions')->whereRaw('LOWER(province)=LOWER(?)', [$province])->update(['coastal_flag' => false]);
            foreach (array_chunk($coastalIds, 500) as $chunk) {
                DB::table('regions')->whereIn('id', $chunk)->update(['coastal_flag' => true, 'updated_at' => now()]);
            }
        });
        $this->info('coastal_flag diperbarui.');

        return self::SUCCESS;
    }

    /**
     * Kumpulkan titik garis pantai ke grid derajat agar pencarian jarak tidak O(wilayah x titik).
     *
     * @return array<string, list<array{0: float, 1: float}>>
     */
    private function buildCoastlineGrid(): array
    {
        $grid = [];
        DB::table('coastlines')->select(['id', 'geometry_geojson'])->orderBy('id')->chunk(100, function ($rows) use (&$grid): void {
            foreach ($rows as $row) {
                $geo = json_decode((string) $row->geometry_geojson, true);
                $lines = match ($geo['type'] ?? null) {
                    'LineString' => [$geo['coordinates']],
                    'MultiLineString' => $geo['coordinates'],
                    default => [],
                };
                foreach ($lines as $line) {
                    $last = count($line) - 1;
                    foreach ($line as $i => $pt) {
                        if ($i % self::VERTEX_SAMPLING !== 0 && $i !== $last) {
                            continue;
                        }
                        $key = $this->gridKey((float) $pt[0], (float) $pt[1]);
                        $grid[$key][] = [(float) $pt[0], (float) $pt[1]];
                    }
                }
            }
        });

        return $grid;
    }

    private function gridKey(float $lon, float $lat): string
    {
        return (int) floor($lon / self::GRID_CELL_DEG) . ':' . (int) floor($lat / self::GRID_CELL_DEG);
    }

    /**
     * Kolom regions.geometry menyimpan dua format: GeoJSON (hasil sinkron BIG)
     * dan WKT MULTIPOLYGON (baris demo lama). Keduanya harus terbaca.
     *
     * @return array{0: float, 1: float, 2: float, 3: float}|null [minLon, minLat, maxLon, maxLat]
     */
    private function geometryBoundingBox(string $geometry): ?array
    {
        $geometry = ltrim($geometry);
        if (str_starts_with($geometry, '{')) {
            $geo = json_decode($geometry, true);
            $lons = [];
            $lats = [];
            $this->collectGeoJsonPoints($geo['coordinates'] ?? [], $lons, $lats);
            if ($lons === []) {
                return null;
            }

            return [min($lons), min($lats), max($lons), max($lats)];
        }

        if (!preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $geometry, $m, PREG_SET_ORDER)) {
            return null;
        }
        $lons = array_map(fn ($pair) => (float) $pair[1], $m);
        $lats = array_map(fn ($pair) => (float) $pair[2], $m);

        return [min($lons), min($lats), max($lons), max($lats)];
    }

    /**
     * @param list<float>|list<mixed> $coords
     * @param list<float> $lons
     * @param list<float> $lats
     */
    private function collectGeoJsonPoints(array $coords, array &$lons, array &$lats): void
    {
        if (isset($coords[0], $coords[1]) && is_numeric($coords[0]) && is_numeric($coords[1])) {
            $lons[] = (float) $coords[0];
            $lats[] = (float) $coords[1];

            return;
        }
        foreach ($coords as $inner) {
            if (is_array($inner)) {
                $this->collectGeoJsonPoints($inner, $lons, $lats);
            }
        }
    }

    /**
     * @param array{0: float, 1: float, 2: float, 3: float} $bbox
     * @param array<string, list<array{0: float, 1: float}>> $grid
     */
    private function bboxNearCoastline(array $bbox, array $grid, int $distanceMeters): bool
    {
        [$minLon, $minLat, $maxLon, $maxLat] = $bbox;
        $latPad = $distanceMeters / 111_320;
        $lonPad = $distanceMeters / (111_320 * max(0.2, cos(deg2rad(($minLat + $maxLat) / 2))));

        $cellMinX = (int) floor(($minLon - $lonPad) / self::GRID_CELL_DEG);
        $cellMaxX = (int) floor(($maxLon + $lonPad) / self::GRID_CELL_DEG);
        $cellMinY = (int) floor(($minLat - $latPad) / self::GRID_CELL_DEG);
        $cellMaxY = (int) floor(($maxLat + $latPad) / self::GRID_CELL_DEG);

        for ($x = $cellMinX; $x <= $cellMaxX; $x++) {
            for ($y = $cellMinY; $y <= $cellMaxY; $y++) {
                foreach ($grid["{$x}:{$y}"] ?? [] as [$lon, $lat]) {
                    // Jarak titik ke bbox: clamp titik ke sisi bbox terdekat lalu Haversine.
                    $nearLon = max($minLon, min($maxLon, $lon));
                    $nearLat = max($minLat, min($maxLat, $lat));
                    if ($this->haversineMeters($lat, $lon, $nearLat, $nearLon) <= $distanceMeters) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

    private function haversineMeters(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $r = 6_371_000;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLon / 2) ** 2;

        return 2 * $r * asin(min(1.0, sqrt($a)));
    }
}
