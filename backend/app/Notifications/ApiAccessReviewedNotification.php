<?php

namespace App\Notifications;

use App\Notifications\Concerns\RoutesViaPreferredChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Memberi tahu peneliti hasil peninjauan permohonan izin akses API oleh admin
 * (disetujui / ditolak). Selalu masuk inbox aplikasi; email/webpush mengikuti
 * preferensi kanal pengguna.
 */
class ApiAccessReviewedNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use RoutesViaPreferredChannels;

    public function __construct(
        public string $status,          // disetujui | ditolak
        public ?string $reviewNote = null,
    ) {
        $this->tries = 3;
    }

    public function toDatabase(object $notifiable): array
    {
        $approved = $this->status === 'disetujui';
        $title = $approved ? 'Izin akses API disetujui' : 'Izin akses API ditolak';
        $body = $approved
            ? 'Permohonan izin akses API Anda disetujui. Silakan buat kunci API di portal peneliti.'
            : 'Permohonan izin akses API Anda ditolak.';

        if (!$approved && $this->reviewNote) {
            $body .= " Alasan: {$this->reviewNote}";
        }

        return [
            'type' => 'api_access',
            'title' => $title,
            'body' => $body,
            'data' => [
                'status' => $this->status,
                'review_note' => $this->reviewNote,
            ],
        ];
    }

    public function toWebPush($notifiable, $notification)
    {
        $dbData = $this->toDatabase($notifiable);

        return (new WebPushMessage)
            ->title($dbData['title'])
            ->icon('/logo.png')
            ->body($dbData['body'])
            ->action('Buka Portal API', '/#/research')
            ->data(['url' => '/#/research']);
    }

    public function toWhatsApp($notifiable): string
    {
        $dbData = $this->toDatabase($notifiable);

        return "*{$dbData['title']}*\n{$dbData['body']}\n\nSilakan cek sistem SIPERAH-RoB.";
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);

        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Halo, '.($notifiable->name ?? 'Peneliti'))
            ->line($dbData['body'])
            ->action('Buka Portal Peneliti', url('/#/research'));
    }
}
