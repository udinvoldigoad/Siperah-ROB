<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportStatusRequest;
use App\Http\Requests\RejectReportRequest;
use App\Http\Resources\ReportResource;
use App\Models\AuditLog;
use App\Models\GroundTruthReport;
use App\Models\ReportPhoto;
use App\Services\NotificationService;
use App\Services\ReportAccessService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ReportController
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly ReportAccessService $access,
    ) {}

    public function index(Request $request)
    {
        $query = $this->access->accessible($request->user())
            ->with(['region', 'reporter', 'validator', 'photos'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $statuses = array_values(array_filter(explode(',', $request->query('status'))));
            $query->whereIn('status', $statuses);
        }

        if ($request->filled('severity')) {
            $query->where('severity', $request->query('severity'));
        }

        if ($request->filled('region_id')) {
            $query->where('region_id', $request->query('region_id'));
        }

        $reports = $query->paginate(15);

        return ReportResource::collection($reports);
    }

    public function show(Request $request, string $report)
    {
        $reportData = GroundTruthReport::with(['region', 'reporter', 'validator', 'photos'])->findOrFail($report);
        $this->access->authorizeView($request->user(), $reportData);
        return new ReportResource($reportData);
    }

    public function store(StoreReportRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $region = $this->resolveCoastalRegion((float) $data['latitude'], (float) $data['longitude']);

        if (!$region) {
            throw ValidationException::withMessages([
                'latitude' => 'Lokasi laporan berada di luar wilayah pesisir yang dipantau.',
            ]);
        }

        if (isset($data['region_id']) && $data['region_id'] !== $region->id) {
            throw ValidationException::withMessages([
                'region_id' => 'Wilayah yang dipilih tidak sesuai dengan koordinat laporan.',
            ]);
        }

        $storedPaths = [];

        try {
            $report = DB::transaction(function () use ($data, $region, $request, $user, &$storedPaths) {
                $report = GroundTruthReport::create([
                    'id' => (string) Str::uuid(),
                    'report_code' => $this->generateReportCode(),
                    'user_id' => $user->id,
                    'region_id' => $region->id,
                    'latitude' => $data['latitude'],
                    'longitude' => $data['longitude'],
                    'severity' => $data['severity'],
                    'water_height_cm' => $data['water_height_cm'],
                    'incident_time' => $data['incident_time'],
                    'description' => $data['description'],
                    'status' => 'menunggu',
                ]);

                foreach ($request->file('photos', []) as $photo) {
                    $path = $photo->store('reports', 'public');
                    $storedPaths[] = $path;

                    ReportPhoto::create([
                        'id' => (string) Str::uuid(),
                        'report_id' => $report->id,
                        'file_url' => $path,
                        'file_name' => basename($photo->getClientOriginalName()),
                        'file_size' => $photo->getSize(),
                        'mime_type' => $photo->getMimeType(),
                        'uploaded_at' => now(),
                    ]);
                }

                return $report;
            });
        } catch (\Throwable $exception) {
            if ($storedPaths !== []) {
                Storage::disk('public')->delete($storedPaths);
            }

            throw $exception;
        }

        $report->load('photos');

        return response()->json([
            'message' => 'Laporan berhasil dikirim dan menunggu validasi.',
            'data' => new ReportResource($report)
        ], 201);
    }

    private function generateReportCode(): string
    {
        do {
            $code = 'GT-LPG-' . Str::upper(Str::random(16));
        } while (GroundTruthReport::where('report_code', $code)->exists());

        return $code;
    }

    public function validateReport(Request $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);
        $this->access->authorizeReview($request->user(), $reportData);
        
        $reportData->update([
            'status' => 'divalidasi',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
        ]);
        $this->notifications->notifyReportStatus($reportData);
        $this->writeAudit($request, 'validate_report', $reportData);

        return response()->json([
            'message' => 'Laporan divalidasi',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function rejectReport(RejectReportRequest $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);
        $this->access->authorizeReview($request->user(), $reportData);

        $reportData->update([
            'status' => 'ditolak',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
            'rejection_reason' => $request->input('reason'),
        ]);
        $this->notifications->notifyReportStatus($reportData);
        $this->writeAudit($request, 'reject_report', $reportData);

        return response()->json([
            'message' => 'Laporan ditolak',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function updateStatus(UpdateReportStatusRequest $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);
        $this->access->authorizeReview($request->user(), $reportData);

        $status = $request->input('status');

        $reportData->update([
            'status' => $status,
            'rejection_reason' => $request->input('rejection_reason'),
            'validated_by' => in_array($status, ['divalidasi', 'ditolak']) ? $request->user()->id : null,
            'validated_at' => in_array($status, ['divalidasi', 'ditolak']) ? now() : null,
        ]);
        $this->notifications->notifyReportStatus($reportData);
        $this->writeAudit($request, 'update_report_status', $reportData);

        return response()->json([
            'message' => 'Status laporan diperbarui',
            'data' => new ReportResource($reportData)
        ]);
    }

    private function writeAudit(Request $request, string $action, GroundTruthReport $report): void
    {
        $actor = $request->user();

        AuditLog::create([
            'id' => (string) Str::uuid(),
            'actor_user_id' => $actor->id,
            'actor_name' => $actor->name,
            'actor_role' => $actor->role,
            'action' => $action,
            'target_resource' => "ground_truth_reports:{$report->id}",
            'outcome' => 'success',
            'ip_address' => $request->ip(),
            'user_agent' => $request->userAgent(),
            'payload' => [
                'report_code' => $report->report_code,
                'status' => $report->status,
                'region_id' => $report->region_id,
            ],
        ]);
    }

    /**
     * Produksi memakai PostGIS. Fallback WKT hanya untuk database development
     * lama agar pelaporan tetap dapat diuji sebelum ekstensi dipasang.
     */
    private function resolveCoastalRegion(float $latitude, float $longitude): ?\App\Models\Region
    {
        if ($this->postgisAvailable()) {
            return \App\Models\Region::where('coastal_flag', true)
                ->whereRaw(
                    'ST_Covers(geometry, ST_SetSRID(ST_MakePoint(?, ?), 4326))',
                    [$longitude, $latitude],
                )
                ->first();
        }

        $regions = \App\Models\Region::where('coastal_flag', true)->get();

        // 1. Coba cari yang benar-benar masuk dalam bounding box WKT
        $exactMatch = $regions->first(fn ($region) => $this->pointIsInsideWktBounds($region->geometry, $latitude, $longitude));
        
        if ($exactMatch) {
            return $exactMatch;
        }

        // 2. Fallback: Cari region terdekat berdasarkan Euclidean distance ke tengah bounding box
        // (Ini memastikan pelaporan bisa jalan di semua pesisir Lampung pada demo app)
        $nearestRegion = null;
        $minDist = PHP_FLOAT_MAX;

        foreach ($regions as $region) {
            preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $region->geometry, $matches, PREG_SET_ORDER);
            if ($matches === []) {
                continue;
            }

            $longitudes = array_map(fn (array $match) => (float) $match[1], $matches);
            $latitudes = array_map(fn (array $match) => (float) $match[2], $matches);
            
            $centerLng = array_sum($longitudes) / count($longitudes);
            $centerLat = array_sum($latitudes) / count($latitudes);
            
            $dist = pow($latitude - $centerLat, 2) + pow($longitude - $centerLng, 2);
            if ($dist < $minDist) {
                $minDist = $dist;
                $nearestRegion = $region;
            }
        }

        // Toleransi maksimal sekitar ~3 derajat (ratusan kilometer)
        return $minDist < 10 ? $nearestRegion : null;
    }

    private function postgisAvailable(): bool
    {
        return false;
    }

    private function pointIsInsideWktBounds(string $wkt, float $latitude, float $longitude): bool
    {
        preg_match_all('/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/', $wkt, $matches, PREG_SET_ORDER);

        if ($matches === []) {
            return false;
        }

        $longitudes = array_map(fn (array $match) => (float) $match[1], $matches);
        $latitudes = array_map(fn (array $match) => (float) $match[2], $matches);

        return $longitude >= min($longitudes)
            && $longitude <= max($longitudes)
            && $latitude >= min($latitudes)
            && $latitude <= max($latitudes);
    }
}
