<?php

namespace App\Http\Controllers\Api;

use App\Http\Resources\PredictionResource;
use App\Http\Resources\ReportResource;
use App\Models\Prediction;
use App\Models\Region;
use App\Models\GroundTruthReport;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublicMapController
{
    public function predictions(Request $request)
    {
        $query = Prediction::with('region')->orderBy('prediction_date', 'desc');

        if ($request->filled('regency')) {
            $query->whereHas('region', function ($q) use ($request) {
                $q->where('regency', $request->query('regency'));
            });
        }

        if ($request->filled('date')) {
            $query->where('prediction_date', $request->query('date'));
        }

        return PredictionResource::collection($query->paginate(200));
    }

    public function region(string $region): JsonResponse
    {
        $data = Region::findOrFail($region);
        return response()->json(['data' => $data]);
    }

    public function modeAwam(Request $request): JsonResponse
    {
        $lat = $request->query('lat');
        $lon = $request->query('lon');

        if ($lat && $lon) {
            $region = Region::where('coastal_flag', true)
                ->selectRaw("*, 
                    ABS(CAST(SPLIT_PART(REPLACE(REPLACE(REPLACE(geometry, 'MULTIPOLYGON(((', ''), ')))', ''), ',', ' '), ' ', 2) AS FLOAT) - ?) +
                    ABS(CAST(SPLIT_PART(REPLACE(REPLACE(REPLACE(geometry, 'MULTIPOLYGON(((', ''), ')))', ''), ',', ' '), ' ', 1) AS FLOAT) - ?) AS dist", 
                    [(float)$lat, (float)$lon])
                ->orderBy('dist')
                ->first();
        } else {
            $region = Region::where('coastal_flag', true)->first();
        }

        if (!$region) {
            return response()->json(['data' => null, 'message' => 'Tidak ada data region']);
        }

        $prediction = Prediction::where('region_id', $region->id)
            ->orderBy('prediction_date', 'desc')
            ->first();

        $forecast = Prediction::where('region_id', $region->id)
            ->orderBy('prediction_date', 'asc')
            ->limit(7)
            ->get();

        $nearby = GroundTruthReport::with(['region', 'photos'])
            ->whereHas('region', function ($q) use ($region) {
                $q->where('regency', $region->regency);
            })
            ->orderBy('created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'region' => [
                    'id' => $region->id,
                    'village' => $region->village,
                    'district' => $region->district,
                    'regency' => $region->regency,
                ],
                'risk_class' => $prediction->risk_class ?? 'rendah',
                'risk_probability' => $prediction->risk_probability ?? 0,
                'max_tidal_height' => $prediction->max_tidal_height ?? 0,
                'peak_time' => $prediction?->peak_time ? substr($prediction->peak_time, 0, 5) : null,
                'forecast' => PredictionResource::collection($forecast),
                'nearby_reports' => ReportResource::collection($nearby),
            ],
        ]);
    }

    public function onboarding(): JsonResponse
    {
        return response()->json([
            'data' => [
                'topics' => ['banjir rob', 'klasifikasi risiko', 'cara melapor', 'FAQ'],
            ],
        ]);
    }
}
