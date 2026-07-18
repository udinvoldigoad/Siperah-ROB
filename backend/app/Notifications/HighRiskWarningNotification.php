<?php

namespace App\Notifications;

use App\Notifications\Concerns\RoutesViaPreferredChannels;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * Peringatan KRITIS: ada kelurahan berkelas risiko Sangat Tinggi pada prediksi
 * hari ini. Notifikasi ini sengaja TIDAK menghormati quiet hours — bahaya
 * keselamatan harus sampai kapan pun (lihat NotificationService yang tidak
 * memberi delay untuk notifikasi ini).
 *
 * @param string[] $regionNames Nama wilayah terdampak yang relevan bagi penerima.
 */
class HighRiskWarningNotification extends Notification implements ShouldQueue
{
    use Queueable;
    use RoutesViaPreferredChannels;

    public function __construct(
        public string $predictionDate,
        public array $regionNames,
        public int $totalRegions,
    ) {
        $this->tries = 3;
    }

    public function toDatabase(object $notifiable): array
    {
        $preview = implode(', ', array_slice($this->regionNames, 0, 3));
        $suffix = $this->totalRegions > 3 ? sprintf(' dan %d wilayah lain', $this->totalRegions - 3) : '';

        return [
            'type' => 'high_risk_warning',
            'title' => 'BAHAYA: risiko rob Sangat Tinggi hari ini',
            'body' => sprintf(
                'Prediksi %s: %d wilayah berkelas Sangat Tinggi (%s%s). Waspadai genangan saat pasang dan siapkan langkah antisipasi.',
                $this->predictionDate,
                $this->totalRegions,
                $preview,
                $suffix,
            ),
            'data' => [
                'prediction_date' => $this->predictionDate,
                'total_regions' => $this->totalRegions,
                'regions' => array_slice($this->regionNames, 0, 10),
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
            ->action('Buka Peta Bahaya', '/map')
            ->data(['prediction_date' => $this->predictionDate]);
    }

    public function toWhatsApp($notifiable): string
    {
        $dbData = $this->toDatabase($notifiable);

        return "🚨 *{$dbData['title']}*\n{$dbData['body']}\n\nPantau peta bahaya di SIPERAH-RoB.";
    }

    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);

        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Peringatan Bahaya Rob')
            ->line($dbData['body'])
            ->action('Buka Peta Bahaya', url('/map'));
    }
}
