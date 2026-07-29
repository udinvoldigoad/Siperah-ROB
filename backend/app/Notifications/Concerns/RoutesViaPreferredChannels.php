<?php

namespace App\Notifications\Concerns;

use App\Models\NotificationSetting;
use App\Notifications\Channels\InboxChannel;
use NotificationChannels\WebPush\WebPushChannel;

/**
 * Pemilihan kanal berdasarkan preferensi user (notification_settings.channels).
 * Inbox selalu dikirim agar riwayat notifikasi tetap lengkap di aplikasi.
 */
trait RoutesViaPreferredChannels
{
    public function via(object $notifiable): array
    {
        // Baris pengaturan dibuat MALAS (saat halaman notifikasi dibuka, atau
        // saat jalur notifikasi tertentu kebetulan memanggil settings()), jadi
        // banyak akun sah tak punya baris sama sekali. Dulu kondisi itu jatuh ke
        // inbox saja sehingga akun tersebut tidak pernah menerima email, padahal
        // defaultnya browser + email. Sekarang keduanya memakai konstanta sama.
        $settings = NotificationSetting::where('user_id', $notifiable->id)->first();
        // Sengaja lewat model (bukan ->value()) supaya cast array-nya jalan.
        // `[]` yang tersimpan berarti user memang mematikan semua kanal dan
        // harus dihormati; hanya ketiadaan nilai yang jatuh ke default.
        $channels = $settings?->channels ?? NotificationSetting::DEFAULT_CHANNELS;

        $delivery = [InboxChannel::class];

        if (in_array('email', $channels, true)) {
            $delivery[] = 'mail';
        }
        if (in_array('browser', $channels, true)) {
            $delivery[] = WebPushChannel::class;
        }

        return $delivery;
    }
}
