<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ResearchDataRequest;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiKey;
use App\Models\Dataset;
use App\Services\AuditService;
use App\Support\CsvWriter;
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
            'year' => ['nullable', 'integer', 'between:2000,2100'],
            'regency' => ['nullable', 'string', 'max:100'],
            'per_page' => ['nullable', 'integer', 'between:1,100'],
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
        if (!empty($filters['year'])) {
            $yearStart = "{$filters['year']}-01-01";
            $yearEnd = "{$filters['year']}-12-31";
            $query->whereDate('period_start', '<=', $yearEnd)
                ->whereDate('period_end', '>=', $yearStart);
        }
        if (!empty($filters['regency'])) {
            // Dataset cocok bila mencakup kabupaten yang diminta ATAU bersifat provinsi (coverage kosong).
            $query->where(function ($items) use ($filters): void {
                $items->whereNull('coverage_regencies')
                    ->orWhereRaw('jsonb_array_length(coverage_regencies) = 0')
                    ->orWhereRaw('coverage_regencies @> ?::jsonb', [json_encode([$filters['regency']])]);
            });
        }

        $paginator = $query->paginate($filters['per_page'] ?? 10);

        return response()->json([
            'data' => $paginator->items(),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'last_page' => $paginator->lastPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'from' => $paginator->firstItem(),
                'to' => $paginator->lastItem(),
                'available_regencies' => $this->availableRegencies(),
            ],
        ]);
    }

    /** Daftar kabupaten/kota pesisir yang dipantau, untuk opsi filter dataset. */
    private function availableRegencies(): array
    {
        return DB::table('regions')
            ->whereNotNull('regency')
            ->where('coastal_flag', true)
            ->distinct()
            ->orderBy('regency')
            ->pluck('regency')
            ->values()
            ->all();
    }

    public function downloadDataset(Request $request, Dataset $dataset): JsonResponse|StreamedResponse
    {
        $data = $request->validate([
            'format' => ['nullable', 'in:json,csv'],
            'per_page' => ['nullable', 'integer', 'between:1,200'],
        ]);
        $data['format'] ??= 'json';

        [$query, $filename] = $this->queryForDataset($dataset);

        $this->audit->write($request, 'download_research_dataset', 'success', "datasets:{$dataset->id}", [
            'format' => $data['format'],
            'dataset_type' => $dataset->dataset_type,
        ]);

        return $this->exportOrPaginate($query, $data, $filename);
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
                ->where('action', 'download_research_dataset')
                ->where('outcome', 'success')
                ->where('created_at', '>=', now()->startOfMonth())
                ->count(),
            'api_calls_today' => DB::table('audit_logs')
                ->where('action', 'api_key_request')
                ->where('actor_user_id', $user->id)
                ->whereDate('created_at', now()->toDateString())
                ->count(),
            'active_api_keys' => ApiKey::where('user_id', $user->id)->where('status', 'aktif')->count(),
        ]]);
    }

    /**
     * Penggunaan API per endpoint selama 30 hari terakhir.
     * Sumber data: audit_logs (action=api_key_request) yang dicatat middleware AuthenticateApiKey.
     */
    public function usage(Request $request): JsonResponse
    {
        $user = $request->user();
        $since = now()->subDays(29)->startOfDay();

        $baseQuery = fn () => DB::table('audit_logs')
            ->where('action', 'api_key_request')
            ->where('actor_user_id', $user->id)
            ->where('created_at', '>=', $since);

        // Total per endpoint (30 hari)
        $perEndpoint = (clone $baseQuery())
            ->selectRaw("COALESCE(payload->>'endpoint', target_resource) AS endpoint")
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw("SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS success")
            ->selectRaw("SUM(CASE WHEN outcome <> 'success' THEN 1 ELSE 0 END) AS failed")
            ->groupByRaw("COALESCE(payload->>'endpoint', target_resource)")
            ->orderByDesc('total')
            ->get()
            ->map(fn ($row) => [
                'endpoint' => $row->endpoint ?? '(tidak diketahui)',
                'total' => (int) $row->total,
                'success' => (int) $row->success,
                'failed' => (int) $row->failed,
            ]);

        // Total per hari (untuk grafik tren)
        $perDay = (clone $baseQuery())
            ->selectRaw('CAST(created_at AS date) AS day')
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw("SUM(CASE WHEN outcome <> 'success' THEN 1 ELSE 0 END) AS failed")
            ->groupByRaw('CAST(created_at AS date)')
            ->orderBy('day')
            ->get()
            ->keyBy(fn ($row) => (string) $row->day);

        // Isi hari kosong dengan nol supaya grafik kontinu
        $series = [];
        for ($i = 0; $i < 30; $i++) {
            $date = now()->subDays(29 - $i)->toDateString();
            $row = $perDay->get($date);
            $series[] = [
                'day' => $date,
                'total' => $row ? (int) $row->total : 0,
                'failed' => $row ? (int) $row->failed : 0,
            ];
        }

        return response()->json(['data' => [
            'window_days' => 30,
            'since' => $since->toDateString(),
            'total_calls' => $perEndpoint->sum('total'),
            'per_endpoint' => $perEndpoint->values(),
            'per_day' => $series,
        ]]);
    }

    public function apiReference(): JsonResponse
    {
        return response()->json(['data' => [
            'base_path' => '/api',
            'authentication' => [
                'header' => 'X-API-Key: spr_xxx',
                'alternative' => 'Authorization: ApiKey spr_xxx',
            ],
            'rate_limit' => [
                'per_minute' => 120,
                'scope' => 'per API key',
                'headers' => ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
                'note' => 'Batas 120 permintaan/menit per API key. Lewat batas mengembalikan HTTP 429.',
            ],
            'error_format' => [
                'shape' => ['data' => null, 'message' => 'string penjelasan error'],
                'codes' => [
                    '401' => 'API key tidak dikirim / salah format (harus diawali spr_).',
                    '403' => 'API key valid tetapi tidak punya scope atau peran yang diperlukan.',
                    '422' => 'Parameter query tidak valid (mis. format tanggal salah).',
                    '429' => 'Melebihi batas rate limit.',
                ],
            ],
            'endpoints' => [
                [
                    'method' => 'GET',
                    'path' => '/predictions/daily',
                    'scope' => 'predictions:read',
                    'query' => ['from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'region' => 'uuid', 'format' => 'json|csv', 'per_page' => '1-200'],
                    'description' => 'Prediksi risiko harian per wilayah.',
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/predictions/daily?from=2026-05-01&to=2026-05-07&format=json\"",
                    'example_response' => [
                        'data' => [[
                            'id' => 'a1b2c3d4-...',
                            'prediction_date' => '2026-05-07',
                            'risk_probability' => 0.82,
                            'risk_class' => 'tinggi',
                            'confidence_score' => 0.76,
                            'max_tidal_height' => 1.42,
                            'peak_time' => '11:30:00',
                            'model_version' => 'v1.3.0',
                            'region_code' => '18.71.01.2001',
                            'village' => 'Kangkung',
                            'district' => 'Bumi Waras',
                            'regency' => 'Kota Bandar Lampung',
                        ]],
                        'meta' => ['current_page' => 1, 'last_page' => 3, 'per_page' => 100, 'total' => 254],
                    ],
                ],
                [
                    'method' => 'GET',
                    'path' => '/reports',
                    'scope' => 'reports:read',
                    'query' => ['from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'region' => 'uuid', 'format' => 'json|csv', 'per_page' => '1-200'],
                    'description' => 'Laporan ground truth yang telah divalidasi. Koordinat dibulatkan 3 desimal demi privasi pelapor.',
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/reports?from=2026-05-01&to=2026-05-31&format=json\"",
                    'example_response' => [
                        'data' => [[
                            'id' => 'e5f6a7b8-...',
                            'report_code' => 'RB-2026-0512',
                            'region_code' => '18.71.01.2001',
                            'village' => 'Kangkung',
                            'district' => 'Bumi Waras',
                            'regency' => 'Kota Bandar Lampung',
                            'latitude_approx' => -5.451,
                            'longitude_approx' => 105.283,
                            'severity' => 'sedang',
                            'water_height_cm' => 40,
                            'incident_time' => '2026-05-12T06:15:00+07:00',
                            'validated_at' => '2026-05-12T09:02:00+07:00',
                        ]],
                        'meta' => ['current_page' => 1, 'last_page' => 1, 'per_page' => 100, 'total' => 18],
                    ],
                ],
                [
                    'method' => 'GET',
                    'path' => '/tidal',
                    'scope' => 'tidal:read',
                    'query' => ['station' => 'kode_stasiun', 'from' => 'YYYY-MM-DD', 'to' => 'YYYY-MM-DD', 'format' => 'json|csv', 'per_page' => '1-200'],
                    'description' => 'Data pasang surut yang tersedia di sistem.',
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/tidal?station=PANJANG&from=2026-05-01&to=2026-05-02&format=json\"",
                    'example_response' => [
                        'data' => [[
                            'id' => 'c9d0e1f2-...',
                            'station_code' => 'PANJANG',
                            'station_name' => 'Stasiun Pasang Surut Panjang',
                            'recorded_at' => '2026-05-01T11:00:00+07:00',
                            'tidal_height' => 1.28,
                            'unit' => 'm',
                            'datum' => 'MSL',
                            'data_type' => 'observasi',
                            'source' => 'BIG',
                        ]],
                        'meta' => ['current_page' => 1, 'last_page' => 5, 'per_page' => 100, 'total' => 480],
                    ],
                ],
            ],
            'license_note' => 'Dataset turunan mengikuti lisensi yang tercatat pada metadata dataset; data mentah mengikuti ketentuan sumber resmi.',
        ]]);
    }

    public function dailyPredictions(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = $this->dailyPredictionsQuery()
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('prediction_date', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('prediction_date', '<=', $to))
            ->when($data['region'] ?? null, fn (Builder $q, string $region) => $q->where('predictions.region_id', $region))
            ->orderByDesc('prediction_date');

        return $this->exportOrPaginate($query, $data, 'daily_predictions.csv');
    }

    public function validatedReports(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = $this->validatedReportsQuery()
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('reports.incident_time', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('reports.incident_time', '<=', $to))
            ->when($data['region'] ?? null, fn (Builder $q, string $region) => $q->where('reports.region_id', $region))
            ->orderByDesc('reports.incident_time');

        return $this->exportOrPaginate($query, $data, 'validated_reports.csv');
    }

    public function tidal(ResearchDataRequest $request): JsonResponse|StreamedResponse
    {
        $data = $request->validated();
        $query = $this->tidalQuery()
            ->when($data['station'] ?? null, fn (Builder $q, string $station) => $q->where('tidal_stations.code', $station))
            ->when($data['from'] ?? null, fn (Builder $q, string $from) => $q->whereDate('recorded_at', '>=', $from))
            ->when($data['to'] ?? null, fn (Builder $q, string $to) => $q->whereDate('recorded_at', '<=', $to))
            ->orderByDesc('recorded_at');

        return $this->exportOrPaginate($query, $data, 'tidal_data.csv');
    }

    private function queryForDataset(Dataset $dataset): array
    {
        $type = mb_strtolower($dataset->dataset_type);

        if (str_contains($type, 'tidal') || str_contains($type, 'pasang')) {
            return [$this->tidalQuery()->orderByDesc('recorded_at'), 'tidal_data.csv'];
        }

        if (str_contains($type, 'ground truth') || str_contains($type, 'report')) {
            return [$this->validatedReportsQuery()->orderByDesc('reports.incident_time'), 'validated_reports.csv'];
        }

        return [$this->dailyPredictionsQuery()->orderByDesc('prediction_date'), 'daily_predictions.csv'];
    }

    private function dailyPredictionsQuery(): Builder
    {
        return DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select([
                'predictions.id', 'predictions.prediction_date', 'predictions.risk_probability',
                'predictions.risk_class', 'predictions.confidence_score', 'predictions.max_tidal_height',
                'predictions.peak_time', 'predictions.model_version', 'predictions.generated_at',
                'predictions.provenance_status', 'regions.region_code', 'regions.village',
                'regions.district', 'regions.regency',
            ]);
    }

    private function validatedReportsQuery(): Builder
    {
        return DB::table('ground_truth_reports as reports')
            ->join('regions', 'reports.region_id', '=', 'regions.id')
            ->where('reports.status', 'divalidasi')
            ->selectRaw(
                'reports.id, reports.report_code, regions.region_code, regions.village, regions.district, regions.regency,
                 ROUND(reports.latitude, 3) AS latitude_approx,
                 ROUND(reports.longitude, 3) AS longitude_approx,
                 reports.severity, reports.water_height_cm, reports.incident_time, reports.validated_at'
            );
    }

    private function tidalQuery(): Builder
    {
        return DB::table('tidal_data')
            ->leftJoin('tidal_stations', 'tidal_data.station_id', '=', 'tidal_stations.id')
            ->select([
                'tidal_data.id', 'tidal_stations.code as station_code', 'tidal_stations.name as station_name',
                'tidal_data.recorded_at', 'tidal_data.tidal_height', 'tidal_data.unit', 'tidal_data.datum',
                'tidal_data.data_type', 'tidal_data.event_type', 'tidal_data.source',
                'tidal_data.provenance_status', 'tidal_data.quality_status',
            ]);
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
                        CsvWriter::putRow($output, array_keys($values));
                        $first = false;
                    }
                    CsvWriter::putRow($output, array_values($values));
                }
                fclose($output);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        } elseif (($data['format'] ?? 'json') === 'xlsx') {
            $xlsxFilename = str_replace('.csv', '.xlsx', $filename);
            return response()->streamDownload(function () use ($query): void {
                $writer = \Spatie\SimpleExcel\SimpleExcelWriter::stream('php://output', 'xlsx');
                foreach ($query->cursor() as $row) {
                    $writer->addRow((array) $row);
                }
                $writer->close();
            }, $xlsxFilename, ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
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
}
