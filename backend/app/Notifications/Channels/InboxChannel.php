<?php

namespace App\Notifications\Channels;

use Illuminate\Notifications\Notification;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class InboxChannel
{
    /**
     * Send the given notification.
     */
    public function send(object $notifiable, Notification $notification): void
    {
        if (method_exists($notification, 'toDatabase')) {
            $data = $notification->toDatabase($notifiable);
            
            DB::table('notification_inbox')->insert([
                'id' => (string) Str::uuid(),
                'user_id' => $notifiable->id,
                'type' => $data['type'] ?? 'general',
                'title' => $data['title'] ?? 'Notifikasi',
                'body' => $data['body'] ?? '',
                'data' => isset($data['data']) ? json_encode($data['data']) : null,
                'created_at' => now(),
            ]);
        }
    }
}
