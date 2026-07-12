<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ResearchDataRequest;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use App\Models\Dataset;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ResearchController
{
    public function datasets(): JsonResponse
    {
        return response()->json(['data' => Dataset::orderBy('name')->get()]);
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

        return response()->json([
            'data' => ['raw_key' => $rawKey],
            'raw_key' => $rawKey,
            'message' => 'API key dibuat. Salin sekarang karena nilai lengkap tidak akan ditampilkan lagi.',
        ], 201);
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
