<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\NotificationSettingsRequest;
use App\Services\AuditService;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class NotificationController
{
    public function __construct(
        private readonly NotificationService $notifications,
        private readonly AuditService $audit,
    ) {}

    public function show(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->notifications->settings($request->user()->id)]);
    }

    public function index(Request $request): JsonResponse
    {
        $items = DB::table('notification_inbox')
            ->where('user_id', $request->user()->id)
            ->latest('created_at')
            ->paginate(30);

        return response()->json(['data' => $items->items(), 'meta' => [
            'current_page' => $items->currentPage(),
            'last_page' => $items->lastPage(),
            'total' => $items->total(),
        ]]);
    }

    public function markRead(Request $request, string $notification): JsonResponse
    {
        $updated = DB::table('notification_inbox')
            ->where('id', $notification)
            ->where('user_id', $request->user()->id)
            ->update(['read_at' => now()]);

        abort_if($updated === 0, 404, 'Notifikasi tidak ditemukan.');
        return response()->json(['data' => null, 'message' => 'Notifikasi ditandai sudah dibaca.']);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        DB::table('notification_inbox')
            ->where('user_id', $request->user()->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['data' => null, 'message' => 'Semua notifikasi ditandai sudah dibaca.']);
    }

    public function update(NotificationSettingsRequest $request): JsonResponse
    {
        $settings = $this->notifications->updateSettings($request->user()->id, $request->validated());
        $this->audit->write($request, 'update_notification_settings', 'success', "notification_settings:{$settings->id}", [
            'channels' => $settings->channels,
            'event_types' => $settings->event_types,
            'monitored_regions' => $settings->monitored_regions,
        ]);
        return response()->json(['data' => $settings, 'message' => 'Pengaturan notifikasi diperbarui.']);
    }

    public function vapidPublicKey(): JsonResponse
    {
        return response()->json([
            'data' => ['public_key' => config('webpush.vapid.public_key')]
        ]);
    }

    public function subscribeWebPush(Request $request): JsonResponse
    {
        $request->validate([
            'endpoint' => 'required',
            'keys.auth' => 'required',
            'keys.p256dh' => 'required'
        ]);

        $request->user()->updatePushSubscription(
            $request->endpoint,
            $request->keys['p256dh'],
            $request->keys['auth']
        );

        return response()->json(['message' => 'Berhasil mendaftar push notifikasi browser.']);
    }

    public function unsubscribeWebPush(Request $request): JsonResponse
    {
        $request->validate(['endpoint' => 'required']);
        $request->user()->deletePushSubscription($request->endpoint);
        
        return response()->json(['message' => 'Berhasil menghapus push notifikasi browser.']);
    }
}
