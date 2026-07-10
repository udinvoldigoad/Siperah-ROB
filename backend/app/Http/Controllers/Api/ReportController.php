<?php

namespace App\Http\Controllers\Api;

use Carbon\Carbon;
use Illuminate\Http\UploadedFile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReportController
{
    private const PUBLIC_USER_ID = '22222222-2222-4222-8222-222222222222';

    public function index(Request $request): JsonResponse
    {
        $query = $this->reportQuery()->latest('reports.created_at');

        if ($request->filled('status')) {
            $query->whereIn('reports.status', array_filter(explode(',', (string) $request->query('status'))));
        }

        if ($request->filled('region_id')) {
            $query->where('reports.region_id', (string) $request->query('region_id'));
        }

        $rows = $query->limit(min(max($request->integer('limit', 30), 1), 100))->get();

        return response()->json([
            'data' => $this->formatReports($rows),
            'filters' => $request->only(['status', 'region_id']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'region_id' => ['required', 'uuid'],
            'latitude' => ['required', 'numeric'],
            'longitude' => ['required', 'numeric'],
            'severity' => ['required', 'in:ringan,sedang,parah,sangat_parah'],
            'water_height_cm' => ['nullable', 'integer', 'min:0', 'max:500'],
            'incident_time' => ['required', 'date'],
            'description' => ['required', 'string', 'max:2000'],
            'photos.*' => ['file', 'mimes:jpg,jpeg,png', 'max:2048'],
        ]);

        $reportId = (string) Str::uuid();
        $reportCode = 'ROB-'.now()->format('Ymd-His').'-'.Str::upper(Str::random(4));

        DB::transaction(function () use ($data, $request, $reportId, $reportCode): void {
            $this->ensureDemoRegion($data['region_id']);
            $this->ensurePublicUser($data['region_id']);

            DB::insert(
                "insert into ground_truth_reports (
                    id, report_code, user_id, region_id, latitude, longitude, severity,
                    water_height_cm, incident_time, description, status, created_at, updated_at
                ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'menunggu', now(), now())",
                [
                    $reportId,
                    $reportCode,
                    self::PUBLIC_USER_ID,
                    $data['region_id'],
                    $data['latitude'],
                    $data['longitude'],
                    $data['severity'],
                    $data['water_height_cm'] ?? null,
                    $data['incident_time'],
                    $data['description'],
                ],
            );

            foreach ($request->file('photos', []) as $photo) {
                if ($photo instanceof UploadedFile) {
                    $path = $photo->store('reports');
                    DB::table('report_photos')->insert([
                        'id' => (string) Str::uuid(),
                        'report_id' => $reportId,
                        'file_url' => $path,
                        'file_name' => $photo->getClientOriginalName(),
                        'file_size' => $photo->getSize() ?: 0,
                        'mime_type' => $photo->getMimeType() ?: 'application/octet-stream',
                        'uploaded_at' => now(),
                    ]);
                }
            }
        });

        return response()->json([
            'message' => 'Report accepted for verification',
            'report_code' => $reportCode,
            'data' => $this->findReport($reportCode),
        ], 202);
    }

    public function show(string $report): JsonResponse
    {
        $data = $this->findReport($report);
        abort_if($data === null, 404, 'Report not found');

        return response()->json(['data' => $data]);
    }

    public function updateStatus(Request $request, string $report): JsonResponse
    {
        $rules = [
            'status' => ['required', 'in:menunggu,perlu_review,divalidasi,ditolak,duplikat'],
            'rejection_reason' => ['nullable', 'string', 'max:1000'],
        ];

        if ($request->input('status') === 'ditolak') {
            $rules['rejection_reason'] = ['required', 'string', 'max:1000'];
        }

        $data = $request->validate($rules);

        return $this->setStatus($report, $data['status'], $data['rejection_reason'] ?? null);
    }

    public function validateReport(string $report): JsonResponse
    {
        return $this->setStatus($report, 'divalidasi');
    }

    public function rejectReport(Request $request, string $report): JsonResponse
    {
        $data = $request->validate(['rejection_reason' => ['required', 'string', 'max:1000']]);

        return $this->setStatus($report, 'ditolak', $data['rejection_reason']);
    }

    private function setStatus(string $report, string $status, ?string $reason = null): JsonResponse
    {
        $id = $this->resolveReportId($report);
        abort_if($id === null, 404, 'Report not found');

        DB::table('ground_truth_reports')->where('id', $id)->update([
            'status' => $status,
            'validated_at' => $status === 'divalidasi' ? now() : null,
            'rejection_reason' => $status === 'ditolak' ? $reason : null,
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Report status updated',
            'data' => $this->findReport($report),
        ]);
    }

    private function findReport(string $report): ?array
    {
        $query = $this->reportQuery();

        if (Str::isUuid($report)) {
            $query->where('reports.id', $report);
        } else {
            $query->whereRaw('lower(reports.report_code) = ?', [strtolower($report)]);
        }

        $row = $query->first();

        return $row ? $this->formatReports(collect([$row]))[0] : null;
    }

    private function resolveReportId(string $report): ?string
    {
        $query = DB::table('ground_truth_reports');

        if (Str::isUuid($report)) {
            $query->where('id', $report);
        } else {
            $query->whereRaw('lower(report_code) = ?', [strtolower($report)]);
        }

        return $query->value('id');
    }

    private function reportQuery()
    {
        return DB::table('ground_truth_reports as reports')
            ->leftJoin('regions', 'regions.id', '=', 'reports.region_id')
            ->leftJoin('users', 'users.id', '=', 'reports.user_id')
            ->select([
                'reports.id as db_id',
                'reports.report_code',
                'reports.severity',
                'reports.status',
                'reports.incident_time',
                'reports.created_at',
                'reports.water_height_cm',
                'reports.description',
                'regions.village',
                'regions.district',
                'regions.regency',
                'users.name as reporter',
                'reports.latitude',
                'reports.longitude',
            ]);
    }

    private function formatReports($rows): array
    {
        $photos = $this->photosByReport($rows->pluck('db_id')->all());

        return $rows->map(fn ($row) => [
            'id' => strtolower($row->report_code),
            'code' => $row->report_code,
            'village' => $row->village ?? 'Lokasi laporan',
            'district' => $row->district ?? '-',
            'regency' => $row->regency ?? 'Lampung',
            'severity' => $row->severity,
            'status' => $row->status,
            'incidentTime' => $this->formatDateTime($row->incident_time),
            'submittedAt' => $this->relativeSubmittedAt($row->created_at),
            'waterHeightCm' => $row->water_height_cm === null ? null : (int) $row->water_height_cm,
            'reporter' => $row->reporter ?? 'Warga',
            'coordinates' => number_format((float) $row->latitude, 6, '.', '').', '.number_format((float) $row->longitude, 6, '.', ''),
            'description' => $row->description,
            'photos' => $photos[$row->db_id] ?? [],
        ])->all();
    }

    private function photosByReport(array $reportIds): array
    {
        if ($reportIds === []) {
            return [];
        }

        $photos = [];
        $rows = DB::table('report_photos')
            ->whereIn('report_id', $reportIds)
            ->orderBy('uploaded_at')
            ->get(['report_id', 'file_name']);

        foreach ($rows as $row) {
            $photos[$row->report_id][] = $row->file_name;
        }

        return $photos;
    }

    private function formatDateTime(string $value): string
    {
        return Carbon::parse($value)->format('d M Y, H:i');
    }

    private function relativeSubmittedAt(string $value): string
    {
        $minutes = max(1, (int) Carbon::parse($value)->diffInMinutes(now()));

        if ($minutes < 60) {
            return "Masuk {$minutes} menit lalu";
        }

        $hours = (int) floor($minutes / 60);

        return "Masuk {$hours} jam lalu";
    }

    private function ensureDemoRegion(string $regionId): void
    {
        DB::statement(
            "insert into regions (id, province, regency, district, village, geometry, population, coastal_flag, created_at, updated_at)
            values (?, 'Lampung', 'Bandar Lampung', 'Panjang', 'Panjang Utara',
                'MULTIPOLYGON(((105.250000 -5.460000,105.290000 -5.460000,105.290000 -5.430000,105.250000 -5.430000,105.250000 -5.460000)))',
                12000, true, now(), now())
            on conflict (id) do nothing",
            [$regionId],
        );
    }

    private function ensurePublicUser(string $regionId): void
    {
        DB::table('users')->updateOrInsert(
            ['id' => self::PUBLIC_USER_ID],
            [
                'name' => 'Warga Mode Awam',
                'email' => 'warga@siperah.local',
                'phone_number' => '080000000000',
                'role' => 'warga',
                'region_id' => $regionId,
                'status' => 'aktif',
                'updated_at' => now(),
                'created_at' => now(),
            ],
        );
    }
}
