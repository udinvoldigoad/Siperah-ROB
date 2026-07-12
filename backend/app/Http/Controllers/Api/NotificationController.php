<?php

namespace App\Http\Controllers\Api;

use App\Http\Requests\NotificationSettingsRequest;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

final class NotificationController
{
    public function __construct(private readonly NotificationService $notifications) {}

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

    public function update(NotificationSettingsRequest $request): JsonResponse
    {
        $settings = $this->notifications->updateSettings($request->user()->id, $request->validated());
        return response()->json(['data' => $settings, 'message' => 'Pengaturan notifikasi diperbarui.']);
    }
}
