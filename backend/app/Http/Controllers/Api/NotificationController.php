<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class NotificationController
{
    public function show(): JsonResponse
    {
        return response()->json(['data' => [
            'channels' => ['push', 'email'],
            'event_types' => ['critical_risk', 'bmkg_extreme_tide'],
            'quiet_start' => '22:00',
            'quiet_end' => '05:00',
            'monitored_regions' => [],
        ]]);
    }

    public function update(Request $request): JsonResponse
    {
        return response()->json(['message' => 'Notification settings updated', 'data' => $request->all()]);
    }
}
