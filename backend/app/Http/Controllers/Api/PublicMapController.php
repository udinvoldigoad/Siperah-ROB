<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\PredictionResource;
use App\Http\Resources\ReportResource;
use App\Http\Resources\RegionResource;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\GroundTruthReport;
use App\Models\TidalStation;
use App\Services\PredictionService;
use App\Services\RegionLocator;
use App\Services\RegionMonitoringService;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PublicMapController
{
    public function __construct(
        private readonly RegionLocator $regionLocator,
        private readonly PredictionService $predictionService,
        private readonly RegionMonitoringService $monitoring,
    ) {}

    public function map(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'regency' => ['nullable', 'string', 'max:100'],
            'date' => ['nullable', 'date'],
        ]);

        $query = Prediction::with('region')->orderByDesc('prediction_date');

        if (!empty($filters['regency'])) {
            $query->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency']));
        }

        if (!empty($filters['date'])) {
            $query->whereDate('prediction_date', $filters['date']);
        } else {
            $latestDate = (clone $query)
                ->whereDate('prediction_date', '>=', CarbonImmutable::today())
                ->min('prediction_date');
            $latestDate ??= (clone $query)->max('prediction_date');
            if ($latestDate) {
                $query->whereDate('prediction_date', $latestDate);
            }
        }

        $predictions = $query->limit(200)->get();
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
                        'risk_class' => $prediction->risk_class,
                        'risk_probability' => (float) $prediction->risk_probability,
                        'max_tidal_height' => (float) $prediction->max_tidal_height,
                        'peak_time' => $prediction->peak_time ? substr($prediction->peak_time, 0, 5) : null,
                        'prediction_date' => $prediction->prediction_date,
                        'provenance_status' => $prediction->provenance_status,
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
                'coordinates' => [(float) $report->longitude, (float) $report->latitude],
            ],
            'properties' => [
                'report_code' => $report->report_code,
                'severity' => $report->severity,
                'water_height_cm' => $report->water_height_cm,
                'incident_time' => optional($report->incident_time)->toIso8601String(),
                'location' => trim(implode(', ', array_filter([$report->region?->village, $report->region?->district, $report->region?->regency]))),
            ],
        ])->values();

        return response()->json([
            'data' => [
                'regions' => ['type' => 'FeatureCollection', 'features' => $regionFeatures],
                'reports' => ['type' => 'FeatureCollection', 'features' => $reportFeatures],
                'layers' => [
                    'tidal_stations' => $this->tidalStationFeatures(),
                    'coastlines' => $this->coastlineFeatures(),
                    'critical_infrastructure' => ['type' => 'FeatureCollection', 'features' => []],
                    'evacuation_routes' => ['type' => 'FeatureCollection', 'features' => []],
                ],
                'active_warning' => $this->activeWarning($predictions),
            ],
        ]);
    }

    private function tidalStationFeatures(): array
    {
        if (!Schema::hasTable('tidal_stations')) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

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
    }

    private function coastlineFeatures(): array
    {
        if (!Schema::hasTable('coastlines')) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

        try {
            $geometrySelect = Schema::hasColumn('coastlines', 'geometry')
                ? DB::raw('ST_AsGeoJSON(geometry) as geometry_json')
                : 'geometry_geojson as geometry_json';

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
        } catch (\Throwable) {
            $features = [];
        }

        return ['type' => 'FeatureCollection', 'features' => $features];
    }

    private function activeWarning($predictions): ?array
    {
        $critical = $predictions->filter(fn (Prediction $prediction) => $prediction->risk_class === 'sangat_tinggi');
        if ($critical->isEmpty()) {
            return null;
        }

        return [
            'type' => 'risk_threshold',
            'title' => 'Risiko sangat tinggi terdeteksi',
            'message' => $critical->count().' zona pantau berada pada kelas sangat tinggi. Pantau pembaruan BMKG dan laporan lapangan.',
            'affected_regencies' => $critical->pluck('region.regency')->filter()->unique()->values(),
            'source' => 'SIPERAH-RoB prediction',
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function regionGeometries(array $regionIds): array
    {
        if ($regionIds === []) {
            return [];
        }

        try {
            return DB::table('regions')
                ->whereIn('id', $regionIds)
                ->pluck(DB::raw('ST_AsGeoJSON(geometry)'), 'id')
                ->map(fn (string $geometry) => json_decode($geometry, true))
                ->filter()
                ->all();
        } catch (\Throwable) {
            return Region::whereIn('id', $regionIds)
                ->get(['id', 'geometry'])
                ->mapWithKeys(fn (Region $region) => [$region->id => $this->decodeGeometry($region->geometry)])
                ->filter()
                ->all();
        }
    }

    /** @return array<string, mixed>|null */
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

    public function predictions(Request $request)
    {
        $filters = $request->validate([
            'regency' => ['nullable', 'string', 'max:100'],
            'date' => ['nullable', 'date_format:Y-m-d'],
            'per_page' => ['nullable', 'integer', 'between:1,200'],
        ]);

        $query = Prediction::with('region')->orderBy('prediction_date', 'desc');

        if (!empty($filters['regency'])) {
            $query->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency']));
        }

        if (!empty($filters['date'])) {
            $query->whereDate('prediction_date', $filters['date']);
        }

        return PredictionResource::collection($query->paginate($filters['per_page'] ?? 200));
    }

    public function mapExport(Request $request): StreamedResponse
    {
        $filters = $request->validate([
            'regency' => ['nullable', 'string', 'max:100'],
            'date' => ['nullable', 'date_format:Y-m-d'],
        ]);

        $query = Prediction::with('region')->orderByDesc('prediction_date');

        if (!empty($filters['regency'])) {
            $query->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency']));
        }
        if (!empty($filters['date'])) {
            $query->whereDate('prediction_date', $filters['date']);
        }

        return response()->streamDownload(function () use ($query): void {
            $output = fopen('php://output', 'wb');
            fputcsv($output, ['Tanggal', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Kelas Risiko', 'Probabilitas', 'Tinggi Pasang Maks', 'Waktu Puncak', 'Model', 'Sumber'], ',', '"', '');
            foreach ($query->cursor() as $prediction) {
                fputcsv($output, [
                    optional($prediction->prediction_date)->toDateString(),
                    $prediction->region?->regency,
                    $prediction->region?->district,
                    $prediction->region?->village,
                    $prediction->risk_class,
                    $prediction->risk_probability,
                    $prediction->max_tidal_height,
                    $prediction->peak_time,
                    $prediction->model_version,
                    $prediction->data_source,
                ], ',', '"', '');
            }
            fclose($output);
        }, 'peta-risiko-banjir-rob.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }

    public function region(string $region): JsonResponse
    {
        $data = Region::findOrFail($region);
        return response()->json(['data' => new RegionResource($data)]);
    }

    public function resolveRegion(Request $request): JsonResponse
    {
        $coordinates = $request->validate([
            'lat' => ['required', 'numeric', 'between:-90,90'],
            'lon' => ['required', 'numeric', 'between:-180,180'],
        ]);
        $region = $this->regionLocator->locateAdministrative(
            (float) $coordinates['lat'],
            (float) $coordinates['lon'],
        );

        $data = null;
        if ($region) {
            $data = (new RegionResource($region))->resolve($request);
            $data['is_monitored'] = $this->monitoring->isPointMonitored(
                $region,
                (float) $coordinates['lat'],
                (float) $coordinates['lon'],
            );
        }

        return response()->json([
            'data' => $data,
            'message' => $region ? null : 'Koordinat berada di luar batas administrasi Lampung yang tersedia.',
        ]);
    }

    public function modeAwam(Request $request): JsonResponse
    {
        $coordinates = $request->validate([
            'lat' => ['nullable', 'numeric', 'between:-90,90', 'required_with:lon'],
            'lon' => ['nullable', 'numeric', 'between:-180,180', 'required_with:lat'],
        ]);
        $lat = $coordinates['lat'] ?? null;
        $lon = $coordinates['lon'] ?? null;

        $region = $this->regionLocator->locate(
            $lat === null ? null : (float) $lat,
            $lon === null ? null : (float) $lon,
        );

        if (!$region) {
            return response()->json([
                'data' => null,
                'message' => $lat !== null
                    ? 'Lokasi berada di luar cakupan wilayah pesisir yang dipantau.'
                    : 'Tidak ada data region.',
            ]);
        }

        $predictionData = $this->predictionService->sevenDayForecast($region->id);
        $prediction = $predictionData['current'];
        $forecast = $predictionData['forecast'];

        $nearby = GroundTruthReport::with(['region', 'photos'])
            ->where('status', 'divalidasi')
            ->when($lat !== null && $lon !== null && $this->regionLocator->supportsDistanceQueries(), fn ($query) => $query->whereRaw(
                'ST_DWithin(location::geography, ST_SetSRID(ST_MakePoint(?, ?), 4326)::geography, 5000)',
                [(float) $lon, (float) $lat],
            ))
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'region' => [
                    'id' => $region->id,
                    'village' => $region->village,
                    'district' => $region->district,
                    'regency' => $region->regency,
                    'provenance_status' => $region->provenance_status,
                    'data_source' => $region->data_source,
                ],
                'risk_class' => $prediction->risk_class ?? 'rendah',
                'risk_probability' => $prediction->risk_probability ?? 0,
                'max_tidal_height' => $prediction->max_tidal_height ?? 0,
                'peak_time' => $prediction?->peak_time ? substr($prediction->peak_time, 0, 5) : null,
                'forecast' => PredictionResource::collection($forecast),
                'nearby_reports' => ReportResource::collection($nearby),
            ],
        ]);
    }

    public function onboarding(): JsonResponse
    {
        return response()->json([
            'data' => [
                'topics' => ['banjir rob', 'klasifikasi risiko', 'cara melapor', 'FAQ'],
            ],
        ]);
    }
}
