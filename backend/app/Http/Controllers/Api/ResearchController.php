<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ResearchDataRequest;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use App\Models\Dataset;
use App\Services\AuditService;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ResearchController
{
    public function __construct(private readonly AuditService $audit) {}

    public function datasets(Request $request): JsonResponse
    {
        $filters = $request->validate([
            'type' => ['nullable', 'string', 'max:80'],
            'search' => ['nullable', 'string', 'max:120'],
        ]);

        $query = Dataset::orderBy('name');
        if (!empty($filters['type'])) {
            $query->where('dataset_type', $filters['type']);
        }
        if (!empty($filters['search'])) {
            $query->where(function ($items) use ($filters): void {
                $items->where('name', 'like', "%{$filters['search']}%")
                    ->orWhere('description', 'like', "%{$filters['search']}%");
            });
        }

        return response()->json(['data' => $query->get()]);
    }

    public function apiKeys(Request $request)
    {
        return ApiKeyResource::collection(
            ApiKey::where('user_id', $request->user()->id)->latest()->paginate(20),
        );
    }

    public function regenerateKey(Request $request): JsonResponse
    {
        $user = $request->user();
        $rawKey = 'spr_'.Str::random(40);

        DB::transaction(function () use ($user, $rawKey): void {
            ApiKey::where('user_id', $user->id)
                ->where('status', 'aktif')
                ->update(['status' => 'nonaktif', 'revoked_at' => now()]);

            ApiKey::create([
                'id' => (string) Str::uuid(),
                'user_id' => $user->id,
                'key_hash' => hash('sha256', $rawKey),
                'key_prefix' => substr($rawKey, 0, 12).'...',
                'status' => 'aktif',
                'scopes' => ['predictions:read', 'reports:read', 'tidal:read'],
                'use_count' => 0,
            ]);
        });
        $this->audit->write($request, 'regenerate_api_key', 'success', "users:{$user->id}", [
            'scopes' => ['predictions:read', 'reports:read', 'tidal:read'],
        ]);

        return response()->json([
            'data' => ['raw_key' => $rawKey],
            'raw_key' => $rawKey,
            'message' => 'API key dibuat. Salin sekarang karena nilai lengkap tidak akan ditampilkan lagi.',
        ], 201);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json(['data' => [
            'dataset_count' => Dataset::count(),
            'total_records' => (int) Dataset::sum('record_count'),
            'downloads_this_month' => DB::table('audit_logs')
                ->where('action', 'api_key_request')
                ->where('outcome', 'success')
                ->where('created_at', '>=', now()->startOfMonth())
                ->count(),
            'api_calls_today' => DB::table('api_keys')
                ->where('user_id', $user->id)
                ->sum('use_count'),
            'active_api_keys' => ApiKey::where('user_id', $user->id)->where('status', 'aktif')->count(),
        ]]);
    }

    public function apiReference(): JsonResponse
    {
        return response()->json(['data' => [
            'base_path' => '/api/v1',
            'authentication' => [
                'header' => 'X-API-Key: spr_xxx',
                'alternative' => 'Authorization: ApiKey spr_xxx',
            ],
            'endpoints' => [
                [
                    'method' => 'GET',
                    'path' => '/predictions/daily',
                    'scope' => 'predictions:read',
                    'query' => ['from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'region' => 'uuid', 'format' => 'json|csv'],
                    'description' => 'Prediksi risiko harian per wilayah.',
                ],
                [
                    'method' => 'GET',
                    'path' => '/reports',
                    'scope' => 'reports:read',
                    'query' => ['from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'region' => 'uuid', 'format' => 'json|csv'],
                    'description' => 'Laporan ground truth yang telah divalidasi.',
                ],
                [
                    'method' => 'GET',
                    'path' => '/tidal',
                    'scope' => 'tidal:read',
                    'query' => ['station' => 'kode_stasiun', 'from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'format' => 'json|csv'],
                    'description' => 'Data pasang surut yang tersedia di sistem.',
                ],
            ],
            'license_note' => 'Dataset turunan mengikuti lisensi yang tercatat pada metadata dataset; data mentah mengikuti ketentuan sumber resmi.',
        ]]);
    }

    public function dailyPredictions(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select([
                'predictions.id', 'predictions.prediction_date', 'predictions.risk_probability',
                'predictions.risk_class', 'predictions.confidence_score', 'predictions.max_tidal_height',
                'predictions.peak_time', 'predictions.model_version', 'predictions.generated_at',
                'predictions.provenance_status', 'regions.region_code', 'regions.village',
                'regions.district', 'regions.regency',
            ])
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('prediction_date', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('prediction_date', '<=', $to))
            ->when($data['region'] ?? null, fn (Builder $q, string $region) => $q->where('predictions.region_id', $region))
            ->orderByDesc('prediction_date');

        return $this->exportOrPaginate($query, $data, 'daily_predictions.csv');
    }

    public function validatedReports(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = DB::table('ground_truth_reports as reports')
            ->join('regions', 'reports.region_id', '=', 'regions.id')
            ->where('reports.status', 'divalidasi')
            ->selectRaw(
                'reports.id, reports.report_code, regions.region_code, regions.village, regions.district, regions.regency,
                 ROUND(reports.latitude::numeric, 3) AS latitude_approx,
                 ROUND(reports.longitude::numeric, 3) AS longitude_approx,
                 reports.severity, reports.water_height_cm, reports.incident_time, reports.validated_at'
            )
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('reports.incident_time', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('reports.incident_time', '<=', $to))
            ->when($data['region'] ?? null, fn (Builder $q, string $region) => $q->where('reports.region_id', $region))
            ->orderByDesc('reports.incident_time');

        return $this->exportOrPaginate($query, $data, 'validated_reports.csv');
    }

    public function tidal(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = DB::table('tidal_data')
            ->leftJoin('tidal_stations', 'tidal_data.station_id', '=', 'tidal_stations.id')
            ->select([
                'tidal_data.id', 'tidal_stations.code as station_code', 'tidal_stations.name as station_name',
                'tidal_data.recorded_at', 'tidal_data.tidal_height', 'tidal_data.unit', 'tidal_data.datum',
                'tidal_data.data_type', 'tidal_data.event_type', 'tidal_data.source',
                'tidal_data.provenance_status', 'tidal_data.quality_status',
            ])
            ->when($data['station'] ?? null, fn (Builder $q, string $station) => $q->where('tidal_stations.code', $station))
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('recorded_at', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('recorded_at', '<=', $to))
            ->orderByDesc('recorded_at');

        return $this->exportOrPaginate($query, $data, 'tidal_data.csv');
    }

    private function exportOrPaginate(Builder $query, array $data, string $filename): JsonResponse|StreamedResponse
    {
        if (($data['format'] ?? 'json') === 'csv') {
            return response()->streamDownload(function () use ($query): void {
                $output = fopen('php://output', 'wb');
                $first = true;
                foreach ($query->cursor() as $row) {
                    $values = (array) $row;
                    if ($first) {
                        fputcsv($output, array_keys($values), ',', '"', '');
                        $first = false;
                    }
                    fputcsv($output, array_map($this->safeCsvValue(...), array_values($values)), ',', '"', '');
                }
                fclose($output);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        }

        /** @var LengthAwarePaginator $paginator */
        $paginator = $query->paginate($data['per_page'] ?? 100);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
            ],
        ]);
    }

    private function safeCsvValue(mixed $value): mixed
    {
        if (is_string($value) && preg_match('/^[=+\-@]/', $value)) {
            return "'{$value}";
        }

        return $value;
    }
}
