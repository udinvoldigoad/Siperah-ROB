<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\StoreReportRequest;
use App\Http\Requests\UpdateReportStatusRequest;
use App\Http\Resources\ReportResource;
use App\Models\GroundTruthReport;
use App\Models\ReportPhoto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

final class ReportController
{
    public function index(Request $request)
    {
        $query = GroundTruthReport::with(['region', 'reporter', 'validator', 'photos'])
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
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

    public function show(string $report)
    {
        $reportData = GroundTruthReport::with(['region', 'reporter', 'validator', 'photos'])->findOrFail($report);
        return new ReportResource($reportData);
    }

    public function store(StoreReportRequest $request): JsonResponse
    {
        $data = $request->validated();
        $user = $request->user();

        $regionId = $request->input('region_id');
        if (!$regionId) {
            $region = \App\Models\Region::where('coastal_flag', true)
                ->selectRaw("id, 
                    ABS(CAST(SPLIT_PART(REPLACE(REPLACE(REPLACE(geometry, 'MULTIPOLYGON(((', ''), ')))', ''), ',', ' '), ' ', 2) AS FLOAT) - ?) +
                    ABS(CAST(SPLIT_PART(REPLACE(REPLACE(REPLACE(geometry, 'MULTIPOLYGON(((', ''), ')))', ''), ',', ' '), ' ', 1) AS FLOAT) - ?) AS dist", 
                    [(float)$data['latitude'], (float)$data['longitude']])
                ->orderBy('dist')
                ->first();
            $regionId = $region?->id;
        }

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
        
        $reportData->update([
            'status' => 'divalidasi',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Laporan divalidasi',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function rejectReport(Request $request, string $report): JsonResponse
    {
        $request->validate(['reason' => ['required', 'string']]);

        $reportData = GroundTruthReport::findOrFail($report);

        $reportData->update([
            'status' => 'ditolak',
            'validated_by' => $request->user()->id,
            'validated_at' => now(),
            'rejection_reason' => $request->input('reason'),
        ]);

        return response()->json([
            'message' => 'Laporan ditolak',
            'data' => new ReportResource($reportData)
        ]);
    }

    public function updateStatus(UpdateReportStatusRequest $request, string $report): JsonResponse
    {
        $reportData = GroundTruthReport::findOrFail($report);

        $reportData->update([
            'status' => $request->input('status'),
            'rejection_reason' => $request->input('rejection_reason'),
            'validated_by' => in_array($request->input('status'), ['divalidasi', 'ditolak']) ? $request->user()->id : null,
            'validated_at' => in_array($request->input('status'), ['divalidasi', 'ditolak']) ? now() : null,
        ]);

        return response()->json([
            'message' => 'Status laporan diperbarui',
            'data' => new ReportResource($reportData)
        ]);
    }
}
