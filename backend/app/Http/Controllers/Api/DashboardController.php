<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;

final class DashboardController
{
    public function operatorSummary(): JsonResponse
    {
        return response()->json(['data' => [
            'monitored_villages' => 42,
            'critical_villages' => 5,
            'pending_reports' => 14,
            'monthly_validations' => 128,
        ]]);
    }

    public function provinceSummary(): JsonResponse
    {
        return response()->json(['data' => [
            'monitored_regencies' => 15,
            'high_risk_villages' => 42,
            'risk_population' => 284000,
            'validated_reports_this_month' => 1204,
        ]]);
    }
}
