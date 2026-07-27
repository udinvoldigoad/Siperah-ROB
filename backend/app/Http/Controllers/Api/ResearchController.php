<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\ResearchDataRequest;
use App\Http\Resources\ApiKeyResource;
use App\Models\ApiAccessRequest;
use App\Models\ApiKey;
use App\Models\Dataset;
use App\Services\AuditService;
use App\Support\AppTime;
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

        // REKAMAN dihitung langsung dari query data nyata (sama dengan yang
        // diekspor saat download), bukan kolom seeder statis — agar angka selalu
        // cocok dengan isi CSV/JSON yang bisa diunduh.
        $items = array_map(function (Dataset $dataset): Dataset {
            $dataset->record_count = $this->queryForDataset($dataset)[0]->count();

            return $dataset;
        }, $paginator->items());

        return response()->json([
            'data' => $items,
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
            'format' => ['nullable', 'in:json,csv,xlsx'],
            'per_page' => ['nullable', 'integer', 'between:1,200'],
        ]);
        $data['format'] ??= 'json';

        [$query, $filename] = $this->queryForDataset($dataset);

        $this->audit->write($request, 'download_research_dataset', 'success', "datasets:{$dataset->id}", [
            'format' => $data['format'],
            'dataset_type' => $dataset->dataset_type,
        ]);

        return $this->exportOrPaginate($query, $data, $filename, fullExport: true);
    }

    public function apiKeys(Request $request)
    {
        return ApiKeyResource::collection(
            ApiKey::where('user_id', $request->user()->id)->latest()->paginate(20),
        );
    }

    /**
     * Status permohonan izin akses API milik pengguna saat ini.
     *
     * Peneliti wajib memiliki izin berstatus "disetujui" sebelum bisa membuat
     * API key. Admin & BPBD Provinsi memakai API untuk tugas resmi sehingga
     * dibebaskan dari alur perizinan (can_generate_key selalu true).
     */
    public function apiAccessRequest(Request $request): JsonResponse
    {
        $user = $request->user();
        $latest = ApiAccessRequest::where('user_id', $user->id)->latest()->first();

        return response()->json([
            'data' => [
                'requires_permit' => $user->role === 'peneliti',
                'can_generate_key' => $this->canGenerateApiKey($user),
                'request' => $latest ? [
                    'id' => $latest->id,
                    'purpose' => $latest->purpose,
                    'organization' => $latest->organization,
                    'project_title' => $latest->project_title,
                    'status' => $latest->status,
                    'review_note' => $latest->review_note,
                    'reviewed_at' => optional($latest->reviewed_at)->toIso8601String(),
                    'created_at' => optional($latest->created_at)->toIso8601String(),
                ] : null,
            ],
        ]);
    }

    /**
     * Peneliti mengajukan izin akses API (menyertakan tujuan penggunaan).
     * Permohonan masuk berstatus "menunggu" untuk divalidasi admin.
     */
    public function storeApiAccessRequest(Request $request): JsonResponse
    {
        $user = $request->user();

        // Admin/BPBD Provinsi tak perlu mengajukan izin.
        abort_if($user->role !== 'peneliti', 403, 'Peran Anda sudah memiliki akses API tanpa perlu mengajukan izin.');

        $data = $request->validate([
            'purpose' => ['required', 'string', 'min:20', 'max:1000'],
            'organization' => ['nullable', 'string', 'max:150'],
            'project_title' => ['nullable', 'string', 'max:150'],
        ]);

        // Cegah pengajuan ganda: hanya boleh mengajukan lagi bila belum pernah
        // mengajukan atau permohonan terakhir ditolak.
        $latest = ApiAccessRequest::where('user_id', $user->id)->latest()->first();
        if ($latest && in_array($latest->status, ['menunggu', 'disetujui'], true)) {
            $message = $latest->status === 'menunggu'
                ? 'Permohonan Anda masih menunggu keputusan admin.'
                : 'Anda sudah memiliki izin akses API yang disetujui.';

            return response()->json(['data' => null, 'message' => $message], 422);
        }

        $permit = ApiAccessRequest::create([
            'id' => (string) Str::uuid(),
            'user_id' => $user->id,
            'purpose' => $data['purpose'],
            'organization' => $data['organization'] ?? $user->institution,
            'project_title' => $data['project_title'] ?? null,
            'status' => 'menunggu',
        ]);

        $this->audit->write($request, 'request_api_access', 'success', "api_access_requests:{$permit->id}", [
            'organization' => $permit->organization,
            'project_title' => $permit->project_title,
        ]);

        return response()->json([
            'data' => ['id' => $permit->id, 'status' => $permit->status],
            'message' => 'Permohonan izin akses API terkirim. Menunggu persetujuan admin.',
        ], 201);
    }

    /** Apakah pengguna boleh membuat API key (peneliti wajib izin disetujui). */
    private function canGenerateApiKey($user): bool
    {
        if ($user->role !== 'peneliti') {
            return true;
        }

        return ApiAccessRequest::where('user_id', $user->id)
            ->where('status', 'disetujui')
            ->exists();
    }

    public function regenerateKey(Request $request): JsonResponse
    {
        $user = $request->user();

        abort_unless(
            $this->canGenerateApiKey($user),
            403,
            'Anda harus mengajukan izin akses API dan menunggu persetujuan admin sebelum membuat kunci.',
        );

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

        // Batas "hari ini" & "bulan ini" mengikuti WIB lalu dikonversi ke UTC
        // karena kolom created_at disimpan UTC. Tanpa ini, panggilan pagi WIB
        // (mis. 06:00 = 23:00 UTC hari sebelumnya) terhitung ke hari yang keliru.
        $startOfTodayWib = AppTime::startOfDayUtc();
        $endOfTodayWib = AppTime::endOfDayUtc();
        $startOfMonthWib = AppTime::startOfMonthUtc();

        return response()->json(['data' => [
            'dataset_count' => Dataset::count(),
            // Jumlah rekaman nyata lintas dataset (count dari query data asli),
            // bukan penjumlahan kolom seeder statis.
            'total_records' => (int) Dataset::all()->sum(fn (Dataset $dataset): int => $this->queryForDataset($dataset)[0]->count()),
            'downloads_this_month' => DB::table('audit_logs')
                ->where('action', 'download_research_dataset')
                ->where('outcome', 'success')
                ->where('created_at', '>=', $startOfMonthWib)
                ->count(),
            'api_calls_today' => DB::table('audit_logs')
                ->where('action', 'api_key_request')
                ->where('actor_user_id', $user->id)
                ->whereBetween('created_at', [$startOfTodayWib, $endOfTodayWib])
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
        // Jendela & ember harian memakai hari kalender WIB, konsisten dengan
        // stats() di atas — kalau tidak, satu respons bisa memuat "hari ini"
        // versi WIB berdampingan dengan grafik ber-ember UTC.
        $firstDay = AppTime::today()->subDays(29);
        $since = AppTime::startOfDayUtc($firstDay->toDateString());

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

        // Total per hari (untuk grafik tren). Pengelompokan WAJIB lewat
        // sqlDateInWib(): `CAST(created_at AS date)` polos memakai zona sesi DB
        // (UTC), jadi lalu lintas 00:00–07:00 WIB masuk ember hari sebelumnya.
        $dayExpression = AppTime::sqlDateInWib('created_at');
        $perDay = (clone $baseQuery())
            ->selectRaw("{$dayExpression} AS day")
            ->selectRaw('COUNT(*) AS total')
            ->selectRaw("SUM(CASE WHEN outcome <> 'success' THEN 1 ELSE 0 END) AS failed")
            ->groupByRaw($dayExpression)
            ->orderBy('day')
            ->get()
            ->keyBy(fn ($row) => (string) $row->day);

        // Isi hari kosong dengan nol supaya grafik kontinu
        $series = [];
        for ($i = 0; $i < 30; $i++) {
            $date = $firstDay->addDays($i)->toDateString();
            $row = $perDay->get($date);
            $series[] = [
                'day' => $date,
                'total' => $row ? (int) $row->total : 0,
                'failed' => $row ? (int) $row->failed : 0,
            ];
        }

        return response()->json(['data' => [
            'window_days' => 30,
            // Tanggal WIB, bukan $since (instan UTC yang jatuh di hari sebelumnya).
            'since' => $firstDay->toDateString(),
            'total_calls' => $perEndpoint->sum('total'),
            'per_endpoint' => $perEndpoint->values(),
            'per_day' => $series,
        ]]);
    }

    public function apiReference(): JsonResponse
    {
        $apiRateLimit = (int) config('limits.api_per_minute');

        return response()->json(['data' => [
            'base_path' => '/api/v1',
            'version' => 'v1',
            'stability' => [
                'status' => 'stable',
                'contract' => 'Field yang terdokumentasi di bawah dijamin stabil dalam v1: nama & tipe tidak dihapus/diubah maknanya. Penambahan field baru bersifat non-breaking — klien wajib mengabaikan field yang tidak dikenal.',
                'response_header' => 'Setiap response v1 menyertakan header X-Api-Version.',
            ],
            'deprecation_policy' => [
                'summary' => 'Perubahan yang membongkar kontrak (breaking) tidak dilakukan di v1 — dirilis sebagai versi baru (mis. /api/v2). v1 tetap dilayani minimal 6 bulan setelah pengumuman penggantian.',
                'signals' => [
                    'Header Deprecation: true dan Sunset: <tanggal RFC 8594> dikirim pada endpoint yang akan dihentikan.',
                    'Pengumuman juga tampil di portal peneliti sebelum tanggal sunset.',
                ],
                'min_support_after_announcement' => '180 hari',
            ],
            'authentication' => [
                'header' => 'X-API-Key: spr_xxx',
                'alternative' => 'Authorization: ApiKey spr_xxx',
            ],
            'rate_limit' => [
                'per_minute' => $apiRateLimit,
                'scope' => 'per API key',
                'headers' => ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'Retry-After'],
                'note' => "Batas {$apiRateLimit} permintaan/menit per API key. Lewat batas mengembalikan HTTP 429.",
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
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/v1/predictions/daily?from=2026-05-01&to=2026-05-07&format=json\"",
                    'example_response' => [
                        'data' => [[
                            'id' => 'a1b2c3d4-...',
                            'prediction_date' => '2026-05-07',
                            // Skala 0-100 (persen), bukan 0-1 — sesuai kolom numeric(5,2)
                            // di tabel predictions. >=75 = sangat_tinggi.
                            'risk_probability' => 82.13,
                            'risk_class' => 'sangat_tinggi',
                            'confidence_score' => 76.0,
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
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/v1/reports?from=2026-05-01&to=2026-05-31&format=json\"",
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
                    'example_request' => "curl -H \"X-API-Key: spr_xxx\" \\\n  \"/api/v1/tidal?station=PANJANG&from=2026-05-01&to=2026-05-02&format=json\"",
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

        // Metadata dataset (periode & cakupan kabupaten) HARUS membatasi isi
        // unduhan — tanpa ini kolom "Periode/Cakupan" di UI mendeskripsikan
        // subset sementara file berisi seluruh tabel.
        $coverage = collect($dataset->coverage_regencies ?? [])
            ->map(fn (string $name) => preg_replace('/^(kabupaten|kota)\s+/i', '', mb_strtolower(trim($name))))
            ->filter()
            ->values();
        $regencyFilter = function (Builder $query) use ($coverage): Builder {
            if ($coverage->isEmpty()) {
                return $query;
            }
            return $query->where(function (Builder $q) use ($coverage): void {
                foreach ($coverage as $name) {
                    $q->orWhereRaw("REGEXP_REPLACE(LOWER(TRIM(regions.regency)), '^(kabupaten|kota)\\s+', '') = ?", [$name]);
                }
            });
        };

        if (str_contains($type, 'tidal') || str_contains($type, 'pasang')) {
            // Pasut per stasiun laut — cakupan kabupaten tidak berlaku 1:1,
            // tapi periode tetap dihormati.
            $query = $this->tidalQuery()
                ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('recorded_at', '>=', $dataset->period_start))
                ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('recorded_at', '<=', $dataset->period_end))
                ->orderByDesc('recorded_at');
            return [$query, 'tidal_data.csv'];
        }

        if (str_contains($type, 'ground truth') || str_contains($type, 'report')) {
            $query = $regencyFilter($this->validatedReportsQuery())
                ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('reports.incident_time', '>=', $dataset->period_start))
                ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('reports.incident_time', '<=', $dataset->period_end))
                ->orderByDesc('reports.incident_time');
            return [$query, 'validated_reports.csv'];
        }

        $query = $regencyFilter($this->dailyPredictionsQuery())
            ->when($dataset->period_start, fn (Builder $q) => $q->whereDate('prediction_date', '>=', $dataset->period_start))
            ->when($dataset->period_end, fn (Builder $q) => $q->whereDate('prediction_date', '<=', $dataset->period_end))
            ->orderByDesc('prediction_date');
        return [$query, 'daily_predictions.csv'];
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

    private function exportOrPaginate(Builder $query, array $data, string $filename, bool $fullExport = false): JsonResponse|StreamedResponse
    {
        // Unduhan JSON (fullExport): file lengkap & rapi — pretty-print, semua baris
        // via cursor (hemat memori), sekelas CSV. API v1 tetap paginated/compact.
        if ($fullExport && ($data['format'] ?? 'json') === 'json') {
            $jsonFilename = str_replace('.csv', '.json', $filename);

            return response()->streamDownload(function () use ($query): void {
                $first = true;
                foreach ($query->cursor() as $row) {
                    echo $first ? "[\n" : ",\n";
                    $encoded = json_encode((array) $row, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                    echo '  '.str_replace("\n", "\n  ", (string) $encoded);
                    $first = false;
                }
                echo $first ? "[]\n" : "\n]\n";
            }, $jsonFilename, ['Content-Type' => 'application/json; charset=UTF-8']);
        }

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
                if ($first) {
                    // Query kosong: jangan kirim file 0 byte tanpa penjelasan.
                    CsvWriter::putRow($output, ['tidak_ada_data_untuk_rentang_dataset_ini']);
                }
                fclose($output);
            }, $filename, ['Content-Type' => 'text/csv; charset=UTF-8']);
        } elseif (($data['format'] ?? 'json') === 'xlsx') {
            $xlsxFilename = str_replace('.csv', '.xlsx', $filename);
            return response()->streamDownload(function () use ($query): void {
                $writer = \Spatie\SimpleExcel\SimpleExcelWriter::stream('php://output', 'xlsx');
                foreach ($query->cursor() as $row) {
                    // Netralkan formula injection juga di XLSX (rentan seperti CSV).
                    $writer->addRow(array_map(CsvWriter::sanitize(...), (array) $row));
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
