<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportStatusRequest;
use App\Http\Requests\RejectReportRequest;
use App\Http\Resources\ReportResource;
use App\Models\GroundTruthReport;
use App\Models\ReportPhoto;
use App\Services\AuditService;
use App\Services\NotificationService;
use App\Services\ReportAccessService;
use App\Services\RegionLocator;
use App\Services\RegionMonitoringService;
use Carbon\CarbonImmutable;
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
        private readonly RegionLocator $regionLocator,
        private readonly AuditService $audit,
        private readonly RegionMonitoringService $monitoring,
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

        if ($request->query('sla_status') === 'terlambat' || $request->query('sla') === 'overdue') {
            $query->whereNotIn('status', ['divalidasi', 'ditolak', 'duplikat'])
                ->where('created_at', '<', now()->subDay());
        }

        $perPage = min(max((int) $request->query('per_page', 15), 1), 100);
        $reports = $query->paginate($perPage);

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

        $region = $this->regionLocator->locateAdministrative((float) $data['latitude'], (float) $data['longitude']);

        if (!$region) {
            throw ValidationException::withMessages([
                'latitude' => 'Lokasi laporan berada di luar batas administrasi Provinsi Lampung yang tersedia.',
            ]);
        }

        if (isset($data['region_id']) && $data['region_id'] !== $region->id) {
            throw ValidationException::withMessages([
                'region_id' => 'Wilayah yang dipilih tidak sesuai dengan koordinat laporan.',
            ]);
        }

        $storedPaths = [];

        $isPointMonitored = $this->monitoring->isPointMonitored(
            $region,
            (float) $data['latitude'],
            (float) $data['longitude'],
        );
        $duplicate = $this->findPotentialDuplicate($user->id, (float) $data['latitude'], (float) $data['longitude'], CarbonImmutable::parse($data['incident_time']));
        if ($duplicate) {
            throw ValidationException::withMessages([
                'latitude' => "Laporan serupa sudah tercatat dengan kode {$duplicate->report_code}. Silakan cek riwayat laporan Anda.",
            ]);
        }

        try {
            $report = DB::transaction(function () use ($data, $region, $request, $user, &$storedPaths, $isPointMonitored) {
                $report = GroundTruthReport::create([
                    'id' => (string) Str::uuid(),
                    'report_code' => $this->generateReportCode(),
                    'user_id' => $user->id,
                    'region_id' => $region->id,
                    'latitude' => $data['latitude'],
                    'longitude' => $data['longitude'],
                    'severity' => $this->severityFromWaterHeight((int) $data['water_height_cm']),
                    'water_height_cm' => $data['water_height_cm'],
                    'incident_time' => $data['incident_time'],
                    'description' => $data['description'],
                    'status' => $isPointMonitored ? 'menunggu' : 'perlu_review',
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

        $report->load(['region', 'photos']);
        $this->notifications->notifyNewReportForReview($report);
        $this->audit->write($request, 'create_report', 'success', "ground_truth_reports:{$report->id}", [
            'report_code' => $report->report_code,
            'region_id' => $report->region_id,
            'severity' => $report->severity,
            'water_height_cm' => $report->water_height_cm,
            'is_within_monitoring_area' => $isPointMonitored,
            'status' => $report->status,
        ]);

        return response()->json([
            'message' => $isPointMonitored
                ? 'Laporan berhasil dikirim dan menunggu validasi BPBD.'
                : 'Laporan berhasil dikirim dan masuk antrean triase BPBD karena berada di luar wilayah pantauan prediksi rob.',
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

    private function severityFromWaterHeight(int $heightCm): string
    {
        return match (true) {
            $heightCm < 10 => 'ringan',
            $heightCm <= 30 => 'sedang',
            $heightCm <= 80 => 'parah',
            default => 'sangat_parah',
        };
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
        $reportData->load(['region', 'reporter', 'validator', 'photos']);
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
        $reportData->load(['region', 'reporter', 'validator', 'photos']);
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
        $reportData->load(['region', 'reporter', 'validator', 'photos']);
        $this->notifications->notifyReportStatus($reportData);
        $this->writeAudit($request, 'update_report_status', $reportData);

        return response()->json([
            'message' => 'Status laporan diperbarui',
            'data' => new ReportResource($reportData)
        ]);
    }

    private function writeAudit(Request $request, string $action, GroundTruthReport $report): void
    {
        $this->audit->write($request, $action, 'success', "ground_truth_reports:{$report->id}", [
            'report_code' => $report->report_code,
            'status' => $report->status,
            'region_id' => $report->region_id,
        ]);
    }

    private function findPotentialDuplicate(string $userId, float $latitude, float $longitude, CarbonImmutable $incidentTime): ?GroundTruthReport
    {
        $radiusMeters = 100;
        $latPadding = $radiusMeters / 111_320;
        $lonPadding = $radiusMeters / (111_320 * max(cos(deg2rad($latitude)), 0.01));

        return GroundTruthReport::query()
            ->where('user_id', $userId)
            ->whereIn('status', ['menunggu', 'perlu_review', 'divalidasi'])
            ->whereBetween('incident_time', [$incidentTime->subHours(2), $incidentTime->addHours(2)])
            ->whereBetween('latitude', [$latitude - $latPadding, $latitude + $latPadding])
            ->whereBetween('longitude', [$longitude - $lonPadding, $longitude + $lonPadding])
            ->latest()
            ->get()
            ->first(fn (GroundTruthReport $report) => $this->distanceMeters($latitude, $longitude, (float) $report->latitude, (float) $report->longitude) <= $radiusMeters);
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
}
