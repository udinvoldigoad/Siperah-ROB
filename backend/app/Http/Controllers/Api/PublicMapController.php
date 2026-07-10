<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class PublicMapController
{
    public function predictions(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [],
            'filters' => $request->only(['date', 'horizon', 'regency', 'layers']),
        ]);
    }

    public function region(string $region): JsonResponse
    {
        return response()->json(['data' => ['id' => $region]]);
    }

    public function modeAwam(Request $request): JsonResponse
    {
        return response()->json([
            'data' => [
                'risk_class' => 'tinggi',
                'risk_probability' => 74,
                'max_tidal_height' => 1.46,
                'peak_time' => '21:40',
                'nearby_reports' => [],
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
