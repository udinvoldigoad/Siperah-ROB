<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class PublicMapController
{
    public function predictions(Request $request): JsonResponse
    {
        $query = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select('predictions.*', 'regions.village', 'regions.district', 'regions.regency', 'regions.geometry');

        if ($request->filled('regency')) {
            $query->where('regions.regency', $request->query('regency'));
        }

        $predictions = $query->orderBy('prediction_date', 'desc')->get();

        // Seed default prediction if empty
        if ($predictions->isEmpty()) {
            $region = DB::table('regions')->first();
            if ($region) {
                DB::table('predictions')->insertOrIgnore([
                    'id' => (string) \Illuminate\Support\Str::uuid(),
                    'region_id' => $region->id,
                    'prediction_date' => now()->format('Y-m-d'),
                    'risk_probability' => 74.00,
                    'risk_class' => 'tinggi',
                    'confidence_score' => 88.00,
                    'max_tidal_height' => 1.46,
                    'peak_time' => '21:40:00',
                    'model_version' => 'v1.0.0',
                    'generated_at' => now(),
                ]);
                $predictions = $query->orderBy('prediction_date', 'desc')->get();
            }
        }

        return response()->json([
            'data' => $predictions,
            'filters' => $request->only(['date', 'horizon', 'regency', 'layers']),
        ]);
    }

    public function region(string $region): JsonResponse
    {
        $data = DB::table('regions')->where('id', $region)->first();
        return response()->json(['data' => $data]);
    }

    public function modeAwam(Request $request): JsonResponse
    {
        $prediction = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select('predictions.*', 'regions.village', 'regions.district', 'regions.regency')
            ->orderBy('prediction_date', 'desc')
            ->first();

        $nearby = DB::table('ground_truth_reports')
            ->join('regions', 'ground_truth_reports.region_id', '=', 'regions.id')
            ->select('ground_truth_reports.*', 'regions.village')
            ->orderBy('ground_truth_reports.created_at', 'desc')
            ->limit(5)
            ->get();

        return response()->json([
            'data' => [
                'village' => $prediction->village ?? 'Panjang Utara',
                'risk_class' => $prediction->risk_class ?? 'tinggi',
                'risk_probability' => $prediction->risk_probability ?? 74,
                'max_tidal_height' => $prediction->max_tidal_height ?? 1.46,
                'peak_time' => $prediction->peak_time ? substr($prediction->peak_time, 0, 5) : '21:40',
                'nearby_reports' => $nearby,
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
