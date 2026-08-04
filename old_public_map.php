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
use App\Support\AppTime;
use App\Support\CsvWriter;
use App\Support\ForecastWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
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

        // Payload berat (GeoJSON banyak wilayah + garis pantai); prediksi hanya
        // berubah sekali sehari, jadi cache singkat aman dan memangkas beban DB.
        $latestReportUpdate = GroundTruthReport::where('status', 'divalidasi')->max('updated_at');

        $payload = Cache::remember(
            'public-map:'.md5(json_encode($filters) . $latestReportUpdate),
            now()->addMinutes(15),
            fn (): array => $this->buildMapPayload($filters),
        );

        return response()->json(['data' => $payload]);
    }

    /** @return array<string, mixed> */
    private function buildMapPayload(array $filters): array
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
                // Peta publik tanpa login: koordinat dibulatkan 3 desimal (~110 m)
                // agar titik tidak menunjuk rumah pelapor. Selaras kebijakan API v1
                // dan ReportResource pada jalur publik.
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

    private function tidalStationFeatures(): array
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

    private function coastlineFeatures(): array
    {
        if (!Schema::hasTable('coastlines')) {
            return ['type' => 'FeatureCollection', 'features' => []];
        }

        return Cache::remember('public-map:coastlines', 60 * 60 * 24, function () {
            try {
                if ($this->usesPostgisGeometry('coastlines', 'geometry')) {
                    $geometrySelect = DB::raw('ST_AsGeoJSON(ST_SimplifyPreserveTopology(geometry, 0.0002), 5) as geometry_json');
                } elseif ($this->hasPostgis()) {
                    // Kolomnya jsonb, tetapi PostGIS tetap bisa menyederhanakannya on-the-fly.
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
            } catch (\Throwable) {
                $features = [];
            }

            return ['type' => 'FeatureCollection', 'features' => $features];
        });
    }

    private function activeWarning($predictions): ?array
    {
        // Utama: peringatan cuaca resmi BMKG (bukan derivasi prediksi sendiri).
        $bmkg = $this->bmkgWarning();
        if ($bmkg !== null) {
            return $bmkg;
        }

        // Sekunder: bila tak ada peringatan BMKG, tetap tandai zona risiko sangat
        // tinggi dari model ΓÇö dilabeli jelas sebagai prediksi internal.
        $critical = $predictions->filter(fn (Prediction $prediction) => $prediction->risk_class === 'sangat_tinggi');
        if ($critical->isEmpty()) {
            return null;
        }

        return [
            'type' => 'risk_threshold',
            'title' => 'Risiko rob sangat tinggi (prediksi model)',
            'message' => $critical->count().' zona pantau berada pada kelas sangat tinggi menurut model SAIBAR. Belum ada peringatan cuaca BMKG aktif.',
            'affected_regencies' => $critical->pluck('region.regency')->filter()->unique()->values(),
            'source' => 'SAIBAR prediction',
        ];
    }

    private function bmkgWarning(): ?array
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
        // Hitung kabupaten HANYA untuk kondisi terparah yang disebut ΓÇö tanpa
        // ini "Hujan lebat" di 1 kabupaten + hujan ringan di 7 lainnya tampil
        // sebagai "Hujan lebat di 8 kabupaten" (melebih-lebihkan sumber resmi).
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
                ? \Carbon\CarbonImmutable::parse($active->max('valid_until'))->toIso8601String()
                : null,
            'source' => 'BMKG prakiraan-cuaca',
        ];
    }

    /** @return array<string, array<string, mixed>> */
    private function regionGeometries(array $regionIds): array
    {
        if ($regionIds === []) {
            return [];
        }

        return Cache::remember('public-map:geometries:'.md5(json_encode($regionIds)), 60 * 60 * 24, function () use ($regionIds) {
            if ($this->usesPostgisGeometry('regions', 'geometry')) {
                // Simplifikasi ~22 m + presisi 5 desimal (~1 m): tak terlihat pada
                // zoom peta publik, tetapi memangkas ukuran GeoJSON belasan kali.
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
        } catch (\Throwable) {
            return false;
        }
    }

    private function hasPostgis(): bool
    {
        try {
            return DB::table('pg_extension')->where('extname', 'postgis')->exists();
        } catch (\Throwable) {
            return false;
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
            'per_page' => ['nullable', 'integer', 'between:1,1000'],
        ]);

        $query = Prediction::with('region')->orderBy('prediction_date', 'desc');

        if (!empty($filters['regency'])) {
            $query->whereHas('region', fn ($regions) => $regions->where('regency', $filters['regency']));
        }

        if (!empty($filters['date'])) {
            $query->whereDate('prediction_date', $filters['date']);
        } else {
            // Tanpa parameter tanggal, default ke prediksi TERDEKAT yang akan
            // datang (aturan yang sama dengan peta). Sebelumnya orderBy desc
            // tanpa filter membuat halaman pertama berisi H+30 ΓÇö konsumen
            // (mis. metrik OnboardingPage) menampilkannya sebagai "saat ini".
            $nearest = Prediction::whereDate('prediction_date', '>=', AppTime::today())
                ->min('prediction_date') ?: Prediction::max('prediction_date');
            if ($nearest) {
                $query->whereDate('prediction_date', $nearest);
            }
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
            CsvWriter::putRow($output, ['Tanggal', 'Kabupaten/Kota', 'Kecamatan', 'Desa/Kelurahan', 'Kelas Risiko', 'Probabilitas', 'Tinggi Pasang Maks', 'Waktu Puncak', 'Model', 'Sumber']);
            foreach ($query->cursor() as $prediction) {
                CsvWriter::putRow($output, [
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
                ]);
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

        $latitude = $lat === null ? null : (float) $lat;
        $longitude = $lon === null ? null : (float) $lon;
        $hasCoordinates = $latitude !== null && $longitude !== null;

        $region = $hasCoordinates
            ? $this->regionLocator->locateAdministrative($latitude, $longitude)
            : $this->regionLocator->locate(null, null);

        $isDummy = false;
        if (!$region) {
            // HANYA di environment local kita tampilkan data dummy (Region::first)
            // untuk pratinjau UI saat pengembang berada di luar Lampung. Di
            // testing/staging/production kita JUJUR: titik di luar data administrasi
            // Lampung tidak boleh disuguhi angka risiko yang dikarang.
            if (app()->environment('local')) {
                $region = \App\Models\Region::first();
                $isDummy = $region !== null;
            }

            if (!$region) {
                return response()->json([
                    'data' => null,
                    'message' => 'Lokasi yang dipilih belum ada di data administrasi Lampung. Coba geser pin ke daratan Lampung terdekat.',
                ]);
            }
        }

        $isMonitored = ($hasCoordinates && !$isDummy)
            ? $this->monitoring->isPointMonitored($region, $latitude, $longitude)
            : $this->monitoring->isMonitored($region);
        $predictionData = $this->predictionService->sevenDayForecast($region->id);
        $prediction = $predictionData['current'];
        $forecast = $predictionData['forecast'];
        $nearby = ($hasCoordinates && !$isDummy)
            ? $this->nearbyValidatedReports($latitude, $longitude)
            : GroundTruthReport::with(['region', 'photos'])
                ->where('status', 'divalidasi')
                ->where('region_id', $region->id)
                ->latest()
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
                'is_monitored' => $isMonitored,
                'monitoring_status' => $isMonitored ? 'inside_monitoring_area' : 'outside_monitoring_area',
                'status_label' => $isDummy ? 'Menampilkan data dummy (Lokasi Anda di luar Lampung)' : ($isMonitored ? 'Masuk wilayah pantauan rob' : 'Di luar wilayah pantauan prediksi rob'),
                'guidance_message' => $isDummy ? 'Lokasi Anda saat ini berada di luar wilayah administrasi Lampung. Menampilkan data dummy untuk keperluan pratinjau antarmuka.' : $this->modeAwamGuidanceMessage($isMonitored, $prediction?->risk_class),
                // null saat prediksi tidak tersedia ΓÇö frontend menampilkan
                // "Tidak tersedia", BUKAN default "rendah/0%" yang menenangkan
                // tanpa dasar data.
                'risk_class' => $prediction?->risk_class,
                'risk_probability' => $prediction?->risk_probability,
                'max_tidal_height' => $prediction?->max_tidal_height,
                'peak_time' => $prediction?->peak_time ? CarbonImmutable::parse($prediction->peak_time)->format('H:i') : null,
                'model_version' => $prediction?->model_version,
                'confidence_score' => $prediction?->confidence_score,
                'data_source' => $prediction?->data_source,
                // Tabel predictions tidak punya kolom created_at (timestamps=false);
                // kolom waktu yang benar adalah generated_at (string timestamptz).
                'generated_at' => $prediction?->generated_at
                    ? CarbonImmutable::parse($prediction->generated_at)->toIso8601String()
                    : null,
                // Status kesegaran prediksi: fresh | stale | unavailable.
                'prediction_status' => $predictionData['status'],
                'last_generated_at' => $predictionData['last_generated_at'],
                'prediction_notice' => $this->predictionNotice($predictionData['status'], $predictionData['last_generated_at']),
                'forecast' => PredictionResource::collection($forecast),
                'nearby_reports' => ReportResource::collection($nearby),
            ],
        ]);
    }


    /**
     * Prakiraan rob 30 hari se-provinsi, DIAGREGASI PER TANGGAL (30 baris).
     *
     * Dulu endpoint publik ini mengembalikan satu baris per kelurahan per hari
     * ΓÇö ~321 wilayah x 30 hari = ~9.600 baris tanpa pagination. Lebih buruk
     * lagi, tiap baris melewati RegionResource yang menghitung `is_monitored`
     * lewat `predictions()->exists()`, jadi satu permintaan anonim bisa memicu
     * ribuan query. Bentuk agregat ini sejalan dengan `trend_30_days` di
     * dashboard provinsi dan memang itu yang dibutuhkan sebuah "prakiraan
     * provinsi": ringkasan harian, bukan daftar tiap kelurahan.
     */
    public function provinceForecast(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'regency' => ['nullable', 'string', 'max:100'],
        ]);

        $window = ForecastWindow::thirtyDaysFrom(AppTime::today());
        $start = $window['start']->toDateString();
        $end = $window['end']->toDateString();

        // Satu baris per tanggal & tidak bergantung laporan warga, jadi aman
        // di-cache lebih lama daripada /public/map ΓÇö prediksi hanya berubah
        // sekali sehari saat pipeline ML jalan.
        $rows = Cache::remember(
            'public-province-forecast:'.md5(json_encode($filters).$start),
            now()->addMinutes(30),
            fn (): array => DB::table('predictions')
                ->join('regions', 'predictions.region_id', '=', 'regions.id')
                ->selectRaw("
                    predictions.prediction_date,
                    COUNT(DISTINCT predictions.region_id) AS region_count,
                    COUNT(DISTINCT CASE WHEN predictions.risk_class = 'sangat_tinggi' THEN predictions.region_id END) AS critical_count,
                    COUNT(DISTINCT CASE WHEN predictions.risk_class IN ('tinggi', 'sangat_tinggi') THEN predictions.region_id END) AS high_risk_count,
                    AVG(predictions.risk_probability) AS avg_probability,
                    MAX(predictions.risk_probability) AS max_probability
                ")
                ->whereBetween('predictions.prediction_date', [$start, $end])
                ->when(
                    !empty($filters['regency']),
                    fn ($query) => $query->where('regions.regency', $filters['regency']),
                )
                ->groupBy('predictions.prediction_date')
                ->orderBy('predictions.prediction_date')
                ->get()
                ->map(fn ($row): array => [
                    'prediction_date' => CarbonImmutable::parse($row->prediction_date)->toDateString(),
                    'region_count' => (int) $row->region_count,
                    'critical_count' => (int) $row->critical_count,
                    'high_risk_count' => (int) $row->high_risk_count,
                    'avg_probability' => round((float) $row->avg_probability, 2),
                    'max_probability' => round((float) $row->max_probability, 2),
                ])
                ->all(),
        );

        return response()->json([
            'data' => $rows,
            'meta' => [
                'start' => $start,
                'end' => $end,
                'regency' => $filters['regency'] ?? null,
                'days' => count($rows),
            ],
        ]);
    }

    private function nearbyValidatedReports(float $latitude, float $longitude)
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

    private function distanceMeters(float $fromLat, float $fromLon, float $toLat, float $toLon): float
    {
        $earthRadius = 6_371_000;
        $deltaLat = deg2rad($toLat - $fromLat);
        $deltaLon = deg2rad($toLon - $fromLon);
        $a = sin($deltaLat / 2) ** 2
            + cos(deg2rad($fromLat)) * cos(deg2rad($toLat)) * sin($deltaLon / 2) ** 2;

        return 2 * $earthRadius * atan2(sqrt($a), sqrt(1 - $a));
    }

    private function predictionNotice(string $status, ?string $lastGeneratedAt): ?string
    {
        if ($status === 'unavailable') {
            return 'Prediksi untuk hari ini belum tersedia. Pipeline mungkin sedang diperbarui ΓÇö tampilkan prakiraan terdekat yang ada sambil menunggu pembaruan.';
        }
        if ($status === 'stale') {
            $when = $lastGeneratedAt
                ? CarbonImmutable::parse($lastGeneratedAt)->timezone('Asia/Jakarta')->format('d M Y H:i')
                : null;

            return 'Prediksi belum diperbarui'.($when ? ' sejak '.$when.' WIB' : '').'. Angka di bawah adalah pembaruan terakhir, bukan hasil terbaru hari ini.';
        }

        return null;
    }

    private function modeAwamGuidanceMessage(bool $isMonitored, ?string $riskClass): string
    {
        if (!$isMonitored) {
            return 'Lokasi ini belum masuk area prediksi rob. Tetap waspada bila melihat genangan, dan laporan warga tetap bisa dikirim untuk ditinjau BPBD.';
        }

        return match ($riskClass) {
            'sangat_tinggi' => 'Risiko rob sangat tinggi. Hindari area rendah dekat pesisir, amankan barang penting, dan ikuti arahan BPBD.',
            'tinggi' => 'Risiko rob tinggi. Kurangi aktivitas di area rendah dekat pesisir dan pantau perubahan pasang.',
            'sedang' => 'Risiko rob sedang. Tetap pantau kondisi sekitar, terutama saat mendekati waktu puncak pasang.',
            'rendah' => 'Risiko rob rendah saat ini. Tetap cek pembaruan berkala dan laporkan jika melihat genangan.',
            // Tanpa prediksi (null) JANGAN mengklaim "rendah" ΓÇö itu pernyataan
            // aman yang tidak didukung data.
            default => 'Prediksi untuk wilayah ini belum tersedia. Tetap waspada saat pasang tinggi dan laporkan bila melihat genangan.',
        };
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
