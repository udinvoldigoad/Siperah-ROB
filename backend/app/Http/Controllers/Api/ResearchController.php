<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ResearchController
{
    private const DEFAULT_USER_ID = '22222222-2222-4222-8222-222222222222';

    public function datasets(): JsonResponse
    {
        $datasets = DB::table('datasets')->get();

        if ($datasets->isEmpty()) {
            // Seed sample datasets on the fly
            $samples = [
                [
                    'id' => (string) Str::uuid(),
                    'name' => 'Data Historis Pasang Surut Teluk Lampung (2020-2025)',
                    'description' => 'Dataset rekaman tinggi muka air laut per jam dari stasiun pengamatan BMKG Panjang, Teluk Lampung.',
                    'dataset_type' => 'Tidal Height Timeseries',
                    'period_start' => '2020-01-01',
                    'period_end' => '2025-12-31',
                    'resolution' => 'Hourly',
                    'record_count' => 52560,
                    'license' => 'Open Database License (ODbL)',
                    'csv_url' => '/api/v1/tidal?format=csv',
                    'json_url' => '/api/v1/tidal?format=json',
                    'visibility' => 'peneliti',
                ],
                [
                    'id' => (string) Str::uuid(),
                    'name' => 'Ground Truth Validasi Banjir Rob Lampung (2026)',
                    'description' => 'Kumpulan laporan verifikasi banjir rob oleh warga dan petugas kebencanaan yang telah divalidasi.',
                    'dataset_type' => 'Geospatial Ground Truth',
                    'period_start' => '2026-01-01',
                    'period_end' => '2026-07-10',
                    'resolution' => 'Event-based',
                    'record_count' => 1204,
                    'license' => 'Creative Commons Attribution (CC BY 4.0)',
                    'csv_url' => '/api/v1/reports?format=csv',
                    'json_url' => '/api/v1/reports?format=json',
                    'visibility' => 'peneliti',
                ]
            ];
            foreach ($samples as $sample) {
                DB::table('datasets')->insert($sample);
            }
            $datasets = DB::table('datasets')->get();
        }

        return response()->json(['data' => $datasets]);
    }

    public function apiKeys(Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? self::DEFAULT_USER_ID;
        $keys = DB::table('api_keys')->where('user_id', $userId)->orderBy('created_at', 'desc')->get();

        return response()->json(['data' => $keys]);
    }

    public function regenerateKey(Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? self::DEFAULT_USER_ID;
        
        // Revoke existing keys
        DB::table('api_keys')->where('user_id', $userId)->update([
            'status' => 'nonaktif',
            'revoked_at' => now(),
        ]);

        $prefix = 'spr_';
        $key = $prefix . Str::random(32);
        $hash = hash('sha256', $key);

        DB::table('api_keys')->insert([
            'id' => (string) Str::uuid(),
            'user_id' => $userId,
            'key_hash' => $hash,
            'key_prefix' => substr($key, 0, 8) . '...',
            'status' => 'aktif',
            'created_at' => now(),
        ]);

        return response()->json([
            'message' => 'API key regenerated',
            'raw_key' => $key, // Return raw key once
        ], 201);
    }

    public function dailyPredictions(): JsonResponse
    {
        $predictions = DB::table('predictions')
            ->join('regions', 'predictions.region_id', '=', 'regions.id')
            ->select('predictions.*', 'regions.village', 'regions.district', 'regions.regency')
            ->orderBy('prediction_date', 'desc')
            ->limit(100)
            ->get();

        return response()->json(['data' => $predictions]);
    }

    public function validatedReports(): JsonResponse
    {
        $reports = DB::table('ground_truth_reports')
            ->where('status', 'divalidasi')
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        return response()->json(['data' => $reports]);
    }

    public function tidal(): JsonResponse
    {
        $tidal = DB::table('tidal_data')->orderBy('recorded_at', 'desc')->limit(100)->get();

        return response()->json(['data' => $tidal]);
    }
}
