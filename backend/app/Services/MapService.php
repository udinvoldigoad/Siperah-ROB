<?php

namespace App\Services;

use App\Models\GroundTruthReport;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\TidalStation;
use App\Support\AppTime;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

final class MapService
{
    public function __construct(
        private readonly RegionLocator $regionLocator,
    ) {}

    public function buildPayload(array $filters): array
    {
        $query = Prediction::with('region')->orderByDesc('prediction_date');

        if (!empty($filters['regency'])) {
            $query->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency']));
        }

        if (!empty($filters['date'])) {
            $query->whereDate('prediction_date', $filters['date']);
        } else {
            $latestDate = (clone $query)
                ->whereDate('prediction_date', '>=', AppTime::today())
                ->min('prediction_date');
            $latestDate ??= (clone $query)->max('prediction_date');
            if ($latestDate) {
                $query->whereDate('prediction_date', $latestDate);
            }
        }

        $predictions = $query->get();
        $regionIds = $predictions->pluck('region_id')->filter()->unique()->values();
        $geometries = $this->regionGeometries($regionIds->all());

        $regionFeatures = $predictions
            ->filter(fn (Prediction $prediction) => $prediction->region && isset($geometries[$prediction->region_id]))
            ->map(function (Prediction $prediction) use ($geometries): array {
                $region = $prediction->region;
                return [
                    'type' => 'Feature',
                    'id' => $region->id,
                    'geometry' => $geometries[$region->id],
                    'properties' => [
                        'region_id' => $region->id,
                        'village' => $region->village,
                        'district' => $region->district,
                        'regency' => $region->regency,
                        'population' => $region->population,
                        'risk_class' => $prediction->risk_class,
                        'risk_probability' => (float) $prediction->risk_probability,
                        'max_tidal_height' => (float) $prediction->max_tidal_height,
                        'peak_time' => $prediction->peak_time ? substr($prediction->peak_time, 0, 5) : null,
                        'prediction_date' => $prediction->prediction_date,
                        'generated_at' => $prediction->generated_at,
                        'provenance_status' => $prediction->provenance_status,
                        'boundary_status' => $region->boundary_status,
                        'data_source' => $prediction->data_source,
                    ],
                ];
            })->values();

        $reports = GroundTruthReport::with('region')
            ->where('status', 'divalidasi')
            ->when(!empty($filters['regency']), fn ($items) => $items->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency'])))
            ->latest()
            ->limit(100)
            ->get();

        $reportFeatures = $reports->map(fn (GroundTruthReport $report): array => [
            'type' => 'Feature',
            'id' => $report->id,
            'geometry' => [
                'type' => 'Point',
                'coordinates' => [round((float) $report->longitude, 3), round((float) $report->latitude, 3)],
            ],
            'properties' => [
                'report_code' => $report->report_code,
                'severity' => $report->severity,
                'water_height_cm' => $report->water_height_cm,
                'incident_time' => optional($report->incident_time)->toIso8601String(),
                'location' => trim(implode(', ', array_filter([$report->region?->village, $report->region?->district, $report->region?->regency]))),
            ],
        ])->values();

        $lastGenerated = $predictions->max('generated_at');
        $lastGeneratedAt = $lastGenerated ? CarbonImmutable::parse($lastGenerated) : null;
        $isStale = $lastGeneratedAt !== null && $lastGeneratedAt->diffInHours(now()) > 30;

        return [
            'regions' => ['type' => 'FeatureCollection', 'features' => $regionFeatures->all()],
            'reports' => ['type' => 'FeatureCollection', 'features' => $reportFeatures->all()],
            'layers' => [
                'tidal_stations' => $this->tidalStationFeatures(),
                'coastlines' => $this->coastlineFeatures(),
                'critical_infrastructure' => ['type' => 'FeatureCollection', 'features' => []],
                'evacuation_routes' => ['type' => 'FeatureCollection', 'features' => []],
            ],
            'active_warning' => $this->activeWarning($predictions),
            'data_freshness' => [
                'last_generated_at' => $lastGeneratedAt?->toIso8601String(),
                'is_stale' => $isStale,
                'notice' => $isStale
                    ? 'Data prediksi belum diperbarui '.$lastGeneratedAt->timezone('Asia/Jakarta')->diffForHumans().'. Menampilkan pembaruan terakhir.'
                    : null,
            ],
        ];
    }

    public function regionGeometries(array $regionIds): array
    {
        if ($regionIds === []) {
            return [];
        }

        return Cache::remember('public-map:geometries:'.md5(json_encode($regionIds)), 60 * 60 * 24, function () use ($regionIds) {
            if ($this->usesPostgisGeometry('regions', 'geometry')) {
                return DB::table('regions')
                    ->whereIn('id', $regionIds)
                    ->select('id', DB::raw('ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0002), 5) as geojson'))
                    ->pluck('geojson', 'id')
                    ->map(fn (string $geometry) => json_decode($geometry, true))
                    ->filter()
                    ->all();
            }

            return Region::whereIn('id', $regionIds)
                ->get(['id', 'geometry'])
                ->mapWithKeys(fn (Region $region) => [$region->id => $this->decodeGeometry($region->geometry)])
                ->filter()
                ->all();
        });
    }

    public function tidalStationFeatures(): array
    {
        if (!Schema::hasTable('tidal_stations')) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

        return Cache::remember('public-map:tidal-stations', 60 * 60 * 24, function () {
            $features = TidalStation::query()
                ->whereNotNull('latitude')
                ->whereNotNull('longitude')
                ->where('status', 'active')
                ->limit(50)
                ->get()
                ->map(fn (TidalStation $station): array => [
                    'type' => 'Feature',
                    'id' => $station->id,
                    'geometry' => [
                        'type' => 'Point',
                        'coordinates' => [(float) $station->longitude, (float) $station->latitude],
                    ],
                    'properties' => [
                        'code' => $station->code,
                        'name' => $station->name,
                        'source' => $station->source,
                        'provenance_status' => $station->provenance_status,
                        'coverage_radius_km' => $station->coverage_radius_km,
                    ],
                ])->values()->all();

            return ['type' => 'FeatureCollection', 'features' => $features];
        });
    }

    public function coastlineFeatures(): array
    {
        if (!Schema::hasTable('coastlines')) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

        return Cache::remember('public-map:coastlines', 60 * 60 * 24, function () {
            try {
                if ($this->usesPostgisGeometry('coastlines', 'geometry')) {
                    $geometrySelect = DB::raw('ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0002), 5) as geometry_json');
                } elseif ($this->hasPostgis()) {
                    $geometrySelect = DB::raw('ST_AsGeoJSON(ST_SimplifyPreserveTopology(ST_GeomFromGeoJSON(geometry_geojson::text), 0.0002), 5) as geometry_json');
                } else {
                    $geometrySelect = 'geometry_geojson as geometry_json';
                }

                $features = DB::table('coastlines')
                    ->select(['id', 'shoreline_type', 'source_year', 'source', 'source_reference', $geometrySelect])
                    ->limit(100)
                    ->get()
                    ->map(function ($row): ?array {
                        $geometry = is_string($row->geometry_json) ? json_decode($row->geometry_json, true) : $row->geometry_json;
                        if (!$geometry) {
                            return null;
                        }

                        return [
                            'type' => 'Feature',
                            'id' => $row->id,
                            'geometry' => $geometry,
                            'properties' => [
                                'shoreline_type' => $row->shoreline_type,
                                'source_year' => $row->source_year,
                                'source' => $row->source,
                                'source_reference' => $row->source_reference,
                            ],
                        ];
                    })
                    ->filter()
                    ->values()
                    ->all();
            } catch (\Throwable $e) {
                Log::warning('MapService: coastline geometries failed to load, falling back to empty set.', ['error' => $e->getMessage()]);
                $features = [];
            }

            return ['type' => 'FeatureCollection', 'features' => $features];
        });
    }

    public function activeWarning($predictions): ?array
    {
        $bmkg = $this->bmkgWarning();
        if ($bmkg !== null) {
            return $bmkg;
        }

        $critical = $predictions->filter(fn (Prediction $prediction) => $prediction->risk_class === 'sangat_tinggi');
        if ($critical->isEmpty()) {
            return null;
        }

        return [
            'type' => 'risk_threshold',
            'title' => 'Risiko rob sangat tinggi (prediksi model)',
            'message' => $critical->count().' zona pantau berada pada kelas sangat tinggi menurut model SIPERAH-RoB. Belum ada peringatan cuaca BMKG aktif.',
            'affected_regencies' => $critical->pluck('region.regency')->filter()->unique()->values(),
            'source' => 'SIPERAH-RoB prediction',
        ];
    }

    public function bmkgWarning(): ?array
    {
        if (!Schema::hasTable('weather_warnings')) {
            return null;
        }

        $active = DB::table('weather_warnings')
            ->where('valid_until', '>=', now())
            ->orderByRaw("CASE severity WHEN 'tinggi' THEN 2 ELSE 1 END DESC")
            ->orderBy('valid_from')
            ->get();

        if ($active->isEmpty()) {
            return null;
        }

        $regencies = $active->pluck('regency')->unique()->values();
        $topDesc = $active->first()->weather_desc;
        $topRegencies = $active->where('weather_desc', $topDesc)->pluck('regency')->unique()->values();

        return [
            'type' => 'bmkg_weather',
            'title' => 'Peringatan cuaca BMKG aktif',
            'message' => sprintf(
                '%s diprakirakan BMKG di %d kabupaten pesisir (a.l. %s). Waspadai potensi genangan rob saat pasang.',
                $topDesc,
                $topRegencies->count(),
                $topRegencies->take(3)->implode(', '),
            ),
            'affected_regencies' => $regencies,
            'valid_until' => optional($active->max('valid_until'))
                ? CarbonImmutable::parse($active->max('valid_until'))->toIso8601String()
                : null,
            'source' => 'BMKG prakiraan-cuaca',
        ];
    }

    public function nearbyValidatedReports(float $latitude, float $longitude)
    {
        if ($this->regionLocator->supportsDistanceQueries()) {
            return GroundTruthReport::with(['region', 'photos'])
                ->where('status', 'divalidasi')
                ->whereRaw(
                    'ST_DWithin(ST_SetSRID(ST_MakePoint(longitude, latitude), 4326)::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 5000)',
                    [$longitude, $latitude],
                )
                ->orderBy('created_at', 'desc')
                ->limit(5)
                ->get();
        }

        $radiusMeters = 5000;
        $latPadding = $radiusMeters / 111_320;
        $lonPadding = $radiusMeters / (111_320 * max(cos(deg2rad($latitude)), 0.01));

        return GroundTruthReport::with(['region', 'photos'])
            ->where('status', 'divalidasi')
            ->whereBetween('latitude', [$latitude - $latPadding, $latitude + $latPadding])
            ->whereBetween('longitude', [$longitude - $lonPadding, $longitude + $lonPadding])
            ->latest()
            ->limit(25)
            ->get()
            ->map(function (GroundTruthReport $report) use ($latitude, $longitude): GroundTruthReport {
                $report->distance_meters = $this->distanceMeters($latitude, $longitude, (float) $report->latitude, (float) $report->longitude);
                return $report;
            })
            ->filter(fn (GroundTruthReport $report) => $report->distance_meters <= $radiusMeters)
            ->sortBy('distance_meters')
            ->take(5)
            ->values();
    }

    public function predictionNotice(string $status, ?string $lastGeneratedAt): ?string
    {
        if ($status === 'unavailable') {
            return 'Prediksi untuk hari ini belum tersedia. Pipeline mungkin sedang diperbarui — tampilkan prakiraan terdekat yang ada sambil menunggu pembaruan.';
        }
        if ($status === 'stale') {
            $when = $lastGeneratedAt
                ? CarbonImmutable::parse($lastGeneratedAt)->timezone('Asia/Jakarta')->format('d M Y H:i')
                : null;

            return 'Prediksi belum diperbarui'.($when ? ' sejak '.$when.' WIB' : '').'. Angka di bawah adalah pembaruan terakhir, bukan hasil terbaru hari ini.';
        }

        return null;
    }

    public function modeAwamGuidanceMessage(bool $isMonitored, ?string $riskClass): string
    {
        if (!$isMonitored) {
            return 'Lokasi ini belum masuk area prediksi rob. Tetap waspada bila melihat genangan, dan laporan warga tetap bisa dikirim untuk ditinjau BPBD.';
        }

        return match ($riskClass) {
            'sangat_tinggi' => 'Risiko rob sangat tinggi. Hindari area rendah dekat pesisir, amankan barang penting, dan ikuti arahan BPBD.',
            'tinggi' => 'Risiko rob tinggi. Kurangi aktivitas di area rendah dekat pesisir dan pantau perubahan pasang.',
            'sedang' => 'Risiko rob sedang. Tetap pantau kondisi sekitar, terutama saat mendekati waktu puncak pasang.',
            'rendah' => 'Risiko rob rendah saat ini. Tetap cek pembaruan berkala dan laporkan jika melihat genangan.',
            default => 'Prediksi untuk wilayah ini belum tersedia. Tetap waspada saat pasang tinggi dan laporkan bila melihat genangan.',
        };
    }

    private function distanceMeters(float $fromLat, float $fromLon, float $toLat, float $toLon): float
    {
        $earthRadius = 6_371_000;
        $deltaLat = deg2rad($toLat - $fromLat);
        $deltaLon = deg2rad($toLon - $fromLon);
        $a = sin($deltaLat / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat)) * sin($deltaLon / 2) ** 2;

        return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function decodeGeometry(?string $geometry): ?array
    {
        if (!$geometry) {
            return null;
        }

        if (str_starts_with(ltrim($geometry), '{')) {
            $decoded = json_decode($geometry, true);
            return is_array($decoded) ? $decoded : null;
        }

        if (!preg_match('/^(MULTIPOLYGON|POLYGON)\s*\(\s*(.*)\s*\)$/i', $geometry, $matches)) return null;

        preg_match_all('/\(([^()]+)\)/', $matches[2], $rings);
        $coordinates = array_map(function (string $ring): array {
            return array_map(function (string $point): array {
                [$longitude, $latitude] = preg_split('/\s+/', trim($point));
                return [(float) $longitude, (float) $latitude];
            }, explode(',', trim($ring)));
        }, $rings[1]);

        if (strtoupper($matches[1]) === 'POLYGON') {
            return ['type' => 'Polygon', 'coordinates' => $coordinates];
        }

        return ['type' => 'MultiPolygon', 'coordinates' => array_map(fn (array $ring) => [$ring], $coordinates)];
    }

    private function usesPostgisGeometry(string $table, string $column): bool
    {
        try {
            return $this->hasPostgis()
                && DB::table('information_schema.columns')
                    ->where('table_schema', 'public')
                    ->where('table_name', $table)
                    ->where('column_name', $column)
                    ->where('udt_name', 'geometry')
                    ->exists();
        } catch (\Throwable $e) {
            Log::warning('MapService: geometry column check failed, assuming non-geometry.', ['error' => $e->getMessage()]);
            return false;
        }
    }

    private function hasPostgis(): bool
    {
        try {
            return DB::table('pg_extension')->where('extname', 'postgis')->exists();
        } catch (\Throwable $e) {
            Log::warning('MapService: PostGIS extension check failed, assuming not available.', ['error' => $e->getMessage()]);
            return false;
        }
    }
}
