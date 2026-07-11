<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportStatusRequest;
use App\Http\Resources\ReportResource;
use App\Models\AuditLog;
use App\Models\GroundTruthReport;
use App\Models\ReportPhoto;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ReportController
{
    public function index(Request $request)
    {
        $query = $this->accessibleReports($request->user())
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
        $this->ensureCanAccessReport($request->user(), $reportData);
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

        $regionId = $region->id;

        $report = GroundTruthReport::create([
            'id' => (string) Str::uuid(),
            'report_code' => 'GT-LPG-' . mt_rand(1000, 9999),
            'user_id' => $user->id,
            'region_id' => $regionId,
            'latitude' => $data['latitude'],
            'longitude' => $data['longitude'],
            'severity' => $data['severity'],
            'water_height_cm' => $data['water_height_cm'],
            'incident_time' => $data['incident_time'],
            'description' => $data['description'],
            'status' => 'menunggu',
        ]);

        if ($request->hasFile('photos')) {
            foreach ($request->file('photos') as $photo) {
                $path = $photo->store('reports', 'public');
                ReportPhoto::create([
                    'id' => (string) Str::uuid(),
                    'report_id' => $report->id,
                    'file_url' => $path,
                    'file_name' => $photo->getClientOriginalName(),
                    'file_size' => $photo->getSize(),
                    'mime_type' => $photo->getMimeType(),
                    'uploaded_at' => now(),
                ]);
            }
        }

        $report->load('photos');

        return response()->json([
            'message' => 'Laporan berhasil dikirim dan menunggu validasi.',
            'data' => new ReportResource($report)
        ], 201);
    }

    public function validateReport(Request $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);
        $this->ensureCanAccessReport($request->user(), $reportData);
        $this->ensureReportCanBeReviewed($reportData);
        
        $reportData->update([
            'status' => 'divalidasi',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
        ]);
        $this->writeAudit($request, 'validate_report', $reportData);

        return response()->json([
            'message' => 'Laporan divalidasi',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function rejectReport(Request $request, string $report): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string']]);

        $reportData = GroundTruthReport::findOrFail($report);
        $this->ensureCanAccessReport($request->user(), $reportData);
        $this->ensureReportCanBeReviewed($reportData);

        $reportData->update([
            'status' => 'ditolak',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
            'rejection_reason' => $request->input('reason'),
        ]);
        $this->writeAudit($request, 'reject_report', $reportData);

        return response()->json([
            'message' => 'Laporan ditolak',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function updateStatus(UpdateReportStatusRequest $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);
        $this->ensureCanAccessReport($request->user(), $reportData);
        $this->ensureReportCanBeReviewed($reportData);

        $status = $request->input('status');

        $reportData->update([
            'status' => $status,
            'rejection_reason' => $request->input('rejection_reason'),
            'validated_by' => in_array($status, ['divalidasi', 'ditolak']) ? $request->user()->id : null,
            'validated_at' => in_array($status, ['divalidasi', 'ditolak']) ? now() : null,
        ]);
        $this->writeAudit($request, 'update_report_status', $reportData);

        return response()->json([
            'message' => 'Status laporan diperbarui',
            'data' => new ReportResource($reportData)
        ]);
    }

    private function accessibleReports(User $user): Builder
    {
        $query = GroundTruthReport::query();

        return match ($user->role) {
            'warga' => $query->where('user_id', $user->id),
            'bpbd_operator' => $this->scopeToOperatorRegency($query, $user),
            'bpbd_provinsi', 'admin' => $query,
            default => abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.'),
        };
    }

    private function ensureCanAccessReport(User $user, GroundTruthReport $report): void
    {
        if (in_array($user->role, ['bpbd_provinsi', 'admin'], true)) {
            return;
        }

        if ($user->role === 'warga') {
            abort_unless($report->user_id === $user->id, 403, 'Anda hanya dapat mengakses laporan sendiri.');
            return;
        }

        if ($user->role === 'bpbd_operator') {
            $regency = $this->operatorRegency($user);
            $report->loadMissing('region');
            abort_unless($report->region?->regency === $regency, 403, 'Laporan berada di luar wilayah kerja Anda.');
            return;
        }

        abort(403, 'Role ini tidak memiliki akses ke laporan ground truth.');
    }

    private function scopeToOperatorRegency(Builder $query, User $user): Builder
    {
        $regency = $this->operatorRegency($user);

        return $query->whereHas('region', fn (Builder $regionQuery) => $regionQuery->where('regency', $regency));
    }

    private function operatorRegency(User $user): string
    {
        abort_unless($user->region_id, 403, 'Akun operator belum memiliki wilayah kerja.');

        $regency = \App\Models\Region::whereKey($user->region_id)->value('regency');
        abort_unless($regency, 403, 'Wilayah kerja operator tidak valid.');

        return $regency;
    }

    private function ensureReportCanBeReviewed(GroundTruthReport $report): void
    {
        abort_unless(
            in_array($report->status, ['menunggu', 'perlu_review'], true),
            409,
            'Hanya laporan menunggu atau perlu_review yang dapat diproses.'
        );
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

        return \App\Models\Region::where('coastal_flag', true)
            ->get()
            ->first(fn ($region) => $this->pointIsInsideWktBounds($region->geometry, $latitude, $longitude));
    }

    private function postgisAvailable(): bool
    {
        return (bool) DB::selectOne(
            "SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') AS installed"
        )->installed;
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
