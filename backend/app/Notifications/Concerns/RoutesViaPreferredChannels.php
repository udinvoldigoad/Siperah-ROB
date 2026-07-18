<?php

namespace App\Notifications\Concerns;

use App\Models\NotificationSetting;
use App\Notifications\Channels\InboxChannel;
use App\Notifications\Channels\MockWhatsAppChannel;
use NotificationChannels\WebPush\WebPushChannel;

/**
 * Pemilihan kanal berdasarkan preferensi user (notification_settings.channels).
 * Inbox selalu dikirim agar riwayat notifikasi tetap lengkap di aplikasi.
 */
trait RoutesViaPreferredChannels
{
    public function via(object $notifiable): array
    {
        $settings = NotificationSetting::where('user_id', $notifiable->id)->first();
        if (!$settings) {
            return [InboxChannel::class];
        }

        $channels = $settings->channels ?? [];
        $delivery = [InboxChannel::class];

        if (in_array('email', $channels, true)) {
            $delivery[] = 'mail';
        }
        if (in_array('browser', $channels, true)) {
            $delivery[] = WebPushChannel::class;
        }
        if (in_array('whatsapp', $channels, true)) {
            $delivery[] = MockWhatsAppChannel::class;
        }

        return $delivery;
    }
}
