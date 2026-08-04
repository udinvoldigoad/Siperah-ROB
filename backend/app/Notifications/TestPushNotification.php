<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Notifikasi uji untuk memastikan Web Push benar-benar sampai ke perangkat.
 * Sengaja PUSH-ONLY: via() hanya WebPushChannel sehingga TIDAK menulis apa pun
 * ke database (tak ada baris inbox) â€” aman dipakai menguji tanpa mengotori data.
 */
class TestPushNotification extends Notification
{
    public function __construct(public string $note = '') {}

    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush($notifiable, $notification)
    {
        $time = now()->timezone('Asia/Jakarta')->format('H:i:s');
        $body = trim(($this->note !== '' ? $this->note.' ' : 'Push berhasil sampai di perangkat ini. ')."({$time} WIB)");

        return (new WebPushMessage)
            ->title('ðŸ”” Notifikasi Uji SAIBAR')
            ->icon('/logo.png')
            ->badge('/logo.png')
            ->body($body)
            ->action('Buka Aplikasi', '/#/notifications')
            ->data(['url' => '/#/notifications']);
    }
}

