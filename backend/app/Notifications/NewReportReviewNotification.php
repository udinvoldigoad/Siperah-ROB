<?php

namespace App\Notifications;

use App\Models\GroundTruthReport;
use App\Models\NotificationSetting;
use App\Notifications\Channels\MockWhatsAppChannel;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushMessage;
use NotificationChannels\WebPush\WebPushChannel;

class NewReportReviewNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public GroundTruthReport $report,
        public bool $isWithinMonitoringArea
    ) {
        // Tries can be configured here or in the class property
        $this->tries = 3;
    }

    /**
     * Get the notification's delivery channels.
     */
    public function via(object $notifiable): array
    {
        $settings = NotificationSetting::where('user_id', $notifiable->id)->first();
        if (!$settings) {
            return [\App\Notifications\Channels\InboxChannel::class]; // Default fallback
        }

        $channels = $settings->channels ?? [];
        $delivery = [\App\Notifications\Channels\InboxChannel::class]; // Always store in DB inbox

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

    /**
     * Get the database representation of the notification.
     */
    public function toDatabase(object $notifiable): array
    {
        $region = $this->report->region;
        $title = $this->isWithinMonitoringArea ? 'Laporan baru perlu validasi' : 'Laporan luar pantauan perlu triase';
        $location = trim(implode(', ', array_filter([$region?->village, $region?->district, $region?->regency])));
        
        return [
            'type' => 'report_review',
            'title' => $title,
            'body' => "Laporan {$this->report->report_code} masuk di {$location}.",
            'data' => [
                'report_id' => $this->report->id, 
                'report_code' => $this->report->report_code, 
                'status' => $this->report->status
            ]
        ];
    }

    /**
     * Get the web push representation of the notification.
     */
    public function toWebPush($notifiable, $notification)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new WebPushMessage)
            ->title($dbData['title'])
            ->icon('/logo.png')
            ->body($dbData['body'])
            ->action('Lihat Laporan', "/operator/reports/{$this->report->report_code}")
            ->data(['report_code' => $this->report->report_code]);
    }

    /**
     * Get the WhatsApp representation of the notification.
     */
    public function toWhatsApp($notifiable): string
    {
        $dbData = $this->toDatabase($notifiable);
        return "*{$dbData['title']}*\n{$dbData['body']}\n\nSilakan cek sistem SIPERAH-RoB.";
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable)
    {
        $dbData = $this->toDatabase($notifiable);
        return (new \Illuminate\Notifications\Messages\MailMessage)
            ->subject($dbData['title'])
            ->greeting('Halo, ' . ($notifiable->name ?? 'Petugas'))
            ->line($dbData['body'])
            ->action('Buka Sistem', url('/operator/reports/' . $this->report->report_code));
    }
}
