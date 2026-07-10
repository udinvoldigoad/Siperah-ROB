<?php

namespace App\Http\Controllers\Api;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class NotificationController
{
    private const DEFAULT_USER_ID = '22222222-2222-4222-8222-222222222222';

    public function show(Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? self::DEFAULT_USER_ID;

        $settings = DB::table('notification_settings')->where('user_id', $userId)->first();

        if (!$settings) {
            // Create default settings row
            $defaultSettings = [
                'id' => (string) Str::uuid(),
                'user_id' => $userId,
                'channels' => json_encode(['push_browser', 'email', 'whatsapp']),
                'event_types' => json_encode(['event_bahaya', 'event_laporan', 'event_pasang_ekstrem']),
                'quiet_start' => '22:00:00',
                'quiet_end' => '05:00:00',
                'monitored_regions' => json_encode(['Panjang Utara', 'Kalianda', 'Teluk Betung']),
            ];
            DB::table('notification_settings')->insert($defaultSettings);
            $settings = (object) $defaultSettings;
        }

        return response()->json([
            'data' => [
                'channels' => is_string($settings->channels) ? json_decode($settings->channels) : $settings->channels,
                'event_types' => is_string($settings->event_types) ? json_decode($settings->event_types) : $settings->event_types,
                'quiet_start' => $settings->quiet_start,
                'quiet_end' => $settings->quiet_end,
                'monitored_regions' => is_string($settings->monitored_regions) ? json_decode($settings->monitored_regions) : $settings->monitored_regions,
            ]
        ]);
    }

    public function update(Request $request): JsonResponse
    {
        $userId = $request->user()?->id ?? self::DEFAULT_USER_ID;

        $data = $request->validate([
            'channels' => ['required', 'array'],
            'event_types' => ['required', 'array'],
            'quiet_start' => ['nullable', 'string'],
            'quiet_end' => ['nullable', 'string'],
            'monitored_regions' => ['required', 'array'],
        ]);

        DB::table('notification_settings')->updateOrInsert(
            ['user_id' => $userId],
            [
                'id' => DB::raw('COALESCE(id, \'' . (string) Str::uuid() . '\')'),
                'channels' => json_encode($data['channels']),
                'event_types' => json_encode($data['event_types']),
                'quiet_start' => $data['quiet_start'],
                'quiet_end' => $data['quiet_end'],
                'monitored_regions' => json_encode($data['monitored_regions']),
            ]
        );

        return response()->json(['message' => 'Notification settings updated', 'data' => $data]);
    }
}
