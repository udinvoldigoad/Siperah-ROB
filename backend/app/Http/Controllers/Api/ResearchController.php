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

    public function tidal(Request $request)
    {
        $query = DB::table('tidal_data')->orderBy('recorded_at', 'desc')->limit(500);

        if ($request->query('format') === 'csv') {
            return response()->streamDownload(function () use ($query) {
                $file = fopen('php://output', 'w');
                fputcsv($file, ['ID', 'Station', 'Code', 'Recorded At', 'Height (m)', 'Source']);
                foreach ($query->cursor() as $row) {
                    fputcsv($file, [
                        $row->id, $row->station_name, $row->station_code, 
                        $row->recorded_at, $row->tidal_height, $row->source
                    ]);
                }
                fclose($file);
            }, 'tidal_data.csv', ['Content-Type' => 'text/csv']);
        }

        return response()->json(['data' => $query->get()]);
    }

    public function reportsExport(Request $request)
    {
        $query = DB::table('ground_truth_reports')->where('status', 'divalidasi')->orderBy('created_at', 'desc');

        if ($request->query('format') === 'csv') {
            return response()->streamDownload(function () use ($query) {
                $file = fopen('php://output', 'w');
                fputcsv($file, ['ID', 'Code', 'Region ID', 'Latitude', 'Longitude', 'Severity', 'Water Height (cm)', 'Incident Time']);
                foreach ($query->cursor() as $row) {
                    fputcsv($file, [
                        $row->id, $row->report_code, $row->region_id,
                        $row->latitude, $row->longitude, $row->severity,
                        $row->water_height_cm, $row->incident_time
                    ]);
                }
                fclose($file);
            }, 'ground_truth_reports.csv', ['Content-Type' => 'text/csv']);
        }

        return response()->json(['data' => $query->get()]);
    }
}
