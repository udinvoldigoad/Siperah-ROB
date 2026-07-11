<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

final class DashboardController
{
    /**
     * FR-OPS-1—5: Dashboard operator BPBD kabupaten/kota.
     * Filter berdasarkan region_id operator (wilayah kerjanya).
     */
    public function operatorSummary(Request $request): JsonResponse
    {
        $user = $request->user();
        $regionId = $user?->region_id;

        // Jika operator punya region, filter per regency yang sama
        $regency = null;
        if ($regionId) {
            $regency = DB::table('regions')->where('id', $regionId)->value('regency');
        }

        $regionQuery = DB::table('regions')->where('coastal_flag', true);
        if ($regency) {
            $regionQuery->where('regency', $regency);
        }
        $regionIds = $regionQuery->pluck('id');

        $monitored = $regionIds->count();

        $critical = DB::table('predictions')
            ->whereIn('region_id', $regionIds)
            ->where('risk_class', 'sangat_tinggi')
            ->where('prediction_date', Carbon::today())
            ->distinct('region_id')
            ->count('region_id');

        $pending = DB::table('ground_truth_reports')
            ->whereIn('region_id', $regionIds)
            ->where('status', 'menunggu')
            ->count();

        $startOfMonth = Carbon::now()->startOfMonth();
        $monthlyValidations = DB::table('ground_truth_reports')
            ->whereIn('region_id', $regionIds)
            ->where('status', 'divalidasi')
            ->where('validated_at', '>=', $startOfMonth)
            ->count();

        return response()->json(['data' => [
            'monitored_villages' => $monitored,
            'critical_villages' => $critical,
            'pending_reports' => $pending,
            'monthly_validations' => $monthlyValidations,
        ]]);
    }

    /**
     * FR-PROV-1—4: Dashboard BPBD provinsi lintas kabupaten.
     */
    public function provinceSummary(): JsonResponse
    {
        $regencies = DB::table('regions')
            ->where('coastal_flag', true)
            ->distinct('regency')
            ->count('regency');

        $highRisk = DB::table('predictions')
            ->whereIn('risk_class', ['tinggi', 'sangat_tinggi'])
            ->where('prediction_date', Carbon::today())
            ->distinct('region_id')
            ->count('region_id');

        $population = DB::table('regions')
            ->where('coastal_flag', true)
            ->sum('population');

        $startOfMonth = Carbon::now()->startOfMonth();
        $validatedThisMonth = DB::table('ground_truth_reports')
            ->where('status', 'divalidasi')
            ->where('validated_at', '>=', $startOfMonth)
            ->count();

        return response()->json(['data' => [
            'monitored_regencies' => $regencies,
            'high_risk_villages' => $highRisk,
            'risk_population' => (int) $population,
            'validated_reports_this_month' => $validatedThisMonth,
        ]]);
    }
}
