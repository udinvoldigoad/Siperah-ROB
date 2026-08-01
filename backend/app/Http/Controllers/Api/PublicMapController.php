<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\PredictionResource;
use App\Http\Resources\RegionResource;
use App\Http\Resources\ReportResource;
use App\Models\GroundTruthReport;
use App\Models\Prediction;
use App\Models\Region;
use App\Services\MapService;
use App\Services\PredictionService;
use App\Services\RegionLocator;
use App\Services\RegionMonitoringService;
use App\Support\AppTime;
use App\Support\CsvWriter;
use App\Support\ForecastWindow;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class PublicMapController
{
    public function __construct(
        private readonly MapService $map,
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

        $latestReportUpdate = GroundTruthReport::where('status', 'divalidasi')->max('updated_at');

        $payload = Cache::remember(
            'public-map:'.md5(json_encode($filters) . $latestReportUpdate),
            now()->addMinutes(15),
            fn (): array => $this->map->buildPayload($filters),
        );

        return response()->json(['data' => $payload])
            ->withHeaders(['Cache-Control' => 'public, max-age=300']);
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
            // datang (aturan yang sama dengan peta).
            $nearest = (clone $query)->whereDate('prediction_date', '>=', AppTime::today())
                ->min('prediction_date') ?: (clone $query)->max('prediction_date');
            if ($nearest) {
                $query->whereDate('prediction_date', $nearest);
            }
        }

        return PredictionResource::collection($query->paginate($filters['per_page'] ?? 200))
            ->response()
            ->withHeaders(['Cache-Control' => 'public, max-age=300']);
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
        return response()->json(['data' => new RegionResource($data)])
            ->withHeaders(['Cache-Control' => 'public, max-age=3600']);
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
        ])->withHeaders(['Cache-Control' => 'public, max-age=3600']);
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
            if (app()->environment('local')) {
                $region = Region::first();
                $isDummy = $region !== null;
            }

            if (!$region) {
                return response()->json([
                    'data' => null,
                    'message' => 'Lokasi yang dipilih belum ada di data administrasi Lampung. Coba geser pin ke daratan Lampung terdekat.',
                ])->withHeaders(['Cache-Control' => 'public, max-age=3600']);
            }
        }

        $isMonitored = ($hasCoordinates && !$isDummy)
            ? $this->monitoring->isPointMonitored($region, $latitude, $longitude)
            : $this->monitoring->isMonitored($region);
        $predictionData = $this->predictionService->sevenDayForecast($region->id);
        $prediction = $predictionData['current'];
        $forecast = $predictionData['forecast'];
        $nearby = ($hasCoordinates && !$isDummy)
            ? $this->map->nearbyValidatedReports($latitude, $longitude)
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
                'guidance_message' => $isDummy ? 'Lokasi Anda saat ini berada di luar wilayah administrasi Lampung. Menampilkan data dummy untuk keperluan pratinjau antarmuka.' : $this->map->modeAwamGuidanceMessage($isMonitored, $prediction?->risk_class),
                'risk_class' => $prediction?->risk_class,
                'risk_probability' => $prediction?->risk_probability,
                'max_tidal_height' => $prediction?->max_tidal_height,
                'peak_time' => $prediction?->peak_time ? CarbonImmutable::parse($prediction->peak_time)->format('H:i') : null,
                'model_version' => $prediction?->model_version,
                'confidence_score' => $prediction?->confidence_score,
                'data_source' => $prediction?->data_source,
                'generated_at' => $prediction?->generated_at
                    ? CarbonImmutable::parse($prediction->generated_at)->toIso8601String()
                    : null,
                'prediction_status' => $predictionData['status'],
                'last_generated_at' => $predictionData['last_generated_at'],
                'prediction_notice' => $this->map->predictionNotice($predictionData['status'], $predictionData['last_generated_at']),
                'forecast' => PredictionResource::collection($forecast),
                'nearby_reports' => ReportResource::collection($nearby),
            ],
        ]);
    }


    /**
     * Prakiraan rob 30 hari se-provinsi, DIAGREGASI PER TANGGAL (30 baris).
     *
     * Dulu endpoint publik ini mengembalikan satu baris per kelurahan per hari
     * — ~321 wilayah x 30 hari = ~9.600 baris tanpa pagination. Lebih buruk
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
        // di-cache lebih lama daripada /public/map — prediksi hanya berubah
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
        ])->withHeaders(['Cache-Control' => 'public, max-age=3600']);
    }

    public function onboarding(): JsonResponse
    {
        return response()->json([
            'data' => [
                'topics' => ['banjir rob', 'klasifikasi risiko', 'cara melapor', 'FAQ'],
            ],
        ])->withHeaders(['Cache-Control' => 'public, max-age=86400']);
    }
}
